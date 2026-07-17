import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { AppShell } from "../marketplace/components/AppShell";
import { BrowseHeader } from "../marketplace/components/BrowseHeader";
import { QuantityStepper } from "../marketplace/components/QuantityStepper";
import { useCartStore, cartSubtotal } from "../marketplace/store/cartStore";
import { formatKes } from "../marketplace/lib/format";
import { X, BookmarkPlus, ShoppingBag } from "lucide-react";
import { toast } from "sonner";
import { createSavedList } from "../marketplace/api/marketplaceApi";
import { useAuth } from "@/hooks/use-auth";
import { NameDialog } from "../marketplace/components/NameDialog";

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
  const { isAuthenticated } = useAuth();
  const [savePromptOpen, setSavePromptOpen] = useState(false);

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
    onError: (e: Error) => toast.error(e.message ?? "Could not save list"),
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
          <div className="flex flex-col items-center gap-4 py-24 text-center">
            <div className="grid h-16 w-16 place-items-center rounded-full bg-muted">
              <ShoppingBag className="h-7 w-7 text-ink-muted" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-ink">Nothing here yet</h2>
              <p className="mt-1 text-sm text-ink-muted">Start with today's fresh picks.</p>
            </div>
            <Link
              to="/"
              className="rounded-full bg-ink px-5 py-2.5 text-sm font-semibold text-background"
            >
              Browse the market
            </Link>
          </div>
        ) : (
          <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_360px] lg:gap-10">
            <div>
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

              <button
                type="button"
                onClick={handleSaveList}
                className="mt-4 inline-flex items-center gap-2 text-[13px] font-medium text-ink-muted hover:text-ink"
              >
                <BookmarkPlus className="h-4 w-4" />
                Save cart to a list
              </button>

              <p className="mt-6 text-[11px] leading-relaxed text-ink-muted lg:text-[12px]">
                VAT and eTIMS invoice are calculated when Tradly Finance issues your PO.
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
                <div className="flex justify-between text-ink-muted">
                  <dt>VAT</dt>
                  <dd>at invoice</dd>
                </div>
              </dl>
              <div className="mt-5 flex items-baseline justify-between border-t border-divider pt-4">
                <span className="text-[13px] font-medium uppercase tracking-wide text-ink-muted">
                  Estimated
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
                Continue to Purchase Order
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
              Continue
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
    </AppShell>
  );
}
