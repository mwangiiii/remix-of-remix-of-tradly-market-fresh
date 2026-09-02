// src/routes/api.session.clear.ts
//
// Sub 31 — server route that clears the `tradly_market_refresh` httpOnly
// cookie on logout. Complements /api/session/store and /api/session/refresh.
//
// POST /api/session/clear
//   Response: 204 with Set-Cookie header that expires the cookie.

import { createFileRoute } from "@tanstack/react-router";
import type {} from "@tanstack/react-start";

const COOKIE_NAME = "tradly_market_refresh";

export const Route = createFileRoute("/api/session/clear")({
  server: {
    handlers: {
      POST: async () => {
        const expire =
          `${COOKIE_NAME}=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0`;
        return new Response(null, {
          status: 204,
          headers: { "set-cookie": expire },
        });
      },
    },
  },
});
