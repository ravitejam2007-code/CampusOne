-- ==============================================================================
-- CampusOne Migration 03: Demo Club Seed Data (P0 Grounded Verification)
-- Odoo x NMIT 2026 Hackathon
-- Real persisted records for "CampusOne Demo Club" covering all 6 scenes
-- ==============================================================================

-- 1. DEMO ORGANIZATION
insert into public.organizations (id, name, timezone, currency, status)
values (
  'a0000000-0000-0000-0000-000000000001',
  'CampusOne Demo Club',
  'Asia/Kolkata',
  'INR',
  'active'
) on conflict (id) do update set name = excluded.name;

-- 2. SCENE 1: MEMBERSHIP TIERS
insert into public.membership_tiers (
  id, organization_id, name, description, fee_paise, duration_days,
  ticket_discount_percent, merch_discount_percent, benefits, is_active
) values
(
  'b0000000-0000-0000-0000-000000000001',
  'a0000000-0000-0000-0000-000000000001',
  'General Student Member',
  'Standard annual membership for all Skyline College students with full club privileges.',
  25000, -- ₹250.00
  365,
  15, -- 15% off Gala & event tickets
  10, -- 10% off club merchandise
  '["Access to all general meetings & workshops", "15% discount on Gala tickets", "10% discount on club merchandise", "Voting eligibility in annual elections", "Official membership certificate"]'::jsonb,
  true
),
(
  'b0000000-0000-0000-0000-000000000002',
  'a0000000-0000-0000-0000-000000000001',
  'Executive / Patron Member',
  'Premium tier for student leaders, donors, and alumni champions.',
  50000, -- ₹500.00
  365,
  25, -- 25% off event tickets
  20, -- 20% off club merchandise
  '["All General benefits included", "Priority VIP seating at Spring Gala", "20% discount on club merchandise", "Free limited-edition club lapel pin", "Executive committee voting rights", "Direct mentorship mixer invites"]'::jsonb,
  true
),
(
  'b0000000-0000-0000-0000-000000000003',
  'a0000000-0000-0000-0000-000000000001',
  'Honorary Member',
  'Complimentary tier for guest speakers, faculty advisors, and honorary members.',
  0, -- Free
  365,
  10,
  5,
  '["Faculty & advisory council recognition", "Invitations to open galas and panel talks", "Bi-weekly newsletter updates"]'::jsonb,
  true
)
on conflict (id) do nothing;

-- 3. SCENE 2: SPRING GALA 2026 EVENT & TICKET TYPES
insert into public.events (
  id, organization_id, title, description, venue, starts_at, ends_at,
  registration_opens_at, registration_closes_at, capacity, reserved_capacity, sold_count, status
) values (
  'c0000000-0000-0000-0000-000000000001',
  'a0000000-0000-0000-0000-000000000001',
  'Spring Gala 2026',
  'The flagship annual banquet and social of Skyline Student Association featuring keynote presentations, dinner, awards, and entertainment.',
  'Skyline Grand Ballroom, Student Activity Center',
  '2026-04-18 18:30:00+05:30',
  '2026-04-18 23:00:00+05:30',
  '2026-02-01 09:00:00+05:30',
  '2026-04-18 17:00:00+05:30',
  250,
  0,
  0,
  'published'
) on conflict (id) do nothing;

insert into public.ticket_types (
  id, event_id, name, price_paise, member_price_paise, capacity_limit, is_active
) values
(
  'd0000000-0000-0000-0000-000000000001',
  'c0000000-0000-0000-0000-000000000001',
  'General Admission Ticket',
  25000, -- ₹250.00 (Members get 15% discount applied at checkout -> ₹212.50)
  21250,
  200,
  true
),
(
  'd0000000-0000-0000-0000-000000000002',
  'c0000000-0000-0000-0000-000000000001',
  'VIP Patron Ticket',
  50000, -- ₹500.00
  37500,
  50,
  true
)
on conflict (id) do nothing;

-- 4. SCENE 4: MERCHANDISE PRODUCTS & VARIANTS
insert into public.products (
  id, organization_id, name, description, image_path, status
) values
(
  'e0000000-0000-0000-0000-000000000001',
  'a0000000-0000-0000-0000-000000000001',
  'Skyline Club Navy Hoodie',
  'Custom heavyweight 380 GSM fleece pullover with collegiate crest embroidery, double-lined hood, and kangaroo pocket.',
  '/images/merch-hoodie.png',
  'published'
),
(
  'e0000000-0000-0000-0000-000000000002',
  'a0000000-0000-0000-0000-000000000001',
  'Skyline Club Classic Tee',
  '100% combed cotton jersey t-shirt with screen-printed skyline geometric logo. Preshrunk and breathable.',
  '/images/merch-tee.png',
  'published'
)
on conflict (id) do nothing;

