// src/routes/api.auth.login.ts
//
// Audit finding H1 — same-origin proxy for /functions/v1/auth-login.
//
// Without this proxy, password-based logins from market.tradly.co.ke call
// the Edge Function directly on fcbmxacyxioknoyajodc.supabase.co. The
// `tradly_refresh` cookie set in that response is scoped to supabase.co —
// a different origin — so Chrome (3rd-party cookie phase-out) and Safari
// (ITP) silently drop it on every subsequent /auth-refresh call. Result:
// sessions die on reload with no error, only a 401 "no cookie" from the
// interceptor.
//
// This proxy runs on market.tradly.co.ke (same origin), forwards the
// POST body to the real Edge Function, and re-sets the `tradly_refresh`
// cookie scoped to market.tradly.co.ke — same-origin, always sent.
//
// POST /api/auth/login
//   Body:     { email, password }
//   Forwards: to VITE_SUPABASE_FUNCTIONS_URL/auth-login (or /auth/login)
//   Returns:  the Edge Function's { access_token, expires_in, user } body
//   Side-effect: re-issues Set-Cookie: tradly_refresh=... scoped to market

import { createFileRoute } from "@tanstack/react-router";
import type {} from "@tanstack/react-start";

const FUNCTIONS_URL = process.env.VITE_SUPABASE_FUNCTIONS_URL ?? "";
const COOKIE_NAME   = "tradly_refresh";
const COOKIE_TTL_S  = 30 * 24 * 3600; // 30 days — matches auth-login

function jsonResponse(body: unknown, init: ResponseInit = {}): Response {
  const h = new Headers(init.headers);
  h.set("content-type", "application/json");
  return new Response(JSON.stringify(body), { ...init, headers: h });
}

export const Route = createFileRoute("/api/auth/login")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        if (!FUNCTIONS_URL) {
          return jsonResponse({ error: "server misconfigured" }, { status: 500 });
        }

        let rawBody: string;
        try {
          rawBody = await request.text();
        } catch {
          return jsonResponse({ error: "could not read request body" }, { status: 400 });
        }

        // Forward to Edge Function, preserving headers the function needs
        // (content-type, origin, user-agent for rate-limiting, x-forwarded-for).
        const upstream = await fetch(`${FUNCTIONS_URL}/auth-login`, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "origin": request.headers.get("origin") ?? "",
            "user-agent": request.headers.get("user-agent") ?? "",
            "x-forwarded-for": request.headers.get("x-forwarded-for") ?? "",
          },
          body: rawBody,
        });

        const upstreamBody = await upstream.text();

        // If the upstream set a tradly_refresh cookie, extract the token
        // value and re-set it as a same-origin cookie on market.tradly.co.ke.
        const response = new Response(upstreamBody, {
          status: upstream.status,
          headers: { "content-type": "application/json" },
        });

        const upstreamCookie = upstream.headers.get("set-cookie") ?? "";
        const match = upstreamCookie.match(/tradly_refresh=([^;]+)/);
        if (match) {
          const token = decodeURIComponent(match[1]);
          response.headers.append(
            "set-cookie",
            [
              `${COOKIE_NAME}=${encodeURIComponent(token)}`,
              `Max-Age=${COOKIE_TTL_S}`,
              "HttpOnly",
              "Secure",
              "SameSite=Lax",   // Lax (not None) — same-origin, no need for cross-site
              "Path=/",         // Wider path so /api/auth/refresh can read it
            ].join("; "),
          );
        }

        return response;
      },
    },
  },
});
