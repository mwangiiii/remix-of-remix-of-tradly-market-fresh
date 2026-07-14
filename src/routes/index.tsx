import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AppShell } from "../marketplace/components/AppShell";
import { SearchBar } from "../marketplace/components/SearchBar";
import { CategoryPillRow } from "../marketplace/components/CategoryPillRow";
import { ProductCard } from "../marketplace/components/ProductCard";
import { Wordmark } from "../marketplace/components/BrowseHeader";
import { getAllProducts, getOrders } from "../marketplace/api/marketplaceApi";

export const Route = createFileRoute("/")({
  component: Home,
});

function Home() {
  const { data: products = [] } = useQuery({
    queryKey: ["products"],
    queryFn: getAllProducts,
  });
  const { data: orders = [] } = useQuery({ queryKey: ["orders"], queryFn: getOrders });

  const featured = products.filter((p) => p.isFeatured);
  const todayPrices = products.slice(0, 8);

  const freqIds = Array.from(new Set(orders.flatMap((o) => o.lines.map((l) => l.productId))));
  const frequent = freqIds
    .map((id) => products.find((p) => p.id === id))
    .filter((p): p is NonNullable<typeof p> => Boolean(p))
    .slice(0, 8);

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

        {frequent.length > 0 && (
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
              {frequent.map((p) => (
                <div key={p.id} className="w-40 shrink-0 snap-start lg:w-auto">
                  <ProductCard product={p} />
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
          <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4 lg:gap-6">
            {todayPrices.map((p) => <ProductCard key={p.id} product={p} />)}
          </div>
        </section>

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

        <section className="mt-12 rounded-3xl border border-divider bg-surface p-5 lg:mt-20 lg:p-8">
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
