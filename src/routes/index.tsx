import { useEffect } from "react";
import { GuestSignupBanner } from "@/marketplace/components/GuestSignupBanner";
import { trackEvent } from "@/lib/analytics";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { AppShell } from "../marketplace/components/AppShell";
import { SearchBar } from "../marketplace/components/SearchBar";
import { CategoryPillRow } from "../marketplace/components/CategoryPillRow";
import { ProductCard } from "../marketplace/components/ProductCard";
import { Wordmark } from "../marketplace/components/BrowseHeader";
import { ProductGridSkeleton } from "../marketplace/components/Skeletons";
import { getAllProducts, getOrders } from "../marketplace/api/marketplaceApi";
import {
  canonicalLink,
  siteUrl,
  jsonLd,
  collectionPageLd,
  FAQ_ITEMS,
  DELIVERY_ZONES,
} from "../marketplace/lib/seo";
import { MapPin, HelpCircle } from "lucide-react";

const HOME_DESCRIPTION =
  "Order fresh vegetables, fruits, rice, dairy and cooking essentials from Tradly. Same-day dispatch in Nairobi, one supplier, one eTIMS-compliant invoice.";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Tradly Market — Fresh produce for Kenyan kitchens" },
      { property: "og:url", content: siteUrl("/") },
    ],
    links: [canonicalLink("/")],
    scripts: [
      // Home is primarily a product catalog — tag it as CollectionPage so
      // Google reads its intent unambiguously. FAQPage schema lives on
      // /faq (dedicated route), not here.
      jsonLd(
        collectionPageLd({
          path: "/",
          name: "Tradly Market",
          description: HOME_DESCRIPTION,
        }),
        "ld-home-collection",
      ),
    ],
  }),
  component: Home,
});

// The teaser only surfaces these three top questions. Full list lives on
// /faq — including the delivery-zones answer that this page also renders
// visually via the "Where we deliver" section below.
const HOME_FAQ_TEASER_QS = [
  "How fast does Tradly Market deliver in Nairobi?",
  "Do I get a KRA-compliant invoice?",
  "How do I pay?",
];

