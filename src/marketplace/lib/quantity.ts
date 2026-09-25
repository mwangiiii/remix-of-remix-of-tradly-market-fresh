import type { MarketplaceProduct, MarketplaceProductUnit } from "../types/marketplace";

/**
 * Smallest quantity a buyer may order for `product` in `unit`.
 *
 * Two rules can apply at once: the product-level "Minimum order" set in
 * admin (marketplace_products.min_qty) and an optional pack-level MOQ on
 * the unit (marketplace_product_units.moq). The stricter one wins. Falls
 * back to 1 when the product row carries no usable minimum.
 */
export function minOrderQty(
  product: Pick<MarketplaceProduct, "minQty">,
  unit?: Pick<MarketplaceProductUnit, "moq"> | null,
): number {
  const productMin = Number.isFinite(product.minQty) && product.minQty > 0 ? product.minQty : 1;
  return Math.max(productMin, unit?.moq ?? 0);
}
