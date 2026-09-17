// Household recurring baskets (Phase 3 Checkpoint L — L-frontend-manage + L-confirm-flow).
//
// One buyer surface holds all four responsibilities:
//   1. List active baskets with their next-run date
//   2. Show a prominent "Confirm & pay" CTA when a run is due but not
//      yet confirmed (i.e. a recurring_basket_runs row exists today for
//      this basket with status='generated')
//   3. Edit basket metadata (name, cadence, next-run-at, active, pause)
//   4. Delete
//
// The confirm CTA reprices via fn_marketplace_price_cart, shows a preview
// modal, then calls submitConsumerOrder({...basket_lines, recurring_basket_id})
// which redirects to Paystack like a normal checkout.

import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { format, formatDistanceToNow } from "date-fns";
import {
  Calendar, CheckCircle, Loader2, MoreHorizontal, Pause, PlayCircle,
  Plus, RefreshCcw, ShoppingCart, Trash2, X,
} from "lucide-react";
import { AppShell } from "../marketplace/components/AppShell";
import { TrustHeader } from "../marketplace/components/TrustHeader";
import { useAuth } from "@/hooks/use-auth";
import {
  deleteRecurringBasket,
  listBasketRuns,
  listMyRecurringBaskets,
  pauseRecurringBasket,
  skipRecurringBasket,
  upsertRecurringBasket,
} from "../marketplace/api/recurringBaskets";
import { listMyAddresses } from "../marketplace/api/delivery";
import { submitConsumerOrder } from "../marketplace/api/consumerOrders";
import { getSupabase } from "@/lib/supabase";
import { useCartStore } from "../marketplace/store/cartStore";
import { formatKes } from "../marketplace/lib/format";
import type {
  FulfilmentMethod,
  RecurringBasket,
  RecurringBasketLine,
  RecurringCadence,
} from "../marketplace/types/marketplace";

