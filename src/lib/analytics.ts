// Shared GA4 wrapper. This file is intentionally IDENTICAL in
// remix-of-tradly-marketing-suite (tradly.co.ke) and
// remix-of-remix-of-tradly-market-fresh (market.tradly.co.ke) so event names
// and behaviour stay consistent across both properties. If you change one,
// change the other.
//
// SSR NOTE: both sites are TanStack Start, so this module is imported on the
// server too. Every function below no-ops when `window` is undefined —
// initAnalytics() must never be called at module scope, only from a client
// effect (see __root.tsx).

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
    dataLayer?: unknown[];
  }
}

let initialised = false;

export function initAnalytics(): void {
  // Client-only. Guard covers SSR and any accidental server import.
  if (typeof window === "undefined" || typeof document === "undefined") return;

  // Router remounts and React StrictMode double-invoke effects; without this
  // the gtag snippet would be injected twice and page_view double-counted.
  if (initialised) return;

  const gaId = import.meta.env.VITE_GA4_ID as string | undefined;
  if (!gaId) return; // not configured yet — no-op, never throw

  initialised = true;

  const script = document.createElement("script");
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${gaId}`;
  document.head.appendChild(script);

  window.dataLayer = window.dataLayer || [];
  function gtag(...args: unknown[]) {
    window.dataLayer!.push(args);
  }
  window.gtag = gtag;
  gtag("js", new Date());
  gtag("config", gaId);
}

type GAEventParams = Record<string, string | number | boolean | undefined>;

/**
 * Canonical event names — keep these EXACT across both sites so reporting
 * lines up:
 *   demo_request_submitted, pricing_viewed, leak_estimator_started,
 *   leak_estimator_completed, market_catalogue_viewed, market_signup_started,
 *   market_signup_completed, whatsapp_click
 */
export function trackEvent(eventName: string, params?: GAEventParams): void {
  if (typeof window === "undefined") return;
  if (typeof window.gtag !== "function") return;
  window.gtag("event", eventName, params);
}
