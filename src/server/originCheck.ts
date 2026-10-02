// src/server/originCheck.ts
//
// Audit finding L3: belt-and-braces Origin check for state-changing
// /api/session/* endpoints.
//
// Our session cookies are SameSite=Lax so the browser already blocks
// most cross-site POSTs from attaching them. This helper is defence in
// depth: reject the request outright if the Origin header is missing
// or doesn't match an allowed origin. Covers:
//   - A hypothetical future browser change that weakens SameSite=Lax
//   - A proxy / dev-tool pattern that spoofs an unexpected Origin
//   - A reverse-proxy misconfiguration that lets a different site reach
//     these routes (e.g. preview environments sharing a cookie domain)
//
// Not a replacement for CSRF tokens if we ever add a formal CSRF layer —
// it's the "cheap now" layer, correctly scoped to just the three auth
// cookie endpoints we own.
//
// Allowed origins:
//   - VITE_SITE_URL (production market domain, e.g. https://market.tradly.co.ke)
//   - localhost on any port (dev — matches our tradly-flow pattern)
//   - 127.0.0.1 on any port (dev — some setups use the IP instead of localhost)
//   - *.vercel.app (Vercel preview deploys)
//
// Returns null when the Origin is acceptable (request may proceed).
// Returns a 403 Response when it is not — caller just returns it directly.

const SITE_URL = (process.env.VITE_SITE_URL ?? "").trim().replace(/\/$/, "");

const DEV_ORIGIN_RE =
  /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i;
const VERCEL_PREVIEW_RE =
  /^https:\/\/[a-z0-9-]+\.vercel\.app$/i;

export function isAllowedOrigin(origin: string | null): boolean {
  if (!origin) return false;
  if (SITE_URL && origin === SITE_URL) return true;
  if (DEV_ORIGIN_RE.test(origin)) return true;
  if (VERCEL_PREVIEW_RE.test(origin)) return true;
  return false;
}

/**
 * Returns a 403 Response if the request's Origin isn't allowed, otherwise
 * null (request may proceed). Expected to be called at the top of every
 * state-changing session endpoint.
 */
export function rejectForeignOrigin(request: Request): Response | null {
  const origin = request.headers.get("origin");
  if (isAllowedOrigin(origin)) return null;
  return new Response(
    JSON.stringify({ error: "origin not allowed" }),
    { status: 403, headers: { "content-type": "application/json" } },
  );
}
