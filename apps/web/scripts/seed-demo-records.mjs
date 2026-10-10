import { createClient } from '@supabase/supabase-js';
import { existsSync } from 'node:fs';

// Load .env file natively
if (existsSync('.env')) {
  process.loadEnvFile('.env');
} else if (existsSync('../../.env')) {
  process.loadEnvFile('../../.env');
}

const SUPABASE_URL = process.env.PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('CRITICAL: PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be in .env');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const DEMO_ORG_ID = 'a0000000-0000-0000-0000-000000000001';
const GENERAL_TIER_ID = 'b0000000-0000-0000-0000-000000000001';
const GALA_EVENT_ID = 'c0000000-0000-0000-0000-000000000001';
const GENERAL_TICKET_TYPE_ID = 'd0000000-0000-0000-0000-000000000001';

async function seedDemoRecords() {
  console.log('--- Seeding Live Demo Records into Supabase ---');

  // Fetch profiles
  const { data: profiles, error: profErr } = await supabase.from('profiles').select('*');
  if (profErr || !profiles) {
    console.error('Failed to query profiles:', profErr);
    return;
  }

  const rahul = profiles.find((p) => p.email === 'member@skyline.edu');
  const priya = profiles.find((p) => p.email === 'applicant@skyline.edu');
  const admin = profiles.find((p) => p.email === 'admin@skyline.edu');
  const treasurer = profiles.find((p) => p.email === 'treasurer@skyline.edu');

  if (!rahul || !priya) {
    console.error('Missing rahul or priya profiles');
    return;
  }

  // 1. Seed Active Membership for Rahul Sharma
  console.log(`Checking Active Membership for Rahul Sharma (${rahul.id})...`);
  const { data: existingMems } = await supabase
    .from('memberships')
    .select('id')
    .eq('user_id', rahul.id)
    .eq('status', 'active');

  if (!existingMems || existingMems.length === 0) {
    const { error: memErr } = await supabase.from('memberships').insert([{
      organization_id: DEMO_ORG_ID,
      user_id: rahul.id,
      tier_id: GENERAL_TIER_ID,
      status: 'active',
      starts_at: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
      expires_at: new Date(Date.now() + 335 * 24 * 60 * 60 * 1000).toISOString(),
    }]);

    if (memErr) {
      console.warn('Membership insert warning:', memErr.message);
    } else {
      console.log('✅ Rahul Sharma active membership seeded.');
    }
  } else {
    console.log('Active membership already exists for Rahul.');
  }

  // 2. Seed Submitted Membership Application for Priya Nair
  console.log(`Checking Submitted Application for Priya Nair (${priya.id})...`);
  const { data: existingApp } = await supabase
    .from('membership_applications')
    .select('id')
    .eq('applicant_id', priya.id)
    .maybeSingle();

  if (!existingApp) {
    const { error: appErr } = await supabase.from('membership_applications').insert([{
      organization_id: DEMO_ORG_ID,
      applicant_id: priya.id,
      requested_tier_id: GENERAL_TIER_ID,
      status: 'submitted',
      revision: 1,
      statement: 'Passionate about student advocacy and organizing technical workshops on AI and open source software.',
      submitted_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    }]);

    if (appErr) {
      console.warn('Application insert warning:', appErr.message);
    } else {
      console.log('✅ Priya Nair application seeded.');
    }
  } else {
    console.log('Priya Nair application already exists.');
  }

  // 3. Seed Ticket for Rahul Sharma via authoritative checkout RPC
  console.log('Checking Spring Gala ticket for Rahul Sharma...');
  const { data: existingTicket } = await supabase
    .from('tickets')
    .select('id, qr_token')
    .eq('owner_id', rahul.id)
    .maybeSingle();

  if (!existingTicket) {
    console.log('Creating checkout for Spring Gala ticket for Rahul...');
    const checkoutId = crypto.randomUUID();
    const itemId = crypto.randomUUID();

    const { error: chkErr } = await supabase.from('checkouts').insert([{
      id: checkoutId,
      organization_id: DEMO_ORG_ID,
      buyer_id: rahul.id,
      status: 'pending_payment',
      subtotal_paise: 25000,
      discount_paise: 3750, // 15% discount for member
      total_paise: 21250,
      currency: 'INR',
      payment_method: 'online',
      payment_status: 'captured',
      notes: 'Demo VIP Gala Ticket Purchase'
    }]);

    if (chkErr) {
      console.warn('checkout insert error:', chkErr.message);
    } else {
      await supabase.from('checkout_items').insert([{
        id: itemId,
        checkout_id: checkoutId,
        item_type: 'ticket',
        item_id: GENERAL_TICKET_TYPE_ID,
        quantity: 1,
        captured_unit_price_paise: 25000,
        captured_discount_paise: 3750,
        line_total_paise: 21250,
        fulfilment_status: 'pending'
      }]);

      console.log('Fulfilling checkout:', checkoutId);
      const { data: fulfilRes, error: fulErr } = await supabase.rpc('fulfill_checkout', {
        p_checkout_id: checkoutId,
      });
      if (fulErr) {
        console.warn('fulfill_checkout error:', fulErr.message);
      } else {
        console.log('✅ Ticket fulfilled and issued:', fulfilRes);
      }
    }
  } else {
    console.log('Ticket already exists for Rahul with QR token:', existingTicket.qr_token);
  }

  // 4. Seed Mailing List Preferences
  console.log('Seeding mailing preferences...');
  const topics = [
    { topic: 'events', label: 'Event Invitations & Announcements', is_subscribed: true },
    { topic: 'general_announcements', label: 'Club News & Bi-weekly Bulletins', is_subscribed: true },
    { topic: 'volunteer_opportunities', label: 'Volunteer Callouts & Civic Service', is_subscribed: true },
    { topic: 'merchandise_drops', label: 'Merchandise Drop Alerts & Early Access', is_subscribed: false },
  ];

  for (const p of profiles) {
    for (const t of topics) {
      await supabase.from('mailing_list_preferences').upsert({
        user_id: p.id,
        topic: t.topic,
        is_subscribed: t.is_subscribed,
      }, { onConflict: 'user_id,topic' });
    }
  }
  console.log('✅ Mailing preferences seeded for all profiles.');

  // 5. Populate Action Queue via RPC
  console.log('Triggering deterministic Action Queue refresh...');
  const { data: aqCount, error: aqErr } = await supabase.rpc('refresh_action_queue', {
    p_org_id: DEMO_ORG_ID,
  });

  if (aqErr) {
    console.warn('refresh_action_queue RPC warning:', aqErr.message);
  } else {
    console.log(`✅ Action Queue populated with ${aqCount} items.`);
  }

  console.log('--- Seeding Demo Records Complete ---');
}

seedDemoRecords();
