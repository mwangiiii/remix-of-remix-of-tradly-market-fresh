// Admin: consumer-order status flipper (unblocks Phase 1 F3 walkthrough).
//
// Consumer orders never touch the tenant PR chain — spec §3.2. Ops walks
// them paid → picking → dispatched → delivered manually until Phase 2's
// rider tooling does it via mobile taps. Payment (pending_payment → paid)
// is webhook-only; cancel goes through the consumer-order-cancel Edge
// Function so stock reservations get released consistently.

import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { AlertTriangle, ArrowLeft, Ban, ChevronDown, ChevronRight, Loader2, Package, Truck, CircleDollarSign, Check } from "lucide-react";
import { RequireAdmin } from "@/components/RequireAdmin";
import {
  adminAdvanceConsumerOrder,
  adminListConsumerOrders,
  adminMarkLineShortfall,
  cancelConsumerOrder,
  nextConsumerStatus,
} from "../marketplace/api/consumerOrders";
import { StatusBadge } from "../marketplace/components/StatusBadge";
import { formatKes } from "../marketplace/lib/format";
import type { ConsumerOrder, ConsumerOrderStatus } from "../marketplace/types/marketplace";

export const Route = createFileRoute("/admin/consumer-orders")({
  head: () => ({
    meta: [{ title: "Consumer orders — Tradly Admin" }, { name: "robots", content: "noindex" }],
  }),
  component: () => (
    <RequireAdmin>
      <ConsumerOrdersAdmin />
    </RequireAdmin>
  ),
});

// Bucket layout — matches the spec §9.1 walk order.
const STATUS_BUCKETS: { label: string; statuses: ConsumerOrderStatus[] }[] = [
  { label: "Awaiting payment", statuses: ["pending_payment"] },
  { label: "Paid — to pick",   statuses: ["paid"] },
  { label: "Picking",          statuses: ["picking"] },
  { label: "Out for delivery", statuses: ["dispatched"] },
  { label: "Delivered",        statuses: ["delivered"] },
  { label: "Closed",           statuses: ["cancelled", "expired"] },
];

const NEXT_LABEL: Partial<Record<ConsumerOrderStatus, { label: string; icon: typeof Package }>> = {
  paid:       { label: "Start picking",   icon: Package },
  picking:    { label: "Mark dispatched", icon: Truck },
  dispatched: { label: "Mark delivered",  icon: Check },
};

