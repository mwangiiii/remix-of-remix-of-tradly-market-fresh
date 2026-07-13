import { createFileRoute, notFound, useNavigate } from "@tanstack/react-router";
import { AppShell } from "../marketplace/components/AppShell";
import { BrowseHeader } from "../marketplace/components/BrowseHeader";
import { getSavedList } from "../marketplace/api/marketplaceApi";
import { useCartStore } from "../marketplace/store/cartStore";
import { formatKes } from "../marketplace/lib/format";
import { toast } from "sonner";

export const Route = createFileRoute("/lists/$id")({
  head: () => ({ meta: [{ title: "Saved list — Tradly Market" }, { name: "robots", content: "noindex" }] }),
  loader: async ({ params }) => {
    const list = await getSavedList(params.id);
    if (!list) throw notFound();
    return { list };
  },
  component: ListDetail,
});

function ListDetail() {
  const { list } = Route.useLoaderData() as { list: import("../marketplace/types/marketplace").SavedList };
  const navigate = useNavigate();
  const loadLines = useCartStore((s) => s.loadLines);
  const total = list.items.reduce((s: number, i) => s + i.priceKes * i.quantity, 0);

  const addAll = () => {
    loadLines(list.items);
    toast.success(`${list.items.length} items added to cart`);
    navigate({ to: "/cart" });
  };

  return (
    <AppShell>
      <div className="px-4 pb-32">
        <BrowseHeader title={list.name} back="/lists" />

        <ul className="mt-3 divide-y divide-divider">
          {list.items.map((it) => (
            <li key={it.productUnitId} className="flex items-center gap-3 py-3">
              <div className="h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-surface soft-shadow">
                <img src={it.thumbnailUrl} alt={it.productName} className="h-full w-full object-cover" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[14px] font-semibold text-ink">{it.productName}</p>
                <p className="text-[12px] text-ink-muted">{it.unitLabel} × {it.quantity}</p>
              </div>
              <span className="text-[13px] font-semibold text-farm">{formatKes(it.priceKes * it.quantity)}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="fixed inset-x-0 bottom-16 z-30 border-t border-divider bg-surface/95 backdrop-blur">
        <div className="mx-auto flex max-w-lg items-center justify-between gap-3 px-4 py-3">
          <div>
            <p className="text-[11px] font-medium uppercase tracking-wide text-ink-muted">Total</p>
            <p className="text-[16px] font-bold text-farm">{formatKes(total)}</p>
          </div>
          <button
            type="button" onClick={addAll}
            className="flex-1 rounded-full bg-farm px-5 py-3 text-[14px] font-semibold text-farm-foreground"
          >
            Add all to cart
          </button>
        </div>
      </div>
    </AppShell>
  );
}
