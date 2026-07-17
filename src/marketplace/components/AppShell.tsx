import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
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
      {!chromeless && <SiteFooter />}
      {!chromeless && <BottomNav />}
    </div>
  );
}

/**
 * Slim site-wide footer. Its main job is being crawlable — every page
 * needs a link into /faq so that route indexes fast. Kept intentionally
 * spare (no "About / Careers / Blog" invented links) to avoid dead
 * pointers Googlebot would flag.
 *
 * On mobile it sits above BottomNav (which is fixed) via `pb-20`, on
 * desktop the container's own padding handles the spacing.
 */
function SiteFooter() {
  const year = new Date().getFullYear();
  return (
    <footer className="mx-auto max-w-lg px-4 pb-20 pt-8 text-[12px] text-ink-muted lg:max-w-7xl lg:px-8 lg:pb-12">
      <div className="flex flex-col items-start gap-3 border-t border-divider pt-6 lg:flex-row lg:items-center lg:justify-between">
        <p>© {year} Tradly Ltd — Nairobi, Kenya</p>
        <nav aria-label="Footer">
          <ul className="flex flex-wrap gap-x-5 gap-y-2">
            <li>
              <Link to="/faq" className="hover:text-ink">FAQ</Link>
            </li>
            <li>
              <Link to="/account" className="hover:text-ink">Account</Link>
            </li>
            <li>
              <Link to="/orders" className="hover:text-ink">Orders</Link>
            </li>
          </ul>
        </nav>
      </div>
    </footer>
  );
}