import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, PackageCheck, X, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { getOrders, updateOrderStatus } from "../marketplace/api/marketplaceApi";
import { StatusBadge } from "../marketplace/components/StatusBadge";
import { formatKes } from "../marketplace/lib/format";
import type { OrderStatus } from "../marketplace/types/marketplace";
import { RequireAdmin } from "@/components/RequireAdmin";

export const Route = createFileRoute("/admin/orders")({
  head: () => ({ meta: [{ title: "Orders — Tradly Admin" }, { name: "robots", content: "noindex" }] }),
  component: () => (
    <RequireAdmin>
      <OrdersAdmin />
    </RequireAdmin>
  ),
});

function OrdersAdmin() {
  const qc = useQueryClient();
  const { data: orders = [] } = useQuery({ queryKey: ["orders"], queryFn: getOrders });

  const act = async (id: string, next: OrderStatus, label: string) => {
    await updateOrderStatus(id, next);
    qc.invalidateQueries({ queryKey: ["orders"] });
    toast.success(label);
  };

  return (
    <div className="min-h-screen bg-background text-ink">
      <header className="sticky top-0 z-30 border-b border-trust-deep/40 bg-trust-deep text-trust-deep-foreground">
        <div className="mx-auto flex max-w-6xl items-center gap-4 px-6 py-3.5">
          <Link to="/admin" className="grid h-9 w-9 place-items-center rounded-full hover:bg-white/10"><ArrowLeft className="h-5 w-5" /></Link>
          <div><p className="text-[11px] font-semibold uppercase tracking-[0.14em] opacity-70">Tradly Admin</p><h1 className="text-[15px] font-semibold">Orders</h1></div>
          <nav className="ml-auto hidden gap-1 text-[13px] font-medium md:flex">
            <Link to="/admin/catalog" className="rounded-full px-3 py-1.5 opacity-80 hover:bg-white/10">Catalog</Link>
            <Link to="/admin/categories" className="rounded-full px-3 py-1.5 opacity-80 hover:bg-white/10">Categories</Link>
            <Link to="/admin/inventory" className="rounded-full px-3 py-1.5 opacity-80 hover:bg-white/10">Inventory</Link>
            <Link to="/admin/orders" className="rounded-full bg-white/15 px-3 py-1.5">Orders</Link>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 pb-20 pt-6 md:px-6">
        <p className="text-[13px] text-ink-muted">
          Reservations hold on PO generation, resolve to available on GRN, release on cancel.
        </p>
        <ul className="mt-5 space-y-3">
          {orders.map((o) => {
            const canGRN = o.status === "po_generated" || o.status === "approved";
            const canCancel = o.status !== "delivered" && o.status !== "invoiced" && o.status !== "paid" && o.status !== "cancelled";
            return (
              <li key={o.id} className="rounded-2xl border border-divider bg-surface p-4 md:flex md:items-center md:gap-6">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-3">
                    <p className="text-[15px] font-semibold text-ink">{o.requestNumber}</p>
                    <StatusBadge status={o.status} />
                  </div>
                  <p className="mt-1 text-[12px] text-ink-muted">
                    {o.lines.length} items · {formatKes(o.totalKes)} · exp. {o.expectedDeliveryDate}
                  </p>
                  <p className="mt-2 truncate text-[12px] text-ink-muted">
                    {o.lines.map((l) => `${l.quantity}× ${l.productName} (${l.unitLabel})`).join(" · ")}
                  </p>
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-2 md:mt-0">
                  <button
                    disabled={!canGRN}
                    onClick={() => act(o.id, "delivered", `GRN posted for ${o.requestNumber} — inventory released`)}
                    className="inline-flex items-center gap-1.5 rounded-full bg-farm px-3.5 py-1.5 text-[12px] font-semibold text-farm-foreground disabled:opacity-30"
                  >
                    <PackageCheck className="h-3.5 w-3.5" /> Post GRN
                  </button>
                  <button
                    disabled={!canCancel}
                    onClick={() => act(o.id, "cancelled", `${o.requestNumber} cancelled — reservations released`)}
                    className="inline-flex items-center gap-1.5 rounded-full border border-divider bg-background px-3.5 py-1.5 text-[12px] font-semibold text-ink hover:border-destructive/40 hover:text-destructive disabled:opacity-30"
                  >
                    <X className="h-3.5 w-3.5" /> Cancel
                  </button>
                  {o.status === "pending_approval" && (
                    <button
                      onClick={() => act(o.id, "approved", `${o.requestNumber} approved`)}
                      className="inline-flex items-center gap-1.5 rounded-full bg-trust px-3.5 py-1.5 text-[12px] font-semibold text-trust-foreground"
                    >
                      <CheckCircle2 className="h-3.5 w-3.5" /> Approve
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      </main>
    </div>
  );
}
