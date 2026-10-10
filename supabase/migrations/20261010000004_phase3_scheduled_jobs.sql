-- ==============================================================================
-- CampusOne Migration 04: Scheduled Jobs, Expiry Reminders & Stale Checkout Release
-- Odoo x NMIT 2026 Hackathon
-- Implements pg_cron jobs for 30/7 day membership renewal alerts and stale checkout expiry
-- ==============================================================================

-- 1. Enable pg_cron extension if supported
create extension if not exists pg_cron;

-- 2. Function: Generate Membership Expiry Reminders (30-day and 7-day)
create or replace function public.generate_membership_expiry_reminders()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer := 0;
  v_rec record;
  v_org_id uuid;
  v_dedupe_key text;
begin
  -- Scans active memberships expiring within 30 days
  for v_rec in
    select m.id as membership_id, m.organization_id, m.user_id, m.expires_at, p.full_name, p.email,
           case 
             when m.expires_at between (now() + interval '6 days') and (now() + interval '8 days') then '7_day'
             when m.expires_at between (now() + interval '29 days') and (now() + interval '31 days') then '30_day'
             else null
           end as reminder_type
    from public.memberships m
    join public.profiles p on p.id = m.user_id
    where m.status = 'active'
      and m.expires_at between now() and (now() + interval '30 days')
  loop
    if v_rec.reminder_type is not null then
      v_dedupe_key := concat('reminder:', v_rec.membership_id, ':', v_rec.reminder_type);

      -- Insert into membership_reminders table
      insert into public.membership_reminders (
        membership_id, user_id, reminder_type, scheduled_for, status
      ) values (
        v_rec.membership_id, v_rec.user_id, v_rec.reminder_type, now(), 'queued'
      ) on conflict (membership_id, reminder_type) do nothing;

      -- Push to Action Queue for Treasurer / Staff action
      insert into public.action_queue_items (
        organization_id, action_type, source_type, source_id, title, reason,
        next_action, priority, status, assigned_role, dedupe_key
      ) values (
        v_rec.organization_id,
        'membership_renewal',
        'memberships',
        v_rec.membership_id,
        concat('Membership Expiring (', v_rec.reminder_type, '): ', v_rec.full_name),
        concat('Member subscription expires on ', to_char(v_rec.expires_at, 'YYYY-MM-DD HH24:MI TZD')),
        'Send renewal reminder notice or process annual dues payment',
        case when v_rec.reminder_type = '7_day' then 'urgent' else 'medium' end,
        'open',
        'treasurer',
        v_dedupe_key
      ) on conflict (dedupe_key) do nothing;

      v_count := v_count + 1;
    end if;
  end loop;

  return v_count;
end;
$$;

-- 3. Function: Expire Stale Checkouts & Release Reserved Capacity/Stock
create or replace function public.expire_stale_checkouts()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_expired_count integer := 0;
  v_checkout record;
  v_item record;
  v_event_id uuid;
begin
  -- Find pending checkouts past expiry window (expires_at < now())
  for v_checkout in
    select id, organization_id, buyer_id
    from public.checkouts
    where status in ('pending_payment', 'draft')
      and expires_at < now()
    for update skip locked
  loop
    -- Release reservations for line items
    for v_item in
      select id, item_type, item_id, quantity
      from public.checkout_items
      where checkout_id = v_checkout.id
    loop
      if v_item.item_type = 'ticket' then
        select event_id into v_event_id
        from public.ticket_types
        where id = v_item.item_id;

        if v_event_id is not null then
          update public.events
          set reserved_capacity = greatest(0, reserved_capacity - v_item.quantity),
              updated_at = now()
          where id = v_event_id;
        end if;

      elsif v_item.item_type = 'merch' then
        update public.product_variants
        set reserved_quantity = greatest(0, reserved_quantity - v_item.quantity),
            updated_at = now()
        where id = v_item.item_id;
      end if;

      -- Mark line item cancelled
      update public.checkout_items
      set fulfilment_status = 'cancelled'
      where id = v_item.id;
    end loop;

    -- Update checkout status to expired
    update public.checkouts
    set status = 'expired',
        payment_status = 'failed',
        updated_at = now()
    where id = v_checkout.id;

    -- Log to audit trail
    insert into public.audit_logs (
      actor_id, action, entity_type, entity_id, details
    ) values (
      v_checkout.buyer_id, 'EXPIRE_STALE_CHECKOUT', 'checkouts', v_checkout.id,
      jsonb_build_object('reason', 'Payment window expired (15 min limit)', 'expired_at', now())
    );

    v_expired_count := v_expired_count + 1;
  end loop;

  return v_expired_count;
end;
$$;

-- 4. Register pg_cron Job Schedules
do $$
begin
  -- Schedule daily 30/7 day membership renewal reminder scan at 08:00 UTC
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    -- Unsched existing jobs safely if re-running migration
    perform cron.unschedule('membership-expiry-reminders') where exists (select 1 from cron.job where jobname = 'membership-expiry-reminders');
    perform cron.unschedule('expire-stale-checkouts') where exists (select 1 from cron.job where jobname = 'expire-stale-checkouts');

    perform cron.schedule(
      'membership-expiry-reminders',
      '0 8 * * *',
      'SELECT public.generate_membership_expiry_reminders();'
    );

    -- Schedule stale checkout release every 15 minutes
    perform cron.schedule(
      'expire-stale-checkouts',
      '*/15 * * * *',
      'SELECT public.expire_stale_checkouts();'
    );
  end if;
exception
  when others then
    -- Gracefully fallback if pg_cron is restricted in current database privileges
    null;
end;
$$;
