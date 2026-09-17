import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AppShell } from "../marketplace/components/AppShell";
import { BrowseHeader } from "../marketplace/components/BrowseHeader";
import { QuantityStepper } from "../marketplace/components/QuantityStepper";
import { useCartStore, cartSubtotal } from "../marketplace/store/cartStore";
import { formatKes } from "../marketplace/lib/format";
import { X, BookmarkPlus, RefreshCcw, ShoppingBag, RefreshCw } from "lucide-react";
import { EmptyState } from "../marketplace/components/EmptyState";
import { toast } from "sonner";
import { createSavedList } from "../marketplace/api/marketplaceApi";
import { friendlyError } from "../marketplace/lib/friendlyError";
import { upsertRecurringBasket } from "../marketplace/api/recurringBaskets";
import { useAuth } from "@/hooks/use-auth";
import { NameDialog } from "../marketplace/components/NameDialog";
import { getSupabase } from "@/lib/supabase";
import type { RecurringCadence } from "../marketplace/types/marketplace";

/**
 * Result of fn_marketplace_price_cart — server-authoritative per-line shelf
 * and any qty/pricing error. Used by the cart-page reprice to detect drift.
 */
interface PricedLine {
  product_id: string;
  shelf_rate_kes: number | string;
  error: string | null;
}

export const Route = createFileRoute("/cart")({
  head: () => ({
    meta: [
      { title: "Your cart — Tradly Market" },
      { name: "description", content: "Review your Tradly Market cart before checkout." },
      { name: "robots", content: "noindex" },
      { property: "og:title", content: "Your cart — Tradly Market" },
      {
        property: "og:description",
        content: "Review items in your Tradly Market cart before checkout.",
      },
      { property: "og:url", content: "https://market.tradly.co.ke/cart" },
    ],
  }),
  component: Cart,
});

