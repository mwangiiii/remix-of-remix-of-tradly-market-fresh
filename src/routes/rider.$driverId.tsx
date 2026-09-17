// Rider daily link (Phase 2 Checkpoint G — G-rider-link).
//
// URL: /rider/{driver_id}?t={token}
//
// A rider opens this on their phone, sees today's assigned + in-progress
// deliveries, and taps Picked Up / Delivered. No JWT — auth is the opaque
// link_token stored on drivers.link_token. Tokens are rotatable from ops.
//
// Read: fn_rider_day (anon-callable, token-gated).
// Write: fn_rider_advance_delivery (anon-callable, token- + ownership-gated).
//
// No AppShell — riders shouldn't see the buyer chrome. The full-screen
// mobile layout is deliberate: this is a job tool, not a browse surface.

import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { toast } from "sonner";
import { format } from "date-fns";
import {
  AlertTriangle, Check, Loader2, MapPin, Package, Phone, Truck,
} from "lucide-react";
import { getSupabase } from "@/lib/supabase";
import { formatKes } from "../marketplace/lib/format";
import type { DistanceBand } from "../marketplace/types/marketplace";

const searchSchema = z.object({ t: z.string().min(1) });

export const Route = createFileRoute("/rider/$driverId")({
  head: () => ({
    meta: [
      { title: "Your deliveries — Tradly" },
      { name: "robots", content: "noindex" },
      { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover" },
    ],
  }),
  validateSearch: searchSchema,
  component: RiderDay,
});

// ─── Payload shapes returned by fn_rider_day ────────────────────────────

type DeliveryStatus = "assigned" | "picked_up" | "delivered";

interface DayLine {
  product_name: string;
  qty: number;
  base_unit: string;
}

interface DayDelivery {
  id: string;
  status: DeliveryStatus;
  assigned_at: string;
  picked_up_at: string | null;
  delivered_at: string | null;
  distance_band: DistanceBand;
  driver_earning_kes: number;
  order_number: string;
  order_total_kes: number;
  zone_name: string | null;
  area: string | null;
  estate_or_building: string | null;
  house_or_door: string | null;
  landmark: string | null;
  delivery_notes: string | null;
  lines: DayLine[];
}

interface DayPayload {
  ok: boolean;
  reason?: string;
  driver?: { id: string; full_name: string; phone: string };
  owed_kes?: number;
  paid_week_kes?: number;
  deliveries?: DayDelivery[];
}

async function fetchDay(driverId: string, token: string): Promise<DayPayload> {
  const { data, error } = await getSupabase().rpc("fn_rider_day", {
    p_driver_id: driverId,
    p_token: token,
  });
  if (error) throw error;
  return data as DayPayload;
}

async function advance(
  driverId: string,
  token: string,
  deliveryId: string,
  nextStatus: "picked_up" | "delivered",
): Promise<{ ok: boolean; reason?: string; status?: DeliveryStatus }> {
  const { data, error } = await getSupabase().rpc("fn_rider_advance_delivery", {
    p_driver_id: driverId,
    p_token: token,
    p_delivery_id: deliveryId,
    p_next_status: nextStatus,
  });
  if (error) throw error;
  return data as { ok: boolean; reason?: string; status?: DeliveryStatus };
}

// ─── Component ──────────────────────────────────────────────────────────

function RiderDay() {
  const { driverId } = Route.useParams();
  const { t: token } = Route.useSearch();
  const qc = useQueryClient();

  const { data, isLoading, error } = useQuery({
    queryKey: ["rider-day", driverId, token],
    queryFn: () => fetchDay(driverId, token),
    refetchInterval: 30_000,
    retry: 1,
  });

  const tap = useMutation({
    mutationFn: (args: { deliveryId: string; nextStatus: "picked_up" | "delivered" }) =>
      advance(driverId, token, args.deliveryId, args.nextStatus),
    onSuccess: (res, vars) => {
      if (!res.ok) {
        toast.error(res.reason ?? "Update failed");
        return;
      }
      qc.invalidateQueries({ queryKey: ["rider-day", driverId, token] });
      toast.success(vars.nextStatus === "picked_up" ? "Picked up" : "Delivered");
    },
    onError: (e: Error) => toast.error(e.message ?? "Update failed"),
  });

  // Warn the buyer's browser before hiding the tab — riders often close
  // Chrome by accident. Non-blocking; a full solution would sync state
  // server-side, which the DB does anyway.
  useEffect(() => {
    const onVis = () => { if (document.visibilityState === "visible") qc.invalidateQueries({ queryKey: ["rider-day"] }); };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [qc]);

  if (isLoading) {
    return (
      <FullScreen>
        <div className="flex flex-col items-center gap-3 py-16">
          <Loader2 className="h-6 w-6 animate-spin text-trust" />
          <p className="text-[13px] text-ink-muted">Loading your day…</p>
        </div>
      </FullScreen>
    );
  }

  if (error || !data?.ok) {
    return (
      <FullScreen>
        <div className="flex flex-col items-center gap-3 py-16 px-4 text-center">
          <AlertTriangle className="h-6 w-6 text-amber-600" />
          <p className="text-[15px] font-semibold text-ink">This link isn't valid.</p>
          <p className="max-w-xs text-[12.5px] text-ink-muted">
            Ask ops for a fresh URL. Your rider ID and token together identify you — if either is
            wrong (or the token was rotated), you'll see this message.
          </p>
        </div>
      </FullScreen>
    );
  }

  const deliveries = data.deliveries ?? [];
  const active = deliveries.filter((d) => d.status !== "delivered");
  const deliveredToday = deliveries.filter((d) => d.status === "delivered");

  return (
    <FullScreen>
      {/* Header */}
      <header className="border-b border-divider bg-surface px-4 py-4 sm:px-6">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-muted">
          Rider · {format(new Date(), "EEEE d MMM")}
        </p>
        <h1 className="mt-1 text-[19px] font-bold text-ink">{data.driver?.full_name ?? "Rider"}</h1>
      </header>

      {/* Active deliveries */}
      <section className="px-4 pt-4 pb-2 sm:px-6">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-muted">
          Today — {active.length} to deliver
        </p>
      </section>

      {active.length === 0 && (
        <div className="mx-4 rounded-2xl border border-dashed border-divider py-10 text-center text-[13px] text-ink-muted sm:mx-6">
          Nothing assigned yet. Refresh when ops has something for you.
        </div>
      )}

      <ul className="space-y-3 px-4 pb-8 sm:px-6">
        {active.map((d) => (
          <RiderDeliveryCard
            key={d.id}
            delivery={d}
            busy={tap.isPending}
            onPickedUp={() => tap.mutate({ deliveryId: d.id, nextStatus: "picked_up" })}
            onDelivered={() => tap.mutate({ deliveryId: d.id, nextStatus: "delivered" })}
          />
        ))}
      </ul>

      {deliveredToday.length > 0 && (
        <section className="px-4 pb-6 sm:px-6">
          <details>
            <summary className="cursor-pointer text-[12px] font-semibold uppercase tracking-wide text-ink-muted">
              Delivered today · {deliveredToday.length}
            </summary>
            <ul className="mt-3 space-y-2 text-[13px]">
              {deliveredToday.map((d) => (
                <li key={d.id} className="rounded-xl border border-divider bg-surface p-3 opacity-80">
                  <div className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-farm" />
                    <span className="font-semibold text-ink">{d.order_number}</span>
                    <span className="text-ink-muted">· {d.zone_name ?? d.area ?? ""}</span>
                    {d.delivered_at && (
                      <span className="ml-auto text-[11px] text-ink-muted">
                        {format(new Date(d.delivered_at), "HH:mm")}
                      </span>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </details>
        </section>
      )}

      {/* Footer — pay totals */}
      <footer className="sticky bottom-0 border-t border-divider bg-surface/95 px-4 py-3 backdrop-blur sm:px-6">
        <div className="flex items-center justify-between text-[13px]">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wide text-ink-muted">Owed to you</p>
            <p className="text-[19px] font-bold tabular-nums text-ink">{formatKes(data.owed_kes ?? 0)}</p>
          </div>
          <div className="text-right">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-ink-muted">Paid this week</p>
            <p className="text-[15px] font-semibold tabular-nums text-ink-muted">{formatKes(data.paid_week_kes ?? 0)}</p>
          </div>
        </div>
        <p className="mt-2 text-center text-[10px] text-ink-muted">
          Cash paid on delivery — ask ops to mark it on their side.
        </p>
      </footer>
    </FullScreen>
  );
}

function RiderDeliveryCard({
  delivery,
  busy,
  onPickedUp,
  onDelivered,
}: {
  delivery: DayDelivery;
  busy: boolean;
  onPickedUp: () => void;
  onDelivered: () => void;
}) {
  const isPickedUp = delivery.status === "picked_up";
  return (
    <li className="rounded-2xl border border-divider bg-surface p-4">
      <div className="flex items-center gap-2">
        <span className="text-[15px] font-bold text-ink">{delivery.order_number}</span>
        <span className={`ml-auto rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
          isPickedUp ? "bg-trust/12 text-trust-deep" : "bg-muted text-ink-muted"
        }`}>
          {isPickedUp ? "En route" : "To pick up"}
        </span>
      </div>

      <div className="mt-2 flex items-start gap-1.5 text-[13.5px] text-ink">
        <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-trust" />
        <div>
          <p className="font-semibold">{delivery.zone_name ?? delivery.area ?? "—"}</p>
          <p className="text-[12.5px] text-ink-muted">
            {[delivery.house_or_door, delivery.estate_or_building, delivery.area]
              .filter(Boolean)
              .join(" · ")}
          </p>
          {delivery.landmark && (
            <p className="mt-0.5 text-[12px] italic text-ink-muted">"{delivery.landmark}"</p>
          )}
          {delivery.delivery_notes && (
            <p className="mt-1 rounded-xl bg-background px-2 py-1 text-[11.5px] text-ink-muted">
              {delivery.delivery_notes}
            </p>
          )}
        </div>
      </div>

      {delivery.lines?.length > 0 && (
        <details className="mt-3">
          <summary className="cursor-pointer text-[11px] font-semibold uppercase tracking-wide text-ink-muted">
            Items · {delivery.lines.length}
          </summary>
          <ul className="mt-2 space-y-1 text-[12.5px] text-ink-muted">
            {delivery.lines.map((l, i) => (
              <li key={i}>
                {l.qty} {l.base_unit} · {l.product_name}
              </li>
            ))}
          </ul>
        </details>
      )}

      <div className="mt-3 flex items-center justify-between text-[11.5px] text-ink-muted">
        <span>
          Order {formatKes(delivery.order_total_kes)}
          {" · "}
          {delivery.distance_band === "short" ? "short (KES 50)" : "long (KES 100)"}
        </span>
        {delivery.picked_up_at && (
          <span>Picked {format(new Date(delivery.picked_up_at), "HH:mm")}</span>
        )}
      </div>

      <div className="mt-4">
        {isPickedUp ? (
          <button
            type="button"
            onClick={onDelivered}
            disabled={busy}
            className="flex w-full items-center justify-center gap-2 rounded-full bg-farm px-4 py-3 text-[15px] font-semibold text-farm-foreground shadow-sm disabled:opacity-60"
          >
            <Truck className="h-4 w-4" /> Delivered
          </button>
        ) : (
          <button
            type="button"
            onClick={onPickedUp}
            disabled={busy}
            className="flex w-full items-center justify-center gap-2 rounded-full bg-ink px-4 py-3 text-[15px] font-semibold text-background shadow-sm disabled:opacity-60"
          >
            <Package className="h-4 w-4" /> Picked up
          </button>
        )}
      </div>
    </li>
  );
}

function FullScreen({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background text-ink pb-[env(safe-area-inset-bottom)]">
      <div className="mx-auto max-w-lg">{children}</div>
    </div>
  );
}

// Silence unused-import lints for icons used only via conditional branches.
void Phone;