export const Route = createFileRoute("/account/recurring")({
  head: () => ({
    meta: [
      { title: "Recurring baskets — Tradly Market" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: RecurringPage,
});

function RecurringPage() {
  const navigate = useNavigate();
  const { isAuthenticated, isInitializing, buyer } = useAuth();

  if (!isInitializing && !isAuthenticated) {
    navigate({ to: "/login", search: { next: "/account/recurring" } });
  }

  const { data: baskets = [], isLoading } = useQuery({
    queryKey: ["recurring-baskets"],
    queryFn: listMyRecurringBaskets,
    enabled: isAuthenticated,
  });

  const [editing, setEditing] = useState<RecurringBasket | null>(null);
  const [confirming, setConfirming] = useState<RecurringBasket | null>(null);

  if (isInitializing || !isAuthenticated) {
    return (
      <AppShell>
        <div className="px-4">
          <TrustHeader title="Recurring baskets" back="/account" />
          <p className="py-16 text-center text-sm text-ink-muted">Checking your session…</p>
        </div>
      </AppShell>
    );
  }

  if (buyer?.businessType === "company") {
    return (
      <AppShell>
        <div className="px-4">
          <TrustHeader title="Recurring baskets" back="/account" />
          <div className="mx-auto mt-8 max-w-md rounded-2xl border border-divider bg-surface p-6 text-center">
            <p className="text-[14px] font-semibold text-ink">Households only.</p>
            <p className="mt-2 text-[13px] text-ink-muted">
              Company workspaces use standing purchase orders rather than recurring baskets.
            </p>
          </div>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="px-4 pb-24 lg:px-8">
        <TrustHeader title="Recurring baskets" back="/account" />

        <div className="mt-4 flex items-center justify-between">
          <p className="text-[13px] text-ink-muted">
            Set a basket to repeat weekly / fortnightly / monthly. We'll notify you
            when it's due — no charge until you tap Confirm.
          </p>
        </div>

        {isLoading && (
          <div className="mt-8 flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-ink-muted" /></div>
        )}

        {!isLoading && baskets.length === 0 && (
          <div className="mt-6 rounded-2xl border border-dashed border-divider py-10 text-center text-[13px] text-ink-muted">
            <RefreshCcw className="mx-auto mb-2 h-6 w-6 opacity-60" />
            No recurring baskets yet.<br />
            Add items to your <Link to="/cart" className="font-semibold text-ink underline">cart</Link>,
            then save it as a recurring basket.
          </div>
        )}

        {baskets.length > 0 && (
          <ul className="mt-4 space-y-3">
            {baskets.map((b) => (
              <BasketCard
                key={b.id}
                basket={b}
                onEdit={() => setEditing(b)}
                onConfirm={() => setConfirming(b)}
              />
            ))}
          </ul>
        )}
      </div>

      {editing && (
        <BasketEditor
          value={editing}
          onClose={() => setEditing(null)}
        />
      )}
      {confirming && (
        <ConfirmDialog
          basket={confirming}
          onClose={() => setConfirming(null)}
        />
      )}
    </AppShell>
  );
}

// ═════════════════════════════════════════════════════════════════════════
// Basket row card + pending-confirm CTA
// ═════════════════════════════════════════════════════════════════════════

function BasketCard({
  basket,
  onEdit,
  onConfirm,
}: {
  basket: RecurringBasket;
  onEdit: () => void;
  onConfirm: () => void;
}) {
  const qc = useQueryClient();

  // Any generated-but-unconfirmed run for this basket = a due confirmation
  // the buyer should see prominently.
  const { data: runs = [] } = useQuery({
    queryKey: ["recurring-basket-runs", basket.id],
    queryFn: () => listBasketRuns(basket.id),
    staleTime: 60_000,
  });
  const pendingRun = runs.find((r) => r.status === "generated");

  const skip = useMutation({
    mutationFn: () => skipRecurringBasket(basket.id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["recurring-baskets"] });
      toast.success("Skipped");
    },
    onError: (e: Error) => toast.error(e.message ?? "Skip failed"),
  });

  const del = useMutation({
    mutationFn: () => deleteRecurringBasket(basket.id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["recurring-baskets"] });
      toast.success("Deleted");
    },
    onError: (e: Error) => toast.error(e.message ?? "Delete failed"),
  });

  const pause = useMutation({
    mutationFn: (until: string | null) => pauseRecurringBasket(basket.id, until),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["recurring-baskets"] });
      toast.success("Updated");
    },
    onError: (e: Error) => toast.error(e.message ?? "Pause failed"),
  });

  const paused = basket.pauseUntil && new Date(basket.pauseUntil) > new Date();

  return (
    <li className={`rounded-2xl border border-divider bg-surface p-4 ${basket.isActive && !paused ? "" : "opacity-70"}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-[15px] font-semibold text-ink">
            {basket.name}
            {paused && (
              <span className="ml-1.5 rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-semibold uppercase text-ink-muted">Paused</span>
            )}
            {!basket.isActive && (
              <span className="ml-1.5 rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-semibold uppercase text-ink-muted">Inactive</span>
            )}
          </p>
          <p className="mt-1 text-[12px] text-ink-muted">
            {basket.lines.length} item{basket.lines.length === 1 ? "" : "s"}
            {" · "}
            {basket.cadence}
            {" · next "}
            {format(new Date(basket.nextRunAt), "EEE d MMM · HH:mm")}
            {" · "}
            {basket.fulfilmentMethod.replace("_", " ")}
          </p>
        </div>
        <div className="flex shrink-0 gap-1">
          <button
            type="button"
            onClick={onEdit}
            className="rounded-full border border-divider bg-background px-2.5 py-1 text-[11.5px] font-semibold text-ink hover:border-ink/40"
          >
            Edit
          </button>
          <button
            type="button"
            onClick={() => { if (confirm(`Delete "${basket.name}"?`)) del.mutate(); }}
            disabled={del.isPending}
            className="grid h-7 w-7 place-items-center rounded-full text-ink-muted hover:bg-destructive/10 hover:text-destructive disabled:opacity-40"
            aria-label="Delete"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {pendingRun && (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-farm/30 bg-farm/5 px-3 py-2 text-[12.5px]">
          <p className="text-farm">
            <CheckCircle className="mr-1 inline h-3.5 w-3.5" />
            Ready to reorder — notification sent {formatDistanceToNow(new Date(pendingRun.ranAt), { addSuffix: true })}
          </p>
          <button
            type="button"
            onClick={onConfirm}
            className="inline-flex items-center gap-1 rounded-full bg-farm px-3 py-1.5 text-[12px] font-semibold text-farm-foreground hover:bg-farm/90"
          >
            <ShoppingCart className="h-3.5 w-3.5" /> Confirm &amp; pay
          </button>
        </div>
      )}

      <div className="mt-3 flex flex-wrap gap-1 text-[11.5px]">
        <button
          type="button"
          onClick={() => skip.mutate()}
          disabled={skip.isPending}
          className="inline-flex items-center gap-1 rounded-full border border-divider bg-background px-2.5 py-1 font-semibold text-ink hover:border-ink/40 disabled:opacity-60"
        >
          <MoreHorizontal className="h-3 w-3" /> Skip next
        </button>
        {paused ? (
          <button
            type="button"
            onClick={() => pause.mutate(null)}
            disabled={pause.isPending}
            className="inline-flex items-center gap-1 rounded-full border border-divider bg-background px-2.5 py-1 font-semibold text-ink hover:border-ink/40 disabled:opacity-60"
          >
            <PlayCircle className="h-3 w-3" /> Resume
          </button>
        ) : (
          <button
            type="button"
            onClick={() => {
              const until = new Date();
              until.setDate(until.getDate() + 14);
              pause.mutate(until.toISOString());
            }}
            disabled={pause.isPending}
            className="inline-flex items-center gap-1 rounded-full border border-divider bg-background px-2.5 py-1 font-semibold text-ink hover:border-ink/40 disabled:opacity-60"
          >
            <Pause className="h-3 w-3" /> Pause 2 weeks
          </button>
        )}
      </div>
    </li>
  );
}

// ═════════════════════════════════════════════════════════════════════════
// Edit dialog
// ═════════════════════════════════════════════════════════════════════════

function BasketEditor({
  value,
  onClose,
}: {
  value: RecurringBasket;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const { data: addresses = [] } = useQuery({
    queryKey: ["household-addresses"],
    queryFn: listMyAddresses,
  });

  const [name, setName] = useState(value.name);
  const [cadence, setCadence] = useState<RecurringCadence>(value.cadence);
  const [nextRun, setNextRun] = useState(value.nextRunAt.slice(0, 16));  // datetime-local
  const [method, setMethod] = useState<FulfilmentMethod>(value.fulfilmentMethod);
  const [addressId, setAddressId] = useState<string>(value.deliveryAddressId ?? "");
  const [isActive, setIsActive] = useState(value.isActive);

  const save = useMutation({
    mutationFn: () =>
      upsertRecurringBasket({
        id: value.id,
        name,
        lines: value.lines,
        cadence,
        nextRunAt: new Date(nextRun).toISOString(),
        fulfilmentMethod: method,
        deliveryAddressId: method === "tradly_rider" ? (addressId || null) : null,
        isActive,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["recurring-baskets"] });
      toast.success("Saved");
      onClose();
    },
    onError: (e: Error) => toast.error(e.message ?? "Save failed"),
  });

  return (
    <div className="fixed inset-0 z-50 flex bg-black/50" onClick={onClose}>
      <div
        className="ml-auto flex h-full w-full max-w-md flex-col bg-background shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-center justify-between border-b border-divider bg-surface px-5 py-3.5">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-muted">Edit basket</p>
            <h2 className="text-[16px] font-semibold text-ink">{value.name}</h2>
          </div>
          <button onClick={onClose} className="grid h-9 w-9 place-items-center rounded-full text-ink-muted hover:bg-muted">
            <X className="h-5 w-5" />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto px-5 py-5">
          <Field label="Name">
            <input value={name} onChange={(e) => setName(e.target.value)} className={inputCls} />
          </Field>
          <Field label="Cadence">
            <select value={cadence} onChange={(e) => setCadence(e.target.value as RecurringCadence)} className={inputCls}>
              <option value="weekly">weekly</option>
              <option value="fortnightly">fortnightly (every 2 weeks)</option>
              <option value="monthly">monthly (every 30 days)</option>
            </select>
          </Field>
          <Field label="Next run">
            <input
              type="datetime-local"
              value={nextRun}
              onChange={(e) => setNextRun(e.target.value)}
              className={inputCls}
            />
            <p className="mt-1 text-[10.5px] text-ink-muted">
              You'll get a notification at this time; nothing charges until you confirm.
            </p>
          </Field>
          <Field label="Fulfilment">
            <select value={method} onChange={(e) => setMethod(e.target.value as FulfilmentMethod)} className={inputCls}>
              <option value="tradly_rider">Tradly rider</option>
              <option value="customer_rider">Own courier</option>
              <option value="self_pickup">Self-pickup</option>
            </select>
          </Field>
          {method === "tradly_rider" && (
            <Field label="Delivery address">
              <select value={addressId} onChange={(e) => setAddressId(e.target.value)} className={inputCls}>
                <option value="">Choose…</option>
                {addresses.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.label || a.area} · {a.area}
                  </option>
                ))}
              </select>
            </Field>
          )}
          <label className="mt-2 flex items-center gap-2 text-[13px] text-ink">
            <input
              type="checkbox"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
            />
            <span className="font-semibold">Active</span>
            <span className="text-ink-muted">— the cron notifies you at each cadence</span>
          </label>
          <div className="mt-4 rounded-xl bg-surface p-3 text-[12px] text-ink-muted">
            <p className="font-semibold text-ink">Basket items ({value.lines.length})</p>
            <p className="mt-1">To change items, save this basket then add / remove them from your cart and save as a new basket.</p>
          </div>
        </div>

        <footer className="border-t border-divider bg-surface px-5 py-3">
          <button
            type="button"
            onClick={() => save.mutate()}
            disabled={save.isPending || !name.trim() || !nextRun}
            className="w-full rounded-full bg-ink px-4 py-2.5 text-[14px] font-semibold text-background disabled:opacity-60"
          >
            {save.isPending ? "Saving…" : "Save changes"}
          </button>
        </footer>
      </div>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════
// Confirm-and-pay dialog
// ═════════════════════════════════════════════════════════════════════════

interface PricedLine {
  product_id: string;
  product_name: string;
  base_unit: string;
  qty: number;
  shelf_rate_kes: number;
  line_total_kes: number;
  error: string | null;
}

function ConfirmDialog({
  basket,
  onClose,
}: {
  basket: RecurringBasket;
  onClose: () => void;
}) {
  const clearCart = useCartStore((s) => s.clear);
  const [idempotencyKey] = useState(() => crypto.randomUUID());

  const { data: priced = [], isLoading, error } = useQuery({
    queryKey: ["recurring-basket-preview", basket.id],
    queryFn: async () => {
      const { data, error: rpcErr } = await getSupabase().rpc("fn_marketplace_price_cart", {
        p_items: basket.lines,
      });
      if (rpcErr) throw rpcErr;
      return (data ?? []) as PricedLine[];
    },
  });

  const errored = priced.filter((r) => r.error);
  const okLines = priced.filter((r) => !r.error);
  const goodsTotal = okLines.reduce((s, r) => s + Number(r.line_total_kes), 0);

  const submit = useMutation({
    mutationFn: async () => {
      // Delivery date defaults to today for the confirm flow.
      const today = new Date().toISOString().slice(0, 10);
      const res = await submitConsumerOrder({
        lines: okLines.map((r) => ({ product_id: r.product_id, qty: Number(r.qty) })),
        fulfilmentMethod: basket.fulfilmentMethod,
        deliveryAddressId:
          basket.fulfilmentMethod === "tradly_rider" ? basket.deliveryAddressId : null,
        requestedDate: today,
        idempotencyKey,
        callbackUrl: `${window.location.origin}/order/callback`,
        creditApplyKes: 0,
      });
      return res;
    },
    onSuccess: (res) => {
      clearCart();
      toast.success("Redirecting to Paystack…");
      window.location.href = res.paystack_authorization_url;
    },
    onError: (e: Error) => toast.error(e.message ?? "Could not start checkout"),
  });

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center" onClick={onClose}>
      <div
        className="w-full max-w-md rounded-t-3xl bg-background p-5 shadow-2xl sm:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-muted">Confirm basket</p>
            <p className="mt-1 text-[16px] font-semibold text-ink">{basket.name}</p>
          </div>
          <button onClick={onClose} className="grid h-9 w-9 place-items-center rounded-full text-ink-muted hover:bg-muted">
            <X className="h-5 w-5" />
          </button>
        </div>

        {isLoading && (
          <div className="mt-6 flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-ink-muted" /></div>
        )}

        {error && (
          <p className="mt-4 rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-[12.5px] text-destructive">
            Could not fetch prices — {String(error)}
          </p>
        )}

        {!isLoading && !error && (
          <>
            <ul className="mt-4 divide-y divide-divider text-[13px]">
              {priced.map((r, i) => (
                <li key={`${r.product_id}-${i}`} className="flex items-start justify-between gap-2 py-2">
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-ink">
                      {r.product_name ?? "Unknown product"}
                      {r.error && (
                        <span className="ml-1.5 rounded-full bg-destructive/12 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-destructive">
                          {r.error}
                        </span>
                      )}
                    </p>
                    <p className="text-[11.5px] text-ink-muted tabular-nums">
                      {r.qty} {r.base_unit} · {formatKes(Number(r.shelf_rate_kes ?? 0))}/{r.base_unit}
                    </p>
                  </div>
                  <span className="shrink-0 tabular-nums font-semibold text-ink">
                    {r.error ? "—" : formatKes(Number(r.line_total_kes))}
                  </span>
                </li>
              ))}
            </ul>

            <div className="mt-3 flex items-baseline justify-between border-t border-divider pt-3">
              <span className="text-[12px] font-semibold uppercase tracking-wide text-ink-muted">Goods total</span>
              <span className="text-[18px] font-bold tabular-nums text-ink">{formatKes(goodsTotal)}</span>
            </div>
            <p className="mt-1 text-[10.5px] text-ink-muted">
              Delivery fee + credit applied at Paystack step. Prices at this moment — locked in when you tap Confirm.
            </p>

            {errored.length > 0 && (
              <p className="mt-3 rounded-xl border border-amber-500/30 bg-amber-500/5 p-2.5 text-[11.5px] text-amber-700">
                {errored.length} item{errored.length === 1 ? "" : "s"} unavailable right now — we'll skip them and charge only for what's in stock.
              </p>
            )}
          </>
        )}

        <div className="mt-5 flex gap-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-full border border-divider bg-surface px-4 py-2.5 text-[13px] font-semibold text-ink hover:bg-muted"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => submit.mutate()}
            disabled={submit.isPending || isLoading || okLines.length === 0}
            className="flex-1 rounded-full bg-ink px-4 py-2.5 text-[13px] font-semibold text-background disabled:opacity-60"
          >
            <ShoppingCart className="mr-1 inline h-3.5 w-3.5" />
            {submit.isPending ? "Redirecting…" : `Confirm · ${formatKes(goodsTotal)}`}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Shared ──────────────────────────────────────────────────────────────

const inputCls =
  "w-full rounded-lg border border-divider bg-background px-3 py-2 text-[13px] text-ink focus:border-trust focus:outline-none focus:ring-2 focus:ring-trust/20";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="mb-4 block">
      <span className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-ink-muted">{label}</span>
      {children}
    </label>
  );
}

// Silence unused-import lints for icons wired later.
void Calendar; void Plus; void RefreshCcw;
