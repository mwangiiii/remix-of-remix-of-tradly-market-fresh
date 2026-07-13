import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppShell } from "../marketplace/components/AppShell";
import { TrustHeader } from "../marketplace/components/TrustHeader";
import { useCartStore, cartSubtotal, cartCount } from "../marketplace/store/cartStore";
import { useSessionStore, seedProfile } from "../marketplace/store/sessionStore";
import { submitMarketplaceOrder } from "../marketplace/api/marketplaceApi";
import { formatKes } from "../marketplace/lib/format";
import { ChevronDown, ChevronUp, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/checkout")({
  head: () => ({ meta: [{ title: "Checkout — Tradly Market" }, { name: "robots", content: "noindex" }] }),
  component: Checkout,
});

function Checkout() {
  const navigate = useNavigate();
  const lines = useCartStore((s) => s.lines);
  const clear = useCartStore((s) => s.clear);
  const { isAuthenticated, isInitializing } = useAuth();

  // Buyer-profile display data still comes from the legacy sessionStore until
  // Phase 4 wires it to the real businesses / addresses tables.
  const profileState = useSessionStore((s) => s.profile);
  const profile = profileState ?? seedProfile;

  const [addressId, setAddressId] = useState(profile.addresses[0].id);
  const [date, setDate] = useState(() => {
    const d = new Date(); d.setDate(d.getDate() + 2);
    return d.toISOString().slice(0, 10);
  });
  const [showSummary, setShowSummary] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  // Stable per-cart-render idempotency key: two taps on "Submit" from the
  // same page load resolve to the same PR instead of double-billing stock.
  const [idempotencyKey] = useState(() => crypto.randomUUID());

  const subtotal = cartSubtotal(lines);
  const count = cartCount(lines);

  // Checkout requires a real buyer session. Anonymous browsers get pushed to
  // /login with a `next` param so they land back here after signing in.
  useEffect(() => {
    if (!isInitializing && !isAuthenticated) {
      navigate({ to: "/login", search: { next: "/checkout" } });
    }
  }, [isInitializing, isAuthenticated, navigate]);

  if (isInitializing || !isAuthenticated) {
    return (
      <AppShell>
        <div className="px-4">
          <TrustHeader title="Checkout" back="/cart" />
          <p className="py-16 text-center text-sm text-ink-muted">Checking your session…</p>
        </div>
      </AppShell>
    );
  }

  if (lines.length === 0) {
    return (
      <AppShell>
        <div className="px-4">
          <TrustHeader title="Checkout" back="/cart" />
          <p className="py-16 text-center text-sm text-ink-muted">Your cart is empty.</p>
        </div>
      </AppShell>
    );
  }

  const submit = async () => {
    setSubmitting(true);
    try {
      const { id, requestNumber } = await submitMarketplaceOrder(lines, date, {
        idempotencyKey,
      });
      clear();
      toast.success(`Order ${requestNumber} submitted`);
      navigate({ to: "/order/$id/confirmation", params: { id }, search: { pr: requestNumber } });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Could not submit. Try again.";
      toast.error(msg);
      console.error(e);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AppShell>
      <div className="px-4 pb-32">
        <TrustHeader title="Submit Purchase Order" back="/cart" />

        <section className="mt-5">
          <h2 className="mb-2 text-[13px] font-semibold uppercase tracking-wide text-ink-muted">Deliver to</h2>
          <div className="space-y-2">
            {profile.addresses.map((a) => (
              <label
                key={a.id}
                className={`flex cursor-pointer items-start gap-3 rounded-2xl border p-4 transition-colors ${
                  addressId === a.id ? "border-trust bg-trust/5" : "border-divider bg-surface"
                }`}
              >
                <input
                  type="radio" name="addr" checked={addressId === a.id}
                  onChange={() => setAddressId(a.id)}
                  className="mt-1 accent-[color:var(--trust)]"
                />
                <div className="min-w-0">
                  <p className="text-[14px] font-semibold text-ink">{a.label}</p>
                  <p className="text-[12px] text-ink-muted">{a.line}</p>
                </div>
              </label>
            ))}
          </div>
          <button type="button" className="mt-2 text-[13px] font-medium text-trust">+ Add address</button>
        </section>

        <section className="mt-5">
          <h2 className="mb-2 text-[13px] font-semibold uppercase tracking-wide text-ink-muted">Expected delivery</h2>
          <input
            type="date" value={date}
            min={new Date(Date.now() + 86400000).toISOString().slice(0, 10)}
            onChange={(e) => setDate(e.target.value)}
            className="w-full rounded-2xl border border-divider bg-surface px-4 py-3 text-[14px] text-ink focus:border-trust focus:outline-none focus:ring-2 focus:ring-trust/20"
          />
        </section>

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
                  <span className="shrink-0 font-semibold tabular-nums text-ink">{formatKes(l.priceKes * l.quantity)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>

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
            disabled={submitting}
            className="w-full rounded-full bg-trust px-5 py-3.5 text-[15px] font-semibold text-trust-foreground shadow-sm transition-colors hover:bg-trust/95 disabled:opacity-60"
          >
            {submitting ? "Submitting…" : `Submit Purchase Order · ${formatKes(subtotal)}`}
          </button>
        </div>
      </div>
    </AppShell>
  );
}
