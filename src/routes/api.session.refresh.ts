// src/routes/api.session.refresh.ts
//
// Sub 31 — server route that refreshes a magic-link session via the
// httpOnly `tradly_market_refresh` cookie. Called by AuthProvider's
// silentRefresh on mount and by the axios 401 interceptor on token
// expiry.
//
// POST /api/session/refresh
//   Cookie: tradly_market_refresh=<supabase refresh_token>
//   Response: { access_token, expires_in }
//   Side effect: rotates the cookie with the NEW refresh_token Supabase
//                issued. Old refresh_token becomes invalid immediately
//                (replay protection).

import { createFileRoute } from "@tanstack/react-router";
import type {} from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";

const COOKIE_NAME = "tradly_market_refresh";
const COOKIE_TTL_S = 30 * 24 * 3600;

// Server-side Supabase client. Uses the anon key (auth.refreshSession only
// needs the refresh_token itself as authorization).
const supabaseUrl = process.env.VITE_SUPABASE_URL ?? "";
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY ?? "";

function parseCookie(header: string | null, name: string): string | null {
  if (!header) return null;
  for (const part of header.split(";")) {
    const [k, ...rest] = part.trim().split("=");
    if (k === name) return decodeURIComponent(rest.join("="));
  }
  return null;
}

function jsonResponse(body: unknown, init: ResponseInit = {}): Response {
  const headers = new Headers(init.headers);
  headers.set("content-type", "application/json");
  return new Response(JSON.stringify(body), { ...init, headers });
}

function rotationCookie(token: string): string {
  return (
    `${COOKIE_NAME}=${encodeURIComponent(token)}` +
    `; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${COOKIE_TTL_S}`
  );
}

function expireCookie(): string {
  return `${COOKIE_NAME}=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0`;
}

export const Route = createFileRoute("/api/session/refresh")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const refreshToken = parseCookie(request.headers.get("cookie"), COOKIE_NAME);
        if (!refreshToken) {
          return jsonResponse({ error: "no session cookie" }, { status: 401 });
        }
        if (!supabaseUrl || !supabaseAnonKey) {
          return jsonResponse({ error: "server misconfigured" }, { status: 500 });
        }

        const supabase = createClient(supabaseUrl, supabaseAnonKey, {
          auth: { persistSession: false, autoRefreshToken: false },
        });

        const { data, error } = await supabase.auth.refreshSession({
          refresh_token: refreshToken,
        });
        if (error || !data.session) {
          // Refresh token invalid/revoked/expired — clear the cookie so we
          // don't loop trying to use it on every page load.
          return jsonResponse(
            { error: error?.message ?? "refresh failed" },
            { status: 401, headers: { "set-cookie": expireCookie() } },
          );
        }

        return jsonResponse(
          {
            access_token: data.session.access_token,
            expires_in:   data.session.expires_in ?? 3600,
          },
          {
            status: 200,
            // Rotate the cookie with Supabase's newly-issued refresh_token
            headers: { "set-cookie": rotationCookie(data.session.refresh_token) },
          },
        );
      },
    },
  },
});
