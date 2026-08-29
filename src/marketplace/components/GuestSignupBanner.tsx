// Next step for an anonymous visitor.
//
// The growth brief assumed the catalogue was behind a login and asked for a
// public read-only view to be built. It already is public: src/routes/index.tsx
// has no auth gate, no beforeLoad and no redirect, and marketplace_products /
// marketplace_product_units carry anon-readable RLS policies for published
// rows — verified against production, 20 products with live prices.
//
// So the real gap was not visibility, it was that a signed-out visitor could
// browse real prices and then find no obvious way to act. This is that step.
// Rendered only when signed out; signed-in users already have cart and orders.

import { Link } from "@tanstack/react-router";
import { useAuth } from "@/hooks/use-auth";
import { trackEvent } from "@/lib/analytics";

export function GuestSignupBanner() {
  const { isAuthenticated } = useAuth();
  if (isAuthenticated) return null;

  return (
    <section className="mt-8 rounded-2xl border border-divider bg-surface p-5 lg:mt-12 lg:p-7">
      <h2 className="text-[16px] font-semibold text-ink lg:text-[20px]">
        Fresh produce, rice, and pantry items
      </h2>
      <p className="mt-1.5 max-w-xl text-[13px] leading-relaxed text-ink-muted lg:text-[15px]">
        One supplier, one invoice, delivered same-day across Kenya. Prices above
        are live — create a free account to place an order.
      </p>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        {/* /login's searchSchema only accepts `next` — there is no signup
            mode param, so both links go to the same route and the intent is
            captured by the event, not the URL. */}
        <Link
          to="/login"
          search={{ next: "/" }}
          onClick={() => trackEvent("market_signup_started", { from: "catalogue" })}
          className="inline-flex items-center justify-center rounded-full bg-farm px-5 py-2.5 text-[14px] font-semibold text-farm-foreground transition-opacity hover:opacity-90"
        >
          Create a free account to order
        </Link>
        <Link
          to="/login"
          className="text-[13px] font-medium text-ink-muted underline-offset-4 hover:text-ink hover:underline"
        >
          Already have an account? Log in
        </Link>
      </div>
    </section>
  );
}
