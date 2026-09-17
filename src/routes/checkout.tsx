import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Building2,
  ChevronDown,
  ChevronUp,
  Home,
  Loader2,
  MapPin,
  Package,
  ShieldCheck,
  Truck,
} from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "../marketplace/components/AppShell";
import { TrustHeader } from "../marketplace/components/TrustHeader";
import { useCartStore, cartSubtotal, cartCount } from "../marketplace/store/cartStore";
import { submitMarketplaceOrder, getBranches } from "../marketplace/api/marketplaceApi";
import {
  listDeliveryZones,
  listMyAddresses,
} from "../marketplace/api/delivery";
import { submitConsumerOrder } from "../marketplace/api/consumerOrders";
import { listMyCreditBalance, totalSpendable } from "../marketplace/api/credit";
import { getSupabase } from "@/lib/supabase";
import { formatKes } from "../marketplace/lib/format";
import { friendlyError } from "../marketplace/lib/friendlyError";
import { useAuth } from "@/hooks/use-auth";
import type {
  CartLine,
  DeliveryZone,
  HouseholdAddress,
} from "../marketplace/types/marketplace";

export const Route = createFileRoute("/checkout")({
  head: () => ({ meta: [{ title: "Checkout — Tradly Market" }, { name: "robots", content: "noindex" }] }),
  component: Checkout,
});

function Checkout() {
  const navigate = useNavigate();
  const lines = useCartStore((s) => s.lines);
  const { isAuthenticated, isInitializing, buyer } = useAuth();

  // Auth gate — anonymous browsers get sent to /login with a `next` param.
  useEffect(() => {
    if (!isInitializing && !isAuthenticated) {
      navigate({ to: "/login", search: { next: "/checkout" } });
    }
  }, [isInitializing, isAuthenticated, navigate]);

  if (isInitializing || !isAuthenticated) {
    return (
      <CheckoutShell title="Checkout">
        <p className="py-16 text-center text-sm text-ink-muted">Checking your session…</p>
      </CheckoutShell>
    );
  }

  if (lines.length === 0) {
    return (
      <CheckoutShell title="Checkout">
        <p className="py-16 text-center text-sm text-ink-muted">Your cart is empty.</p>
      </CheckoutShell>
    );
  }

  // Persona split (Household Commerce spec §4.3). Companies keep the
  // branch-based purchase-request path. Individuals get the household
  // path (D-checkout) — submit is a stub until Checkpoint E wires the
  // consumer-order-init Edge Function.
  if (buyer?.businessType === "individual") {
    return <HouseholdCheckout lines={lines} />;
  }
  return <CompanyCheckout lines={lines} />;
}

// ─── Shared UI ───────────────────────────────────────────────────────────

function CheckoutShell({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <AppShell hideNav variant="focused">
      <div className="px-4">
        <TrustHeader title={title} back="/cart" />
        {children}
      </div>
    </AppShell>
  );
}