function ConsumerOrdersAdmin() {
  const qc = useQueryClient();
  const { data: orders = [], isLoading } = useQuery({
    queryKey: ["admin", "consumer-orders"],
    queryFn: adminListConsumerOrders,
    // Payments land via webhook — refetch periodically so the admin sees
    // pending_payment → paid transitions without a manual refresh.
    refetchInterval: 15_000,
  });

  const [busyId, setBusyId] = useState<string | null>(null);

  const advance = useMutation({
    mutationFn: ({ id, from }: { id: string; from: ConsumerOrderStatus }) =>
      adminAdvanceConsumerOrder(id, from),
    onSuccess: (nextStatus, vars) => {
      qc.invalidateQueries({ queryKey: ["admin", "consumer-orders"] });
      toast.success(`${vars.id.slice(0, 8)} → ${nextStatus}`);
    },
    onError: (e: Error) => toast.error(e.message ?? "Advance failed"),
    onSettled: () => setBusyId(null),
  });

  const cancel = useMutation({
    mutationFn: (orderId: string) => cancelConsumerOrder(orderId, "ops-initiated"),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ["admin", "consumer-orders"] });
      toast.success(res.needs_refund ? "Cancelled — refund needs manual processing" : "Cancelled");
    },
    onError: (e: Error) => toast.error(e.message ?? "Cancel failed"),
    onSettled: () => setBusyId(null),
  });

  const [expandedId, setExpandedId] = useState<string | null>(null);

  const shortfall = useMutation({
    mutationFn: (lineId: string) => adminMarkLineShortfall(lineId),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ["admin", "consumer-orders"] });
      toast.success(
        `Line marked unavailable — KES ${res.amount_kes} refundable credit issued`,
      );
    },
    onError: (e: Error) => toast.error(e.message ?? "Shortfall failed"),
  });

  const grouped = useMemo(() => {
    const map: Record<string, ConsumerOrder[]> = {};
    for (const bucket of STATUS_BUCKETS) map[bucket.label] = [];
    for (const o of orders) {
      const bucket = STATUS_BUCKETS.find((b) => b.statuses.includes(o.status));
      if (bucket) map[bucket.label].push(o);
    }
    return map;
  }, [orders]);

  return (
    <div className="min-h-screen bg-background text-ink">
      <header className="sticky top-0 z-30 border-b border-trust-deep/40 bg-trust-deep text-trust-deep-foreground">
        <div className="mx-auto flex max-w-5xl items-center gap-4 px-6 py-3.5">
          <Link to="/admin" className="grid h-9 w-9 place-items-center rounded-full hover:bg-white/10" aria-label="Back">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] opacity-70">Tradly Admin</p>
            <h1 className="text-[15px] font-semibold">Consumer orders</h1>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 pb-24 pt-6 md:px-6">
        <p className="max-w-2xl text-[13px] leading-relaxed text-ink-muted">
          Household orders (spec §9). Payment lands via Paystack webhook (auto).
          Walk paid → picking → dispatched → delivered manually here until the
          rider tooling ships in Phase 2.
        </p>

        {isLoading && (
          <div className="mt-8 flex justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-ink-muted" />
          </div>
        )}

        {!isLoading && orders.length === 0 && (
          <div className="mt-8 rounded-2xl border border-dashed border-divider p-10 text-center text-[13px] text-ink-muted">
            No consumer orders yet.
          </div>
        )}

        {!isLoading && orders.length > 0 && (
          <div className="mt-6 space-y-6">
            {STATUS_BUCKETS.map((bucket) => {
              const rows = grouped[bucket.label];
              if (rows.length === 0) return null;
              return (
                <section key={bucket.label}>
                  <div className="mb-2 flex items-baseline justify-between">
                    <h2 className="text-[12px] font-semibold uppercase tracking-wide text-ink-muted">
                      {bucket.label}
                    </h2>
                    <span className="text-[11px] tabular-nums text-ink-muted">{rows.length}</span>
                  </div>
                  <ul className="space-y-2">
                    {rows.map((o) => (
                      <li key={o.id} className="rounded-2xl border border-divider bg-surface p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <Link
                                to="/order/$id"
                                params={{ id: o.id }}
                                className="text-[14px] font-semibold text-ink hover:underline"
                              >
                                {o.orderNumber}
                              </Link>
                              <StatusBadge status={o.status} />
                            </div>
                            <p className="mt-1 text-[12px] text-ink-muted">
                              {o.lines.length} line{o.lines.length === 1 ? "" : "s"} ·{" "}
                              <span className="font-semibold text-ink">{formatKes(o.totalKes)}</span> ·{" "}
                              {o.fulfilmentMethod.replace("_", " ")} ·{" "}
                              {formatDistanceToNow(new Date(o.createdAt), { addSuffix: true })}
                              {o.requestedDate && <> · req {o.requestedDate}</>}
                            </p>
                            {o.lines.length > 0 && (
                              <button
                                type="button"
                                onClick={() => setExpandedId(expandedId === o.id ? null : o.id)}
                                className="mt-1 inline-flex items-center gap-1 text-[11.5px] text-ink-muted hover:text-ink"
                              >
                                <ChevronDown className={`h-3 w-3 transition-transform ${expandedId === o.id ? "rotate-180" : ""}`} />
                                {o.lines.length} line{o.lines.length === 1 ? "" : "s"}
                                {expandedId !== o.id && (
                                  <span className="ml-1 line-clamp-1">
                                    · {o.lines.map((l) => `${l.qty} ${l.baseUnit} ${l.productName}`).join(" · ")}
                                  </span>
                                )}
                              </button>
                            )}
                            {expandedId === o.id && (
                              <ul className="mt-2 divide-y divide-divider rounded-xl border border-divider bg-background">
                                {o.lines.map((l) => {
                                  // Shortfall is meaningful on ordered lines of paid/picking orders.
                                  const canShortfall =
                                    l.status === "ordered" &&
                                    ["paid","picking"].includes(o.status);
                                  return (
                                    <li key={l.id} className="flex items-start justify-between gap-2 px-3 py-2 text-[12px]">
                                      <div className="min-w-0 flex-1">
                                        <p className="font-medium text-ink">
                                          {l.qty} {l.baseUnit} · {l.productName}
                                          {l.status === "cancelled" && (
                                            <span className="ml-1.5 rounded-full bg-destructive/12 px-1.5 py-0.5 text-[9px] font-semibold uppercase text-destructive">
                                              Cancelled
                                            </span>
                                          )}
                                        </p>
                                        <p className="text-[10.5px] text-ink-muted tabular-nums">
                                          {formatKes(l.shelfRateKes)}/{l.baseUnit} · line {formatKes(l.lineTotalKes)}
                                        </p>
                                      </div>
                                      {canShortfall && (
                                        <button
                                          type="button"
                                          onClick={() => {
                                            if (!confirm(`Mark "${l.productName}" as unavailable? Buyer gets KES ${l.lineTotalKes} refundable credit.`)) return;
                                            shortfall.mutate(l.id);
                                          }}
                                          disabled={shortfall.isPending}
                                          className="inline-flex items-center gap-1 rounded-full border border-amber-500/40 bg-amber-500/5 px-2 py-0.5 text-[10.5px] font-semibold text-amber-700 hover:bg-amber-500/10 disabled:opacity-60"
                                          title="Mark line unavailable + auto-credit"
                                        >
                                          <AlertTriangle className="h-2.5 w-2.5" /> Mark unavailable
                                        </button>
                                      )}
                                    </li>
                                  );
                                })}
                              </ul>
                            )}
                          </div>

                          <div className="flex shrink-0 flex-col gap-1">
                            {/* Manual advance is hidden for tradly_rider orders — the
                                rider drives paid → picking → dispatched → delivered
                                via their /rider/{id} link (spec §12.4). Kept as a
                                fallback for self_pickup + customer_rider where
                                there's no rider link. */}
                            {NEXT_LABEL[o.status] && o.fulfilmentMethod !== "tradly_rider" && (() => {
                              const meta = NEXT_LABEL[o.status]!;
                              const Icon = meta.icon;
                              const nextStatus = nextConsumerStatus(o.status);
                              return (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setBusyId(o.id);
                                    advance.mutate({ id: o.id, from: o.status });
                                  }}
                                  disabled={busyId === o.id || advance.isPending || !nextStatus}
                                  className="inline-flex items-center gap-1.5 rounded-full bg-ink px-3 py-1.5 text-[12px] font-semibold text-background hover:bg-ink/90 disabled:opacity-60"
                                >
                                  <Icon className="h-3.5 w-3.5" />
                                  {meta.label}
                                  <ChevronRight className="h-3.5 w-3.5" />
                                </button>
                              );
                            })()}
                            {["pending_payment", "paid", "picking"].includes(o.status) && (
                              <button
                                type="button"
                                onClick={() => {
                                  if (!confirm(`Cancel ${o.orderNumber}?`)) return;
                                  setBusyId(o.id);
                                  cancel.mutate(o.id);
                                }}
                                disabled={busyId === o.id || cancel.isPending}
                                className="inline-flex items-center justify-center gap-1 rounded-full border border-destructive/30 bg-surface px-3 py-1.5 text-[11.5px] font-semibold text-destructive hover:bg-destructive/5 disabled:opacity-60"
                              >
                                <Ban className="h-3 w-3" /> Cancel
                              </button>
                            )}
                          </div>
                        </div>
                      </li>
                    ))}
                  </ul>
                </section>
              );
            })}
          </div>
        )}

        <p className="mt-8 text-center text-[11px] text-ink-muted">
          Payment (pending_payment → paid) is Paystack-driven and appears automatically here on webhook.
        </p>
      </main>
    </div>
  );
}

// Silence unused-import lints for lucide icons referenced via NEXT_LABEL.
void CircleDollarSign;
