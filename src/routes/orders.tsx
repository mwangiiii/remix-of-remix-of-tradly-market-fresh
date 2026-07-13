import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { AppShell } from "../marketplace/components/AppShell";
import { TrustHeader } from "../marketplace/components/TrustHeader";
import { StatusBadge } from "../marketplace/components/StatusBadge";
import { getOrders } from "../marketplace/api/mockMarketplaceApi";
import { useCartStore } from "../marketplace/store/cartStore";
import { formatKes } from "../marketplace/lib/format";
import { toast } from "sonner";
import { useNavigate } from "@tanstack/react-router";
import { RotateCw } from "lucide-react";

export const Route = createFileRoute("/orders")({
  head: () => ({ meta: [{ title: "Your orders — Tradly Market" }, { name: "robots", content: "noindex" }] }),
  component: Orders,
});

function Orders() {
  const navigate = useNavigate();
  const { data: orders = [] } = useQuery({ queryKey: ["orders"], queryFn: getOrders });
  const loadLines = useCartStore((s) => s.loadLines);

  const handleReorder = (orderId: string) => {
    const o = orders.find((x) => x.id === orderId);
    if (!o) return;
    loadLines(o.lines);
    toast.success(`${o.lines.length} items added to cart`);
    navigate({ to: "/cart" });
  };

  return (
    <AppShell>
      <div className="px-4">
        <TrustHeader title="Your orders" back="/" />

        {orders.length === 0 ? (
          <p className="py-16 text-center text-sm text-ink-muted">No orders yet.</p>
        ) : (
          <ul className="mt-4 space-y-3">
            {orders.map((o) => (
              <li key={o.id} className="rounded-2xl border border-divider bg-surface p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[15px] font-semibold text-ink">{o.requestNumber}</p>
                    <p className="mt-0.5 text-[12px] text-ink-muted">
                      {o.lines.length} items · {formatDistanceToNow(new Date(o.submittedAt), { addSuffix: true })}
                    </p>
                  </div>
                  <StatusBadge status={o.status} />
                </div>

                <div className="mt-3 flex -space-x-2">
                  {o.lines.slice(0, 5).map((l) => (
                    <div key={l.productUnitId} className="h-10 w-10 overflow-hidden rounded-full border-2 border-surface bg-muted">
                      <img src={l.thumbnailUrl} alt="" className="h-full w-full object-cover" />
                    </div>
                  ))}
                  {o.lines.length > 5 && (
                    <div className="grid h-10 w-10 place-items-center rounded-full border-2 border-surface bg-muted text-[11px] font-semibold text-ink-muted">
                      +{o.lines.length - 5}
                    </div>
                  )}
                </div>

                <div className="mt-4 flex items-center justify-between border-t border-divider pt-3">
                  <span className="text-[15px] font-bold text-trust">{formatKes(o.totalKes)}</span>
                  <div className="flex items-center gap-2">
                    <Link
                      to="/orders/$id" params={{ id: o.id }}
                      className="rounded-full border border-divider px-3.5 py-1.5 text-[12px] font-semibold text-ink"
                    >
                      View
                    </Link>
                    <button
                      type="button"
                      onClick={() => handleReorder(o.id)}
                      className="inline-flex items-center gap-1.5 rounded-full bg-farm px-3.5 py-1.5 text-[12px] font-semibold text-farm-foreground"
                    >
                      <RotateCw className="h-3 w-3" /> Reorder
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </AppShell>
  );
}
