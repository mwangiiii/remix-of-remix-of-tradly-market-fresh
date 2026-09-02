// src/routes/api.session.store.ts
//
// Sub 31 — server route that sets the `tradly_market_refresh` httpOnly
// cookie after a magic-link sign-in. Replaces Sub 29's localStorage
// approach (JS-readable → XSS-exfil risk) with a cookie the JS layer
// literally cannot touch.
//
// POST /api/session/store
//   Body: { refresh_token: string }
//   Sets:  Set-Cookie: tradly_market_refresh=...; HttpOnly; Secure;
//          SameSite=Lax; Path=/; Max-Age=<30 days>
//
// SameSite=Lax (not Strict) so the cookie survives navigations from
// external links (e.g. clicking the storefront upgrade CTA to flow,
// then back). It does NOT ride along on cross-site iframes or POSTs.
//
// Secure is required in prod (Vercel is always https). Locally on
// http://localhost:8081 we still send Secure — modern browsers accept
// Secure cookies on localhost even over http.

import { createFileRoute } from "@tanstack/react-router";
import type {} from "@tanstack/react-start";

const COOKIE_NAME = "tradly_market_refresh";
const COOKIE_TTL_S = 30 * 24 * 3600;   // 30 days — mirrors Supabase's default

function jsonResponse(body: unknown, init: ResponseInit = {}): Response {
  const headers = new Headers(init.headers);
  headers.set("content-type", "application/json");
  return new Response(JSON.stringify(body), { ...init, headers });
}

export const Route = createFileRoute("/api/session/store")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let body: { refresh_token?: string };
        try {
          body = await request.json() as { refresh_token?: string };
        } catch {
          return jsonResponse({ error: "invalid JSON body" }, { status: 400 });
        }
        const token = (body.refresh_token ?? "").trim();
        if (!token || token.length < 20 || token.length > 512) {
          return jsonResponse({ error: "refresh_token must be 20-512 chars" }, { status: 400 });
        }

        const cookie =
          `${COOKIE_NAME}=${encodeURIComponent(token)}` +
          `; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${COOKIE_TTL_S}`;

        return jsonResponse({ ok: true }, {
          status: 200,
          headers: { "set-cookie": cookie },
        });
      },
    },
  },
});
