import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AppShell } from "../marketplace/components/AppShell";
import { TrustHeader } from "../marketplace/components/TrustHeader";
import { useCartStore, cartSubtotal, cartCount } from "../marketplace/store/cartStore";
import { submitMarketplaceOrder, getBranches } from "../marketplace/api/marketplaceApi";
import { formatKes } from "../marketplace/lib/format";
import { ChevronDown, ChevronUp, ShieldCheck, Loader2, Building2 } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/checkout")({
  head: () => ({ meta: [{ title: "Checkout — Tradly Market" }, { name: "robots", content: "noindex" }] }),
  component: Checkout,
});

function useActiveBranches() {
  return useQuery({
    queryKey: ["marketplace-branches"],
    staleTime: 30_000,
    queryFn: getBranches,
  });
}

function Checkout() {
  const navigate = useNavigate();
  const lines = useCartStore((s) => s.lines);
  const clear = useCartStore((s) => s.clear);
  const { isAuthenticated, isInitializing } = useAuth();

  const { data: branches = [], isLoading: branchesLoading } = useActiveBranches();

  const [addressId, setAddressId] = useState<string | null>(null);
  const [date, setDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 2);
    return d.toISOString().slice(0, 10);
  });
  const [showSummary, setShowSummary] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  // Stable per-cart-render idempotency key: two taps on "Submit" from the
  // same page load resolve to the same PR instead of double-billing stock.
  const [idempotencyKey] = useState(() => crypto.randomUUID());

  const subtotal = cartSubtotal(lines);
  const count = cartCount(lines);

  // Default to the business's default branch once branches load, falling
  // back to the first active branch if none is flagged default.
  useEffect(() => {
    if (!addressId && branches.length > 0) {
      const def = branches.find((b) => b.isDefault) ?? branches[0];
      setAddressId(def.id);
    }
  }, [branches, addressId]);

  // Checkout requires a real buyer session. Anonymous browsers get pushed to
  // /login with a `next` param so they land back here after signing in.
  useEffect(() => {
    if (!isInitializing && !isAuthenticated) {
      navigate({ to: "/login", search: { next: "/checkout" } });
    }
  }, [isInitializing, isAuthenticated, navigate]);

  if (isInitializing || !isAuthenticated) {
    return (
      <AppShell hideNav variant="focused">
        <div className="px-4">
          <TrustHeader title="Checkout" back="/cart" />
          <p className="py-16 text-center text-sm text-ink-muted">Checking your session…</p>
        </div>
      </AppShell>
    );
  }

  if (lines.length === 0) {
    return (
      <AppShell hideNav variant="focused">
        <div className="px-4">
          <TrustHeader title="Checkout" back="/cart" />
          <p className="py-16 text-center text-sm text-ink-muted">Your cart is empty.</p>
        </div>
      </AppShell>
    );
  }

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
      const msg = e instanceof Error ? e.message : "Could not submit. Try again.";
      toast.error(msg);
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
              <p className="text-[13px] text-ink-muted">No branches set up yet. Add one in Settings.</p>
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