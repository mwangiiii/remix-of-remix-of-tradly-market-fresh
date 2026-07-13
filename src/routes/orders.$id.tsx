import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import {
  ArrowLeft, FileText, PackageCheck, ReceiptText, CircleDollarSign, Check, XCircle, Clock,
} from "lucide-react";
import { AppShell } from "../marketplace/components/AppShell";
import { StatusBadge } from "../marketplace/components/StatusBadge";
import { getOrder } from "../marketplace/api/mockMarketplaceApi";
import { formatKes } from "../marketplace/lib/format";
import type { MarketplaceOrder, OrderStatus } from "../marketplace/types/marketplace";

export const Route = createFileRoute("/orders/$id")({
  head: () => ({
    meta: [
      { title: "Order — Tradly Market" },
      { name: "robots", content: "noindex" },
    ],
  }),
  loader: async ({ params }) => {
    const order = await getOrder(params.id);
    if (!order) throw notFound();
    return { order };
  },
  notFoundComponent: NotFound,
  errorComponent: ({ error }) => (
    <AppShell hideNav><div className="p-6 text-center text-sm text-ink-muted">Couldn't load order — {String(error)}</div></AppShell>
  ),
  component: OrderDetail,
});

function NotFound() {
  return (
    <AppShell hideNav>
      <div className="p-8 text-center">
        <p className="text-[15px] font-semibold text-ink">Order not found</p>
        <Link to="/orders" className="mt-4 inline-block text-[13px] font-semibold text-trust">Back to orders</Link>
      </div>
    </AppShell>
  );
}

/** Ordered lifecycle stages a customer sees. */
const LIFECYCLE: { key: OrderStatus; label: string; description: string; icon: typeof FileText }[] = [
  { key: "po_generated", label: "PO Generated",  description: "Purchase order sent to Tradly", icon: FileText },
  { key: "delivered",    label: "Delivered / GRN", description: "Goods received, stock updated", icon: PackageCheck },
  { key: "invoiced",     label: "Invoiced",      description: "Invoice issued for the shipment", icon: ReceiptText },
  { key: "paid",         label: "Paid",          description: "Payment settled", icon: CircleDollarSign },
];

/** Which lifecycle steps are considered completed for the current status. */
function reachedIndex(status: OrderStatus): number {
  switch (status) {
    case "draft":
    case "pending_approval":
    case "approved":         return -1;
    case "po_generated":     return 0;
    case "delivered":        return 1;
    case "invoiced":         return 2;
    case "paid":             return 3;
    case "cancelled":        return -1;
  }
}

function OrderDetail() {
  const { order } = Route.useLoaderData() as { order: MarketplaceOrder };
  const cancelled = order.status === "cancelled";
  const reached = reachedIndex(order.status);

  return (
    <AppShell>
      <div className="mx-auto max-w-3xl px-4 pb-16 md:px-6">
        <header className="flex items-center gap-3 py-4">
          <Link to="/orders" className="grid h-9 w-9 place-items-center rounded-full border border-divider bg-surface text-ink hover:bg-muted" aria-label="Back">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-muted">Order</p>
            <h1 className="truncate text-[20px] font-bold text-ink md:text-[24px]">{order.requestNumber}</h1>
          </div>
          <StatusBadge status={order.status} />
        </header>

        <section className="grid gap-3 rounded-2xl border border-divider bg-surface p-5 md:grid-cols-3">
          <Meta label="Submitted" value={format(new Date(order.submittedAt), "d MMM yyyy, HH:mm")} />
          <Meta label="Expected delivery" value={format(new Date(order.expectedDeliveryDate), "d MMM yyyy")} />
          <Meta label="Total" value={formatKes(order.totalKes)} accent />
        </section>

        {/* Lifecycle */}
        <section className="mt-5 rounded-2xl border border-divider bg-surface p-5">
          <div className="flex items-center justify-between">
            <p className="text-[12px] font-semibold uppercase tracking-wide text-ink-muted">Lifecycle</p>
            {cancelled && (
              <span className="inline-flex items-center gap-1 text-[12px] font-semibold text-destructive">
                <XCircle className="h-3.5 w-3.5" /> Cancelled
              </span>
            )}
          </div>

          <ol className="mt-4 space-y-4">
            {LIFECYCLE.map((step, i) => {
              const done = !cancelled && i <= reached;
              const active = !cancelled && i === reached;
              const Icon = step.icon;
              return (
                <li key={step.key} className="flex gap-4">
                  <div className="flex flex-col items-center">
                    <span
                      className={[
                        "grid h-9 w-9 place-items-center rounded-full border-2",
                        done ? "border-trust bg-trust text-trust-foreground" :
                        cancelled ? "border-divider bg-muted text-ink-muted opacity-50" :
                        "border-divider bg-background text-ink-muted",
                      ].join(" ")}
                    >
                      {done ? <Check className="h-4 w-4" strokeWidth={3} /> : <Icon className="h-4 w-4" />}
                    </span>
                    {i < LIFECYCLE.length - 1 && (
                      <span className={`mt-1 h-8 w-0.5 ${i < reached ? "bg-trust" : "bg-divider"}`} />
                    )}
                  </div>
                  <div className="flex-1 pb-2">
                    <div className="flex items-center gap-2">
                      <p className={`text-[14px] font-semibold ${done ? "text-ink" : "text-ink-muted"}`}>{step.label}</p>
                      {active && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-trust/12 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-trust-deep">
                          <Clock className="h-2.5 w-2.5" /> Current
                        </span>
                      )}
                    </div>
                    <p className="mt-0.5 text-[12px] text-ink-muted">{step.description}</p>
                  </div>
                </li>
              );
            })}
          </ol>
        </section>

        {/* Line items */}
        <section className="mt-5 rounded-2xl border border-divider bg-surface p-5">
          <p className="text-[12px] font-semibold uppercase tracking-wide text-ink-muted">Items</p>
          <ul className="mt-3 divide-y divide-divider">
            {order.lines.map((l: (typeof order.lines)[number]) => (
              <li key={l.productUnitId} className="flex items-center gap-3 py-3">
                <div className="h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-muted">
                  <img src={l.thumbnailUrl} alt="" className="h-full w-full object-cover" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[14px] font-semibold text-ink">{l.productName}</p>
                  <p className="text-[12px] text-ink-muted">{l.unitLabel} · {l.quantity} ×</p>
                </div>
                <span className="text-[14px] font-semibold tabular-nums text-ink">
                  {formatKes(l.priceKes * l.quantity)}
                </span>
              </li>
            ))}
          </ul>
          <div className="mt-3 flex items-center justify-between border-t border-divider pt-3">
            <span className="text-[13px] text-ink-muted">Total</span>
            <span className="text-[17px] font-bold text-trust">{formatKes(order.totalKes)}</span>
          </div>
        </section>

        <p className="mt-6 text-center text-[11px] text-ink-muted">
          Sourced from Tradly — Kenya's single-source supply chain.
        </p>
      </div>
    </AppShell>
  );
}

function Meta({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-muted">{label}</p>
      <p className={`mt-1 text-[14px] font-semibold ${accent ? "text-trust" : "text-ink"}`}>{value}</p>
    </div>
  );
}