insert into public.product_variants (
  id, product_id, sku, size, color, price_paise, stock_on_hand, reserved_quantity, is_active
) values
-- Navy Hoodie Variants
('f0000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000001', 'HOODIE-NAVY-S', 'S', 'Navy Blue', 85000, 15, 0, true),
('f0000000-0000-0000-0000-000000000002', 'e0000000-0000-0000-0000-000000000001', 'HOODIE-NAVY-M', 'M', 'Navy Blue', 85000, 25, 0, true),
('f0000000-0000-0000-0000-000000000003', 'e0000000-0000-0000-0000-000000000001', 'HOODIE-NAVY-L', 'L', 'Navy Blue', 85000, 30, 0, true),
('f0000000-0000-0000-0000-000000000004', 'e0000000-0000-0000-0000-000000000001', 'HOODIE-NAVY-XL', 'XL', 'Navy Blue', 85000, 10, 0, true),
-- Classic Tee Variants
('f0000000-0000-0000-0000-000000000005', 'e0000000-0000-0000-0000-000000000002', 'TEE-WHITE-S', 'S', 'White', 40000, 20, 0, true),
('f0000000-0000-0000-0000-000000000006', 'e0000000-0000-0000-0000-000000000002', 'TEE-WHITE-M', 'M', 'White', 40000, 35, 0, true),
('f0000000-0000-0000-0000-000000000007', 'e0000000-0000-0000-0000-000000000002', 'TEE-WHITE-L', 'L', 'White', 40000, 25, 0, true)
on conflict (id) do nothing;

-- 5. SCENE 3: ANNOUNCEMENTS
insert into public.announcements (
  id, organization_id, title, body, audience, status, published_at
) values
(
  '10000000-0000-0000-0000-000000000001',
  'a0000000-0000-0000-0000-000000000001',
  'Welcome to Spring Semester 2026!',
  'Welcome back students! Join us this Thursday at 5:00 PM in the Student Commons for our semester kickoff and project showcase.',
  'public',
  'published',
  now() - interval '2 days'
),
(
  '10000000-0000-0000-0000-000000000002',
  'a0000000-0000-0000-0000-000000000001',
  'Member Exclusive: Spring Gala Early-Bird Tickets Open',
  'Active members can now reserve their Gala tickets with automatic 15% discount applied at checkout. Door tickets will be capped at remaining capacity.',
  'all_members',
  'published',
  now() - interval '1 day'
)
on conflict (id) do nothing;

-- 6. SCENE 5: FUNDRAISER & VOLUNTEER TASKS
insert into public.fundraisers (
  id, organization_id, title, description, goal_paise, raised_paise, status, starts_at, ends_at
) values (
  '20000000-0000-0000-0000-000000000001',
  'a0000000-0000-0000-0000-000000000001',
  'Spring Bake Sale & Charity Drive',
  'Annual quad bake sale raising funds for student travel grants and local food bank donations.',
  1000000, -- ₹10,000.00 Goal
  0,       -- Raised to date (derived from contributions)
  'active',
  now() - interval '3 days',
  now() + interval '14 days'
) on conflict (id) do nothing;

insert into public.tasks (
  id, fundraiser_id, title, description, priority, status, due_at
) values
(
  '30000000-0000-0000-0000-000000000001',
  '20000000-0000-0000-0000-000000000001',
  'Bake 4 dozen double chocolate brownies',
  'Package in individual biodegradable boxes with clear allergen labels.',
  'high',
  'in_progress',
  now() + interval '1 day'
),
(
  '30000000-0000-0000-0000-000000000002',
  '20000000-0000-0000-0000-000000000001',
  'Set up folding tables and quad canopy',
  'Collect two 10x10 blue canopies from club storage room 204.',
  'medium',
  'todo',
  now() + interval '2 days'
),
(
  '30000000-0000-0000-0000-000000000003',
  '20000000-0000-0000-0000-000000000001',
  'Print allergen warning notices & price board',
  'Gluten-free, vegan, nut-free labels must be placed beside each display tray.',
  'high',
  'done',
  now() - interval '1 day'
),
(
  '30000000-0000-0000-0000-000000000004',
  '20000000-0000-0000-0000-000000000001',
  'Pick up cash lockbox and ₹100 change float from treasurer',
  'Audited cash handoff required before desk opens at 10:00 AM.',
  'urgent',
  'todo',
  now() + interval '2 days'
)
on conflict (id) do nothing;

-- 7. ACTION QUEUE RULES
insert into public.action_queue_rules (
  organization_id, rule_key, is_enabled, threshold_value, description
) values
('a0000000-0000-0000-0000-000000000001', 'membership_renewal_days', true, 30, 'Trigger renewal notice when membership expires within N days'),
('a0000000-0000-0000-0000-000000000001', 'low_event_availability', true, 15, 'Warn staff when available event tickets drop below N units'),
('a0000000-0000-0000-0000-000000000001', 'low_merch_stock', true, 5, 'Alert admin when merchandise variant stock drops below N units')
on conflict (rule_key) do nothing;