function Cart() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const lines = useCartStore((s) => s.lines);
  const setQuantity = useCartStore((s) => s.setQuantity);
  const removeLine = useCartStore((s) => s.removeLine);
  const subtotal = cartSubtotal(lines);
  const { isAuthenticated, buyer } = useAuth();
  // isCompany drives the B2B vs household copy split (eTIMS, PO, VAT
  // language stays for company buyers; households see plain words).
  // Anonymous browsers default to household copy — safest for onboarding.
  const isCompany = buyer?.businessType === "company";
  const [savePromptOpen, setSavePromptOpen] = useState(false);
  const [recurringOpen, setRecurringOpen] = useState(false);

  // ── Live reprice via fn_marketplace_price_cart (audit Fix-5).
  //    Runs while the cart is being viewed so the customer sees today's
  //    shelf, not the price cached at add-to-cart time. Checkout still
  //    reprices at submit — this is early transparency, not authority.
  //    Anon reads are permitted by RLS (see 20260910140000 policies).
  const priceItems = useMemo(
    () => lines.map((l) => ({ product_id: l.productId, qty: l.quantity })),
    [lines],
  );
  const { data: priced } = useQuery<PricedLine[]>({
    queryKey: ["cart-reprice", priceItems],
    enabled: lines.length > 0,
    staleTime: 30_000,
    queryFn: async () => {
      const { data, error } = await getSupabase().rpc(
        "fn_marketplace_price_cart",
        { p_items: priceItems },
      );
      if (error) throw error;
      return (data ?? []) as PricedLine[];
    },
  });

  // Compare cached priceKes vs live shelf_rate_kes. Any diff > 1 cent = drift.
  const drift = useMemo(() => {
    if (!priced) return { hasDrift: false, drifted: [] as string[], liveSubtotal: subtotal };
    const drifted: string[] = [];
    let liveSubtotal = 0;
    for (const line of lines) {
      const row = priced.find((r) => r.product_id === line.productId);
      const liveShelf = row ? Number(row.shelf_rate_kes) : line.priceKes;
      if (Math.abs(liveShelf - line.priceKes) > 0.01) drifted.push(line.productId);
      liveSubtotal += liveShelf * line.quantity;
    }
    return { hasDrift: drifted.length > 0, drifted, liveSubtotal };
  }, [lines, priced, subtotal]);

  const applyLivePrices = () => {
    if (!priced) return;
    const currentLines = useCartStore.getState().lines;
    useCartStore.setState({
      lines: currentLines.map((l) => {
        const row = priced.find((r) => r.product_id === l.productId);
        if (!row) return l;
        const liveShelf = Number(row.shelf_rate_kes);
        return Math.abs(liveShelf - l.priceKes) > 0.01
          ? { ...l, priceKes: liveShelf }
          : l;
      }),
    });
    toast.success("Prices updated");
  };

  const saveListMutation = useMutation({
    mutationFn: (name: string) => createSavedList(name, lines),
    onSuccess: (list) => {
      qc.invalidateQueries({ queryKey: ["lists"] });
      setSavePromptOpen(false);
      toast.success(
        `Saved "${list.name}" — ${list.items.length} item${list.items.length === 1 ? "" : "s"}`,
        {
          action: {
            label: "View lists",
            onClick: () => navigate({ to: "/lists" }),
          },
        },
      );
    },
    onError: (e: Error) => toast.error(friendlyError(e, "Could not save the list. Please try again.")),
  });

  const handleSaveList = () => {
    if (lines.length === 0) return;
    if (!isAuthenticated) {
      toast.error("Sign in to save this cart to a list.", {
        action: {
          label: "Sign in",
          onClick: () => navigate({ to: "/login", search: { next: "/cart" } }),
        },
      });
      return;
    }
    setSavePromptOpen(true);
  };

  const handleSaveRecurring = () => {
    if (lines.length === 0) return;
    if (!isAuthenticated) {
      toast.error("Sign in to save a recurring basket.", {
        action: { label: "Sign in", onClick: () => navigate({ to: "/login", search: { next: "/cart" } }) },
      });
      return;
    }
    if (buyer?.businessType !== "individual") {
      toast.error("Recurring baskets are a household feature.");
      return;
    }
    setRecurringOpen(true);
  };

  const saveRecurring = useMutation({
    mutationFn: (input: { name: string; cadence: RecurringCadence; nextRunAt: string }) =>
      upsertRecurringBasket({
        name: input.name,
        lines: lines.map((l) => ({ product_id: l.productId, qty: l.quantity })),
        cadence: input.cadence,
        nextRunAt: input.nextRunAt,
        fulfilmentMethod: "self_pickup",   // sane default — buyer edits on /account/recurring
        deliveryAddressId: null,
        isActive: true,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["recurring-baskets"] });
      setRecurringOpen(false);
      toast.success("Basket saved — manage it under Account → Recurring baskets", {
        action: { label: "View", onClick: () => navigate({ to: "/account/recurring" }) },
      });
    },
    onError: (e: Error) => toast.error(friendlyError(e, "Could not save. Please try again.")),
  });

  const suggestedCartName = `Cart · ${new Date().toLocaleDateString("en-KE", { day: "numeric", month: "short" })}`;

  return (
    <AppShell variant="focused">
      <div className="px-4 lg:px-8 lg:pb-12">
        <div className="lg:hidden">
          <BrowseHeader title="Cart" back="/" />
        </div>
        <div className="hidden pt-10 pb-6 lg:block">
          <p className="text-[12px] font-medium uppercase tracking-[0.18em] text-ink-muted">
            Your cart
          </p>
          <h1 className="mt-2 text-[36px] font-semibold tracking-tight text-ink">
            Review your order
          </h1>
        </div>

        {lines.length === 0 ? (
          <EmptyState
            icon={ShoppingBag}
            title="Your cart is empty"
            description="Add fresh vegetables, fruits, milk, rice and more — everything gets delivered to your door."
            primary={{ label: "Browse the market", to: "/" }}
          />
        ) : (
          <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_360px] lg:gap-10">
            <div>
              {drift.hasDrift && (
                <div className="mb-3 flex items-start gap-3 rounded-2xl border border-ripe/40 bg-ripe/5 px-4 py-3">
                  <RefreshCw className="mt-0.5 h-4 w-4 shrink-0 text-ripe" />
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] font-semibold text-ink">
                      Prices updated for {drift.drifted.length} item
                      {drift.drifted.length === 1 ? "" : "s"}
                    </p>
                    <p className="mt-0.5 text-[12px] text-ink-muted">
                      New total: <span className="font-semibold text-ink">{formatKes(drift.liveSubtotal)}</span>
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={applyLivePrices}
                    className="shrink-0 rounded-full bg-ink px-3 py-1.5 text-[12px] font-semibold text-background hover:bg-ink/90"
                  >
                    Refresh
                  </button>
                </div>
              )}
              <ul className="divide-y divide-divider">
                {lines.map((l) => (
                  <li
                    key={l.productUnitId}
                    className="flex items-center gap-3 py-4 lg:gap-5 lg:py-5"
                  >
                    <Link
                      to="/product/$slug"
                      params={{ slug: l.productSlug }}
                      className="h-16 w-16 shrink-0 overflow-hidden rounded-2xl bg-surface soft-shadow lg:h-20 lg:w-20"
                    >
                      <img
                        src={l.thumbnailUrl}
                        alt={l.productName}
                        className="h-full w-full object-cover"
                      />
                    </Link>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[14px] font-semibold text-ink lg:text-[15.5px]">
                        {l.productName}
                      </p>
                      <p className="text-[12px] text-ink-muted">
                        {l.unitLabel} · {formatKes(l.priceKes)}
                      </p>
                      <p className="mt-1 text-[13px] font-semibold tabular-nums text-ink lg:hidden">
                        {formatKes(l.priceKes * l.quantity)}
                      </p>
                    </div>
                    <div className="hidden w-32 text-right text-[15px] font-semibold tabular-nums text-ink lg:block">
                      {formatKes(l.priceKes * l.quantity)}
                    </div>
                    <div className="flex flex-col items-end gap-2 lg:flex-row lg:items-center lg:gap-3">
                      <QuantityStepper
                        value={l.quantity}
                        onChange={(v) => setQuantity(l.productUnitId, v)}
                        size="sm"
                        min={l.minQty ?? 1}
                        step={l.qtyStep ?? 1}
                        sellMode={l.sellMode}
                        baseUnit={l.baseUnit}
                      />
                      <button
                        type="button"
                        onClick={() => removeLine(l.productUnitId)}
                        className="grid h-7 w-7 place-items-center rounded-full text-ink-muted hover:bg-muted hover:text-destructive"
                        aria-label="Remove"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>

              <div className="mt-4 flex flex-wrap gap-4">
                <button
                  type="button"
                  onClick={handleSaveList}
                  className="inline-flex items-center gap-2 text-[13px] font-medium text-ink-muted hover:text-ink"
                >
                  <BookmarkPlus className="h-4 w-4" />
                  Save cart to a list
                </button>
                {buyer?.businessType === "individual" && (
                  <button
                    type="button"
                    onClick={handleSaveRecurring}
                    className="inline-flex items-center gap-2 text-[13px] font-medium text-ink-muted hover:text-ink"
                  >
                    <RefreshCcw className="h-4 w-4" />
                    Save as recurring basket
                  </button>
                )}
              </div>

              {/* Persona-aware footnote. Households never need to think
                  about eTIMS or POs — that's B2B accounting language. */}
              <p className="mt-6 text-[11px] leading-relaxed text-ink-muted lg:text-[12px]">
                {isCompany
                  ? "VAT and eTIMS invoice are calculated when Tradly Finance issues your PO."
                  : "Delivery fee is added at checkout, based on where we're sending your order."}
              </p>
            </div>

            {/* Desktop order summary */}
            <aside className="mt-8 hidden self-start rounded-3xl border border-divider bg-surface p-6 lg:sticky lg:top-24 lg:mt-0 lg:block">
              <p className="text-[12px] font-medium uppercase tracking-[0.14em] text-ink-muted">
                Summary
              </p>
              <dl className="mt-4 space-y-2 text-[14px]">
                <div className="flex justify-between text-ink-muted">
                  <dt>Items</dt>
                  <dd className="tabular-nums text-ink">
                    {lines.reduce((s, l) => s + l.quantity, 0)}
                  </dd>
                </div>
                <div className="flex justify-between text-ink-muted">
                  <dt>Subtotal</dt>
                  <dd className="tabular-nums text-ink">{formatKes(subtotal)}</dd>
                </div>
                {isCompany ? (
                  <div className="flex justify-between text-ink-muted">
                    <dt>VAT</dt>
                    <dd>at invoice</dd>
                  </div>
                ) : (
                  <div className="flex justify-between text-ink-muted">
                    <dt>Delivery</dt>
                    <dd>added at checkout</dd>
                  </div>
                )}
              </dl>
              <div className="mt-5 flex items-baseline justify-between border-t border-divider pt-4">
                <span className="text-[13px] font-medium uppercase tracking-wide text-ink-muted">
                  {isCompany ? "Estimated" : "So far"}
                </span>
                <span className="text-[22px] font-semibold tabular-nums text-ink">
                  {formatKes(subtotal)}
                </span>
              </div>
              <button
                type="button"
                onClick={() => navigate({ to: "/checkout" })}
                className="mt-5 w-full rounded-full bg-ink px-5 py-3.5 text-[14px] font-semibold text-background transition hover:bg-ink/90"
              >
                {isCompany ? "Continue to Purchase Order" : "Checkout"}
              </button>
            </aside>
          </div>
        )}
      </div>

      {/* Mobile sticky footer */}
      {lines.length > 0 && (
        <div className="fixed inset-x-0 bottom-16 z-30 border-t border-divider bg-surface/95 backdrop-blur lg:hidden">
          <div className="mx-auto flex max-w-lg items-center justify-between gap-3 px-4 py-3">
            <div>
              <p className="text-[11px] font-medium uppercase tracking-wide text-ink-muted">
                Subtotal
              </p>
              <p className="text-[18px] font-semibold tabular-nums text-ink">
                {formatKes(subtotal)}
              </p>
            </div>
            <button
              type="button"
              onClick={() => navigate({ to: "/checkout" })}
              className="flex-1 rounded-full bg-ink px-5 py-3 text-[14px] font-semibold text-background shadow-sm"
            >
              {isCompany ? "Continue" : "Checkout"}
            </button>
          </div>
        </div>
      )}

      <NameDialog
        open={savePromptOpen}
        onOpenChange={setSavePromptOpen}
        title={`Save ${lines.length} cart item${lines.length === 1 ? "" : "s"} as a list`}
        description="Snapshot this cart — you can reload it into your cart anytime from Lists."
        label="List name"
        defaultValue={suggestedCartName}
        submitLabel="Save list"
        pending={saveListMutation.isPending}
        onSubmit={(name) => saveListMutation.mutate(name)}
      />

      {recurringOpen && (
        <RecurringSaveDialog
          suggestedName={suggestedCartName.replace("Cart", "Weekly")}
          onClose={() => setRecurringOpen(false)}
          onSubmit={(input) => saveRecurring.mutate(input)}
          pending={saveRecurring.isPending}
        />
      )}
    </AppShell>
  );
}

