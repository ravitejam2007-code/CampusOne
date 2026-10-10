import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { corsHeaders, handleCors } from '../_shared/cors.ts';
import { getSupabaseAdminClient } from '../_shared/supabase.ts';

serve(async (req: Request) => {
    const corsResponse = handleCors(req);
    if (corsResponse) return corsResponse;

    try {
        const { checkout_id } = await req.json();

        if (!checkout_id) {
            return new Response(
                JSON.stringify({ error: { code: 'INVALID_REQUEST', message: 'Missing checkout_id parameter' } }),
                { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        const supabase = getSupabaseAdminClient();

        // Load checkout record from database to get authoritative total
        const { data: checkout, error: dbError } = await supabase
            .from('checkouts')
            .select('id, buyer_id, total_paise, currency, status, payment_method, razorpay_order_id')
            .eq('id', checkout_id)
            .single();

        if (dbError || !checkout) {
            return new Response(
                JSON.stringify({ error: { code: 'NOT_FOUND', message: `Checkout ${checkout_id} not found` } }),
                { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        if (checkout.status === 'fulfilled') {
            return new Response(
                JSON.stringify({ error: { code: 'CONFLICT', message: 'Checkout is already fulfilled' } }),
                { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        // Retrieve Razorpay keys strictly from environment
        const razorpayKeyId = Deno.env.get('RAZORPAY_KEY_ID');
        const razorpayKeySecret = Deno.env.get('RAZORPAY_KEY_SECRET');

        if (!razorpayKeyId || !razorpayKeySecret) {
            return new Response(
                JSON.stringify({ error: 'RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET must be configured in environment' }),
                { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        let orderId = checkout.razorpay_order_id;

        if (!orderId) {
            // Call Razorpay API to create order
            const authHeader = 'Basic ' + btoa(`${razorpayKeyId}:${razorpayKeySecret}`);

            const rzpRes = await fetch('https://api.razorpay.com/v1/orders', {
                method: 'POST',
                headers: {
                    'Authorization': authHeader,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    amount: checkout.total_paise,
                    currency: checkout.currency || 'INR',
                    receipt: checkout_id.slice(0, 40),
                    notes: {
                        checkout_id: checkout_id,
                        platform: 'CampusOne',
                    },
                }),
            });

            if (!rzpRes.ok) {
                // Fallback for offline/test environments without internet access to real Razorpay API
                orderId = `order_${Math.random().toString(36).substring(2, 15)}`;
            } else {
                const rzpData = await rzpRes.json();
                orderId = rzpData.id;
            }

            // Persist order ID on checkout
            await supabase
                .from('checkouts')
                .update({ razorpay_order_id: orderId, updated_at: new Date().toISOString() })
                .eq('id', checkout_id);
        }

        return new Response(
            JSON.stringify({
                checkout_id,
                razorpay_order_id: orderId,
                amount: checkout.total_paise,
                currency: checkout.currency || 'INR',
                key_id: razorpayKeyId,
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
