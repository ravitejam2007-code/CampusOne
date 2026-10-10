-- ==============================================================================
-- Migration: 20261010000010_user_profiles_and_registration.sql
-- Description: Automatic user profile creation trigger, register_user_profile RPC,
--              and permissive RLS for seamless registration of real student profiles.
-- ==============================================================================

-- 1. Automatic trigger function when new users sign up via auth.users
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_role text := coalesce(new.raw_user_meta_data->>'role', 'member');
  v_full_name text := coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1));
  v_student_id text := coalesce(new.raw_user_meta_data->>'student_id', 'SKY-2026-' || lpad(floor(random() * 9000 + 1000)::text, 4, '0'));
  v_org_id uuid := 'a0000000-0000-0000-0000-000000000001';
  v_tier_id uuid := 'b0000000-0000-0000-0000-000000000001';
begin
  -- Insert into public.profiles
  insert into public.profiles (id, full_name, email, student_id)
  values (new.id, v_full_name, new.email, v_student_id)
  on conflict (id) do update
  set full_name = excluded.full_name,
      student_id = coalesce(public.profiles.student_id, excluded.student_id),
      updated_at = now();

  -- Insert user role
  insert into public.user_roles (user_id, organization_id, role)
  values (new.id, v_org_id, v_role)
  on conflict (user_id, organization_id, role) do nothing;

  -- If student member, provision default active membership
  if v_role in ('member', 'active_member') then
    insert into public.memberships (
      organization_id,
      user_id,
      tier_id,
      status,
      starts_at,
      expires_at
    )
    values (
      v_org_id,
      new.id,
      v_tier_id,
      'active',
      now(),
      now() + interval '365 days'
    )
    on conflict do nothing;
  end if;

  return new;
end;
$$;

-- Drop if exists and recreate trigger
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- 2. Explicit security definer RPC for client or edge function profile provisioning
create or replace function public.register_user_profile(
  p_user_id uuid,
  p_full_name text,
  p_email text,
  p_student_id text default null,
  p_role text default 'member'
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_org_id uuid := 'a0000000-0000-0000-0000-000000000001';
  v_student_id text := coalesce(p_student_id, 'SKY-2026-' || lpad(floor(random() * 9000 + 1000)::text, 4, '0'));
  v_tier_id uuid := 'b0000000-0000-0000-0000-000000000001';
  v_result jsonb;
begin
  insert into public.profiles (id, full_name, email, student_id)
  values (p_user_id, p_full_name, p_email, v_student_id)
  on conflict (id) do update
  set full_name = excluded.full_name,
      student_id = coalesce(public.profiles.student_id, excluded.student_id),
      updated_at = now();

  insert into public.user_roles (user_id, organization_id, role)
  values (p_user_id, v_org_id, p_role)
  on conflict (user_id, organization_id, role) do nothing;

  if p_role in ('member', 'active_member') then
    insert into public.memberships (
      organization_id,
      user_id,
      tier_id,
      status,
      starts_at,
      expires_at
    )
    values (
      v_org_id,
      p_user_id,
      v_tier_id,
      'active',
      now(),
      now() + interval '365 days'
    )
    on conflict do nothing;
  end if;

  select jsonb_build_object(
    'success', true,
    'user_id', p_user_id,
    'full_name', p_full_name,
    'email', p_email,
    'student_id', v_student_id,
    'role', p_role
  ) into v_result;

  return v_result;
end;
$$;

grant execute on function public.register_user_profile(uuid, text, text, text, text) to anon, authenticated, service_role;

-- 3. Ensure profiles are visible and manageable
drop policy if exists "profiles_select_all" on public.profiles;
create policy "profiles_select_all" on public.profiles
  for select to anon, authenticated using (true);

drop policy if exists "profiles_insert_permissive" on public.profiles;
create policy "profiles_insert_permissive" on public.profiles
  for insert to anon, authenticated with check (true);

drop policy if exists "profiles_update_permissive" on public.profiles;
create policy "profiles_update_permissive" on public.profiles
  for update to anon, authenticated using (true) with check (true);
