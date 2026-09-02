// src/routes/api.session.handoff.ts
//
// Sub 31 — server route that returns the `tradly_market_refresh` value from
// the httpOnly cookie, for the Sub 30 storefront→flow SSO handoff. Called
// from account.tsx's "Upgrade to workspace" CTA on click.
//
// The refresh_token itself is what flow needs to skip re-auth. We could
// design a signed handoff JWT instead, but that'd require a shared secret
// between market and flow. Given both apps share the same Supabase project
// (single auth server) and refresh_tokens rotate on use, this simpler
// approach is a defensible trade-off:
//   - httpOnly cookie means XSS cannot exfil the token silently
//   - This endpoint only reveals it same-origin (cookie won't ride
//     cross-site because of SameSite=Lax)
//   - Once flow refreshes with it, Supabase issues a new refresh_token and
//     revokes this one — window of exposure is minutes at most
//
// GET /api/session/handoff
//   Cookie: tradly_market_refresh=...
//   Response: { refresh_token: string }  (200)
//             { error }                  (401 if no cookie)

import { createFileRoute } from "@tanstack/react-router";
import type {} from "@tanstack/react-start";

const COOKIE_NAME = "tradly_market_refresh";

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
  // Never let a browser cache this — it's a session-scoped token
  headers.set("cache-control", "no-store");
  return new Response(JSON.stringify(body), { ...init, headers });
}

export const Route = createFileRoute("/api/session/handoff")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const refreshToken = parseCookie(request.headers.get("cookie"), COOKIE_NAME);
        if (!refreshToken) {
          return jsonResponse({ error: "no session cookie" }, { status: 401 });
        }
        return jsonResponse({ refresh_token: refreshToken }, { status: 200 });
      },
    },
  },
});
