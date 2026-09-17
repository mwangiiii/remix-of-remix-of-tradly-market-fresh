// Admin: delivery ops queue (Phase 2 Checkpoint G — G-admin-deliveries).
//
// Two sections:
//   Awaiting dispatch  — paid tradly_rider orders with no delivery row yet.
//                        Assign rider (+ optional band override) via
//                        fn_delivery_assign; flips the order paid → picking.
//   In progress        — deliveries at status assigned or picked_up.
//                        Ops can advance from here as a fallback when the
//                        rider's own tap doesn't happen.
//
// Rider-driven advances (spec §12.4) come through the rider link at
// /rider/{id}?t={token}. Ops advance stays here as a safety net.

import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { ArrowLeft, ChevronRight, Loader2, MapPin, Package, Truck } from "lucide-react";
import { RequireAdmin } from "@/components/RequireAdmin";
import { StatusBadge } from "../marketplace/components/StatusBadge";
import {
  type DeliveryStatus,
  type Driver,
  adminAdvanceDelivery,
  adminAssignDelivery,
  adminListDrivers,
  adminListInProgressDeliveries,
  adminListUnassignedOrders,
} from "../marketplace/api/deliveries";
import { formatKes } from "../marketplace/lib/format";
import type { DistanceBand } from "../marketplace/types/marketplace";

export const Route = createFileRoute("/admin/deliveries")({
  head: () => ({
    meta: [{ title: "Deliveries — Tradly Admin" }, { name: "robots", content: "noindex" }],
  }),
  component: () => (
    <RequireAdmin>
      <DeliveriesAdmin />
    </RequireAdmin>
  ),
});

