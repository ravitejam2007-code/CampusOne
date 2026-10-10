-- ==============================================================================
-- CampusOne Migration 01: Core Architecture, Tables, Constraints & RLS Policies
-- Odoo x NMIT 2026 Hackathon
-- Covers Phase 1 Foundation & all 6 PDF Scenes
-- ==============================================================================

-- 1. EXTENSIONS & SCHEMAS
create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto";

-- 2. CORE IDENTITY & ORGANIZATIONS
create table if not exists public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  timezone text not null default 'Asia/Kolkata',
  currency text not null default 'INR',
  status text not null default 'active' check (status in ('active', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  email text not null unique,
  student_id text,
  phone text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  role text not null check (role in ('admin', 'treasurer', 'door_staff', 'volunteer', 'member')),
  granted_by uuid references public.profiles(id) on delete set null,
  granted_at timestamptz not null default now(),
  expires_at timestamptz,
  constraint user_roles_user_org_role_uniq unique(user_id, organization_id, role)
);

-- 4. SCENE 1: MEMBERSHIP MANAGEMENT
create table if not exists public.membership_tiers (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  description text,
  fee_paise integer not null check (fee_paise >= 0),
  duration_days integer not null default 365 check (duration_days > 0),
  ticket_discount_percent numeric not null default 0 check (ticket_discount_percent >= 0 and ticket_discount_percent <= 100),
  merch_discount_percent numeric not null default 0 check (merch_discount_percent >= 0 and merch_discount_percent <= 100),
  benefits jsonb not null default '[]'::jsonb,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.membership_applications (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  applicant_id uuid not null references public.profiles(id) on delete cascade,
  requested_tier_id uuid not null references public.membership_tiers(id) on delete restrict,
  status text not null default 'draft' check (status in ('draft', 'submitted', 'approved', 'rejected')),
  revision integer not null default 1 check (revision >= 1),
  statement text,
  reviewer_id uuid references public.profiles(id) on delete set null,
  rejection_reason text,
  submitted_at timestamptz,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.membership_application_reviews (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.membership_applications(id) on delete cascade,
  revision integer not null check (revision >= 1),
  reviewer_id uuid not null references public.profiles(id) on delete restrict,
  decision text not null check (decision in ('approved', 'rejected')),
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists public.memberships (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  tier_id uuid not null references public.membership_tiers(id) on delete restrict,
  status text not null default 'pending' check (status in ('pending', 'active', 'expired', 'cancelled')),
  starts_at timestamptz not null default now(),
  expires_at timestamptz not null,
  renewed_from_id uuid references public.memberships(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.membership_reminders (
  id uuid primary key default gen_random_uuid(),
  membership_id uuid not null references public.memberships(id) on delete cascade,
  reminder_kind text not null check (reminder_kind in ('30_day', '7_day')),
  due_date date not null,
  status text not null default 'pending' check (status in ('pending', 'sent', 'cancelled')),
  dedupe_key text not null unique,
  sent_at timestamptz,
  created_at timestamptz not null default now()
);

-- 5. SCENE 2: EVENTS & TICKETS
create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  title text not null,
  description text,
  venue text not null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  registration_opens_at timestamptz,
  registration_closes_at timestamptz,
  capacity integer not null check (capacity > 0),
  reserved_capacity integer not null default 0 check (reserved_capacity >= 0),
  sold_count integer not null default 0 check (sold_count >= 0),
  status text not null default 'draft' check (status in ('draft', 'published', 'archived', 'cancelled')),
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.ticket_types (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  name text not null,
  price_paise integer not null check (price_paise >= 0),
  member_price_paise integer check (member_price_paise is null or member_price_paise >= 0),
  capacity_limit integer check (capacity_limit is null or capacity_limit > 0),
  sales_start_at timestamptz,
  sales_end_at timestamptz,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

-- 6. SCENE 4: PRODUCTS & MERCHANDISE
create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  description text,
  image_path text,
  status text not null default 'draft' check (status in ('draft', 'published', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.product_variants (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  sku text not null unique,
  size text,
  color text,
  price_paise integer not null check (price_paise >= 0),
  stock_on_hand integer not null default 0 check (stock_on_hand >= 0),
  reserved_quantity integer not null default 0 check (reserved_quantity >= 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 7. CHECKOUTS, PAYMENTS & FULFILMENT
create table if not exists public.checkouts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  buyer_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'draft' check (status in ('draft', 'pending_payment', 'paid', 'recorded', 'fulfilled', 'cancelled', 'expired')),
  subtotal_paise integer not null default 0 check (subtotal_paise >= 0),
  discount_paise integer not null default 0 check (discount_paise >= 0),
  total_paise integer not null default 0 check (total_paise >= 0),
  currency text not null default 'INR',
  payment_method text check (payment_method is null or payment_method in ('online', 'cash', 'manual_upi')),
  payment_status text not null default 'created' check (payment_status in ('created', 'pending', 'captured', 'verified', 'failed')),
  source_reference text,
  idempotency_key text unique,
  recorded_by uuid references public.profiles(id) on delete set null,
  notes text,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.checkout_items (
  id uuid primary key default gen_random_uuid(),
  checkout_id uuid not null references public.checkouts(id) on delete cascade,
  item_type text not null check (item_type in ('ticket', 'merch', 'membership')),
  item_id uuid not null,
  quantity integer not null check (quantity > 0),
  captured_unit_price_paise integer not null check (captured_unit_price_paise >= 0),
  captured_discount_paise integer not null default 0 check (captured_discount_paise >= 0),
  line_total_paise integer not null check (line_total_paise >= 0),
  fulfilment_status text not null default 'pending' check (fulfilment_status in ('pending', 'fulfilled', 'cancelled')),
  created_at timestamptz not null default now()
);

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  checkout_id uuid not null references public.checkouts(id) on delete cascade,
  provider text not null check (provider in ('razorpay', 'cash', 'manual_upi')),
  provider_order_id text,
  provider_payment_id text,
  amount_paise integer not null check (amount_paise > 0),
  currency text not null default 'INR',
  status text not null default 'created' check (status in ('created', 'pending', 'captured', 'failed', 'refunded')),
  mode text not null default 'test' check (mode in ('test', 'live')),
  verification_metadata jsonb not null default '{}'::jsonb,
  verified_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.webhook_events (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  provider_event_id text not null unique,
  event_type text not null,
  payload_hash text not null,
  payload jsonb not null,
  status text not null default 'received' check (status in ('received', 'processed', 'ignored', 'failed')),
  processed_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.tickets (
  id uuid primary key default gen_random_uuid(),
  checkout_item_id uuid not null references public.checkout_items(id) on delete cascade,
  event_id uuid not null references public.events(id) on delete cascade,
  ticket_type_id uuid not null references public.ticket_types(id) on delete restrict,
  owner_id uuid not null references public.profiles(id) on delete cascade,
  qr_token text not null,
  status text not null default 'issued' check (status in ('issued', 'checked_in', 'cancelled')),
  issued_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table if not exists public.check_ins (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null unique references public.tickets(id) on delete cascade,
  event_id uuid not null references public.events(id) on delete cascade,
  checked_in_by uuid not null references public.profiles(id) on delete restrict,
  checked_in_at timestamptz not null default now()
);

-- 8. SCENE 3: ANNOUNCEMENTS & MAILING LIST
create table if not exists public.announcements (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  title text not null,
  body text not null,
  audience text not null default 'public' check (audience in ('all_members', 'active_members', 'volunteers', 'event_attendees', 'public')),
  status text not null default 'draft' check (status in ('draft', 'published', 'archived')),
  author_id uuid references public.profiles(id) on delete set null,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.mailing_list_preferences (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  email text not null,
  topic text not null default 'general',
  is_subscribed boolean not null default true,
  opt_out_token text unique,
  unsubscribed_at timestamptz,
  updated_at timestamptz not null default now()
);

-- 9. SCENE 5: FUNDRAISING & VOLUNTEER TASKS
create table if not exists public.fundraisers (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  title text not null,
  description text,
  goal_paise integer not null check (goal_paise > 0),
  raised_paise integer not null default 0 check (raised_paise >= 0),
  status text not null default 'active' check (status in ('draft', 'active', 'completed', 'archived')),
  starts_at timestamptz,
  ends_at timestamptz,
  owner_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  fundraiser_id uuid not null references public.fundraisers(id) on delete cascade,
  title text not null,
  description text,
  assigned_to uuid references public.profiles(id) on delete set null,
  priority text not null default 'medium' check (priority in ('low', 'medium', 'high', 'urgent')),
  status text not null default 'todo' check (status in ('todo', 'in_progress', 'done', 'cancelled')),
  due_at timestamptz,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.contributions (
  id uuid primary key default gen_random_uuid(),
  fundraiser_id uuid not null references public.fundraisers(id) on delete cascade,
  amount_paise integer not null check (amount_paise > 0),
  method text not null default 'cash' check (method in ('cash', 'online', 'manual_upi')),
  notes text,
  recorded_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

-- 10. SCENE 6: TREASURER, LEDGER & AUDITING
create table if not exists public.expenses (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  amount_paise integer not null check (amount_paise > 0),
  category text not null,
  description text not null,
  event_id uuid references public.events(id) on delete set null,
  fundraiser_id uuid references public.fundraisers(id) on delete set null,
  status text not null default 'submitted' check (status in ('submitted', 'approved', 'rejected', 'paid')),
  submitted_by uuid not null references public.profiles(id) on delete restrict,
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  paid_at timestamptz,
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists public.ledger_entries (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  entry_type text not null check (entry_type in ('income', 'expense', 'refund', 'adjustment')),
  amount_paise integer not null check (amount_paise > 0),
  category text not null,
  source_type text not null check (source_type in ('checkout', 'contribution', 'expense', 'refund', 'adjustment')),
  source_id uuid not null,
  payment_method text check (payment_method is null or payment_method in ('online', 'cash', 'manual_upi')),
  effective_date date not null default current_date,
  recorded_by uuid references public.profiles(id) on delete set null,
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references public.profiles(id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id uuid,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- 11. DETERMINISTIC ACTION QUEUE & NOTIFICATIONS
create table if not exists public.action_queue_rules (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  rule_key text not null unique,
  is_enabled boolean not null default true,
  threshold_value integer not null,
  description text,
  updated_at timestamptz not null default now()
);

create table if not exists public.action_queue_items (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  action_type text not null,
  source_type text not null,
  source_id uuid not null,
  title text not null,
  reason text not null,
  next_action text not null,
  priority text not null default 'medium' check (priority in ('low', 'medium', 'high', 'urgent')),
  status text not null default 'open' check (status in ('open', 'in_progress', 'resolved', 'dismissed')),
  assigned_role text,
  assigned_to uuid references public.profiles(id) on delete set null,
  due_at timestamptz,
  dedupe_key text not null unique,
  detected_at timestamptz not null default now(),
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.notification_jobs (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references public.profiles(id) on delete cascade,
  template text not null,
  source_event text not null,
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'pending' check (status in ('pending', 'sent', 'failed')),
  attempts integer not null default 0,
  provider_message_id text,
  dedupe_key text unique,
  created_at timestamptz not null default now()
);

-- ==============================================================================
-- 12. INDEXES (Foreign keys, status, dates, and RLS lookup columns)
-- ==============================================================================

create index if not exists idx_user_roles_user on public.user_roles(user_id);
create index if not exists idx_user_roles_org on public.user_roles(organization_id);
create index if not exists idx_user_roles_role on public.user_roles(role);

create index if not exists idx_membership_tiers_org on public.membership_tiers(organization_id);
create index if not exists idx_membership_tiers_active on public.membership_tiers(is_active);

create index if not exists idx_membership_apps_user on public.membership_applications(applicant_id);
create index if not exists idx_membership_apps_status on public.membership_applications(status);

create index if not exists idx_memberships_user on public.memberships(user_id);
create index if not exists idx_memberships_status on public.memberships(status);
create index if not exists idx_memberships_expiry on public.memberships(expires_at);

create index if not exists idx_events_org on public.events(organization_id);
create index if not exists idx_events_status on public.events(status);
create index if not exists idx_events_starts on public.events(starts_at);

create index if not exists idx_ticket_types_event on public.ticket_types(event_id);

create index if not exists idx_products_org on public.products(organization_id);
create index if not exists idx_product_variants_prod on public.product_variants(product_id);

create index if not exists idx_checkouts_buyer on public.checkouts(buyer_id);
create index if not exists idx_checkouts_status on public.checkouts(status);
create index if not exists idx_checkouts_idemp on public.checkouts(idempotency_key);

create index if not exists idx_checkout_items_checkout on public.checkout_items(checkout_id);
create index if not exists idx_payments_checkout on public.payments(checkout_id);

create index if not exists idx_tickets_owner on public.tickets(owner_id);
create index if not exists idx_tickets_event on public.tickets(event_id);
create index if not exists idx_tickets_qr on public.tickets(qr_token);

create index if not exists idx_check_ins_event on public.check_ins(event_id);

create index if not exists idx_announcements_org on public.announcements(organization_id);
create index if not exists idx_announcements_status on public.announcements(status);
create index if not exists idx_announcements_pub on public.announcements(published_at desc);

create index if not exists idx_fundraisers_org on public.fundraisers(organization_id);
create index if not exists idx_tasks_fundraiser on public.tasks(fundraiser_id);
create index if not exists idx_tasks_assignee on public.tasks(assigned_to);

create index if not exists idx_contributions_fundraiser on public.contributions(fundraiser_id);
create index if not exists idx_expenses_org on public.expenses(organization_id);

create index if not exists idx_ledger_org on public.ledger_entries(organization_id);
create index if not exists idx_ledger_source on public.ledger_entries(source_type, source_id);
create index if not exists idx_ledger_date on public.ledger_entries(effective_date desc);

create index if not exists idx_audit_actor on public.audit_logs(actor_id);
create index if not exists idx_audit_entity on public.audit_logs(entity_type, entity_id);

create index if not exists idx_action_queue_org on public.action_queue_items(organization_id);
create index if not exists idx_action_queue_status on public.action_queue_items(status);
create index if not exists idx_action_queue_dedupe on public.action_queue_items(dedupe_key);

-- ==============================================================================
-- 12. HELPER FUNCTIONS (Security Invoker / Definer for RLS)
-- ==============================================================================

create or replace function public.has_role(check_user_id uuid, check_role text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.user_roles
    where user_id = check_user_id
      and role = check_role
      and (expires_at is null or expires_at > now())
  );
$$;

create or replace function public.is_org_staff(check_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.user_roles
    where user_id = check_user_id
      and role in ('admin', 'treasurer', 'door_staff', 'volunteer')
      and (expires_at is null or expires_at > now())
  );
$$;

create or replace function public.is_org_admin(check_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.user_roles
    where user_id = check_user_id
      and role = 'admin'
      and (expires_at is null or expires_at > now())
  );
$$;

create or replace function public.get_user_discounts(check_user_id uuid)
returns table (ticket_discount numeric, merch_discount numeric)
language sql
stable
security definer
set search_path = public
as $$
  select 
    coalesce(max(mt.ticket_discount_percent), 0) as ticket_discount,
    coalesce(max(mt.merch_discount_percent), 0) as merch_discount
  from public.memberships m
  join public.membership_tiers mt on mt.id = m.tier_id
  where m.user_id = check_user_id
    and m.status = 'active'
    and m.expires_at > now();
$$;

-- ==============================================================================
-- 13. ROW LEVEL SECURITY (RLS) POLICIES
-- ==============================================================================

alter table public.organizations enable row level security;
alter table public.profiles enable row level security;
alter table public.user_roles enable row level security;
alter table public.membership_tiers enable row level security;
alter table public.membership_applications enable row level security;
alter table public.membership_application_reviews enable row level security;
alter table public.memberships enable row level security;
alter table public.membership_reminders enable row level security;
alter table public.events enable row level security;
alter table public.ticket_types enable row level security;
alter table public.products enable row level security;
alter table public.product_variants enable row level security;
alter table public.checkouts enable row level security;
alter table public.checkout_items enable row level security;
alter table public.payments enable row level security;
alter table public.webhook_events enable row level security;
alter table public.tickets enable row level security;
alter table public.check_ins enable row level security;
alter table public.announcements enable row level security;
alter table public.mailing_list_preferences enable row level security;
alter table public.fundraisers enable row level security;
alter table public.tasks enable row level security;
alter table public.contributions enable row level security;
alter table public.expenses enable row level security;
alter table public.ledger_entries enable row level security;
alter table public.audit_logs enable row level security;
alter table public.action_queue_rules enable row level security;
alter table public.action_queue_items enable row level security;
alter table public.notification_jobs enable row level security;

-- Organizations: readable by all authenticated, manageable by admin
create policy "organizations_select" on public.organizations
  for select to anon, authenticated using (true);

create policy "organizations_admin" on public.organizations
  for all to authenticated
  using (public.is_org_admin((select auth.uid())));

-- Profiles: readable by all authenticated, editable by owner or admin
create policy "profiles_select" on public.profiles
  for select to authenticated using (true);

create policy "profiles_update_own" on public.profiles
  for update to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

create policy "profiles_insert_own" on public.profiles
  for insert to authenticated
  with check ((select auth.uid()) = id);

-- User roles: readable by self or staff, insert/update by admin only
create policy "user_roles_select" on public.user_roles
  for select to authenticated
  using ((select auth.uid()) = user_id or public.is_org_staff((select auth.uid())));

create policy "user_roles_admin" on public.user_roles
  for all to authenticated
  using (public.is_org_admin((select auth.uid())));

-- Membership Tiers: active tiers public, admin full
create policy "membership_tiers_select" on public.membership_tiers
  for select to anon, authenticated using (is_active = true or public.is_org_staff((select auth.uid())));

create policy "membership_tiers_admin" on public.membership_tiers
  for all to authenticated
  using (public.is_org_admin((select auth.uid())));

-- Membership Applications: applicants see own; staff see all; admin reviews
create policy "membership_apps_select" on public.membership_applications
  for select to authenticated
  using ((select auth.uid()) = applicant_id or public.is_org_staff((select auth.uid())));

create policy "membership_apps_insert" on public.membership_applications
  for insert to authenticated
  with check ((select auth.uid()) = applicant_id);

create policy "membership_apps_update_applicant" on public.membership_applications
  for update to authenticated
  using ((select auth.uid()) = applicant_id and status in ('draft', 'rejected'))
  with check ((select auth.uid()) = applicant_id);

create policy "membership_apps_staff_update" on public.membership_applications
  for update to authenticated
  using (public.is_org_staff((select auth.uid())));

-- Membership Application Reviews: read by applicant or staff
create policy "membership_reviews_select" on public.membership_application_reviews
  for select to authenticated
  using (
    public.is_org_staff((select auth.uid())) or
    exists (
      select 1 from public.membership_applications a 
      where a.id = application_id and a.applicant_id = (select auth.uid())
    )
  );

-- Memberships: read own or staff
create policy "memberships_select" on public.memberships
  for select to authenticated
  using ((select auth.uid()) = user_id or public.is_org_staff((select auth.uid())));

-- Events & Ticket Types: published events public
create policy "events_select" on public.events
  for select to anon, authenticated
  using (status = 'published' or public.is_org_staff((select auth.uid())));

create policy "events_admin" on public.events
  for all to authenticated
  using (public.is_org_admin((select auth.uid())));

create policy "ticket_types_select" on public.ticket_types
  for select to anon, authenticated
  using (is_active = true or public.is_org_staff((select auth.uid())));

-- Products & Variants: published products public
create policy "products_select" on public.products
  for select to anon, authenticated
  using (status = 'published' or public.is_org_staff((select auth.uid())));

create policy "product_variants_select" on public.product_variants
  for select to anon, authenticated
  using (is_active = true or public.is_org_staff((select auth.uid())));

-- Checkouts & Items: buyer sees own; staff sees all
create policy "checkouts_select" on public.checkouts
  for select to authenticated
  using ((select auth.uid()) = buyer_id or public.is_org_staff((select auth.uid())));

create policy "checkout_items_select" on public.checkout_items
  for select to authenticated
  using (
    exists (
      select 1 from public.checkouts c 
      where c.id = checkout_id and (c.buyer_id = (select auth.uid()) or public.is_org_staff((select auth.uid())))
    )
  );

-- Tickets & Check-ins: owner sees own tickets, staff sees all
create policy "tickets_select" on public.tickets
  for select to authenticated
  using ((select auth.uid()) = owner_id or public.is_org_staff((select auth.uid())));

create policy "check_ins_select" on public.check_ins
  for select to authenticated
  using (public.is_org_staff((select auth.uid())));

-- Announcements: published public/all_members according to audience
create policy "announcements_select" on public.announcements
  for select to anon, authenticated
  using (
    status = 'published' and (
      audience = 'public' or
      (audience in ('all_members', 'active_members') and exists (
        select 1 from public.memberships m 
        where m.user_id = (select auth.uid()) and m.status = 'active' and m.expires_at > now()
      )) or
      public.is_org_staff((select auth.uid()))
    )
  );

create policy "announcements_admin" on public.announcements
  for all to authenticated
  using (public.is_org_admin((select auth.uid())));

-- Mailing list preferences: own preference
create policy "mailing_prefs_select" on public.mailing_list_preferences
  for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "mailing_prefs_modify" on public.mailing_list_preferences
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- Fundraisers & Tasks: active fundraiser public; tasks visible to volunteers/staff
create policy "fundraisers_select" on public.fundraisers
  for select to anon, authenticated
  using (status in ('active', 'completed') or public.is_org_staff((select auth.uid())));

create policy "tasks_select" on public.tasks
  for select to authenticated
  using (public.is_org_staff((select auth.uid())) or (select auth.uid()) = assigned_to);

create policy "tasks_update_assigned" on public.tasks
  for update to authenticated
  using (public.is_org_staff((select auth.uid())) or (select auth.uid()) = assigned_to)
  with check (public.is_org_staff((select auth.uid())) or (select auth.uid()) = assigned_to);

-- Contributions & Expenses: visible to staff/treasurer/admin
create policy "contributions_select" on public.contributions
  for select to authenticated
  using (public.is_org_staff((select auth.uid())));

create policy "expenses_select" on public.expenses
  for select to authenticated
  using (
    public.has_role((select auth.uid()), 'admin') or 
    public.has_role((select auth.uid()), 'treasurer') or 
    (select auth.uid()) = submitted_by
  );

-- Ledger Entries: treasurer and admin only (immutable source-linked ledger)
create policy "ledger_entries_select" on public.ledger_entries
  for select to authenticated
  using (
    public.has_role((select auth.uid()), 'admin') or 
    public.has_role((select auth.uid()), 'treasurer')
  );

-- Audit Logs: admin full, treasurer financial scope
create policy "audit_logs_select" on public.audit_logs
  for select to authenticated
  using (
    public.has_role((select auth.uid()), 'admin') or 
    public.has_role((select auth.uid()), 'treasurer')
  );

-- Action Queue: staff sees items according to role
create policy "action_queue_select" on public.action_queue_items
  for select to authenticated
  using (
    public.has_role((select auth.uid()), 'admin') or
    (public.has_role((select auth.uid()), 'treasurer') and action_type in ('reimbursement_review', 'membership_renewal')) or
    (public.has_role((select auth.uid()), 'door_staff') and action_type = 'low_event_availability') or
    (public.has_role((select auth.uid()), 'volunteer') and action_type = 'overdue_task')
  );
