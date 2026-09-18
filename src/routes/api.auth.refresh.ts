// src/routes/api.auth.refresh.ts
//
// Audit finding H1 — same-origin proxy for /functions/v1/auth-refresh.
//
// Reads the `tradly_refresh` cookie set by /api/auth/login (same-origin),
// forwards it to the upstream auth-refresh Edge Function, and rotates
// the cookie on success. Mirror of /api/session/refresh (which handles
// the magic-link cookie). This one handles the password/admin cookie.
//
// POST /api/auth/refresh
//   Cookie:   tradly_refresh=<supabase refresh_token>
//   Returns:  { access_token, expires_in }
//   Rotates:  Set-Cookie: tradly_refresh=<new token>

import { createFileRoute } from "@tanstack/react-router";
import type {} from "@tanstack/react-start";

const FUNCTIONS_URL = process.env.VITE_SUPABASE_FUNCTIONS_URL ?? "";
const COOKIE_NAME   = "tradly_refresh";
const COOKIE_TTL_S  = 30 * 24 * 3600;

function parseCookie(header: string | null, name: string): string | null {
  if (!header) return null;
  for (const part of header.split(";")) {
    const [k, ...rest] = part.trim().split("=");
    if (k === name) return decodeURIComponent(rest.join("="));
  }
  return null;
}

function expireCookie(): string {
  return `${COOKIE_NAME}=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0`;
}

function jsonResponse(body: unknown, init: ResponseInit = {}): Response {
  const h = new Headers(init.headers);
  h.set("content-type", "application/json");
  return new Response(JSON.stringify(body), { ...init, headers: h });
}

export const Route = createFileRoute("/api/auth/refresh")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        if (!FUNCTIONS_URL) {
          return jsonResponse({ error: "server misconfigured" }, { status: 500 });
        }

        const refreshToken = parseCookie(request.headers.get("cookie"), COOKIE_NAME);
        if (!refreshToken) {
          // Always expire the cookie on 401 (audit finding M1 applied here too).
          return jsonResponse(
            { code: "AUTH_006", message: "Session expired. Please sign in again." },
            { status: 401, headers: { "set-cookie": expireCookie() } },
          );
        }

        // Forward to the upstream auth-refresh with the cookie as the
        // upstream expects it.
        const upstream = await fetch(`${FUNCTIONS_URL}/auth-refresh`, {
          method: "POST",
          headers: {
            "cookie": `${COOKIE_NAME}=${encodeURIComponent(refreshToken)}`,
            "origin": request.headers.get("origin") ?? "",
            "user-agent": request.headers.get("user-agent") ?? "",
          },
        });

        const upstreamBody = await upstream.text();

        if (!upstream.ok) {
          // Upstream rejected the refresh_token — expire our copy too.
          return new Response(upstreamBody, {
            status: upstream.status,
            headers: {
              "content-type": "application/json",
              "set-cookie": expireCookie(),
            },
          });
        }

        // Rotate: extract the new refresh_token from upstream's Set-Cookie
        // and re-issue it as a same-origin cookie on market.
        const response = new Response(upstreamBody, {
          status: 200,
          headers: { "content-type": "application/json" },
        });

        const upstreamCookie = upstream.headers.get("set-cookie") ?? "";
        const match = upstreamCookie.match(/tradly_refresh=([^;]+)/);
        if (match) {
          const newToken = decodeURIComponent(match[1]);
          response.headers.append(
            "set-cookie",
            [
              `${COOKIE_NAME}=${encodeURIComponent(newToken)}`,
              `Max-Age=${COOKIE_TTL_S}`,
              "HttpOnly",
              "Secure",
              "SameSite=Lax",
              "Path=/",
            ].join("; "),
          );
        }

        return response;
      },
    },
  },
});
