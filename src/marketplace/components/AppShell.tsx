import type { ReactNode } from "react";
import { BottomNav } from "./BottomNav";
import { TopNav } from "./TopNav";

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
  const width = variant === "storefront" ? "lg:max-w-7xl" : "lg:max-w-4xl";
  return (
    <div className="min-h-screen bg-background text-ink">
      {!hideNav && <TopNav />}
      <div className={`mx-auto max-w-lg pb-24 lg:pb-16 ${width}`}>
        {children}
      </div>
      {!hideNav && <BottomNav />}
    </div>
  );
}