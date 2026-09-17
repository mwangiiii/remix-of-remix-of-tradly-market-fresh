import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Loader2 } from "lucide-react";
import { format } from "date-fns";
import {
  adminListPriceHistory,
  adminListProducts,
  type AdminPriceVersion,
} from "../marketplace/api/adminCatalog";
import { RequireAdmin } from "@/components/RequireAdmin";
import { formatKes } from "../marketplace/lib/format";
import type { MarketplaceRoundingRule } from "../marketplace/types/marketplace";

export const Route = createFileRoute("/admin/product/$id/prices")({
  head: () => ({
    meta: [
      { title: "Price history — Tradly Admin" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: () => (
    <RequireAdmin>
      <PriceHistoryView />
    </RequireAdmin>
  ),
});

const ROUNDING_LABEL: Record<MarketplaceRoundingRule, string> = {
  exact: "Exact",
  nearest_1: "Nearest 1",
  nearest_5: "Nearest 5",
  nearest_10: "Nearest 10",
  charm_down: "Charm (…95)",
};

function PriceHistoryView() {
  const { id } = Route.useParams();

  const { data: versions = [], isLoading } = useQuery({
    queryKey: ["admin", "price-history", id],
    queryFn: () => adminListPriceHistory(id),
  });

  // Pull product name from the shared admin products list — cheap because
  // the admin catalog page already primes this cache.
  const { data: products = [] } = useQuery({
    queryKey: ["admin", "products"],
    queryFn: adminListProducts,
    staleTime: 60_000,
  });
  const product = products.find((p) => p.id === id);

  return (
    <div className="min-h-screen bg-background text-ink">
      <header className="sticky top-0 z-30 border-b border-trust-deep/40 bg-trust-deep text-trust-deep-foreground">
        <div className="mx-auto flex max-w-5xl items-center gap-4 px-6 py-3.5">
          <Link
            to="/admin/catalog"
            className="grid h-9 w-9 place-items-center rounded-full hover:bg-white/10"
            aria-label="Back to catalog"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] opacity-70">Tradly Admin</p>
            <h1 className="truncate text-[15px] font-semibold">
              Price history · {product?.name ?? "Loading…"}
            </h1>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 pb-20 pt-6">
        <p className="text-[13px] text-ink-muted">
          Every write to <span className="font-mono">fn_marketplace_write_price_version</span> creates a new row.
          The topmost row with no <em>closed</em> date is what the storefront serves now.
        </p>

        {isLoading && (
          <div className="mt-8 flex justify-center py-10">
            <Loader2 className="h-5 w-5 animate-spin text-ink-muted" />
          </div>
        )}

        {!isLoading && versions.length === 0 && (
          <div className="mt-8 rounded-2xl border border-dashed border-divider py-16 text-center text-[13px] text-ink-muted">
            No price versions for this product yet.
          </div>
        )}

        {!isLoading && versions.length > 0 && (
          <section className="mt-5 overflow-hidden rounded-2xl border border-divider bg-surface">
            <table className="w-full text-left text-[13px]">
              <thead className="border-b border-divider bg-background/60 text-[11px] uppercase tracking-wide text-ink-muted">
                <tr>
                  <th className="px-4 py-3 font-semibold">Effective</th>
                  <th className="px-3 py-3 text-right font-semibold">Cost</th>
                  <th className="px-3 py-3 text-right font-semibold">Markup</th>
                  <th className="px-3 py-3 text-right font-semibold">Shelf</th>
                  <th className="px-3 py-3 font-semibold">Rounding</th>
                  <th className="px-4 py-3 font-semibold">Reason</th>
                </tr>
              </thead>
              <tbody>
                {versions.map((v) => (
                  <PriceVersionRow key={v.id} v={v} />
                ))}
              </tbody>
            </table>
          </section>
        )}
      </main>
    </div>
  );
}

function PriceVersionRow({ v }: { v: AdminPriceVersion }) {
  const isCurrent = v.effectiveTo === null;
  return (
    <tr className="border-b border-divider last:border-b-0">
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          {isCurrent && (
            <span className="inline-flex items-center gap-1 rounded-full bg-farm/12 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-farm">
              <span className="h-1.5 w-1.5 rounded-full bg-current" />
              Current
            </span>
          )}
          <div>
            <p className="font-medium text-ink">
              {format(new Date(v.effectiveFrom), "d MMM yyyy · HH:mm")}
            </p>
            <p className="text-[11px] text-ink-muted">
              {isCurrent
                ? "still live"
                : `closed ${format(new Date(v.effectiveTo!), "d MMM yyyy · HH:mm")}`}
            </p>
          </div>
        </div>
      </td>
      <td className="px-3 py-3 text-right tabular-nums text-ink">{formatKes(v.costRateKes)}</td>
      <td className="px-3 py-3 text-right tabular-nums">
        <span className="text-ink">{v.effectiveMarkupPct.toFixed(2)}%</span>
        {v.markupPct == null && (
          <span className="ml-1 text-[10px] uppercase tracking-wide text-ink-muted">inherited</span>
        )}
      </td>
      <td className="px-3 py-3 text-right font-semibold tabular-nums text-ink">
        {formatKes(v.shelfRateKes)}
      </td>
      <td className="px-3 py-3 text-ink-muted">{ROUNDING_LABEL[v.roundingRule]}</td>
      <td className="px-4 py-3 text-ink-muted">
        {v.changeReason ? (
          <span className="text-ink">{v.changeReason}</span>
        ) : (
          <span className="italic">no reason recorded</span>
        )}
      </td>
    </tr>
  );
}
