-- ==============================================================================
-- CampusOne Migration 02: Core Database RPCs & Financial Transaction Engine
-- Odoo x NMIT 2026 Hackathon
-- Atomic capacity/inventory reservations, idempotent fulfilment, audited ledger
-- ==============================================================================

-- 1. RPC: CREATE UNIFIED CHECKOUT
create or replace function public.create_checkout(
  p_items jsonb,
  p_payment_method text,
  p_idempotency_key text,
  p_notes text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
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
    raise exception 'UNAUTHENTICATED: Must be signed in to create checkout';
  end if;

  if p_payment_method not in ('online', 'cash', 'manual_upi') then
    raise exception 'INVALID_REQUEST: Invalid payment method %', p_payment_method;
  end if;

  -- Staff role check for non-online checkouts (cash / manual_upi cannot be self-asserted by members)
  if p_payment_method in ('cash', 'manual_upi') and not public.is_org_staff(v_user_id) then
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
        'payment_method', p_payment_method
      );
    end if;
  end if;

  -- Get active membership discount percentages for buyer
  select ticket_discount, merch_discount
  into v_ticket_disc_pct, v_merch_disc_pct
  from public.get_user_discounts(v_user_id);

  -- Fetch default demo organization
  select id into v_org_id from public.organizations where status = 'active' limit 1;
  if v_org_id is null then
    raise exception 'INTERNAL_ERROR: No active organization found';
  end if;

  -- Generate checkout ID
  v_checkout_id := gen_random_uuid();

  -- Insert checkout header in 'pending_payment' (or 'draft')
  insert into public.checkouts (
    id, organization_id, buyer_id, status, subtotal_paise, discount_paise, total_paise,
    currency, payment_method, payment_status, idempotency_key, expires_at, notes, recorded_by
  ) values (
    v_checkout_id, v_org_id, v_user_id, 'pending_payment', 0, 0, 0,
    'INR', p_payment_method, 'pending', p_idempotency_key, v_expires_at, p_notes,
    case when p_payment_method in ('cash', 'manual_upi') then v_user_id else null end
  );

  -- Process line items with atomic reservation
  for v_item in select * from jsonb_to_recordset(p_items) as x(item_type text, item_id uuid, quantity int)
  loop
    v_item_type := v_item.item_type;
    v_item_id := v_item.item_id;
    v_qty := coalesce(v_item.quantity, 1);

    if v_qty <= 0 then
      raise exception 'INVALID_REQUEST: Item quantity must be positive';
    end if;

    if v_item_type = 'ticket' then
      -- Lock event row for atomic capacity check
      select tt.price_paise, e.capacity, e.reserved_capacity, e.sold_count
      into v_unit_price, v_current_cap, v_reserved_cap, v_sold_count
      from public.ticket_types tt
      join public.events e on e.id = tt.event_id
      where tt.id = v_item_id
      for update of e;

      if v_unit_price is null then
        raise exception 'NOT_FOUND: Ticket type % not found', v_item_id;
      end if;

      if (v_sold_count + v_reserved_cap + v_qty) > v_current_cap then
        raise exception 'CONFLICT: Event capacity exceeded. Available: %', (v_current_cap - v_sold_count - v_reserved_cap);
      end if;

      -- Calculate member discount
      v_line_discount := round((v_unit_price * v_qty) * (v_ticket_disc_pct / 100.0));
      v_line_total := (v_unit_price * v_qty) - v_line_discount;

      -- Reserve event capacity
      update public.events
      set reserved_capacity = reserved_capacity + v_qty, updated_at = now()
      where id = (select event_id from public.ticket_types where id = v_item_id);

    elsif v_item_type = 'merch' then
      -- Lock product variant for atomic stock reservation
      select price_paise, stock_on_hand, reserved_quantity
      into v_unit_price, v_current_stock, v_reserved_cap
      from public.product_variants
      where id = v_item_id
      for update;

      if v_unit_price is null then
        raise exception 'NOT_FOUND: Product variant % not found', v_item_id;
      end if;

      if (v_current_stock - v_reserved_cap) < v_qty then
        raise exception 'CONFLICT: Insufficient stock for variant %. Available: %', v_item_id, (v_current_stock - v_reserved_cap);
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

