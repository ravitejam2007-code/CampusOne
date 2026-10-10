import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { corsHeaders, handleCors } from '../_shared/cors.ts';
import { createErrorResponse, parseJsonBody, isValidUuid, mapPostgresError } from '../_shared/errors.ts';
import { getSupabaseAdminClient, getSupabaseUserClient } from '../_shared/supabase.ts';

serve(async (req: Request) => {
    const corsResponse = handleCors(req);
    if (corsResponse) return corsResponse;

    try {
        if (req.method !== 'POST') {
            return createErrorResponse(405, 'BAD_REQUEST', `Method ${req.method} not allowed, use POST`);
        }

        const { data: body, errorResponse } = await parseJsonBody(req);
        if (errorResponse) return errorResponse;

        const { checkout_id, payment_method, amount_paise, reference, notes } = body || {};

        if (!checkout_id || !payment_method || amount_paise === undefined) {
            return createErrorResponse(
                400,
                'INVALID_REQUEST',
                'Missing required manual payment parameters: checkout_id, payment_method, amount_paise'
            );
        }

        if (!isValidUuid(checkout_id)) {
            return createErrorResponse(
                400,
                'INVALID_REQUEST',
                `Parameter checkout_id must be a valid UUID. Received: ${checkout_id}`
            );
        }

        if (payment_method !== 'cash' && payment_method !== 'manual_upi') {
            return createErrorResponse(
                400,
                'INVALID_REQUEST',
                `Invalid payment_method: '${payment_method}'. Permitted methods are 'cash' or 'manual_upi'`
            );
        }

        const numericAmount = Number(amount_paise);
        if (isNaN(numericAmount) || numericAmount <= 0 || !Number.isInteger(numericAmount)) {
            return createErrorResponse(
                400,
                'INVALID_REQUEST',
                `Payment amount_paise must be a positive integer. Received: ${amount_paise}`
            );
        }

        const authHeader = req.headers.get('Authorization') ?? '';
        const supabase = authHeader.includes('Bearer') ? getSupabaseUserClient(req) : getSupabaseAdminClient();

        // Call atomic staff payment RPC
        const { data: result, error: rpcError } = await supabase.rpc('record_staff_payment', {
            p_checkout_id: checkout_id,
            p_payment_method: payment_method,
            p_amount_paise: numericAmount,
            p_reference: reference ? String(reference).trim().slice(0, 200) : null,
            p_notes: notes ? String(notes).trim().slice(0, 500) : null,
        });

        if (rpcError) {
            const mapped = mapPostgresError(rpcError);
            return createErrorResponse(mapped.status, mapped.code, `Staff payment recording failed: ${mapped.message}`);
        }

        return new Response(
            JSON.stringify({
                success: true,
                checkout_id,
                payment_method,
                payment_status: 'captured',
                checkout_status: 'fulfilled',
                fulfilment: result,
            }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    } catch (err: any) {
        return createErrorResponse(500, 'INTERNAL_ERROR', err.message || 'Unexpected server failure recording manual staff payment');
    }
});
