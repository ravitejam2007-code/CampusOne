import { createClient } from '@supabase/supabase-js';
import { createServerClient, parseCookieHeader } from '@supabase/ssr';
import type { AstroCookies } from 'astro';

// Environment variables
const supabaseUrl = import.meta.env.PUBLIC_SUPABASE_URL || 'https://leifxoxnqnvezbmdtmcr.supabase.co';
const supabaseAnonKey = import.meta.env.PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.e30.placeholder';

/**
 * Standard browser client for React Islands and client-side interactions.
 */
export function getBrowserClient() {
  return createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  });
}

/**
 * Server SSR client for Astro endpoints and server-rendered pages.
 * Handles secure session cookies via AstroCookies.
 */
export function getServerClient(cookies: AstroCookies, request?: Request) {
  return createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        if (request) {
          const cookieHeader = request.headers.get('Cookie') ?? '';
          return parseCookieHeader(cookieHeader);
        }
        // Fallback for Astro cookies
        return [];
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => {
          cookies.set(name, value, options);
        });
      },
    },
  });
}