function RecurringSaveDialog({
  suggestedName,
  onClose,
  onSubmit,
  pending,
}: {
  suggestedName: string;
  onClose: () => void;
  onSubmit: (input: { name: string; cadence: RecurringCadence; nextRunAt: string }) => void;
  pending: boolean;
}) {
  // Default next run: next Sunday morning at 08:00 local.
  const nextSunday = new Date();
  const daysUntilSunday = (7 - nextSunday.getDay()) % 7 || 7;
  nextSunday.setDate(nextSunday.getDate() + daysUntilSunday);
  nextSunday.setHours(8, 0, 0, 0);
  const defaultRun = nextSunday.toISOString().slice(0, 16); // datetime-local format

  const [name, setName] = useState(suggestedName);
  const [cadence, setCadence] = useState<RecurringCadence>("weekly");
  const [nextRun, setNextRun] = useState(defaultRun);

  const canSubmit = name.trim().length > 0 && nextRun.length > 0 && !pending;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center" onClick={onClose}>
      <div
        className="w-full max-w-md rounded-t-3xl bg-background p-5 shadow-2xl sm:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-muted">Save as recurring basket</p>
            <p className="mt-1 text-[15px] font-semibold text-ink">Snapshot this cart on a schedule</p>
          </div>
          <button onClick={onClose} className="grid h-9 w-9 place-items-center rounded-full text-ink-muted hover:bg-muted"><X className="h-5 w-5" /></button>
        </div>

        <p className="mt-2 text-[12.5px] text-ink-muted">
          We'll notify you at each cadence — no charge until you tap Confirm.
        </p>

        <div className="mt-4 space-y-3">
          <label className="block">
            <span className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-ink-muted">Basket name</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
              className="w-full rounded-lg border border-divider bg-background px-3 py-2 text-[13px] focus:border-trust focus:outline-none focus:ring-2 focus:ring-trust/20"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-ink-muted">Cadence</span>
            <select
              value={cadence}
              onChange={(e) => setCadence(e.target.value as RecurringCadence)}
              className="w-full rounded-lg border border-divider bg-background px-3 py-2 text-[13px] focus:border-trust focus:outline-none focus:ring-2 focus:ring-trust/20"
            >
              <option value="weekly">Weekly</option>
              <option value="fortnightly">Fortnightly</option>
              <option value="monthly">Monthly</option>
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-ink-muted">First reminder</span>
            <input
              type="datetime-local"
              value={nextRun}
              onChange={(e) => setNextRun(e.target.value)}
              className="w-full rounded-lg border border-divider bg-background px-3 py-2 text-[13px] focus:border-trust focus:outline-none focus:ring-2 focus:ring-trust/20"
            />
          </label>
        </div>

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
            onClick={() => canSubmit && onSubmit({
              name: name.trim(),
              cadence,
              nextRunAt: new Date(nextRun).toISOString(),
            })}
            disabled={!canSubmit}
            className="flex-1 rounded-full bg-ink px-4 py-2.5 text-[13px] font-semibold text-background hover:bg-ink/90 disabled:opacity-60"
          >
            {pending ? "Saving…" : "Save basket"}
          </button>
        </div>
      </div>
    </div>
  );
}
