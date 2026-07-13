import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AppShell } from "../marketplace/components/AppShell";
import { SearchBar } from "../marketplace/components/SearchBar";
import { CategoryPillRow } from "../marketplace/components/CategoryPillRow";
import { ProductCard } from "../marketplace/components/ProductCard";
import { Wordmark } from "../marketplace/components/BrowseHeader";
import { getAllProducts, getOrders } from "../marketplace/api/mockMarketplaceApi";
import { ShieldCheck } from "lucide-react";

export const Route = createFileRoute("/")({
  component: Home,
});

function Home() {
  const { data: products = [] } = useQuery({ queryKey: ["products"], queryFn: getAllProducts });
  const { data: orders = [] } = useQuery({ queryKey: ["orders"], queryFn: getOrders });

  const featured = products.filter((p) => p.isFeatured);
  const todayPrices = products.slice(0, 6);

  // "Frequently ordered" = product ids drawn from past orders
  const freqIds = Array.from(new Set(orders.flatMap((o) => o.lines.map((l) => l.productId))));
  const frequent = freqIds
    .map((id) => products.find((p) => p.id === id))
    .filter((p): p is NonNullable<typeof p> => Boolean(p))
    .slice(0, 8);

  const today = new Date().toLocaleDateString("en-KE", { day: "numeric", month: "short" });

  return (
    <AppShell>
      <div className="px-4">
        <div className="flex items-center justify-between pt-4 pb-2">
          <Wordmark className="text-lg" />
          <Link to="/notifications" className="text-xs font-medium text-ink-muted hover:text-ink">
            Notifications
          </Link>
        </div>

        <SearchBar />

        <div className="pt-3">
          <CategoryPillRow />
        </div>

        {frequent.length > 0 && (
          <section className="pt-6">
            <div className="mb-3 flex items-baseline justify-between">
              <h2 className="text-[15px] font-semibold text-ink">Frequently ordered</h2>
              <Link to="/orders" className="text-xs font-medium text-ink-muted">Past orders</Link>
            </div>
            <div className="hide-scrollbar -mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-1">
              {frequent.map((p) => (
                <div key={p.id} className="w-40 shrink-0 snap-start">
                  <ProductCard product={p} />
                </div>
              ))}
            </div>
          </section>
        )}

        <section className="pt-8">
          <div className="mb-3 flex items-baseline justify-between">
            <h2 className="text-[15px] font-semibold text-ink">Today's prices</h2>
            <span className="text-[11px] font-medium text-ink-muted">Updated {today}</span>
          </div>
          <div className="grid grid-cols-2 gap-4">
            {todayPrices.map((p) => <ProductCard key={p.id} product={p} />)}
          </div>
        </section>

        {featured.length > 0 && (
          <section className="pt-8">
            <h2 className="mb-3 text-[15px] font-semibold text-ink">Featured this week</h2>
            <div className="grid grid-cols-2 gap-4">
              {featured.slice(0, 4).map((p) => <ProductCard key={p.id} product={p} />)}
            </div>
          </section>
        )}

        <section className="mt-10 rounded-2xl border border-divider bg-surface p-4">
          <div className="flex items-start gap-3">
            <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-trust/10 text-trust">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <p className="text-[13px] font-semibold text-ink">Sourced by Tradly</p>
              <p className="mt-0.5 text-[12px] leading-relaxed text-ink-muted">
                One supplier, one invoice, eTIMS-compliant. The same Tradly that runs your procurement.
              </p>
            </div>
          </div>
        </section>
      </div>
    </AppShell>
  );
}
