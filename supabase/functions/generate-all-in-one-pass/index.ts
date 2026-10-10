import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import QRCode from 'https://esm.sh/qrcode@1.5.3';
import { corsHeaders, handleCors } from '../_shared/cors.ts';
import { createErrorResponse, parseJsonBody, isValidUuid, mapPostgresError } from '../_shared/errors.ts';
import { getSupabaseAdminClient, getSupabaseUserClient } from '../_shared/supabase.ts';

serve(async (req: Request) => {
    const corsResponse = handleCors(req);
    if (corsResponse) return corsResponse;

    try {
        const url = new URL(req.url);
        const authHeader = req.headers.get('Authorization') ?? '';

        // Safe body parsing
        let body: any = {};
        if (req.method === 'POST') {
            const { data, errorResponse } = await parseJsonBody(req);
            if (errorResponse) return errorResponse;
            body = data || {};
        }

        const isVerify = url.pathname.endsWith('/verify') || body.action === 'verify';

        const supabase = authHeader.includes('Bearer')
            ? getSupabaseUserClient(req)
            : getSupabaseAdminClient();

        // ─── ACTION: VERIFY PASS (Door Staff / Scanner) ──────────────────────────
        if (isVerify) {
            const passToken = body.pass_token || url.searchParams.get('pass_token');

            if (!passToken || typeof passToken !== 'string' || passToken.trim() === '') {
                return createErrorResponse(400, 'INVALID_REQUEST', 'Missing required parameter: pass_token to verify');
            }

            const { data: verifyData, error: verifyError } = await supabase.rpc('verify_student_all_in_one_pass', {
                p_pass_token: passToken.trim(),
            });

            if (verifyError) {
                const mapped = mapPostgresError(verifyError);
                return createErrorResponse(mapped.status, mapped.code, `Pass verification failed: ${mapped.message}`);
            }

            return new Response(
                JSON.stringify({
                    success: true,
                    status: 'success',
                    verified: verifyData?.valid ?? false,
                    data: verifyData,
                }),
                { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        // ─── ACTION: GENERATE ALL-IN-ONE PASS ────────────────────────────────────
        const targetUserId = body.user_id || url.searchParams.get('user_id') || null;

        if (targetUserId && !isValidUuid(targetUserId)) {
            return createErrorResponse(400, 'INVALID_REQUEST', `Parameter user_id must be a valid UUID. Received: ${targetUserId}`);
        }

        const { data: passData, error: passError } = await supabase.rpc('generate_student_all_in_one_pass', {
            p_user_id: targetUserId,
        });

        if (passError) {
            const mapped = mapPostgresError(passError);
            return createErrorResponse(mapped.status, mapped.code, `Failed to generate student pass: ${mapped.message}`);
        }

        if (!passData || !passData.pass_token) {
            return createErrorResponse(500, 'INTERNAL_ERROR', 'Database did not return a valid student pass payload');
        }

        // Generate high-resolution renderable QR code data
        const tokenToEncode = passData.pass_token;
        let qrSvg = '';
        let qrDataUrl = '';

        try {
            qrSvg = await QRCode.toString(tokenToEncode, {
                type: 'svg',
                margin: 2,
                errorCorrectionLevel: 'M',
                color: {
                    dark: '#000000',
                    light: '#ffffff',
                },
            });

            qrDataUrl = await QRCode.toDataURL(tokenToEncode, {
                margin: 2,
                errorCorrectionLevel: 'M',
                color: {
                    dark: '#000000',
                    light: '#ffffff',
                },
            });
        } catch (qrErr: any) {
            console.warn('QR code visual rendering warning:', qrErr.message);
        }

        return new Response(
            JSON.stringify({
                success: true,
                status: 'success',
                pass_token: passData.pass_token,
                qr_data_url: qrDataUrl,
                qr_svg: qrSvg,
                payload: passData,
            }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    } catch (err: any) {
        return createErrorResponse(500, 'INTERNAL_ERROR', err.message || 'Unexpected pass generation failure');
    }
});
