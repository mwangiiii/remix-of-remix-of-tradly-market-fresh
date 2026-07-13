import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { useAuthStore } from "@/store/useAuthStore";

// Shared with tradly-flow / tradly-super-admin (see C:\Projects\tradly\CLAUDE.md).
// Non-persisting client. When a buyer is signed in, we inject the in-memory JWT
// on every PostgREST request via the `global.fetch` override — matches
// tradly-flow's supabaseClient pattern. Anonymous callers just send the anon
// key and read whatever RLS lets them read (published catalog rows).
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL ?? "";
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY ?? "";

if (!supabaseUrl || !supabaseAnonKey) {
  // eslint-disable-next-line no-console
  console.warn(
    "[marketplace] VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY missing — catalog reads will fail.",
  );
}

let _client: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient {
  if (!_client) {
    _client = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
      global: {
        fetch: async (url, options = {}) => {
          const token = useAuthStore.getState().accessToken;
          const headers = new Headers(options.headers as HeadersInit | undefined);
          if (token) headers.set("Authorization", `Bearer ${token}`);
          return fetch(url, { ...options, headers });
        },
      },
    });
  }
  return _client;
}
