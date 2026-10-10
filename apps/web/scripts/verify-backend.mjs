import { createClient } from '@supabase/supabase-js';
import { existsSync } from 'node:fs';

if (existsSync('.env')) {
  process.loadEnvFile('.env');
} else if (existsSync('../../.env')) {
  process.loadEnvFile('../../.env');
}

const url = process.env.PUBLIC_SUPABASE_URL;
const anonKey = process.env.PUBLIC_SUPABASE_ANON_KEY;

console.log('--- Testing Live RPCs with Authenticated User Session ---');

const client = createClient(url, anonKey);

async function testAuthenticatedRPCs() {
  // Sign in as Treasurer Devansh Verma
  const { data: authData, error: authError } = await client.auth.signInWithPassword({
    email: 'treasurer@skyline.edu',
    password: 'SkylineDemo2026!'
  });

  if (authError) {
    console.error('❌ Sign-in failed:', authError.message);
    return;
  }

  console.log(`✅ Authenticated as: ${authData.user.email} (ID: ${authData.user.id})`);

  const orgId = 'a0000000-0000-0000-0000-000000000001';

  // 1. Call get_treasurer_overview as Treasurer
  const { data: treasury, error: errTreasury } = await client.rpc('get_treasurer_overview', {
    p_org_id: orgId
  });

  if (errTreasury) {
    console.log(`❌ RPC [get_treasurer_overview]: ${errTreasury.message}`);
  } else {
    console.log(`✅ RPC [get_treasurer_overview] SUCCEEDED as Treasurer:`);
    console.log(`   Money In: ₹${treasury.total_income_paise / 100}`);
    console.log(`   Money Out: ₹${treasury.total_expense_paise / 100}`);
    console.log(`   Net Balance: ₹${treasury.net_recorded_movement_paise / 100}`);
    console.log(`   By Source:`, treasury.by_source);
    console.log(`   By Payment Method:`, treasury.by_method);
  }

  // 2. Call record_cash_contribution as Treasurer
  const { data: fund, error: errFund } = await client.from('fundraisers').select('id, title').limit(1).single();
  if (fund) {
    console.log(`\nTesting cash contribution recording for: "${fund.title}"`);
    const { data: contrib, error: errContrib } = await client.rpc('record_cash_contribution', {
      p_fundraiser_id: fund.id,
      p_amount_paise: 50000, // ₹500.00
      p_notes: 'Quad table bake sale morning shift cash collection'
    });

    if (errContrib) {
      console.log(`❌ RPC [record_cash_contribution]: ${errContrib.message}`);
    } else {
      console.log(`✅ RPC [record_cash_contribution] SUCCEEDED! Recorded ₹${contrib.amount_paise / 100}.`);
      console.log(`   New Fundraiser Total Raised: ₹${contrib.new_raised_paise / 100}`);
      console.log(`   Immutable Ledger Entry ID: ${contrib.ledger_entry_id}`);
    }
  }

  // 3. Call get_treasurer_overview again to observe live ledger update!
  const { data: updatedTreasury } = await client.rpc('get_treasurer_overview', {
    p_org_id: orgId
  });
  if (updatedTreasury) {
    console.log(`\n✅ Verified Live Ledger Update:`);
    console.log(`   New Money In: ₹${updatedTreasury.total_income_paise / 100}`);
    console.log(`   New Net Balance: ₹${updatedTreasury.net_recorded_movement_paise / 100}`);
  }

  console.log('\n--- Authenticated RPC Testing Complete ---');
}

testAuthenticatedRPCs();
