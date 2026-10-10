import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { corsHeaders, handleCors } from '../_shared/cors.ts';
import { getSupabaseAdminClient, getSupabaseUserClient } from '../_shared/supabase.ts';

serve(async (req: Request) => {
    const corsResponse = handleCors(req);
    if (corsResponse) return corsResponse;

    try {
        const { checkout_id, payment_method, amount_paise, reference, notes } = await req.json();

        if (!checkout_id || !payment_method || !amount_paise) {
            return new Response(
                JSON.stringify({ error: { code: 'INVALID_REQUEST', message: 'Missing required manual payment parameters' } }),
                { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        if (payment_method !== 'cash' && payment_method !== 'manual_upi') {
            return new Response(
                JSON.stringify({ error: { code: 'INVALID_REQUEST', message: 'Payment method must be cash or manual_upi' } }),
                { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        const authHeader = req.headers.get('Authorization') ?? '';
        const supabase = authHeader.includes('Bearer') ? getSupabaseUserClient(req) : getSupabaseAdminClient();

        // Call atomic staff payment RPC
        const { data: result, error: rpcError } = await supabase.rpc('record_staff_payment', {
            p_checkout_id: checkout_id,
            p_payment_method: payment_method,
            p_amount_paise: amount_paise,
            p_reference: reference || null,
            p_notes: notes || null,
        });

        if (rpcError) {
            const isForbidden = rpcError.message.includes('FORBIDDEN');
            const isConflict = rpcError.message.includes('CONFLICT');
            const status = isForbidden ? 403 : isConflict ? 409 : 500;

            return new Response(
                JSON.stringify({ error: { code: isForbidden ? 'FORBIDDEN' : isConflict ? 'CONFLICT' : 'INTERNAL_ERROR', message: rpcError.message } }),
                { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        return new Response(
            JSON.stringify({
                checkout_id,
                payment_method,
                payment_status: 'captured',
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
