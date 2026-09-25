import type { MarketplaceProduct, MarketplaceProductUnit, SellMode } from "../types/marketplace";

export interface QtyRules {
  /** Smallest orderable quantity. */
  min: number;
  step: number;
  /** Undefined = plain whole-number counter. */
  sellMode?: SellMode;
  baseUnit?: string;
}

type RulesProduct = Pick<MarketplaceProduct, "minQty" | "qtyStep" | "sellMode" | "baseUnit"> & {
  units?: Pick<MarketplaceProductUnit, "isDefault">[];
};
type RulesUnit = Pick<MarketplaceProductUnit, "moq" | "isDefault">;

/**
 * Quantity rules for ordering `product` in `unit`.
 *
 * The product-level sell mode, "Minimum order" and step set in admin
 * (marketplace_products.min_qty / qty_step) describe the DEFAULT unit —
 * e.g. potatoes sold by weight, min 2 kg, step 0.5 kg. Other varieties
 * (bucket, sack) are whole packs: counted 1, 2, 3… with their own MOQ.
 * A unit's MOQ (marketplace_product_units.moq) applies on top when stricter.
 */
export function unitQtyRules(product: RulesProduct, unit?: RulesUnit | null): QtyRules {
  const moq = unit?.moq ?? 0;
  // A product with no flagged default treats its first/only unit as default.
  const hasDefault = product.units ? product.units.some((u) => u.isDefault) : true;
  if (unit && !unit.isDefault && hasDefault) {
    return { min: Math.max(1, moq), step: 1 };
  }
  const productMin = Number.isFinite(product.minQty) && product.minQty > 0 ? product.minQty : 1;
  const step = Number.isFinite(product.qtyStep) && product.qtyStep > 0 ? product.qtyStep : 1;
  return {
    min: Math.max(productMin, moq),
    step,
    sellMode: product.sellMode,
    baseUnit: product.baseUnit,
  };
}

/** Smallest quantity a buyer may order for `product` in `unit`. */
export function minOrderQty(product: RulesProduct, unit?: RulesUnit | null): number {
  return unitQtyRules(product, unit).min;
}