-- 2. RPC: IDEMPOTENT FULFILMENT & SOURCE-LINKED LEDGER POSTING
create or replace function public.fulfill_checkout(
  p_checkout_id uuid,
  p_payment_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
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
        -- Deterministic HMAC QR token representation
        v_qr_token := encode(hmac(concat(v_item.id::text, ':', v_i::text, ':', now()::text), 'CAMPUSONE_SECRET_KEY', 'sha256'), 'hex');

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
    'checkout', 'checkout', p_checkout_id, v_checkout.payment_method,
    current_date, coalesce(v_checkout.recorded_by, auth.uid()),
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

-- 3. RPC: RECORD AUDITED STAFF PAYMENT (Cash & Manual UPI)
create or replace function public.record_staff_payment(
  p_checkout_id uuid,
  p_payment_method text,
  p_amount_paise integer,
  p_reference text default null,
  p_notes text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_staff_id uuid := auth.uid();
  v_checkout record;
  v_payment_id uuid := gen_random_uuid();
  v_fulfil_res jsonb;
begin
  if not public.is_org_staff(v_staff_id) then
    raise exception 'FORBIDDEN: Only authorized staff can record cash/manual UPI payments';
  end if;

  if p_payment_method not in ('cash', 'manual_upi') then
    raise exception 'INVALID_REQUEST: Method must be cash or manual_upi';
  end if;

  select * into v_checkout
  from public.checkouts
  where id = p_checkout_id
  for update;

  if v_checkout.id is null then
    raise exception 'NOT_FOUND: Checkout % not found', p_checkout_id;
  end if;

  if v_checkout.status in ('fulfilled', 'cancelled', 'expired') then
    raise exception 'CONFLICT: Checkout cannot be paid in status %', v_checkout.status;
  end if;

  if p_amount_paise != v_checkout.total_paise then
    raise exception 'VALIDATION_ERROR: Amount provided (%) does not match checkout total (%)', p_amount_paise, v_checkout.total_paise;
  end if;

  -- Record payment
  insert into public.payments (
    id, checkout_id, provider, amount_paise, status, mode,
    provider_payment_id, verification_metadata, verified_at
  ) values (
    v_payment_id, p_checkout_id, p_payment_method, p_amount_paise, 'captured', 'test',
    p_reference, jsonb_build_object('recorded_by', v_staff_id, 'notes', p_notes), now()
  );

  -- Update checkout status
  update public.checkouts
  set status = 'recorded',
      payment_method = p_payment_method,
      payment_status = 'captured',
      recorded_by = v_staff_id,
      notes = coalesce(p_notes, notes),
      updated_at = now()
  where id = p_checkout_id;

  -- Fulfill atomically
  v_fulfil_res := public.fulfill_checkout(p_checkout_id, v_payment_id);

  return v_fulfil_res;
end;
$$;

-- 4. RPC: RECORD CASH BAKE-SALE CONTRIBUTION (Scene 5)
create or replace function public.record_cash_contribution(
  p_fundraiser_id uuid,
  p_amount_paise integer,
  p_method text default 'cash',
  p_notes text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_staff_id uuid := auth.uid();
  v_contrib_id uuid := gen_random_uuid();
  v_ledger_id uuid := gen_random_uuid();
  v_fundraiser record;
begin
  if not public.is_org_staff(v_staff_id) then
    raise exception 'FORBIDDEN: Only authorized staff or volunteers can record contributions';
  end if;

  if p_amount_paise <= 0 then
    raise exception 'INVALID_REQUEST: Contribution amount must be positive';
  end if;

  select * into v_fundraiser
  from public.fundraisers
  where id = p_fundraiser_id
  for update;

  if v_fundraiser.id is null then
    raise exception 'NOT_FOUND: Fundraiser % not found', p_fundraiser_id;
  end if;

  -- Insert contribution
  insert into public.contributions (
    id, fundraiser_id, amount_paise, method, notes, recorded_by
  ) values (
    v_contrib_id, p_fundraiser_id, p_amount_paise, p_method, p_notes, v_staff_id
  );

  -- Update raised amount atomically
  update public.fundraisers
  set raised_paise = raised_paise + p_amount_paise, updated_at = now()
  where id = p_fundraiser_id;

  -- Post to immutable ledger
  insert into public.ledger_entries (
    id, organization_id, entry_type, amount_paise, category,
    source_type, source_id, payment_method, effective_date, recorded_by, notes
  ) values (
    v_ledger_id, v_fundraiser.organization_id, 'income', p_amount_paise, 'fundraiser',
    'contribution', v_contrib_id, p_method, current_date, v_staff_id,
    coalesce(p_notes, 'Fundraiser cash contribution')
  );

  -- Audit log
  insert into public.audit_logs (
    actor_id, action, entity_type, entity_id, details
  ) values (
    v_staff_id, 'RECORD_CONTRIBUTION', 'contributions', v_contrib_id,
    jsonb_build_object(
      'fundraiser_id', p_fundraiser_id,
      'amount_paise', p_amount_paise,
      'method', p_method,
      'ledger_entry_id', v_ledger_id
    )
  );

  return jsonb_build_object(
    'contribution_id', v_contrib_id,
    'fundraiser_id', p_fundraiser_id,
    'amount_paise', p_amount_paise,
    'new_raised_paise', (v_fundraiser.raised_paise + p_amount_paise),
    'ledger_entry_id', v_ledger_id
  );
end;
$$;

-- 5. RPC: ATOMIC DOOR CHECK-IN (Scene 2)
create or replace function public.check_in_ticket(
  p_ticket_id uuid,
  p_qr_token text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_staff_id uuid := auth.uid();
  v_ticket record;
  v_profile record;
  v_check_in_id uuid := gen_random_uuid();
begin
  if not public.is_org_staff(v_staff_id) then
    raise exception 'FORBIDDEN: Only authorized door staff can check in attendees';
  end if;

  select * into v_ticket
  from public.tickets
  where id = p_ticket_id
  for update;

  if v_ticket.id is null then
    raise exception 'NOT_FOUND: Ticket % not found', p_ticket_id;
  end if;

  if p_qr_token is not null and v_ticket.qr_token != p_qr_token then
    raise exception 'FORBIDDEN: Invalid QR token verification signature';
  end if;

  if v_ticket.status = 'checked_in' then
    raise exception 'CONFLICT: Ticket already checked in';
  end if;

  if v_ticket.status = 'cancelled' then
    raise exception 'CONFLICT: Ticket has been cancelled';
  end if;

  -- Record check-in
  insert into public.check_ins (
    id, ticket_id, event_id, checked_in_by, checked_in_at
  ) values (
    v_check_in_id, p_ticket_id, v_ticket.event_id, v_staff_id, now()
  );

  -- Update ticket
  update public.tickets
  set status = 'checked_in'
  where id = p_ticket_id;

  select full_name into v_profile
  from public.profiles
  where id = v_ticket.owner_id;

  insert into public.audit_logs (
    actor_id, action, entity_type, entity_id, details
  ) values (
    v_staff_id, 'CHECK_IN_TICKET', 'tickets', p_ticket_id,
    jsonb_build_object('event_id', v_ticket.event_id, 'attendee', v_profile.full_name)
  );

  return jsonb_build_object(
    'valid', true,
    'ticket_id', p_ticket_id,
    'status', 'checked_in',
    'checked_in_at', now(),
    'attendee_name', coalesce(v_profile.full_name, 'Guest')
  );
end;
$$;

-- 6. RPC: TREASURER FINANCIAL OVERVIEW (Scene 6)
create or replace function public.get_treasurer_overview(
  p_org_id uuid,
  p_start_date date default null,
  p_end_date date default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_caller_id uuid := auth.uid();
  v_income_total integer := 0;
  v_expense_total integer := 0;
  v_net_movement integer := 0;
  v_by_method jsonb;
  v_by_source jsonb;
begin
  if not (public.has_role(v_caller_id, 'treasurer') or public.has_role(v_caller_id, 'admin')) then
    raise exception 'FORBIDDEN: Only treasurer or admin can view financial overview';
  end if;

  -- Money In (Recorded Income)
  select coalesce(sum(amount_paise), 0) into v_income_total
  from public.ledger_entries
  where organization_id = p_org_id
    and entry_type = 'income'
    and (p_start_date is null or effective_date >= p_start_date)
    and (p_end_date is null or effective_date <= p_end_date);

  -- Money Out (Expenses & Approved Outflows)
  select coalesce(sum(amount_paise), 0) into v_expense_total
  from public.ledger_entries
  where organization_id = p_org_id
    and entry_type in ('expense', 'refund')
    and (p_start_date is null or effective_date >= p_start_date)
    and (p_end_date is null or effective_date <= p_end_date);

  v_net_movement := v_income_total - v_expense_total;

  -- Breakdown by Payment Method
  select jsonb_build_object(
    'online', coalesce(sum(case when payment_method = 'online' then amount_paise else 0 end), 0),
    'cash', coalesce(sum(case when payment_method = 'cash' then amount_paise else 0 end), 0),
    'manual_upi', coalesce(sum(case when payment_method = 'manual_upi' then amount_paise else 0 end), 0)
  ) into v_by_method
  from public.ledger_entries
  where organization_id = p_org_id
    and entry_type = 'income'
    and (p_start_date is null or effective_date >= p_start_date)
    and (p_end_date is null or effective_date <= p_end_date);

  -- Breakdown by Source / Category
  select jsonb_build_object(
    'dues', coalesce(sum(case when category = 'membership' then amount_paise else 0 end), 0),
    'tickets', coalesce(sum(case when category = 'tickets' then amount_paise else 0 end), 0),
    'merch', coalesce(sum(case when category = 'merch' then amount_paise else 0 end), 0),
    'fundraiser', coalesce(sum(case when category = 'fundraiser' then amount_paise else 0 end), 0),
    'other', coalesce(sum(case when category not in ('membership', 'tickets', 'merch', 'fundraiser') then amount_paise else 0 end), 0)
  ) into v_by_source
  from public.ledger_entries
  where organization_id = p_org_id
    and entry_type = 'income'
    and (p_start_date is null or effective_date >= p_start_date)
    and (p_end_date is null or effective_date <= p_end_date);

  return jsonb_build_object(
    'period', jsonb_build_object(
      'start_date', coalesce(p_start_date, '2026-01-01'::date),
      'end_date', coalesce(p_end_date, current_date)
    ),
    'total_income_paise', v_income_total,
    'total_expense_paise', v_expense_total,
    'net_recorded_movement_paise', v_net_movement,
    'by_method', v_by_method,
    'by_source', v_by_source
  );
end;
$$;

-- 7. RPC: REFRESH DETERMINISTIC ACTION QUEUE
create or replace function public.refresh_action_queue(p_org_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer := 0;
  v_rec record;
begin
  -- Rule 1: Memberships expiring within 30 days
  for v_rec in
    select m.id, m.user_id, p.full_name, m.expires_at
    from public.memberships m
    join public.profiles p on p.id = m.user_id
    where m.organization_id = p_org_id
      and m.status = 'active'
      and m.expires_at between now() and (now() + interval '30 days')
  loop
    insert into public.action_queue_items (
      organization_id, action_type, source_type, source_id, title, reason,
      next_action, priority, status, assigned_role, dedupe_key
    ) values (
      p_org_id, 'membership_renewal', 'memberships', v_rec.id,
      concat('Membership Expiring: ', v_rec.full_name),
      concat('Member subscription expires on ', to_char(v_rec.expires_at, 'YYYY-MM-DD')),
      'Send renewal notice or initiate dues checkout',
      'medium', 'open', 'treasurer',
      concat('renewal:', v_rec.id, ':', to_char(v_rec.expires_at, 'YYYYMMDD'))
    ) on conflict (dedupe_key) do nothing;
    v_count := v_count + 1;
  end loop;

  -- Rule 2: Low event availability (< 15 tickets remaining)
  for v_rec in
    select id, title, (capacity - sold_count - reserved_capacity) as remaining
    from public.events
    where organization_id = p_org_id
      and status = 'published'
      and (capacity - sold_count - reserved_capacity) <= 15
  loop
    insert into public.action_queue_items (
      organization_id, action_type, source_type, source_id, title, reason,
      next_action, priority, status, assigned_role, dedupe_key
    ) values (
      p_org_id, 'low_event_availability', 'events', v_rec.id,
      concat('Low Capacity: ', v_rec.title),
      concat('Only ', v_rec.remaining, ' tickets remaining before sellout'),
      'Review venue capacity limit or close online registrations',
      'high', 'open', 'door_staff',
      concat('low_cap:', v_rec.id)
    ) on conflict (dedupe_key) do update
      set reason = concat('Only ', v_rec.remaining, ' tickets remaining before sellout');
    v_count := v_count + 1;
  end loop;

  -- Rule 3: Overdue tasks
  for v_rec in
    select t.id, t.title, t.due_at, f.title as fundraiser_name
    from public.tasks t
    join public.fundraisers f on f.id = t.fundraiser_id
    where f.organization_id = p_org_id
      and t.status != 'done'
      and t.due_at < now()
  loop
    insert into public.action_queue_items (
      organization_id, action_type, source_type, source_id, title, reason,
      next_action, priority, status, assigned_role, dedupe_key
    ) values (
      p_org_id, 'overdue_task', 'tasks', v_rec.id,
      concat('Overdue Task: ', v_rec.title),
      concat('Task was due on ', to_char(v_rec.due_at, 'YYYY-MM-DD')),
      'Contact volunteer assignee or update completion status',
      'urgent', 'open', 'volunteer',
      concat('overdue_task:', v_rec.id)
    ) on conflict (dedupe_key) do nothing;
    v_count := v_count + 1;
  end loop;

  -- Rule 4: Low merchandise stock (< 5 units)
  for v_rec in
    select pv.id, p.name, pv.sku, (pv.stock_on_hand - pv.reserved_quantity) as remaining
    from public.product_variants pv
    join public.products p on p.id = pv.product_id
    where p.organization_id = p_org_id
      and pv.is_active = true
      and (pv.stock_on_hand - pv.reserved_quantity) <= 5
  loop
    insert into public.action_queue_items (
      organization_id, action_type, source_type, source_id, title, reason,
      next_action, priority, status, assigned_role, dedupe_key
    ) values (
      p_org_id, 'low_stock', 'product_variants', v_rec.id,
      concat('Low Stock: ', v_rec.name, ' (', v_rec.sku, ')'),
      concat('Available inventory down to ', v_rec.remaining, ' units'),
      'Order re-stock or adjust online catalog availability',
      'medium', 'open', 'admin',
      concat('low_stock:', v_rec.id)
    ) on conflict (dedupe_key) do update
      set reason = concat('Available inventory down to ', v_rec.remaining, ' units');
    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;
