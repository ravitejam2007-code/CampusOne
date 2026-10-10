import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.8';

export function getSupabaseAdminClient() {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !serviceRoleKey) {
        throw new Error('CONFIG_ERROR: Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables');
    }

    return createClient(supabaseUrl, serviceRoleKey, {
        auth: {
            persistSession: false,
            autoRefreshToken: false,
        },
    });
}

export function getSupabaseUserClient(req: Request) {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY') || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !anonKey) {
        throw new Error('CONFIG_ERROR: Missing SUPABASE_URL or SUPABASE_ANON_KEY environment variables');
    }

    const authHeader = req.headers.get('Authorization') ?? '';

    return createClient(supabaseUrl, anonKey, {
        global: {
            headers: {
                Authorization: authHeader,
            },
        },
        auth: {
            persistSession: false,
            autoRefreshToken: false,
        },
    });
}
