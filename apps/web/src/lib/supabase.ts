import { createClient } from '@supabase/supabase-js';
import { createServerClient, parseCookieHeader } from '@supabase/ssr';
import type { AstroCookies } from 'astro';

// Environment variables
const supabaseUrl = import.meta.env.PUBLIC_SUPABASE_URL || 'https://leifxoxnqnvezbmdtmcr.supabase.co';
const supabaseAnonKey = import.meta.env.PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxlaWZ4b3hucW52ZXpibWR0bWNyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTE2MDc0NDAsImV4cCI6MjEwNzE4MzQ0MH0.jHq6iSuTOTF7tMTrVjZLslx3NO7emDKGfLJRR7TepqM';

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
