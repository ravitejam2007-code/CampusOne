-- ==============================================================================
-- CampusOne Migration 06: Checkout razorpay_order_id & Deterministic Queue Triggers
-- Odoo x NMIT 2026 Hackathon
-- ==============================================================================

-- 1. ADD RAZORPAY_ORDER_ID TO CHECKOUTS TABLE
alter table public.checkouts add column if not exists razorpay_order_id text;

-- 2. ENRICH INVENTORY FOR LOW-STOCK ACTION QUEUE RULE (< 5 units)
update public.product_variants
set stock_on_hand = 3, updated_at = now()
where sku = 'HOODIE-NAVY-XL';

-- 3. ENRICH OVERDUE TASK FOR VOLUNTEER ACTION QUEUE RULE
update public.tasks
set due_at = now() - interval '3 hours', status = 'todo', updated_at = now()
where id = '30000000-0000-0000-0000-000000000004';

-- 4. ADD WORKSHOP EVENT FOR LOW EVENT CAPACITY RULE (<= 15 tickets)
insert into public.events (
  id, organization_id, title, description, venue, starts_at, ends_at,
  registration_opens_at, registration_closes_at, capacity, reserved_capacity, sold_count, status
) values (
  'c0000000-0000-0000-0000-000000000002',
  'a0000000-0000-0000-0000-000000000001',
  'Skyline Leadership & Mentorship Mixer',
  'Intimate networking session with alumni founders, venture fellows, and faculty advisors.',
  'Innovation Hub Seminar Room 102',
  '2026-04-10 17:00:00+05:30',
  '2026-04-10 19:30:00+05:30',
  '2026-02-15 09:00:00+05:30',
  '2026-04-10 16:00:00+05:30',
  20,
  0,
  16,
  'published'
) on conflict (id) do nothing;

insert into public.ticket_types (
  id, event_id, name, price_paise, member_price_paise, capacity_limit, is_active
) values (
  'd0000000-0000-0000-0000-000000000003',
  'c0000000-0000-0000-0000-000000000002',
  'Mixer Seat Reservation',
  10000, -- ₹100.00
  0,     -- Free for members
  20,
  true
) on conflict (id) do nothing;

-- 5. TRIGGER INITIAL ACTION QUEUE REFRESH
select public.refresh_action_queue('a0000000-0000-0000-0000-000000000001');
