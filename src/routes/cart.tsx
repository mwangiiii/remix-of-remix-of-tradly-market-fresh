import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { AppShell } from "../marketplace/components/AppShell";
import { BrowseHeader } from "../marketplace/components/BrowseHeader";
import { QuantityStepper } from "../marketplace/components/QuantityStepper";
import { useCartStore, cartSubtotal } from "../marketplace/store/cartStore";
import { formatKes } from "../marketplace/lib/format";
import { X, BookmarkPlus, ShoppingBag } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/cart")({
  head: () => ({ meta: [{ title: "Your cart — Tradly Market" }, { name: "robots", content: "noindex" }] }),
  component: Cart,
});

function Cart() {
  const navigate = useNavigate();
  const lines = useCartStore((s) => s.lines);
  const setQuantity = useCartStore((s) => s.setQuantity);
  const removeLine = useCartStore((s) => s.removeLine);
  const subtotal = cartSubtotal(lines);

  return (
    <AppShell>
      <div className="px-4">
        <BrowseHeader title="Your cart" back="/" />

        {lines.length === 0 ? (
          <div className="flex flex-col items-center gap-4 py-24 text-center">
            <div className="grid h-16 w-16 place-items-center rounded-full bg-muted">
              <ShoppingBag className="h-7 w-7 text-ink-muted" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-ink">Your cart is empty</h2>
              <p className="mt-1 text-sm text-ink-muted">Add produce to get started.</p>
            </div>
            <Link
              to="/"
              className="rounded-full bg-farm px-5 py-2.5 text-sm font-semibold text-farm-foreground"
            >
              Browse categories
            </Link>
          </div>
        ) : (
          <>
            <ul className="divide-y divide-divider">
              {lines.map((l) => (
                <li key={l.productUnitId} className="flex items-center gap-3 py-4">
                  <Link
                    to="/product/$slug"
                    params={{ slug: l.productSlug }}
                    className="h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-surface soft-shadow"
                  >
                    <img src={l.thumbnailUrl} alt={l.productName} className="h-full w-full object-cover" />
                  </Link>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[14px] font-semibold text-ink">{l.productName}</p>
                    <p className="text-[12px] text-ink-muted">{l.unitLabel}</p>
                    <p className="mt-1 text-[13px] font-semibold text-farm">{formatKes(l.priceKes * l.quantity)}</p>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <button
                      type="button"
                      onClick={() => removeLine(l.productUnitId)}
                      className="grid h-7 w-7 place-items-center rounded-full text-ink-muted hover:bg-muted hover:text-destructive"
                      aria-label="Remove"
                    >
                      <X className="h-4 w-4" />
                    </button>
                    <QuantityStepper
                      value={l.quantity}
                      onChange={(v) => setQuantity(l.productUnitId, v)}
                      size="sm"
                    />
                  </div>
                </li>
              ))}
            </ul>

            <button
              type="button"
              onClick={() => toast.success("Saved for later in your list")}
              className="mt-4 inline-flex items-center gap-2 text-[13px] font-medium text-trust"
            >
              <BookmarkPlus className="h-4 w-4" /> Save cart to a list
            </button>

            <p className="mt-8 text-[11px] leading-relaxed text-ink-muted">
              VAT is calculated at purchase order stage, on your Tradly invoice.
            </p>
          </>
        )}
      </div>

      {lines.length > 0 && (
        <div className="fixed inset-x-0 bottom-16 z-30 border-t border-divider bg-surface/95 backdrop-blur">
          <div className="mx-auto flex max-w-lg items-center justify-between gap-3 px-4 py-3">
            <div>
              <p className="text-[11px] font-medium uppercase tracking-wide text-ink-muted">Subtotal</p>
              <p className="text-[18px] font-bold text-trust">{formatKes(subtotal)}</p>
            </div>
            <button
              type="button"
              onClick={() => navigate({ to: "/checkout" })}
              className="flex-1 rounded-full bg-trust px-5 py-3 text-[14px] font-semibold text-trust-foreground shadow-sm hover:bg-trust/95"
            >
              Submit Purchase Order
            </button>
          </div>
        </div>
      )}
    </AppShell>
  );
}
