import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import QRCode from 'https://esm.sh/qrcode@1.5.3';
import { corsHeaders, handleCors } from '../_shared/cors.ts';
import { getSupabaseAdminClient, getSupabaseUserClient } from '../_shared/supabase.ts';

serve(async (req: Request) => {
    const corsResponse = handleCors(req);
    if (corsResponse) return corsResponse;

    try {
        const url = new URL(req.url);
        const authHeader = req.headers.get('Authorization') ?? '';

        // Determine if verifying or generating
        let body: any = {};
        if (req.method === 'POST') {
            try {
                body = await req.json();
            } catch {
                body = {};
            }
        }

        const isVerify = url.pathname.endsWith('/verify') || body.action === 'verify';

        const supabase = authHeader.includes('Bearer')
            ? getSupabaseUserClient(req)
            : getSupabaseAdminClient();

        // ─── ACTION: VERIFY PASS (Door Staff / Scanner) ──────────────────────────
        if (isVerify) {
            const passToken = body.pass_token || url.searchParams.get('pass_token');

            if (!passToken) {
                return new Response(
                    JSON.stringify({ error: { code: 'INVALID_REQUEST', message: 'Missing pass_token to verify' } }),
                    { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
                );
            }

            const { data: verifyData, error: verifyError } = await supabase.rpc('verify_student_all_in_one_pass', {
                p_pass_token: passToken,
            });

            if (verifyError) {
                const isForbidden = verifyError.message.includes('FORBIDDEN');
                return new Response(
                    JSON.stringify({ error: { code: isForbidden ? 'FORBIDDEN' : 'INTERNAL_ERROR', message: verifyError.message } }),
                    { status: isForbidden ? 403 : 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
                );
            }

            return new Response(
                JSON.stringify({
                    status: 'success',
                    verified: verifyData.valid,
                    data: verifyData,
                }),
                { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        // ─── ACTION: GENERATE ALL-IN-ONE PASS ────────────────────────────────────
        const targetUserId = body.user_id || url.searchParams.get('user_id') || null;

        const { data: passData, error: passError } = await supabase.rpc('generate_student_all_in_one_pass', {
            p_user_id: targetUserId,
        });

        if (passError) {
            const isUnauthenticated = passError.message.includes('UNAUTHENTICATED');
            const isForbidden = passError.message.includes('FORBIDDEN');
            const isNotFound = passError.message.includes('NOT_FOUND');
            const status = isUnauthenticated ? 401 : isForbidden ? 403 : isNotFound ? 404 : 500;

            return new Response(
                JSON.stringify({ error: { code: isUnauthenticated ? 'UNAUTHENTICATED' : isForbidden ? 'FORBIDDEN' : 'INTERNAL_ERROR', message: passError.message } }),
                { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        // Generate high-resolution renderable QR code data
        const tokenToEncode = passData.pass_token;
        const qrSvg = await QRCode.toString(tokenToEncode, {
            type: 'svg',
            margin: 2,
            errorCorrectionLevel: 'M',
            color: {
                dark: '#000000',
                light: '#ffffff',
            },
        });

        const qrDataUrl = await QRCode.toDataURL(tokenToEncode, {
            margin: 2,
            errorCorrectionLevel: 'M',
            color: {
                dark: '#000000',
                light: '#ffffff',
            },
        });

        return new Response(
            JSON.stringify({
                status: 'success',
                pass_token: passData.pass_token,
                qr_data_url: qrDataUrl,
                qr_svg: qrSvg,
                payload: passData,
            }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    } catch (err: any) {
        return new Response(
            JSON.stringify({ error: { code: 'INTERNAL_ERROR', message: err.message || 'Unexpected pass generation failure' } }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }
});
