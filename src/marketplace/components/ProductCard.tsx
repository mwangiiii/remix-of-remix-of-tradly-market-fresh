import { Link } from "@tanstack/react-router";
import { useState } from "react";
import type { MarketplaceProduct } from "../types/marketplace";
import { QuantityStepper } from "./QuantityStepper";
import { useCartStore } from "../store/cartStore";
import { formatKes } from "../lib/format";
import { Plus } from "lucide-react";

function availabilityBadge(a: string) {
  if (a === "available") return null;
  const map: Record<string, { label: string; className: string }> = {
    low_stock:    { label: "Low stock",    className: "bg-ripe/90 text-ripe-foreground" },
    seasonal:     { label: "Seasonal",     className: "bg-ripe/90 text-ripe-foreground" },
    out_of_stock: { label: "Out of stock", className: "bg-destructive text-destructive-foreground" },
  };
  const c = map[a];
  if (!c) return null;
  return (
    <span className={`absolute left-3 top-3 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${c.className}`}>
      {c.label}
    </span>
  );
}

export function ProductCard({ product }: { product: MarketplaceProduct }) {
  const defaultUnit = product.units.find((u) => u.isDefault) ?? product.units[0];
  const [qty, setQty] = useState(0);
  const addLine = useCartStore((s) => s.addLine);
  const setQuantity = useCartStore((s) => s.setQuantity);
  const cartLine = useCartStore((s) =>
    s.lines.find((l) => l.productUnitId === defaultUnit.id),
  );
  const effectiveQty = cartLine?.quantity ?? qty;
  const outOfStock = defaultUnit.availability === "out_of_stock";

  const handleAdd = (e: React.MouseEvent) => {
    e.preventDefault();
    if (outOfStock) return;
    addLine({
      productUnitId: defaultUnit.id,
      productId: product.id,
      productSlug: product.slug,
      thumbnailUrl: product.thumbnailUrl,
      productName: product.name,
      unitLabel: defaultUnit.unitLabel,
      quantity: 1,
      priceKes: defaultUnit.priceKes,
    });
    setQty(1);
  };

  const handleChange = (v: number) => {
    if (cartLine) setQuantity(defaultUnit.id, v);
    else setQty(v);
  };

  return (
    <Link
      to="/product/$slug"
      params={{ slug: product.slug }}
      className="group block"
    >
      <div className="relative aspect-square overflow-hidden rounded-2xl bg-surface soft-shadow">
        <img
          src={product.thumbnailUrl}
          alt={product.name}
          loading="lazy"
          className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
        />
        {availabilityBadge(defaultUnit.availability)}
      </div>
      <div className="mt-2.5 flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-[15px] font-semibold text-ink">{product.name}</h3>
          <p className="mt-0.5 text-[12px] text-ink-muted">{defaultUnit.unitLabel}</p>
          <p className="mt-1 text-[17px] font-bold text-farm">{formatKes(defaultUnit.priceKes)}</p>
        </div>
        <div className="pt-1" onClick={(e) => e.preventDefault()}>
          {effectiveQty === 0 ? (
            <button
              type="button"
              onClick={handleAdd}
              disabled={outOfStock}
              className="grid h-9 w-9 place-items-center rounded-full bg-farm text-farm-foreground shadow-sm transition-transform hover:scale-105 disabled:cursor-not-allowed disabled:opacity-40"
              aria-label={`Add ${product.name} to cart`}
            >
              <Plus className="h-4 w-4" strokeWidth={2.5} />
            </button>
          ) : (
            <QuantityStepper value={effectiveQty} onChange={handleChange} size="sm" />
          )}
        </div>
      </div>
    </Link>
  );
}
