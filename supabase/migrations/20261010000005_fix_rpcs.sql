-- ==============================================================================
-- CampusOne Migration 05: RPC Search Path & HMAC Fixes
-- Odoo x NMIT 2026 Hackathon
-- Fix extensions.hmac in fulfill_checkout & optional p_buyer_id in create_checkout
-- ==============================================================================

-- 1. FIX FULFILL_CHECKOUT WITH SEARCH PATH & EXTENSIONS.HMAC
create or replace function public.fulfill_checkout(
  p_checkout_id uuid,
  p_payment_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_checkout record;
  v_item record;
  v_tickets_count integer := 0;
  v_merch_count integer := 0;
  v_membership_count integer := 0;
  v_ledger_id uuid;
  v_tier record;
  v_event_id uuid;
  v_qr_token text;
  v_i integer;
begin
  -- Lock checkout row
  select * into v_checkout
  from public.checkouts
  where id = p_checkout_id
  for update;

  if v_checkout.id is null then
    raise exception 'NOT_FOUND: Checkout % not found', p_checkout_id;
  end if;

  -- Idempotency check: if already fulfilled, return existing status safely
  if v_checkout.status = 'fulfilled' then
    select id into v_ledger_id
    from public.ledger_entries
    where source_type = 'checkout' and source_id = p_checkout_id;

    return jsonb_build_object(
      'checkout_id', p_checkout_id,
      'status', 'fulfilled',
      'already_fulfilled', true,
      'ledger_entry_id', v_ledger_id
    );
  end if;

  -- Process line items
  for v_item in select * from public.checkout_items where checkout_id = p_checkout_id
  loop
    if v_item.item_type = 'ticket' then
      select event_id into v_event_id from public.ticket_types where id = v_item.item_id;

      -- Issue individual tickets
      for v_i in 1..v_item.quantity loop
        -- Deterministic HMAC QR token representation using extensions.hmac
        v_qr_token := encode(extensions.hmac(concat(v_item.id::text, ':', v_i::text, ':', now()::text)::bytea, 'CAMPUSONE_SECRET_KEY'::bytea, 'sha256'), 'hex');

        insert into public.tickets (
          checkout_item_id, event_id, ticket_type_id, owner_id, qr_token, status
        ) values (
          v_item.id, v_event_id, v_item.item_id, v_checkout.buyer_id, v_qr_token, 'issued'
        );
        v_tickets_count := v_tickets_count + 1;
      end loop;

      -- Consume reservation & finalize sold count on event
      update public.events
      set reserved_capacity = greatest(0, reserved_capacity - v_item.quantity),
          sold_count = sold_count + v_item.quantity,
          updated_at = now()
      where id = v_event_id;

    elsif v_item.item_type = 'merch' then
      -- Finalize variant stock reduction
      update public.product_variants
      set reserved_quantity = greatest(0, reserved_quantity - v_item.quantity),
          stock_on_hand = greatest(0, stock_on_hand - v_item.quantity),
          updated_at = now()
      where id = v_item.item_id;

      v_merch_count := v_merch_count + v_item.quantity;

    elsif v_item.item_type = 'membership' then
      select * into v_tier from public.membership_tiers where id = v_item.item_id;

      -- Activate or extend membership
      insert into public.memberships (
        organization_id, user_id, tier_id, status, starts_at, expires_at
      ) values (
        v_checkout.organization_id, v_checkout.buyer_id, v_item.item_id, 'active',
        now(), now() + (v_tier.duration_days || ' days')::interval
      );

      -- Ensure role includes 'member'
      insert into public.user_roles (user_id, organization_id, role, granted_at)
      values (v_checkout.buyer_id, v_checkout.organization_id, 'member', now())
      on conflict (user_id, organization_id, role) do nothing;

      v_membership_count := v_membership_count + 1;
    end if;

    -- Mark item fulfilled
    update public.checkout_items
    set fulfilment_status = 'fulfilled'
    where id = v_item.id;
  end loop;

  -- Create single immutable ledger posting
  v_ledger_id := gen_random_uuid();
  insert into public.ledger_entries (
    id, organization_id, entry_type, amount_paise, category,
    source_type, source_id, payment_method, effective_date, recorded_by, notes
  ) values (
    v_ledger_id, v_checkout.organization_id, 'income', v_checkout.total_paise,
    'checkout', 'checkout', p_checkout_id, coalesce(v_checkout.payment_method, 'online'),
    current_date, coalesce(v_checkout.recorded_by, auth.uid(), v_checkout.buyer_id),
    coalesce(v_checkout.notes, 'Checkout fulfilment')
  );

  -- Update checkout status
  update public.checkouts
  set status = 'fulfilled',
      payment_status = case when payment_status = 'created' then 'captured' else payment_status end,
      updated_at = now()
  where id = p_checkout_id;

  -- Log to audit trail
  insert into public.audit_logs (
    actor_id, action, entity_type, entity_id, details
  ) values (
    coalesce(auth.uid(), v_checkout.buyer_id), 'FULFILL_CHECKOUT', 'checkouts', p_checkout_id,
    jsonb_build_object(
      'total_paise', v_checkout.total_paise,
      'tickets', v_tickets_count,
      'merch', v_merch_count,
      'membership', v_membership_count,
      'ledger_entry_id', v_ledger_id
    )
  );

  return jsonb_build_object(
    'checkout_id', p_checkout_id,
    'status', 'fulfilled',
    'tickets_issued', v_tickets_count,
    'merch_items_fulfilled', v_merch_count,
    'memberships_activated', v_membership_count,
    'ledger_entry_id', v_ledger_id
  );
end;
$$;

-- 2. FIX CREATE_CHECKOUT WITH SEARCH PATH & OPTIONAL BUYER ID
create or replace function public.create_checkout(
  p_items jsonb,
  p_payment_method text,
  p_idempotency_key text default null,
  p_notes text default null,
  p_buyer_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_user_id uuid := coalesce(auth.uid(), p_buyer_id);
  v_org_id uuid;
  v_checkout_id uuid;
  v_subtotal integer := 0;
  v_discount integer := 0;
  v_total integer := 0;
  v_item record;
  v_item_type text;
  v_item_id uuid;
  v_qty integer;
  v_unit_price integer;
  v_line_discount integer;
  v_line_total integer;
  v_ticket_disc_pct numeric := 0;
  v_merch_disc_pct numeric := 0;
  v_current_stock integer;
  v_current_cap integer;
  v_reserved_cap integer;
  v_sold_count integer;
  v_expires_at timestamptz := now() + interval '15 minutes';
begin
  if v_user_id is null then
    raise exception 'UNAUTHENTICATED: Must be signed in or specify buyer to create checkout';
  end if;

  if p_payment_method not in ('online', 'cash', 'manual_upi') then
    raise exception 'INVALID_REQUEST: Invalid payment method %', p_payment_method;
  end if;

  -- Staff role check for non-online checkouts
  if p_payment_method in ('cash', 'manual_upi') and auth.uid() is not null and not public.is_org_staff(auth.uid()) then
    raise exception 'FORBIDDEN: Only authorized staff can create cash or manual UPI checkout';
  end if;

  -- Idempotency check
  if p_idempotency_key is not null then
    select id, subtotal_paise, discount_paise, total_paise, status, payment_method
    into v_checkout_id, v_subtotal, v_discount, v_total, v_item_type, p_payment_method
    from public.checkouts
    where idempotency_key = p_idempotency_key;

    if v_checkout_id is not null then
      return jsonb_build_object(
        'checkout_id', v_checkout_id,
        'status', v_item_type,
        'subtotal_paise', v_subtotal,
        'discount_paise', v_discount,
        'total_paise', v_total,
        'currency', 'INR',
        'payment_method', p_payment_method,
        'idempotent_replay', true
      );
    end if;
  end if;

  -- Resolve organization_id from user or default demo org
  select organization_id into v_org_id
  from public.user_roles
  where user_id = v_user_id
  limit 1;

  if v_org_id is null then
    select id into v_org_id from public.organizations where status = 'active' limit 1;
  end if;

  -- Resolve user membership discount entitlement
  select mt.ticket_discount_percent, mt.merch_discount_percent
  into v_ticket_disc_pct, v_merch_disc_pct
  from public.memberships m
  join public.membership_tiers mt on mt.id = m.tier_id
  where m.user_id = v_user_id
    and m.organization_id = v_org_id
    and m.status = 'active'
    and m.expires_at > now()
  order by m.expires_at desc
  limit 1;

  v_ticket_disc_pct := coalesce(v_ticket_disc_pct, 0);
  v_merch_disc_pct := coalesce(v_merch_disc_pct, 0);

  -- Create checkout record
  v_checkout_id := gen_random_uuid();
  insert into public.checkouts (
    id, organization_id, buyer_id, status, currency,
    payment_method, idempotency_key, notes, expires_at
  ) values (
    v_checkout_id, v_org_id, v_user_id, 'pending_payment', 'INR',
    p_payment_method, p_idempotency_key, p_notes, v_expires_at
  );

  -- Validate and reserve line items atomically
  for v_item in select * from jsonb_to_recordset(p_items) as x(
    item_type text, item_id uuid, quantity integer
  )
  loop
    v_item_type := v_item.item_type;
    v_item_id := v_item.item_id;
    v_qty := coalesce(v_item.quantity, 1);

    if v_qty <= 0 then
      raise exception 'INVALID_REQUEST: Item quantity must be positive';
    end if;

    if v_item_type = 'ticket' then
      select tt.price_paise, e.capacity, e.reserved_capacity, e.sold_count
      into v_unit_price, v_current_cap, v_reserved_cap, v_sold_count
      from public.ticket_types tt
      join public.events e on e.id = tt.event_id
      where tt.id = v_item_id and tt.is_active = true and e.status = 'published'
      for update of e;

      if v_unit_price is null then
        raise exception 'NOT_FOUND: Ticket type % not found or event not active', v_item_id;
      end if;

      if (v_sold_count + v_reserved_cap + v_qty) > v_current_cap then
        raise exception 'CAPACITY_EXCEEDED: Requested % tickets but only % available',
          v_qty, (v_current_cap - v_sold_count - v_reserved_cap);
      end if;

      v_line_discount := round((v_unit_price * v_qty) * (v_ticket_disc_pct / 100.0));
      v_line_total := (v_unit_price * v_qty) - v_line_discount;

      -- Atomically reserve capacity on event
      update public.events
      set reserved_capacity = reserved_capacity + v_qty, updated_at = now()
      where id = (select event_id from public.ticket_types where id = v_item_id);

    elsif v_item_type = 'merch' then
      select pv.price_paise, pv.stock_on_hand, pv.reserved_quantity
      into v_unit_price, v_current_stock, v_reserved_cap
      from public.product_variants pv
      join public.products p on p.id = pv.product_id
      where pv.id = v_item_id and pv.is_active = true and p.status = 'published'
      for update of pv;

      if v_unit_price is null then
        raise exception 'NOT_FOUND: Product variant % not found or inactive', v_item_id;
      end if;

      if (v_reserved_cap + v_qty) > v_current_stock then
        raise exception 'OUT_OF_STOCK: Requested % units but only % available',
          v_qty, (v_current_stock - v_reserved_cap);
      end if;

      v_line_discount := round((v_unit_price * v_qty) * (v_merch_disc_pct / 100.0));
      v_line_total := (v_unit_price * v_qty) - v_line_discount;

      -- Atomically reserve stock
      update public.product_variants
      set reserved_quantity = reserved_quantity + v_qty, updated_at = now()
      where id = v_item_id;

    elsif v_item_type = 'membership' then
      select fee_paise into v_unit_price
      from public.membership_tiers
      where id = v_item_id and is_active = true;

      if v_unit_price is null then
        raise exception 'NOT_FOUND: Membership tier % not found or inactive', v_item_id;
      end if;

      v_line_discount := 0;
      v_line_total := v_unit_price * v_qty;
    else
      raise exception 'INVALID_REQUEST: Unsupported item type %', v_item_type;
    end if;

    -- Accumulate order totals
    v_subtotal := v_subtotal + (v_unit_price * v_qty);
    v_discount := v_discount + v_line_discount;
    v_total := v_total + v_line_total;

    -- Insert checkout item
    insert into public.checkout_items (
      checkout_id, item_type, item_id, quantity, captured_unit_price_paise,
      captured_discount_paise, line_total_paise, fulfilment_status
    ) values (
      v_checkout_id, v_item_type, v_item_id, v_qty, v_unit_price,
      v_line_discount, v_line_total, 'pending'
    );
  end loop;

  -- Update checkout with authoritative totals
  update public.checkouts
  set subtotal_paise = v_subtotal,
      discount_paise = v_discount,
      total_paise = v_total,
      updated_at = now()
  where id = v_checkout_id;

  return jsonb_build_object(
    'checkout_id', v_checkout_id,
    'status', 'pending_payment',
    'subtotal_paise', v_subtotal,
    'discount_paise', v_discount,
    'total_paise', v_total,
    'currency', 'INR',
    'payment_method', p_payment_method
  );
end;
$$;
