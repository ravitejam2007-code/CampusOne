-- ==============================================================================
-- CampusOne Migration 08: Upcoming Event Dates & Enhanced All-in-One Pass
-- Odoo x NMIT 2026 Hackathon
-- ==============================================================================

-- 1. UPDATE SPRING GALA 2026 DATES TO UPCOMING ACADEMIC SCHEDULE
update public.events
set starts_at = now() + interval '14 days 18 hours',
    ends_at = now() + interval '14 days 23 hours',
    registration_opens_at = now() - interval '7 days',
    registration_closes_at = now() + interval '14 days 17 hours',
    updated_at = now()
where id = 'c0000000-0000-0000-0000-000000000001';

update public.events
set starts_at = now() + interval '5 days 17 hours',
    ends_at = now() + interval '5 days 20 hours',
    registration_opens_at = now() - interval '5 days',
    registration_closes_at = now() + interval '5 days 16 hours',
    updated_at = now()
where id = 'c0000000-0000-0000-0000-000000000002';

-- 2. ENHANCE GENERATE_STUDENT_ALL_IN_ONE_PASS TO AUTHORITATIVELY INCLUDE ALL ACTIVE EVENT TICKETS
create or replace function public.generate_student_all_in_one_pass(
  p_user_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_caller_id uuid := auth.uid();
  v_target_id uuid;
  v_profile record;
  v_mem record;
  v_events jsonb := '[]'::jsonb;
  v_sig text;
  v_pass_token text;
  v_membership_info jsonb;
  v_student_info jsonb;
  v_now timestamptz := now();
  v_days_left integer := 0;
begin
  -- Target defaults to authenticated user if not provided
  v_target_id := coalesce(p_user_id, v_caller_id);

  if v_target_id is null then
    raise exception 'UNAUTHENTICATED: Must be signed in or provide a valid user_id';
  end if;

  -- Security check: callers can only generate passes for themselves unless they are organization staff
  if v_caller_id is not null and v_caller_id != v_target_id and not public.is_org_staff(v_caller_id) then
    raise exception 'FORBIDDEN: Only authorized staff or the student can generate this identification pass';
  end if;

  -- 1. Fetch Student Profile
  select id, full_name, email, student_id, avatar_url into v_profile
  from public.profiles
  where id = v_target_id;

  if v_profile.id is null then
    raise exception 'NOT_FOUND: Student profile % not found', v_target_id;
  end if;

  v_student_info := jsonb_build_object(
    'user_id', v_profile.id,
    'full_name', v_profile.full_name,
    'email', v_profile.email,
    'student_id', coalesce(v_profile.student_id, 'N/A')
  );

  -- 2. Fetch Active / Latest Membership & Tier Details
  select
    m.id as membership_id,
    m.tier_id,
    m.status,
    m.starts_at,
    m.expires_at,
    mt.name as tier_name,
    mt.ticket_discount_percent,
    mt.merch_discount_percent,
    mt.benefits
  into v_mem
  from public.memberships m
  join public.membership_tiers mt on mt.id = m.tier_id
  where m.user_id = v_target_id
  order by (case when m.status = 'active' and m.expires_at > v_now then 1 else 2 end), m.expires_at desc
  limit 1;

  if v_mem.membership_id is not null and v_mem.status = 'active' and v_mem.expires_at > v_now then
    v_days_left := greatest(0, ceil(extract(epoch from (v_mem.expires_at - v_now)) / 86400.0)::integer);
    v_membership_info := jsonb_build_object(
      'is_member', true,
      'status', 'active',
      'membership_id', v_mem.membership_id,
      'tier_id', v_mem.tier_id,
      'tier_name', v_mem.tier_name,
      'starts_at', v_mem.starts_at,
      'expires_at', v_mem.expires_at,
      'days_remaining', v_days_left,
      'ticket_discount_percent', coalesce(v_mem.ticket_discount_percent, 0),
      'merch_discount_percent', coalesce(v_mem.merch_discount_percent, 0),
      'benefits', coalesce(v_mem.benefits, '[]'::jsonb)
    );
  elsif v_mem.membership_id is not null then
    v_membership_info := jsonb_build_object(
      'is_member', false,
      'status', 'expired',
      'membership_id', v_mem.membership_id,
      'tier_id', v_mem.tier_id,
      'tier_name', v_mem.tier_name,
      'starts_at', v_mem.starts_at,
      'expires_at', v_mem.expires_at,
      'days_remaining', 0,
      'ticket_discount_percent', 0,
      'merch_discount_percent', 0,
      'benefits', '[]'::jsonb
    );
  else
    v_membership_info := jsonb_build_object(
      'is_member', false,
      'status', 'none',
      'membership_id', null,
      'tier_id', null,
      'tier_name', null,
      'starts_at', null,
      'expires_at', null,
      'days_remaining', 0,
      'ticket_discount_percent', 0,
      'merch_discount_percent', 0,
      'benefits', '[]'::jsonb
    );
  end if;

  -- 3. Fetch All Active & Issued Event Tickets for the Student
  select coalesce(jsonb_agg(
    jsonb_build_object(
      'ticket_id', t.id,
      'event_id', e.id,
      'event_title', e.title,
      'venue', e.venue,
      'starts_at', e.starts_at,
      'ends_at', e.ends_at,
      'ticket_type_id', tt.id,
      'ticket_type_name', tt.name,
      'status', t.status,
      'qr_token', t.qr_token,
      'issued_at', t.issued_at
    ) order by e.starts_at asc
  ), '[]'::jsonb) into v_events
  from public.tickets t
  join public.events e on e.id = t.event_id
  join public.ticket_types tt on tt.id = t.ticket_type_id
  where t.owner_id = v_target_id
    and t.status in ('issued', 'checked_in');

  -- 4. Generate Cryptographic Server HMAC Signature
  v_sig := encode(
    extensions.hmac(
      concat(
        'SKYPASS:',
        v_target_id::text, ':',
        coalesce(v_mem.tier_id::text, 'nomem'), ':',
        jsonb_array_length(v_events)::text, ':',
        to_char(v_now, 'YYYYMMDD')
      )::bytea,
      'CAMPUSONE_SECRET_KEY'::bytea,
      'sha256'
    ),
    'hex'
  );

  -- 5. Format Compact Token for QR Code Scanning
  v_pass_token := concat('SKYPASS:v1:', v_target_id::text, ':', substring(v_sig from 1 for 16));

  -- 6. Return Structured Unified Pass
  return jsonb_build_object(
    'pass_token', v_pass_token,
    'pass_version', '1.0',
    'issuer', 'Skyline Student Association · CampusOne',
    'generated_at', v_now,
    'student', v_student_info,
    'membership', v_membership_info,
    'upcoming_events', v_events,
    'signature', v_sig
  );
end;
$$;