function DeliveriesAdmin() {
  const qc = useQueryClient();
  const { data: unassigned = [], isLoading: unassignedLoading } = useQuery({
    queryKey: ["admin", "deliveries", "unassigned"],
    queryFn: adminListUnassignedOrders,
    refetchInterval: 15_000, // catch new paid orders quickly
  });
  const { data: inProgress = [], isLoading: inProgressLoading } = useQuery({
    queryKey: ["admin", "deliveries", "in-progress"],
    queryFn: adminListInProgressDeliveries,
    refetchInterval: 15_000,
  });
  const { data: drivers = [] } = useQuery({
    queryKey: ["admin", "drivers", "active"],
    queryFn: () => adminListDrivers(false),
    staleTime: 60_000,
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["admin", "deliveries"] });
    qc.invalidateQueries({ queryKey: ["admin", "consumer-orders"] });
  };

  const assign = useMutation({
    mutationFn: (args: { orderId: string; driverId: string; band?: DistanceBand }) =>
      adminAssignDelivery(args.orderId, args.driverId, args.band),
    onSuccess: (_, vars) => {
      invalidate();
      const d = drivers.find((x) => x.id === vars.driverId);
      toast.success(`Assigned to ${d?.fullName ?? "rider"}`);
    },
    onError: (e: Error) => toast.error(e.message ?? "Assign failed"),
  });

  const advance = useMutation({
    mutationFn: (args: { deliveryId: string; nextStatus: "picked_up" | "delivered" }) =>
      adminAdvanceDelivery(args.deliveryId, args.nextStatus),
    onSuccess: (_, vars) => {
      invalidate();
      toast.success(`Marked ${vars.nextStatus.replace("_", " ")}`);
    },
    onError: (e: Error) => toast.error(e.message ?? "Advance failed"),
  });

  return (
    <div className="min-h-screen bg-background text-ink">
      <header className="sticky top-0 z-30 border-b border-trust-deep/40 bg-trust-deep text-trust-deep-foreground">
        <div className="mx-auto flex max-w-5xl items-center gap-4 px-6 py-3.5">
          <Link to="/admin" className="grid h-9 w-9 place-items-center rounded-full hover:bg-white/10" aria-label="Back">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] opacity-70">Tradly Admin</p>
            <h1 className="text-[15px] font-semibold">Deliveries</h1>
          </div>
          <nav className="ml-auto hidden gap-1 text-[13px] font-medium md:flex">
            <Link to="/admin/deliveries" className="rounded-full bg-white/15 px-3 py-1.5">Queue</Link>
            <Link to="/admin/rider-pay" className="rounded-full px-3 py-1.5 opacity-80 hover:bg-white/10">Rider pay</Link>
            <Link to="/admin/consumer-orders" className="rounded-full px-3 py-1.5 opacity-80 hover:bg-white/10">All orders</Link>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 pb-24 pt-6 md:px-6">
        <p className="max-w-2xl text-[13px] leading-relaxed text-ink-muted">
          Paid tradly_rider orders sit in the queue below until you assign a rider. Once assigned,
          the rider taps Picked Up + Delivered from their daily link (<code>/rider/{`{id}`}?t=…</code>).
          The buttons here are a safety net if the rider's tap doesn't come through.
        </p>

        {/* ── Awaiting dispatch ─────────────────────────────────────── */}
        <section className="mt-6">
          <div className="mb-2 flex items-baseline justify-between">
            <h2 className="text-[12px] font-semibold uppercase tracking-wide text-ink-muted">
              Awaiting dispatch
            </h2>
            <span className="text-[11px] tabular-nums text-ink-muted">{unassigned.length}</span>
          </div>

          {unassignedLoading && (
            <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-ink-muted" /></div>
          )}

          {!unassignedLoading && unassigned.length === 0 && (
            <div className="rounded-2xl border border-dashed border-divider py-8 text-center text-[13px] text-ink-muted">
              No orders waiting — everything's assigned.
            </div>
          )}

          <ul className="space-y-2">
            {unassigned.map((o) => (
              <li key={o.id} className="rounded-2xl border border-divider bg-surface p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <Link
                      to="/order/$id"
                      params={{ id: o.id }}
                      className="text-[14px] font-semibold text-ink hover:underline"
                    >
                      {o.orderNumber}
                    </Link>
                    <p className="mt-1 text-[12px] text-ink-muted">
                      <span className="font-semibold text-ink">{formatKes(o.totalKes)}</span>
                      {" · "}
                      {o.zoneName ?? "no zone"}
                      {o.address && (
                        <>
                          {" · "}
                          <span className="inline-flex items-center gap-1">
                            <MapPin className="h-3 w-3" />
                            {[o.address.houseOrDoor, o.address.estateOrBuilding, o.address.area].filter(Boolean).join(" · ")}
                          </span>
                        </>
                      )}
                      {" · "}
                      {formatDistanceToNow(new Date(o.createdAt), { addSuffix: true })}
                    </p>
                    {o.address?.landmark && (
                      <p className="mt-0.5 text-[11px] italic text-ink-muted">"{o.address.landmark}"</p>
                    )}
                  </div>
                  <AssignRow
                    drivers={drivers}
                    defaultBand={o.defaultDistanceBand ?? "short"}
                    disabled={assign.isPending}
                    onAssign={(driverId, band) => assign.mutate({ orderId: o.id, driverId, band })}
                  />
                </div>
              </li>
            ))}
          </ul>
        </section>

        {/* ── In progress ─────────────────────────────────────────── */}
        <section className="mt-8">
          <div className="mb-2 flex items-baseline justify-between">
            <h2 className="text-[12px] font-semibold uppercase tracking-wide text-ink-muted">
              In progress
            </h2>
            <span className="text-[11px] tabular-nums text-ink-muted">{inProgress.length}</span>
          </div>

          {inProgressLoading && (
            <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-ink-muted" /></div>
          )}

          {!inProgressLoading && inProgress.length === 0 && (
            <div className="rounded-2xl border border-dashed border-divider py-8 text-center text-[13px] text-ink-muted">
              Nothing in progress.
            </div>
          )}

          <ul className="space-y-2">
            {inProgress.map((d) => {
              const nextStatus: "picked_up" | "delivered" | null =
                d.status === "assigned" ? "picked_up" :
                d.status === "picked_up" ? "delivered" : null;
              return (
                <li key={d.id} className="rounded-2xl border border-divider bg-surface p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <Link
                          to="/order/$id"
                          params={{ id: d.orderId }}
                          className="text-[14px] font-semibold text-ink hover:underline"
                        >
                          {d.orderNumber ?? "—"}
                        </Link>
                        <DeliveryStatusChip status={d.status} />
                        {d.orderStatus && <StatusBadge status={d.orderStatus} />}
                      </div>
                      <p className="mt-1 text-[12px] text-ink-muted">
                        {d.driverFullName ?? "—"}
                        {" · "}
                        {d.zoneName ?? "no zone"}
                        {" · "}
                        {d.distanceBand === "short" ? "short · KES 50" : "long · KES 100"}
                        {" · assigned "}
                        {formatDistanceToNow(new Date(d.assignedAt), { addSuffix: true })}
                      </p>
                      {d.landmark && (
                        <p className="mt-0.5 text-[11px] italic text-ink-muted">"{d.landmark}"</p>
                      )}
                    </div>
                    {nextStatus && (
                      <button
                        type="button"
                        onClick={() => advance.mutate({ deliveryId: d.id, nextStatus })}
                        disabled={advance.isPending}
                        className="inline-flex items-center gap-1.5 rounded-full bg-ink px-3 py-1.5 text-[12px] font-semibold text-background hover:bg-ink/90 disabled:opacity-60"
                      >
                        {nextStatus === "picked_up" ? <Package className="h-3.5 w-3.5" /> : <Truck className="h-3.5 w-3.5" />}
                        Mark {nextStatus.replace("_", " ")}
                        <ChevronRight className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      </main>
    </div>
  );
}

function AssignRow({
  drivers,
  defaultBand,
  disabled,
  onAssign,
}: {
  drivers: Driver[];
  defaultBand: DistanceBand;
  disabled: boolean;
  onAssign: (driverId: string, band: DistanceBand) => void;
}) {
  const [driverId, setDriverId] = useState("");
  const [band, setBand] = useState<DistanceBand>(defaultBand);
  const canAssign = useMemo(() => driverId !== "" && !disabled, [driverId, disabled]);
  return (
    <div className="flex flex-wrap items-center gap-2">
      <select
        value={band}
        onChange={(e) => setBand(e.target.value as DistanceBand)}
        className="rounded-full border border-divider bg-background px-3 py-1.5 text-[12px] text-ink"
      >
        <option value="short">Short · KES 50</option>
        <option value="long">Long · KES 100</option>
      </select>
      <select
        value={driverId}
        onChange={(e) => setDriverId(e.target.value)}
        className="rounded-full border border-divider bg-background px-3 py-1.5 text-[12px] text-ink"
      >
        <option value="">Choose rider…</option>
        {drivers.map((d) => (
          <option key={d.id} value={d.id}>{d.fullName} · {d.phone}</option>
        ))}
      </select>
      <button
        type="button"
        onClick={() => canAssign && onAssign(driverId, band)}
        disabled={!canAssign}
        className="rounded-full bg-ink px-3 py-1.5 text-[12px] font-semibold text-background hover:bg-ink/90 disabled:opacity-60"
      >
        Assign
      </button>
    </div>
  );
}

function DeliveryStatusChip({ status }: { status: DeliveryStatus }) {
  const cfg: Record<DeliveryStatus, { label: string; className: string }> = {
    assigned:   { label: "Assigned",   className: "bg-trust/12 text-trust-deep" },
    picked_up:  { label: "Picked up",  className: "bg-trust/12 text-trust-deep" },
    delivered:  { label: "Delivered",  className: "bg-farm/12 text-farm" },
  };
  const c = cfg[status];
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${c.className}`}>
      {c.label}
    </span>
  );
}