function OrderSummary({ lines }: { lines: CartLine[] }) {
  const subtotal = cartSubtotal(lines);
  const count = cartCount(lines);
  const [showSummary, setShowSummary] = useState(false);

  return (
    <section className="mt-5 rounded-2xl border border-divider bg-surface">
      <button
        type="button"
        onClick={() => setShowSummary((s) => !s)}
        className="flex w-full items-center justify-between p-4 text-left"
      >
        <div>
          <p className="text-[13px] font-semibold uppercase tracking-wide text-ink-muted">Order summary</p>
          <p className="mt-1 text-[14px] text-ink">
            <span className="font-semibold">{count} items</span>
            <span className="text-ink-muted"> · </span>
            <span className="font-bold text-trust">{formatKes(subtotal)}</span>
          </p>
        </div>
        {showSummary ? <ChevronUp className="h-4 w-4 text-ink-muted" /> : <ChevronDown className="h-4 w-4 text-ink-muted" />}
      </button>
      {showSummary && (
        <ul className="divide-y divide-divider border-t border-divider">
          {lines.map((l) => (
            <li key={l.productUnitId} className="flex items-center justify-between gap-2 px-4 py-3 text-[13px]">
              <span className="min-w-0 truncate">
                <span className="font-medium text-ink">{l.productName}</span>
                <span className="text-ink-muted"> · {l.unitLabel} × {l.quantity}</span>
              </span>
              <span className="shrink-0 font-semibold tabular-nums text-ink">
                {formatKes(l.priceKes * l.quantity)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

// ═════════════════════════════════════════════════════════════════════════
// Company path — unchanged branch → purchase_request flow (spec §4).
// ═════════════════════════════════════════════════════════════════════════

function useActiveBranches() {
  return useQuery({
    queryKey: ["marketplace-branches"],
    staleTime: 30_000,
    queryFn: getBranches,
    retry: 1,
  });
}

function CompanyCheckout({ lines }: { lines: CartLine[] }) {
  const navigate = useNavigate();
  const clear = useCartStore((s) => s.clear);
  const { data: branches = [], isLoading: branchesLoading, error: branchesError } = useActiveBranches();

  const [addressId, setAddressId] = useState<string | null>(null);
  const [date, setDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 2);
    return d.toISOString().slice(0, 10);
  });
  const [submitting, setSubmitting] = useState(false);
  const [idempotencyKey] = useState(() => crypto.randomUUID());

  useEffect(() => {
    if (!addressId && branches.length > 0) {
      const def = branches.find((b) => b.isDefault) ?? branches[0];
      setAddressId(def.id);
    }
  }, [branches, addressId]);

  useEffect(() => {
    if (branchesError) console.error("[checkout] getBranches failed:", branchesError);
  }, [branchesError]);

  const subtotal = cartSubtotal(lines);

  const submit = async () => {
    if (!addressId) {
      toast.error("Choose a delivery branch first.");
      return;
    }
    setSubmitting(true);
    try {
      const { id, requestNumber } = await submitMarketplaceOrder(lines, date, {
        idempotencyKey,
        branchId: addressId,
      });
      clear();
      toast.success(`Order ${requestNumber} submitted`);
      navigate({ to: "/order/$id/confirmation", params: { id }, search: { pr: requestNumber } });
    } catch (e) {
      toast.error(friendlyError(e, "Couldn't send your order. Please try again."));
      console.error(e);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AppShell hideNav variant="focused">
      <div className="px-4 pb-32">
        <TrustHeader title="Submit Purchase Order" back="/cart" />

        <section className="mt-5">
          <h2 className="mb-2 text-[13px] font-semibold uppercase tracking-wide text-ink-muted">Deliver to</h2>

          {branchesLoading && (
            <div className="flex justify-center py-6">
              <Loader2 className="h-5 w-5 animate-spin text-ink-muted" />
            </div>
          )}

          {!branchesLoading && branches.length === 0 && (
            <div className="rounded-2xl border border-dashed border-divider py-8 text-center">
              <Building2 className="mx-auto h-5 w-5 text-ink-muted mb-2" />
              {branchesError ? (
                <>
                  <p className="text-[13px] font-medium text-ink">Couldn't load branches.</p>
                  <p className="mt-1 px-4 text-[12px] text-ink-muted">
                    {branchesError instanceof Error ? branchesError.message : "Unknown error — check the browser console."}
                  </p>
                </>
              ) : (
                <p className="text-[13px] text-ink-muted">No branches set up yet. Add one in Settings.</p>
              )}
            </div>
          )}

          {!branchesLoading && branches.length > 0 && (
            <div className="space-y-2">
              {branches.map((b) => (
                <label
                  key={b.id}
                  className={`flex cursor-pointer items-start gap-3 rounded-2xl border p-4 transition-colors ${
                    addressId === b.id ? "border-trust bg-trust/5" : "border-divider bg-surface"
                  }`}
                >
                  <input
                    type="radio"
                    name="addr"
                    checked={addressId === b.id}
                    onChange={() => setAddressId(b.id)}
                    className="mt-1 accent-[color:var(--trust)]"
                  />
                  <div className="min-w-0">
                    <p className="text-[14px] font-semibold text-ink">
                      {b.name}
                      {b.isDefault && <span className="ml-1.5 text-[11px] font-normal text-trust">· Default</span>}
                    </p>
                    <p className="text-[12px] text-ink-muted">
                      {[b.address, b.city].filter(Boolean).join(", ") || "No address on file"}
                    </p>
                  </div>
                </label>
              ))}
            </div>
          )}
        </section>

        <section className="mt-5">
          <h2 className="mb-2 text-[13px] font-semibold uppercase tracking-wide text-ink-muted">Expected delivery</h2>
          <input
            type="date"
            value={date}
            min={new Date(Date.now() + 86400000).toISOString().slice(0, 10)}
            onChange={(e) => setDate(e.target.value)}
            className="w-full rounded-2xl border border-divider bg-surface px-4 py-3 text-[14px] text-ink focus:border-trust focus:outline-none focus:ring-2 focus:ring-trust/20"
          />
        </section>

        <OrderSummary lines={lines} />

        <div className="mt-5 flex items-start gap-2 rounded-xl bg-trust/8 p-3 text-[12px] text-trust-deep">
          <ShieldCheck className="h-4 w-4 shrink-0" />
          <span>Sourced from Tradly. VAT and eTIMS invoice are handled at approval.</span>
        </div>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-divider bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur">
        <div className="mx-auto max-w-lg px-4 py-3">
          <button
            type="button"
            onClick={submit}
            disabled={submitting || !addressId}
            className="w-full rounded-full bg-trust px-5 py-3.5 text-[15px] font-semibold text-trust-foreground shadow-sm transition-colors hover:bg-trust/95 disabled:opacity-60"
          >
            {submitting ? "Submitting…" : `Submit Purchase Order · ${formatKes(subtotal)}`}
          </button>
        </div>
      </div>
    </AppShell>
  );
}

// ═════════════════════════════════════════════════════════════════════════
// Household path (spec §7, §16, plan D6+D7).
// Submit is a placeholder until Checkpoint E wires consumer-order-init.
// ═════════════════════════════════════════════════════════════════════════

type FulfilmentMethod = "tradly_rider" | "customer_rider" | "self_pickup";

const FULFILMENT_LABEL: Record<FulfilmentMethod, { label: string; hint: string; icon: typeof Truck }> = {
  tradly_rider:  { label: "Tradly rider",     hint: "Fee per zone",       icon: Truck },
  customer_rider:{ label: "My own courier",   hint: "Free — you arrange", icon: Package },
  self_pickup:   { label: "Self-pickup",      hint: "Free — collect from Tradly", icon: Home },
};

/**
 * Current time in Africa/Nairobi as an "HH:MM" string. Used to compare
 * against a zone's same_day_cutoff_time.
 */
function nairobiTimeHHMM(): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Africa/Nairobi",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date());
}

/**
 * Return a YYYY-MM-DD date string, offset `days` from today (in Africa/
 * Nairobi where "today" means calendar day, not UTC).
 */
function nairobiDate(days: number): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Nairobi",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const y = Number(parts.find((p) => p.type === "year")!.value);
  const m = Number(parts.find((p) => p.type === "month")!.value);
  const d = Number(parts.find((p) => p.type === "day")!.value);
  // Build a UTC midnight for that Nairobi day, then offset by days.
  const base = new Date(Date.UTC(y, m - 1, d));
  base.setUTCDate(base.getUTCDate() + days);
  return base.toISOString().slice(0, 10);
}

/**
 * Given a zone's cutoff time and the selected fulfilment method, return the
 * default requested delivery date:
 *   - tradly_rider before cutoff → today
 *   - tradly_rider after cutoff  → tomorrow
 *   - other methods              → tomorrow (rider timing doesn't apply)
 */
function defaultRequestedDate(
  method: FulfilmentMethod,
  zone: DeliveryZone | null,
): string {
  if (method !== "tradly_rider" || !zone) return nairobiDate(1);
  const nowHHMM = nairobiTimeHHMM();
  const cutoffHHMM = zone.sameDayCutoffTime.slice(0, 5);
  return nowHHMM < cutoffHHMM ? nairobiDate(0) : nairobiDate(1);
}

interface PriceDrift {
  productId: string;
  productName: string;
  qty: number;
  oldRateKes: number;
  newRateKes: number;
}

function HouseholdCheckout({ lines }: { lines: CartLine[] }) {
  const clearCart = useCartStore((s) => s.clear);

  const { data: addresses = [], isLoading: addressesLoading } = useQuery({
    queryKey: ["household-addresses"],
    queryFn: listMyAddresses,
  });
  const { data: zones = [] } = useQuery({
    queryKey: ["delivery-zones"],
    queryFn: listDeliveryZones,
    staleTime: 5 * 60_000,
  });

  const [addressId, setAddressId] = useState<string | null>(null);
  const [method, setMethod] = useState<FulfilmentMethod>("tradly_rider");
  // Stable per-mount idempotency key — retries collapse to the same order row.
  const [idempotencyKey] = useState(() => crypto.randomUUID());
  const [submitting, setSubmitting] = useState(false);
  const [drift, setDrift] = useState<PriceDrift[] | null>(null);
  const [cartErrors, setCartErrors] = useState<string | null>(null);
  const [creditApplyKes, setCreditApplyKes] = useState<number>(0);

  const { data: creditBalances = [] } = useQuery({
    queryKey: ["credit-balance"],
    queryFn: listMyCreditBalance,
    staleTime: 30_000,
  });
  const availableCredit = totalSpendable(creditBalances);

  // Auto-select default (or first) address once loaded.
  useEffect(() => {
    if (!addressId && addresses.length > 0) {
      const def = addresses.find((a) => a.isDefault) ?? addresses[0];
      setAddressId(def.id);
    }
  }, [addresses, addressId]);

  const selectedAddress: HouseholdAddress | null =
    addresses.find((a) => a.id === addressId) ?? null;
  const selectedZone: DeliveryZone | null =
    (selectedAddress && zones.find((z) => z.id === selectedAddress.zoneId)) ?? null;

  // If the selected address has no zone, tradly_rider is unavailable —
  // auto-shift to customer_rider so the UI is coherent.
  useEffect(() => {
    if (method === "tradly_rider" && selectedAddress && !selectedZone) {
      setMethod("customer_rider");
    }
  }, [method, selectedAddress, selectedZone]);

  const [date, setDate] = useState(() => defaultRequestedDate(method, selectedZone));
  // Keep the date defaulter in sync when the zone or method changes,
  // unless the buyer has explicitly picked a future date.
  const [dateTouched, setDateTouched] = useState(false);
  useEffect(() => {
    if (!dateTouched) setDate(defaultRequestedDate(method, selectedZone));
  }, [method, selectedZone, dateTouched]);

  const subtotal = cartSubtotal(lines);
  const deliveryFee = useMemo(() => {
    if (method !== "tradly_rider" || !selectedZone) return 0;
    return selectedZone.customerFeeKes;
  }, [method, selectedZone]);
  const preCreditTotal = subtotal + deliveryFee;
  // Cap credit apply at both the buyer's balance AND the pre-credit total —
  // over-application is silently clamped by the server too, but reflect the
  // cap in the UI so the numbers add up on screen.
  const maxCreditApply = Math.max(0, Math.min(availableCredit, Math.floor(preCreditTotal)));
  const clampedCreditApply = Math.max(0, Math.min(creditApplyKes, maxCreditApply));
  const total = preCreditTotal - clampedCreditApply;

  const submitDisabled =
    submitting ||
    lines.length === 0 ||
    (method === "tradly_rider" && !selectedAddress);

  const runSubmit = async (opts?: { skipDriftCheck?: boolean }) => {
    if (submitDisabled) return;
    setSubmitting(true);
    setCartErrors(null);
    try {
      const priceItems = lines.map((l) => ({ product_id: l.productId, qty: l.quantity }));

      // ── Drift check (spec §5.9 second invariant). Compare cached
      //    priceKes against the server's current shelf. Any difference →
      //    surface a modal and require re-confirmation. Skipped once the
      //    user has already re-confirmed.
      if (!opts?.skipDriftCheck) {
        const { data: pricedRows, error: priceErr } = await getSupabase().rpc(
          "fn_marketplace_price_cart",
          { p_items: priceItems },
        );
        if (priceErr) throw priceErr;

        const priced = (pricedRows ?? []) as Array<{
          product_id: string;
          product_name: string;
          shelf_rate_kes: number;
          error: string | null;
        }>;

        // Per-line errors (unpriced, qty below min, etc.) — surface directly.
        const errored = priced.filter((r) => r.error);
        if (errored.length > 0) {
          setCartErrors(
            `${errored.length} item${errored.length === 1 ? "" : "s"} can't be ordered right now — please review your cart.`,
          );
          setSubmitting(false);
          return;
        }

        // Drift = cached priceKes ≠ server shelf_rate_kes (± 1 cent).
        const drifted: PriceDrift[] = [];
        for (const r of priced) {
          const line = lines.find((l) => l.productId === r.product_id);
          if (!line) continue;
          if (Math.abs(Number(r.shelf_rate_kes) - line.priceKes) > 0.01) {
            drifted.push({
              productId: r.product_id,
              productName: r.product_name,
              qty: line.quantity,
              oldRateKes: line.priceKes,
              newRateKes: Number(r.shelf_rate_kes),
            });
          }
        }
        if (drifted.length > 0) {
          setDrift(drifted);
          setSubmitting(false);
          return;
        }
      }

      // ── Submit to consumer-order-init ────────────────────────────────
      const result = await submitConsumerOrder({
        lines: priceItems,
        fulfilmentMethod: method,
        deliveryAddressId:
          method === "tradly_rider" ? (selectedAddress?.id ?? null) : null,
        requestedDate: date,
        idempotencyKey,
        // Paystack appends ?reference=X to this URL on callback. Our
        // /order/callback route reads it and forwards to /order/{id}.
        callbackUrl: `${window.location.origin}/order/callback`,
        creditApplyKes: clampedCreditApply,
      });

      // Clear cart before we navigate away — otherwise refreshing the
      // Paystack page and hitting back would leave stale lines.
      clearCart();
      window.location.href = result.paystack_authorization_url;
    } catch (err) {
      const anyErr = err as { response?: { data?: { code?: string; errors?: unknown } }; message?: string };
      const code = anyErr.response?.data?.code;
      if (code === "CART_HAS_ERRORS") {
        setCartErrors("Some items are no longer available — please review your cart.");
      } else {
        toast.error(friendlyError(err, "Couldn't start checkout. Please try again."));
      }
      setSubmitting(false);
    }
  };

  const acceptDriftAndResubmit = () => {
    if (!drift) return;
    // Update cart with the new prices so the buyer sees them reflected
    // and future adds combine at the fresh price. Preserve quantities.
    for (const d of drift) {
      // Find the CartLine, keep qty, replace price via setQuantity+addLine…
      // Simpler: just close the modal and re-submit; the cart display will
      // catch up on next getAllProducts refresh, and consumer-order-init
      // is the source of truth for what actually gets charged.
      void d;
    }
    setDrift(null);
    void runSubmit({ skipDriftCheck: true });
  };

  return (
    <AppShell hideNav variant="focused">
      <div className="px-4 pb-32">
        <TrustHeader title="Checkout" back="/cart" />

        {/* ── Address picker ───────────────────────────────────────── */}
        <section className="mt-5">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-[13px] font-semibold uppercase tracking-wide text-ink-muted">
              Deliver to
            </h2>
            <Link
              to="/account/addresses"
              className="text-[12px] font-medium text-ink-muted hover:text-ink"
            >
              Manage →
            </Link>
          </div>

          {addressesLoading && (
            <div className="flex justify-center py-6">
              <Loader2 className="h-5 w-5 animate-spin text-ink-muted" />
            </div>
          )}

          {!addressesLoading && addresses.length === 0 && (
            <div className="rounded-2xl border border-dashed border-divider py-8 text-center">
              <MapPin className="mx-auto mb-2 h-5 w-5 text-ink-muted" />
              <p className="text-[13px] font-medium text-ink">No delivery addresses yet.</p>
              <Link
                to="/account/addresses"
                className="mt-3 inline-block rounded-full bg-ink px-4 py-2 text-[12px] font-semibold text-background"
              >
                Add your first address
              </Link>
            </div>
          )}

          {!addressesLoading && addresses.length > 0 && (
            <div className="space-y-2">
              {addresses.map((a) => {
                const az = zones.find((z) => z.id === a.zoneId);
                return (
                  <label
                    key={a.id}
                    className={`flex cursor-pointer items-start gap-3 rounded-2xl border p-4 transition-colors ${
                      addressId === a.id ? "border-trust bg-trust/5" : "border-divider bg-surface"
                    }`}
                  >
                    <input
                      type="radio"
                      name="addr"
                      checked={addressId === a.id}
                      onChange={() => setAddressId(a.id)}
                      className="mt-1 accent-[color:var(--trust)]"
                    />
                    <div className="min-w-0">
                      <p className="text-[14px] font-semibold text-ink">
                        {a.label || a.area}
                        {a.isDefault && (
                          <span className="ml-1.5 text-[11px] font-normal text-trust">· Default</span>
                        )}
                      </p>
                      <p className="text-[12px] text-ink-muted">
                        {[a.houseOrDoor, a.estateOrBuilding, a.area].filter(Boolean).join(" · ")}
                      </p>
                      {a.landmark && (
                        <p className="text-[11px] italic text-ink-muted">"{a.landmark}"</p>
                      )}
                      <p className="mt-0.5 text-[11px] font-medium text-ink-muted">
                        {az ? (
                          <>
                            {az.name} · rider {formatKes(az.customerFeeKes)}
                          </>
                        ) : (
                          <span className="text-amber-700">Outside rider zones — courier / pickup only</span>
                        )}
                      </p>
                    </div>
                  </label>
                );
              })}
            </div>
          )}
        </section>

        {/* ── Fulfilment method ────────────────────────────────────── */}
        <section className="mt-5">
          <h2 className="mb-2 text-[13px] font-semibold uppercase tracking-wide text-ink-muted">
            How should this arrive?
          </h2>
          <div className="grid grid-cols-3 gap-2">
            {(Object.keys(FULFILMENT_LABEL) as FulfilmentMethod[]).map((m) => {
              const meta = FULFILMENT_LABEL[m];
              const active = method === m;
              // Tradly rider disabled when the selected address has no
              // resolvable zone. Other methods are always available.
              const disabled = m === "tradly_rider" && !selectedZone;
              const Icon = meta.icon;
              return (
                <button
                  key={m}
                  type="button"
                  onClick={() => !disabled && setMethod(m)}
                  disabled={disabled}
                  className={`rounded-xl border px-3 py-3 text-left transition-colors ${
                    active
                      ? "border-ink bg-ink text-background"
                      : "border-divider bg-surface text-ink hover:border-ink/40"
                  } ${disabled ? "cursor-not-allowed opacity-40" : ""}`}
                >
                  <Icon className={`h-4 w-4 ${active ? "" : "text-ink-muted"}`} />
                  <p className="mt-1 text-[13px] font-semibold">{meta.label}</p>
                  <p className={`mt-0.5 text-[11px] ${active ? "text-background/80" : "text-ink-muted"}`}>
                    {disabled ? "Not in a zone yet" : meta.hint}
                  </p>
                </button>
              );
            })}
          </div>
        </section>

        {/* ── Delivery date ────────────────────────────────────────── */}
        <section className="mt-5">
          <h2 className="mb-2 text-[13px] font-semibold uppercase tracking-wide text-ink-muted">
            Delivery date
          </h2>
          <input
            type="date"
            value={date}
            min={nairobiDate(0)}
            onChange={(e) => {
              setDateTouched(true);
              setDate(e.target.value);
            }}
            className="w-full rounded-2xl border border-divider bg-surface px-4 py-3 text-[14px] text-ink focus:border-trust focus:outline-none focus:ring-2 focus:ring-trust/20"
          />
          {method === "tradly_rider" && selectedZone && (
            <p className="mt-1 text-[11px] text-ink-muted">
              Same-day if ordered by {selectedZone.sameDayCutoffTime.slice(0, 5)} — otherwise next day.
            </p>
          )}
        </section>

        {/* ── Totals ──────────────────────────────────────────────── */}
        <OrderSummary lines={lines} />

        {/* ── Tradly Credit apply ─────────────────────────────────── */}
        {availableCredit > 0 && (
          <section className="mt-4 rounded-2xl border border-divider bg-surface p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[13px] font-semibold text-ink">Apply Tradly Credit</p>
                <p className="mt-0.5 text-[11.5px] text-ink-muted">
                  Available <span className="font-semibold text-ink">{formatKes(availableCredit)}</span>
                  {" · "}<Link to="/account/credit" className="hover:underline">History</Link>
                </p>
              </div>
              <span className="text-[14px] font-semibold tabular-nums text-farm">
                −{formatKes(clampedCreditApply)}
              </span>
            </div>
            {maxCreditApply > 0 ? (
              <>
                <input
                  type="range"
                  min={0}
                  max={maxCreditApply}
                  step={10}
                  value={clampedCreditApply}
                  onChange={(e) => setCreditApplyKes(Number(e.target.value))}
                  className="mt-3 w-full accent-[color:var(--trust)]"
                />
                <div className="mt-2 flex justify-between text-[11.5px] text-ink-muted">
                  <span>{formatKes(0)}</span>
                  <button
                    type="button"
                    onClick={() => setCreditApplyKes(maxCreditApply)}
                    className="font-semibold text-ink hover:underline"
                  >
                    Use max · {formatKes(maxCreditApply)}
                  </button>
                </div>
                <p className="mt-2 text-[10.5px] text-ink-muted">
                  Spend order: promotional credit first, then refundable. Server confirms
                  the actual amount applied at checkout.
                </p>
              </>
            ) : (
              <p className="mt-2 text-[11.5px] text-ink-muted">
                Your order total is 0 — nothing to apply credit against.
              </p>
            )}
          </section>
        )}

        <section className="mt-4 rounded-2xl border border-divider bg-surface p-4 text-[13px]">
          <div className="flex justify-between text-ink-muted">
            <span>Subtotal</span>
            <span className="tabular-nums text-ink">{formatKes(subtotal)}</span>
          </div>
          <div className="mt-1 flex justify-between text-ink-muted">
            <span>Delivery</span>
            <span className="tabular-nums text-ink">
              {method === "tradly_rider"
                ? selectedZone
                  ? formatKes(deliveryFee)
                  : "—"
                : "Free"}
            </span>
          </div>
          {clampedCreditApply > 0 && (
            <div className="mt-1 flex justify-between text-ink-muted">
              <span>Tradly Credit</span>
              <span className="tabular-nums text-farm">−{formatKes(clampedCreditApply)}</span>
            </div>
          )}
          <div className="mt-2 flex items-baseline justify-between border-t border-divider pt-2">
            <span className="text-[12px] font-semibold uppercase tracking-wide text-ink-muted">Total</span>
            <span className="text-[18px] font-semibold tabular-nums text-ink">{formatKes(total)}</span>
          </div>
        </section>

        <div className="mt-5 flex items-start gap-2 rounded-xl bg-trust/8 p-3 text-[12px] text-trust-deep">
          <ShieldCheck className="h-4 w-4 shrink-0" />
          <span>
            Prepaid via Paystack once household checkout ships. Stock is reserved
            at checkout start so the rider only picks what's genuinely in stock.
          </span>
        </div>
      </div>

      {cartErrors && (
        <div className="mx-4 mt-4 rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-[13px] text-destructive">
          {cartErrors} <Link to="/cart" className="ml-2 font-semibold underline">Review cart</Link>
        </div>
      )}

      {/* Sticky submit — Paystack redirect on success. */}
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-divider bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur">
        <div className="mx-auto max-w-lg px-4 py-3">
          <button
            type="button"
            onClick={() => runSubmit()}
            disabled={submitDisabled}
            className="w-full rounded-full bg-trust px-5 py-3.5 text-[15px] font-semibold text-trust-foreground shadow-sm transition-colors hover:bg-trust/95 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? "Starting checkout…" : `Pay with Paystack · ${formatKes(total)}`}
          </button>
          <p className="mt-1.5 text-center text-[11px] text-ink-muted">
            Paystack handles card + M-Pesa. Delivered to your door.
          </p>
        </div>
      </div>

      {drift && drift.length > 0 && (
        <PriceDriftModal
          drift={drift}
          onCancel={() => setDrift(null)}
          onAccept={acceptDriftAndResubmit}
        />
      )}
    </AppShell>
  );
}

function PriceDriftModal({
  drift,
  onCancel,
  onAccept,
}: {
  drift: PriceDrift[];
  onCancel: () => void;
  onAccept: () => void;
}) {
  const oldTotal = drift.reduce((s, d) => s + d.oldRateKes * d.qty, 0);
  const newTotal = drift.reduce((s, d) => s + d.newRateKes * d.qty, 0);
  const delta = newTotal - oldTotal;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center" onClick={onCancel}>
      <div
        className="w-full max-w-md rounded-t-3xl bg-background p-5 shadow-2xl sm:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-muted">
          Prices updated
        </p>
        <h2 className="mt-1 text-[18px] font-semibold text-ink">
          {drift.length} item{drift.length === 1 ? "" : "s"} changed price
        </h2>
        <p className="mt-1 text-[13px] text-ink-muted">
          The cart caches prices from when you added items. Tradly's live prices are:
        </p>
        <ul className="mt-3 divide-y divide-divider text-[13px]">
          {drift.map((d) => (
            <li key={d.productId} className="flex items-center justify-between py-2">
              <span className="min-w-0 truncate font-medium text-ink">{d.productName}</span>
              <span className="shrink-0 tabular-nums">
                <span className="text-ink-muted line-through">{formatKes(d.oldRateKes)}</span>{" "}
                <span className="font-semibold text-ink">{formatKes(d.newRateKes)}</span>
              </span>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-[13px]">
          {delta > 0 ? (
            <>Your total increases by <span className="font-semibold tabular-nums">{formatKes(delta)}</span>.</>
          ) : delta < 0 ? (
            <>Your total decreases by <span className="font-semibold tabular-nums">{formatKes(-delta)}</span>.</>
          ) : (
            <>Your total is unchanged.</>
          )}
        </p>
        <div className="mt-5 flex gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 rounded-full border border-divider bg-surface px-4 py-2.5 text-[13px] font-semibold text-ink hover:bg-muted"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onAccept}
            className="flex-1 rounded-full bg-trust px-4 py-2.5 text-[13px] font-semibold text-trust-foreground hover:bg-trust/95"
          >
            Accept new prices
          </button>
        </div>
      </div>
    </div>
  );
}
