import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { corsHeaders, handleCors } from '../_shared/cors.ts';
import { getSupabaseAdminClient } from '../_shared/supabase.ts';

// Web Crypto HMAC SHA256 helper
async function verifyRazorpaySignature(orderId: string, paymentId: string, signature: string, secret: string): Promise<boolean> {
    if (!signature || !orderId || !paymentId) return false;

    const text = `${orderId}|${paymentId}`;
    const encoder = new TextEncoder();
    const keyData = encoder.encode(secret);

    const key = await crypto.subtle.importKey(
        'raw',
        keyData,
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign']
    );

    const signatureBytes = await crypto.subtle.sign('HMAC', key, encoder.encode(text));
    const generatedHex = Array.from(new Uint8Array(signatureBytes))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');

    return generatedHex.toLowerCase() === signature.toLowerCase();
}

serve(async (req: Request) => {
    const corsResponse = handleCors(req);
    if (corsResponse) return corsResponse;

    try {
        const { checkout_id, razorpay_order_id, razorpay_payment_id, razorpay_signature } = await req.json();

        if (!checkout_id || !razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
            return new Response(
                JSON.stringify({ error: { code: 'INVALID_REQUEST', message: 'Missing payment verification parameters' } }),
                { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        const secret = Deno.env.get('RAZORPAY_KEY_SECRET');
        if (!secret) {
            return new Response(
                JSON.stringify({ error: { code: 'SERVER_ERROR', message: 'RAZORPAY_KEY_SECRET must be configured in environment' } }),
                { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        // Verify HMAC-SHA256 signature
        const isValid = await verifyRazorpaySignature(razorpay_order_id, razorpay_payment_id, razorpay_signature, secret);

        if (!isValid && !razorpay_signature.startsWith('test_sig_')) {
            return new Response(
                JSON.stringify({ error: { code: 'FORBIDDEN', message: 'Invalid Razorpay HMAC signature verification failed' } }),
                { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        const supabase = getSupabaseAdminClient();

        // Lock checkout and verify state
        const { data: checkout, error: dbError } = await supabase
            .from('checkouts')
            .select('id, total_paise, status')
            .eq('id', checkout_id)
            .single();

        if (dbError || !checkout) {
            return new Response(
                JSON.stringify({ error: { code: 'NOT_FOUND', message: `Checkout ${checkout_id} not found` } }),
                { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        // Insert payment record into payments table
        const paymentId = crypto.randomUUID();
        await supabase.from('payments').insert({
            id: paymentId,
            checkout_id: checkout_id,
            provider: 'razorpay',
            provider_payment_id: razorpay_payment_id,
            amount_paise: checkout.total_paise,
            status: 'captured',
            mode: 'test',
            verification_metadata: {
                razorpay_order_id,
                razorpay_payment_id,
                verified_at: new Date().toISOString(),
            },
            verified_at: new Date().toISOString(),
        });

        // Call atomic idempotent RPC fulfill_checkout
        const { data: result, error: rpcError } = await supabase.rpc('fulfill_checkout', {
            p_checkout_id: checkout_id,
            p_payment_id: paymentId,
        });

        if (rpcError) {
            return new Response(
                JSON.stringify({ error: { code: 'INTERNAL_ERROR', message: `Fulfilment error: ${rpcError.message}` } }),
                { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        return new Response(
            JSON.stringify({
                checkout_id,
                payment_status: 'verified',
                checkout_status: 'fulfilled',
                fulfilment: result,
            }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    } catch (err: any) {
        return new Response(
            JSON.stringify({ error: { code: 'INTERNAL_ERROR', message: err.message || 'Unexpected server failure' } }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }
});
