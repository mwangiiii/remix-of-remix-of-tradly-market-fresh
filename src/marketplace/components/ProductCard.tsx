import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { MarketplaceProduct } from "../types/marketplace";
import { QuantityStepper } from "./QuantityStepper";
import { useCartStore } from "../store/cartStore";
import { formatKes } from "../lib/format";
import { getProduct } from "../api/marketplaceApi";
import { imgUrl, imgSrcSet } from "../lib/img";
import { Plus } from "lucide-react";

// The grid layout displays the card image at roughly:
//   mobile (2-col) ~   170px, tablet (3-col) ~ 230px, desktop (4-col) ~ 280px
// So 400px is a comfortable fallback fetch when srcset can't be picked.
const CARD_FALLBACK_WIDTH = 400;
const CARD_SIZES = "(min-width: 1024px) 280px, (min-width: 768px) 33vw, 50vw";

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

export function ProductCard({
  product,
  priority = false,
}: {
  product: MarketplaceProduct;
  /**
   * Above-the-fold cards on the home grid should set priority so the LCP
   * image isn't lazy-loaded and gets fetchpriority=high. Off-screen cards
   * stay lazy.
   */
  priority?: boolean;
}) {
  // A product might have zero units if it was created in the admin but never
  // saved a unit. Never crash — render a minimal placeholder instead.
  const defaultUnit = product.units.find((u) => u.isDefault) ?? product.units[0];
  const [qty, setQty] = useState(0);
  const [addPop, setAddPop] = useState(false);
  const qc = useQueryClient();
  const addLine = useCartStore((s) => s.addLine);
  const setQuantity = useCartStore((s) => s.setQuantity);

  // Warm the product-detail query the moment a buyer signals intent (hover
  // on desktop, touchstart on mobile). By the time the tap-through fires,
  // the detail page has data already — no visible loading state.
  const prefetch = () => {
    qc.prefetchQuery({
      queryKey: ["product", product.slug],
      queryFn: () => getProduct(product.slug),
      staleTime: 30_000,
    });
  };

  const cartLine = useCartStore((s) =>
    s.lines.find((l) => defaultUnit && l.productUnitId === defaultUnit.id),
  );

  if (!defaultUnit) {
    // Draft-ish product with no packaging yet — safe default so we don't blow up.
    return (
      <Link
        to="/product/$slug"
        params={{ slug: product.slug }}
        className="group block opacity-60"
      >
        <div className="relative aspect-square overflow-hidden rounded-2xl bg-muted">
          {product.thumbnailUrl && (
            <img
              src={imgUrl(product.thumbnailUrl, { width: CARD_FALLBACK_WIDTH })}
              srcSet={imgSrcSet(product.thumbnailUrl)}
              sizes={CARD_SIZES}
              alt={`Fresh ${product.name} from Tradly`}
              loading="lazy"
              decoding="async"
              className="h-full w-full object-cover"
            />
          )}
        </div>
        <div className="mt-2.5">
          <h3 className="truncate text-[15px] font-semibold text-ink">{product.name}</h3>
          <p className="mt-0.5 text-[12px] text-ink-muted">Not yet priced</p>
        </div>
      </Link>
    );
  }

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
      onMouseEnter={prefetch}
      onFocus={prefetch}
      onTouchStart={prefetch}
      className="group block"
    >
      <div className="relative aspect-square overflow-hidden rounded-2xl bg-surface soft-shadow">
        <img
          src={imgUrl(product.thumbnailUrl, { width: CARD_FALLBACK_WIDTH })}
          srcSet={imgSrcSet(product.thumbnailUrl)}
          sizes={CARD_SIZES}
          alt={`Fresh ${product.name} from Tradly`}
          loading={priority ? "eager" : "lazy"}
          fetchPriority={priority ? "high" : "auto"}
          decoding="async"
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
