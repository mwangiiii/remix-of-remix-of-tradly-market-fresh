import type { ReactNode } from "react";
import { BottomNav } from "./BottomNav";
import { TopNav } from "./TopNav";
import { useCatalogRealtime } from "../hooks/useCatalogRealtime";

/** True when this app is rendered inside an iframe. Set explicitly via
 * `?embed=1` (used by app.tradly.co.ke's Marketplace page) OR inferred
 * from being framed at all (window.self !== window.top). We hide our own
 * top/bottom nav in that case so the outer host's chrome doesn't stack
 * with ours. Guarded try/catch — cross-origin frames throw on window.top. */
function isEmbedded(): boolean {
  if (typeof window === "undefined") return false;
  try {
    if (new URLSearchParams(window.location.search).has("embed")) return true;
    return window.self !== window.top;
  } catch {
    return true;   // if reading window.top throws, we're cross-origin framed
  }
}

/**
 * Responsive marketplace shell.
 *  - Mobile (< lg): narrow column, sticky bottom nav.
 *  - Desktop (≥ lg): wide layout with a top nav, no bottom bar, generous gutters.
 * `variant="storefront"` renders the wide desktop grid — best for landing / listings.
 * `variant="focused"` keeps a centred, narrower column — best for cart / checkout / detail.
 *
 * Pass `hideNav` on any screen that renders its own fixed bottom action bar
 * (checkout, wizards, etc.) — otherwise BottomNav's fixed bottom-0 tab bar
 * paints on the same edge as that bar on mobile and covers it.
 *
 * When embedded (iframe / ?embed=1), TopNav + BottomNav are hidden
 * automatically so we don't paint on top of the host's chrome.
 */
export function AppShell({
  children,
  hideNav = false,
  variant = "storefront",
}: {
  children: ReactNode;
  hideNav?: boolean;
  variant?: "storefront" | "focused";
}) {
  // Live-refresh catalog + inventory on remote changes so what the buyer
  // sees always matches what super-admin most recently saved.
  useCatalogRealtime();

  const embedded = isEmbedded();
  const chromeless = hideNav || embedded;

  const width = variant === "storefront" ? "lg:max-w-7xl" : "lg:max-w-4xl";
  return (
    <div className="min-h-screen bg-background text-ink">
      {!chromeless && <TopNav />}
      <main
        id="main"
        className={`mx-auto max-w-lg ${chromeless ? "pb-4" : "pb-24 lg:pb-16"} ${width}`}
      >
        {children}
      </main>
      {!chromeless && <BottomNav />}
    </div>
  );
}