function Home() {
  const { data: products = [], isLoading: productsLoading } = useQuery({
    queryKey: ["products"],
    queryFn: getAllProducts,
  });
  const { data: orders = [], isPending: ordersPending } = useQuery({
    queryKey: ["orders"],
    queryFn: getOrders,
  });

  // Memoize the derived slices so we don't recompute filter/find on every
  // render (e.g. when unrelated state changes elsewhere in the tree).
  const featured = useMemo(() => products.filter((p) => p.isFeatured), [products]);
  // Fires on mount regardless of auth state — this is the public
  // catalogue view, and signed-out visits are the ones that matter
  // most for the funnel.
  useEffect(() => { trackEvent("market_catalogue_viewed"); }, []);

  const todayPrices = useMemo(() => products.slice(0, 8), [products]);
  const frequent = useMemo(() => {
    const freqIds = Array.from(new Set(orders.flatMap((o) => o.lines.map((l) => l.productId))));
    return freqIds
      .map((id) => products.find((p) => p.id === id))
      .filter((p): p is NonNullable<typeof p> => Boolean(p))
      .slice(0, 8);
  }, [products, orders]);

  const today = new Date().toLocaleDateString("en-KE", { day: "numeric", month: "short" });

  return (
    <AppShell>
      <div className="px-4 lg:px-8">
        {/* Mobile wordmark row (desktop has TopNav) */}
        <div className="flex items-center justify-between pt-4 pb-2 lg:hidden">
          <Wordmark className="text-lg" />
          <Link to="/notifications" className="text-xs font-medium text-ink-muted hover:text-ink">
            Notifications
          </Link>
        </div>

        {/* Editorial hero */}
        <section className="hidden pt-10 pb-6 lg:block">
          <p className="text-[12px] font-medium uppercase tracking-[0.18em] text-ink-muted">
            Tradly Market · Nairobi
          </p>
          <h1 className="mt-3 max-w-3xl text-[52px] font-semibold leading-[1.05] tracking-tight text-ink">
            Fresh produce.
            <br />
            <span className="text-ink-muted">Single source. Single invoice.</span>
          </h1>
          <p className="mt-4 max-w-xl text-[15px] leading-relaxed text-ink-muted">
            Vegetables, fruit, rice and pantry staples, curated by Tradly and delivered
            same day across Kenyan kitchens.
          </p>
        </section>

        <SearchBar />

        <div className="pt-3 lg:pt-5">
          <CategoryPillRow />
        </div>

        {/* Only render the frequent-reorder section once orders has resolved.
            Rendering it later would push the whole rest of the page down and
            spike CLS; keeping it hidden until we know the outcome means at
            most one shift (when a user with orders lands), and never a
            "phantom" section for a first-time buyer. */}
        {!ordersPending && frequent.length > 0 && (
          <section className="pt-6 lg:pt-14">
            <div className="mb-3 flex items-baseline justify-between lg:mb-5">
              <h2 className="text-[15px] font-semibold text-ink lg:text-[22px] lg:tracking-tight">
                Reorder in one tap
              </h2>
              <Link to="/orders" className="text-xs font-medium text-ink-muted hover:text-ink lg:text-[13px]">
                All orders →
              </Link>
            </div>
            <div className="hide-scrollbar -mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-1 lg:mx-0 lg:grid lg:grid-cols-4 lg:gap-6 lg:overflow-visible lg:px-0">
              {frequent.map((p, i) => (
                <div key={p.id} className="w-40 shrink-0 snap-start lg:w-auto">
                  <ProductCard product={p} priority={i < 2} />
                </div>
              ))}
            </div>
          </section>
        )}

        <section className="pt-8 lg:pt-16">
          <div className="mb-3 flex items-baseline justify-between lg:mb-5">
            <h2 className="text-[15px] font-semibold text-ink lg:text-[22px] lg:tracking-tight">
              Today at market
            </h2>
            <span className="text-[11px] font-medium text-ink-muted lg:text-[13px]">
              Prices refreshed {today}
            </span>
          </div>
          {productsLoading && todayPrices.length === 0 ? (
            <ProductGridSkeleton count={8} />
          ) : (
            <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4 lg:gap-6">
              {todayPrices.map((p, i) => (
                // First 4 tiles are above the fold on mobile (2 cols × 2 rows)
                // and on desktop (4 cols × 1 row) — priority so the LCP image
                // isn't lazy-loaded and gets fetchpriority=high.
                <ProductCard key={p.id} product={p} priority={i < 4} />
              ))}
            </div>
          )}
        </section>

        <GuestSignupBanner />

        {featured.length > 0 && (
          <section className="pt-10 lg:pt-16">
            <h2 className="mb-3 text-[15px] font-semibold text-ink lg:mb-5 lg:text-[22px] lg:tracking-tight">
              In season
            </h2>
            <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4 lg:gap-6">
              {featured.slice(0, 8).map((p) => <ProductCard key={p.id} product={p} />)}
            </div>
          </section>
        )}

        {/* Home is a CollectionPage (see head scripts) so it doesn't render
            an accordion or FAQPage schema — that lives on /faq. This is
            just a discoverability teaser: three top questions as flat rows
            with a link across. */}
        <section className="mt-12 lg:mt-20" aria-labelledby="home-faq-heading">
          <div className="mb-3 flex items-baseline justify-between lg:mb-5">
            <h2
              id="home-faq-heading"
              className="text-[15px] font-semibold text-ink lg:text-[22px] lg:tracking-tight"
            >
              Common questions
            </h2>
            <Link
              to="/faq"
              className="text-xs font-medium text-ink-muted hover:text-ink lg:text-[13px]"
            >
              See all FAQs →
            </Link>
          </div>
          <ul className="divide-y divide-divider rounded-2xl border border-divider bg-surface">
            {HOME_FAQ_TEASER_QS.map((q) => {
              const item = FAQ_ITEMS.find((f) => f.q === q);
              if (!item) return null;
              return (
                <li key={item.q}>
                  <Link
                    to="/faq"
                    className="flex items-center justify-between gap-3 px-5 py-4 text-[14px] font-medium text-ink hover:bg-background/60 lg:px-6 lg:py-5 lg:text-[15px]"
                  >
                    <span className="flex items-center gap-3">
                      <HelpCircle
                        className="h-4 w-4 shrink-0 text-ink-muted"
                        aria-hidden="true"
                      />
                      <span>{item.q}</span>
                    </span>
                    <span
                      aria-hidden="true"
                      className="text-ink-muted"
                    >
                      →
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>

        {/* Delivery coverage. Names are load-bearing SEO copy — Google's
            long-tail signals ("grocery delivery karen") ride on rendered
            text, not JSON-LD. Kept in seo.ts so this list and any future
            areaServed / FAQ additions stay in one place. */}
        <section className="mt-10 lg:mt-14" aria-labelledby="delivery-areas-heading">
          <div className="mb-3 flex items-baseline justify-between lg:mb-5">
            <h2
              id="delivery-areas-heading"
              className="text-[15px] font-semibold text-ink lg:text-[22px] lg:tracking-tight"
            >
              Where we deliver
            </h2>
            <span className="text-[11px] font-medium text-ink-muted lg:text-[13px]">
              Same-day in Nairobi
            </span>
          </div>
          <p className="mb-4 text-[13px] leading-relaxed text-ink-muted lg:text-[14px]">
            Tradly Market covers Nairobi, Kiambu, Machakos, Kirinyaga, Murang'a, Nyeri,
            Nyandarua, Embu, Nakuru, Laikipia and Uasin Gishu counties — restaurants, hotels,
            schools, hospitals and institutions across the zones below.
          </p>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3 lg:gap-4">
            {DELIVERY_ZONES.map((z) => (
              <div
                key={z.zone}
                className="rounded-2xl border border-divider bg-surface p-4 lg:p-5"
              >
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 shrink-0 text-trust" aria-hidden="true" />
                  <h3 className="text-[13px] font-semibold text-ink lg:text-[14px]">
                    {z.zone}
                  </h3>
                </div>
                <p className="mt-2 text-[12.5px] leading-relaxed text-ink-muted lg:text-[13px]">
                  {z.places.join(" · ")}
                </p>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-8 rounded-3xl border border-divider bg-surface p-5 lg:mt-12 lg:p-8">
          <div className="min-w-0">
            <p className="text-[14px] font-semibold text-ink lg:text-[17px]">Sourced by Tradly</p>
            <p className="mt-1 text-[12px] font-medium uppercase tracking-[0.08em] text-trust-deep lg:text-[13px]">
              Corporate supply assurance
            </p>
          </div>
        </section>
      </div>
    </AppShell>
  );
}
