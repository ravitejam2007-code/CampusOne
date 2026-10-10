
const SUPABASE_URL = process.env.PUBLIC_SUPABASE_URL || 'https://leifxoxnqnvezbmdtmcr.supabase.co';
const ANON_KEY = process.env.PUBLIC_SUPABASE_ANON_KEY;

async function testErrorHandling() {
  console.log('--- Testing Live Edge Functions Error Handling ---');

  // Test 1: Malformed JSON to create-payment-order
  console.log('\nTest 1: Malformed JSON Body:');
  const res1 = await fetch(`${SUPABASE_URL}/functions/v1/create-payment-order`, {
    method: 'POST',
    headers: {
      'apikey': ANON_KEY,
      'Authorization': `Bearer ${ANON_KEY}`,
      'Content-Type': 'application/json',
    },
    body: '{ malformed json',
  });
  const data1 = await res1.json();
  console.log('Status:', res1.status, '(expected 400)');
  console.log('Error Code:', data1.error?.code, '(expected INVALID_JSON)');
  console.log('Message:', data1.error?.message);

  // Test 2: Missing checkout_id parameter
  console.log('\nTest 2: Missing Required Parameter:');
  const res2 = await fetch(`${SUPABASE_URL}/functions/v1/create-payment-order`, {
    method: 'POST',
    headers: {
      'apikey': ANON_KEY,
      'Authorization': `Bearer ${ANON_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({}),
  });
  const data2 = await res2.json();
  console.log('Status:', res2.status, '(expected 400)');
  console.log('Error Code:', data2.error?.code, '(expected INVALID_REQUEST)');
  console.log('Message:', data2.error?.message);

  // Test 3: Invalid UUID format
  console.log('\nTest 3: Malformed UUID Parameter:');
  const res3 = await fetch(`${SUPABASE_URL}/functions/v1/create-payment-order`, {
    method: 'POST',
    headers: {
      'apikey': ANON_KEY,
      'Authorization': `Bearer ${ANON_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ checkout_id: 'not-a-valid-uuid' }),
  });
  const data3 = await res3.json();
  console.log('Status:', res3.status, '(expected 400)');
  console.log('Error Code:', data3.error?.code, '(expected INVALID_REQUEST)');
  console.log('Message:', data3.error?.message);

  // Test 4: Non-existent checkout UUID
  console.log('\nTest 4: Non-Existent Checkout (404 Not Found):');
  const res4 = await fetch(`${SUPABASE_URL}/functions/v1/create-payment-order`, {
    method: 'POST',
    headers: {
      'apikey': ANON_KEY,
      'Authorization': `Bearer ${ANON_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ checkout_id: '00000000-0000-0000-0000-000000000000' }),
  });
  const data4 = await res4.json();
  console.log('Status:', res4.status, '(expected 404)');
  console.log('Error Code:', data4.error?.code, '(expected NOT_FOUND)');
  console.log('Message:', data4.error?.message);

  // Test 5: Verify Pass with Malformed Token (Unauthorized Anon -> 403)
  console.log('\nTest 5: Verify Pass with Malformed Token (Unauthorized Anon -> 403):');
  const res5 = await fetch(`${SUPABASE_URL}/functions/v1/generate-all-in-one-pass/verify`, {
    method: 'POST',
    headers: {
      'apikey': ANON_KEY,
      'Authorization': `Bearer ${ANON_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ pass_token: 'SKYPASS:v1:not-a-uuid:fakedsig' }),
  });
  const data5 = await res5.json();
  console.log('Status:', res5.status, '(expected 403)');
  console.log('Error Code:', data5.error?.code, '(expected FORBIDDEN)');
  console.log('Message:', data5.error?.message);

  // Test 6: Verify Pass with Malformed Token (Authorized Staff -> 200 with verified: false)
  console.log('\nTest 6: Verify Pass with Malformed Token (Authorized Staff -> 200 with verified: false):');
  const authRes = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: {
      'apikey': ANON_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      email: 'door@skyline.edu',
      password: 'SkylineDemo2026!',
    }),
  });
  const authData = await authRes.json();
  const doorJwt = authData.access_token;

  if (doorJwt) {
    const res6 = await fetch(`${SUPABASE_URL}/functions/v1/generate-all-in-one-pass/verify`, {
      method: 'POST',
      headers: {
        'apikey': ANON_KEY,
        'Authorization': `Bearer ${doorJwt}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ pass_token: 'SKYPASS:v1:not-a-uuid:fakedsig' }),
    });
    const data6 = await res6.json();
    console.log('Status:', res6.status, '(expected 200)');
    console.log('Verified:', data6.verified, '(expected false)');
    console.log('Reason:', data6.data?.reason, '(expected Malformed pass token format...)');
  }

  console.log('\nAll error handling tests executed!');
}

testErrorHandling().catch(console.error);
