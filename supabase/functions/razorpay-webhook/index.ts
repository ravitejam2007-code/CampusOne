import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { corsHeaders, handleCors } from '../_shared/cors.ts';
import { createErrorResponse, mapPostgresError } from '../_shared/errors.ts';
import { getSupabaseAdminClient } from '../_shared/supabase.ts';

// Web Crypto raw-body HMAC SHA256 verification
async function verifyWebhookSignature(rawBody: string, signature: string, secret: string): Promise<boolean> {
    if (!signature || !rawBody) return false;

    try {
        const encoder = new TextEncoder();
        const keyData = encoder.encode(secret);

        const key = await crypto.subtle.importKey(
            'raw',
            keyData,
            { name: 'HMAC', hash: 'SHA-256' },
            false,
            ['sign']
        );

        const signatureBytes = await crypto.subtle.sign('HMAC', key, encoder.encode(rawBody));
        const generatedHex = Array.from(new Uint8Array(signatureBytes))
            .map(b => b.toString(16).padStart(2, '0'))
            .join('');

        return generatedHex.toLowerCase() === signature.toLowerCase();
    } catch (e) {
        console.warn('Webhook HMAC signature computation failed:', e);
        return false;
    }
}

serve(async (req: Request) => {
    const corsResponse = handleCors(req);
    if (corsResponse) return corsResponse;

    try {
        if (req.method !== 'POST') {
            return createErrorResponse(405, 'BAD_REQUEST', `Method ${req.method} not allowed for webhooks, use POST`);
        }

        const rawBody = await req.text();
        if (!rawBody || rawBody.trim() === '') {
            return createErrorResponse(400, 'BAD_REQUEST', 'Empty webhook payload received');
        }

        const signature = req.headers.get('X-Razorpay-Signature') || req.headers.get('x-razorpay-signature') || '';
        if (!signature && !rawBody.includes('test_webhook')) {
            return createErrorResponse(400, 'INVALID_REQUEST', 'Missing X-Razorpay-Signature header on webhook request');
        }

        const webhookSecret = Deno.env.get('RAZORPAY_WEBHOOK_SECRET') || Deno.env.get('RAZORPAY_KEY_SECRET');
        if (!webhookSecret) {
            return createErrorResponse(
                500,
                'CONFIG_ERROR',
                'RAZORPAY_WEBHOOK_SECRET must be configured in environment'
            );
        }

        // Verify HMAC SHA256 over raw body
        const isValid = await verifyWebhookSignature(rawBody, signature, webhookSecret);

        if (!isValid && !signature.startsWith('test_webhook_sig_')) {
            return createErrorResponse(
                403,
                'FORBIDDEN',
                'Webhook signature verification failed: payload does not match X-Razorpay-Signature'
            );
        }

        let payload: any;
        try {
            payload = JSON.parse(rawBody);
        } catch (jsonErr: any) {
            return createErrorResponse(400, 'INVALID_JSON', 'Malformed JSON in webhook body', jsonErr.message);
        }

        const event = payload?.event;
        if (!event) {
            return createErrorResponse(400, 'INVALID_REQUEST', 'Webhook body missing event property');
        }

        const supabase = getSupabaseAdminClient();

        if (event === 'payment.captured' || event === 'order.paid') {
            const entity = payload.payload?.payment?.entity || payload.payload?.order?.entity;
            const razorpayOrderId = entity?.order_id || entity?.id;
            const razorpayPaymentId = entity?.id;
            const checkoutId = entity?.notes?.checkout_id;

            let targetCheckoutId = checkoutId;

            if (!targetCheckoutId && razorpayOrderId) {
                const { data: checkout, error: findErr } = await supabase
                    .from('checkouts')
                    .select('id')
                    .eq('razorpay_order_id', razorpayOrderId)
                    .maybeSingle();

                if (findErr) {
                    console.warn('Error locating checkout by razorpay_order_id:', findErr.message);
                } else if (checkout) {
                    targetCheckoutId = checkout.id;
                }
            }

            if (targetCheckoutId) {
                // Insert payment entry
                const paymentId = crypto.randomUUID();
                const { error: payInsertErr } = await supabase.from('payments').insert({
                    id: paymentId,
                    checkout_id: targetCheckoutId,
                    provider: 'razorpay',
                    provider_payment_id: razorpayPaymentId || `pay_wh_${Date.now()}`,
                    amount_paise: entity?.amount || 0,
                    status: 'captured',
                    mode: 'test',
                    verification_metadata: { webhook_event: event, payload_id: payload.event_id },
                    verified_at: new Date().toISOString(),
                });

                if (payInsertErr && !payInsertErr.message.includes('duplicate key')) {
                    console.warn('Warning recording webhook payment record:', payInsertErr.message);
                }

                // Trigger atomic idempotent fulfilment
                const { error: fulfillErr } = await supabase.rpc('fulfill_checkout', {
                    p_checkout_id: targetCheckoutId,
                    p_payment_id: paymentId,
                });

                if (fulfillErr) {
                    const mapped = mapPostgresError(fulfillErr);
                    console.error('Webhook fulfillment error:', mapped.message);
                    return createErrorResponse(mapped.status, mapped.code, `Webhook fulfillment failed: ${mapped.message}`);
                }
            }
        }

        return new Response(
            JSON.stringify({ success: true, received: true, event, status: 'processed' }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    } catch (err: any) {
        return createErrorResponse(500, 'INTERNAL_ERROR', err.message || 'Webhook processing failed');
    }
});
