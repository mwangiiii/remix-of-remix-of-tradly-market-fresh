// Admin catalog API — all mutations against public.marketplace_* tables.
//
// Writes are gated by the platform_super_admin RLS policies added in the
// Phase 0 migration. This module assumes an authenticated platform super admin
// JWT is present (RequireAdmin enforces that at the route boundary).

import { getSupabase } from "@/lib/supabase";
import type {
  MarketplaceCategory,
  MarketplaceProduct,
  MarketplaceProductUnit,
  MarketplaceRoundingRule,
  MarketplaceTaxTreatment,
  ScheduledPrice,
  SellMode,
} from "../types/marketplace";

// ─── Row shapes ──────────────────────────────────────────────────────────

type CategoryRow = {
  id: string;
  name: string;
  slug: string;
  parent_id: string | null;
  display_order: number;
  is_active: boolean;
  default_markup_pct: number | string | null;
  default_tax_treatment: MarketplaceTaxTreatment | null;
  default_rounding_rule: MarketplaceRoundingRule;
};

/**
 * Admin-side category shape includes the pricing-engine defaults so the
 * product form can render "inherited from Vegetables: 30%" hints and the
 * "Use category default" button (spec §5.7).
 */
export interface AdminCategory extends MarketplaceCategory {
  isActive: boolean;
  defaultMarkupPct: number | null;
  defaultTaxTreatment: MarketplaceTaxTreatment | null;
  defaultRoundingRule: MarketplaceRoundingRule;
}

type UnitRow = {
  id: string;
  product_id: string;
  unit_label: string;
  unit_qty: number | string;
  is_default: boolean;
  price_kes: number | string;
  availability: MarketplaceProductUnit["availability"];
  display_order: number;
};

// Admin uses a LEFT join (not !inner) so unpriced products still appear in
// the list — we just show the "Unpriced · hidden" badge. The storefront uses
// !inner and drops them entirely. That's the intentional difference.
type AdminPriceVersionRow = {
  id: string;
  cost_rate_kes: number | string;
  shelf_rate_kes: number | string;
  effective_markup_pct: number | string;
  rounding_rule: MarketplaceRoundingRule;
};

type ProductRow = {
  id: string;
  category_id: string;
  name: string;
  slug: string;
  description: string;
  origin: string | null;
  thumbnail_url: string | null;
  gallery_urls: string[] | null;
  keywords: string[] | null;
  is_featured: boolean;
  published: boolean;
  sell_mode: SellMode;
  base_unit: string;
  min_qty: number | string;
  qty_step: number | string;
  avg_unit_weight_kg: number | string | null;
  pack_contents_label: string | null;
  tax_treatment: MarketplaceTaxTreatment | null;
  marketplace_product_units: UnitRow[] | null;
  // LEFT-joined current price version (null when unpriced).
  marketplace_price_versions: AdminPriceVersionRow[] | null;
};

type ScheduledPriceRow = {
  id: string;
  product_unit_id: string;
  price_kes: number | string;
  effective_from: string;
  note: string | null;
};

export interface InventoryRow {
  productUnitId: string;
  onHand: number;
  reserved: number;
  updatedAt: string;
}

export interface InventoryMovementRow {
  id: string;
  productUnitId: string;
  movementType: "adjust" | "reserve" | "release" | "fulfill";
  quantity: number;
  reference: string | null;
  orderId: string | null;
  note: string | null;
  createdAt: string;
}

/**
 * A product bundled with a `published` flag — the storefront read layer strips
 * this because anon RLS already filters, but admins care about the state.
 */
export interface AdminProduct extends MarketplaceProduct {
  published: boolean;
}

// ─── Mappers ─────────────────────────────────────────────────────────────

const num = (v: number | string): number =>
  typeof v === "number" ? v : Number(v);

function mapCategory(r: CategoryRow): AdminCategory {
  return {
    id: r.id,
    name: r.name,
    slug: r.slug,
    parentId: r.parent_id,
    displayOrder: r.display_order,
    isActive: r.is_active,
    defaultMarkupPct: r.default_markup_pct == null ? null : num(r.default_markup_pct),
    defaultTaxTreatment: r.default_tax_treatment,
    defaultRoundingRule: r.default_rounding_rule,
  };
}

function mapUnit(r: UnitRow): MarketplaceProductUnit {
  return {
    id: r.id,
    unitLabel: r.unit_label,
    unitQty: num(r.unit_qty),
    isDefault: r.is_default,
    priceKes: num(r.price_kes),
    availability: r.availability,
  };
}

function mapProduct(r: ProductRow): AdminProduct {
  const gallery = r.gallery_urls ?? [];
  const thumb = r.thumbnail_url ?? gallery[0] ?? "";
  const units = (r.marketplace_product_units ?? [])
    .slice()
    .sort((a, b) => a.display_order - b.display_order)
    .map(mapUnit);
  return {
    id: r.id,
    categoryId: r.category_id,
    name: r.name,
    slug: r.slug,
    description: r.description,
    origin: r.origin ?? undefined,
    thumbnailUrl: thumb,
    galleryUrls: gallery,
    units,
    isFeatured: r.is_featured,
    keywords: r.keywords ?? undefined,
    published: r.published,
    sellMode: r.sell_mode,
    baseUnit: r.base_unit,
    minQty: num(r.min_qty),
    qtyStep: num(r.qty_step),
    avgUnitWeightKg: r.avg_unit_weight_kg == null ? null : num(r.avg_unit_weight_kg),
    packContentsLabel: r.pack_contents_label,
    taxTreatment: r.tax_treatment,
    // LEFT-joined current price version. Null = unpriced (shows the
    // "Unpriced · hidden" badge). Non-null = has a live price version.
    currentPrice: (() => {
      const pv = (r.marketplace_price_versions ?? [])[0];
      if (!pv) return null;
      return {
        priceVersionId: pv.id,
        costRateKes: num(pv.cost_rate_kes),
        shelfRateKes: num(pv.shelf_rate_kes),
        effectiveMarkupPct: num(pv.effective_markup_pct),
        roundingRule: pv.rounding_rule,
      };
    })(),
  };
}

function mapSchedule(r: ScheduledPriceRow): ScheduledPrice {
  return {
    id: r.id,
    productUnitId: r.product_unit_id,
    priceKes: num(r.price_kes),
    effectiveFrom: r.effective_from,
    note: r.note ?? undefined,
  };
}

// LEFT-joins marketplace_price_versions filtered to the current row
// (effective_to IS NULL). Unlike the storefront (which uses !inner and drops
// unpriced products), LEFT means unpriced products still appear — we just
// show the "Unpriced · hidden" badge and force pricing on save.
const PRODUCT_SELECT = `
  id, category_id, name, slug, description, origin,
  thumbnail_url, gallery_urls, keywords, is_featured, published,
  sell_mode, base_unit, min_qty, qty_step,
  avg_unit_weight_kg, pack_contents_label, tax_treatment,
  marketplace_product_units (
    id, product_id, unit_label, unit_qty, is_default, price_kes, availability, display_order
  ),
  marketplace_price_versions (
    id, cost_rate_kes, shelf_rate_kes, effective_markup_pct, rounding_rule
  )
`;

// ─── Categories ──────────────────────────────────────────────────────────

export async function adminListCategories(): Promise<AdminCategory[]> {
  const { data, error } = await getSupabase()
    .from("marketplace_categories")
    .select("id, name, slug, parent_id, display_order, is_active, default_markup_pct, default_tax_treatment, default_rounding_rule")
    .order("display_order", { ascending: true });
  if (error) throw error;
  return (data ?? []).map((r) => mapCategory(r as unknown as CategoryRow));
}

export interface CategoryInput {
  id?: string;
  name: string;
  slug: string;
  parentId?: string | null;
  displayOrder: number;
  isActive?: boolean;
  // Pricing engine defaults — inherited by products in this category when they
  // don't override. Recursively resolved by fn_marketplace_resolve_defaults;
  // NULL here means "inherit from parent category, then platform default (25%,
  // hardcoded in the RPC)." Setting these here is the ONLY way for ops to
  // manage category markup without SQL.
  defaultMarkupPct?: number | null;
  defaultTaxTreatment?: MarketplaceTaxTreatment | null;
  defaultRoundingRule?: MarketplaceRoundingRule | null;
}

export async function adminUpsertCategory(input: CategoryInput): Promise<string> {
  const row: Record<string, unknown> = {
    id: input.id,
    name: input.name,
    slug: input.slug,
    parent_id: input.parentId ?? null,
    display_order: input.displayOrder,
    is_active: input.isActive ?? true,
  };
  // Only send pricing defaults when the caller explicitly supplied them so
  // an UPDATE from a legacy code path doesn't clobber existing values back to
  // NULL. Postgres DEFAULTs kick in only on INSERT for missing keys.
  if (input.defaultMarkupPct !== undefined) row.default_markup_pct = input.defaultMarkupPct;
  if (input.defaultTaxTreatment !== undefined) row.default_tax_treatment = input.defaultTaxTreatment;
  if (input.defaultRoundingRule !== undefined) row.default_rounding_rule = input.defaultRoundingRule;

  const { data, error } = await getSupabase()
    .from("marketplace_categories")
    .upsert(row, { onConflict: "id" })
    .select("id")
    .single();
  if (error) throw error;
  return data.id;
}

export async function adminDeleteCategory(id: string): Promise<void> {
  const { error } = await getSupabase()
    .from("marketplace_categories")
    .delete()
    .eq("id", id);
  if (error) throw error;
}

// ─── Products ────────────────────────────────────────────────────────────

export async function adminListProducts(): Promise<AdminProduct[]> {
  const { data, error } = await getSupabase()
    .from("marketplace_products")
    .select(PRODUCT_SELECT)
    // Narrow the embedded price_versions rows to the single current row
    // (effective_to IS NULL). Same filter the storefront uses — but here it
    // is on a LEFT join so unpriced products still come back (currentPrice
    // will be null, storefront uses !inner and drops them entirely).
    .is("marketplace_price_versions.effective_to", null)
    .order("name", { ascending: true });
  if (error) throw error;
  return (data ?? []).map(mapProduct);
}

export interface ProductInput {
  id?: string;
  categoryId: string;
  name: string;
  slug: string;
  description: string;
  origin?: string | null;
  thumbnailUrl?: string | null;
  galleryUrls?: string[];
  keywords?: string[];
  isFeatured?: boolean;
  published?: boolean;
  // Pricing engine columns (spec §5). Optional so callers that only touch
  // legacy product fields don't have to specify them — the DB defaults
  // (sell_mode='by_piece', base_unit='piece', min_qty=1, qty_step=1) keep
  // pre-migration rows valid.
  sellMode?: SellMode;
  baseUnit?: string;
  minQty?: number;
  qtyStep?: number;
  avgUnitWeightKg?: number | null;
  packContentsLabel?: string | null;
  taxTreatment?: MarketplaceTaxTreatment | null;
}

export async function adminUpsertProduct(input: ProductInput): Promise<string> {
  const row: Record<string, unknown> = {
    id: input.id,
    category_id: input.categoryId,
    name: input.name,
    slug: input.slug,
    description: input.description ?? "",
    origin: input.origin ?? null,
    thumbnail_url: input.thumbnailUrl ?? null,
    gallery_urls: input.galleryUrls ?? [],
    keywords: input.keywords ?? [],
    is_featured: input.isFeatured ?? false,
    published: input.published ?? false,
  };
  // Only set pricing-engine columns when the caller supplied them, so an
  // upsert from a legacy code path doesn't clobber a product's sell_mode
  // back to the default. Postgres DEFAULTs kick in only on INSERT, not
  // UPDATE, so omitting these on UPDATE preserves the current value.
  if (input.sellMode !== undefined) row.sell_mode = input.sellMode;
  if (input.baseUnit !== undefined) row.base_unit = input.baseUnit;
  if (input.minQty !== undefined) row.min_qty = input.minQty;
  if (input.qtyStep !== undefined) row.qty_step = input.qtyStep;
  if (input.avgUnitWeightKg !== undefined) row.avg_unit_weight_kg = input.avgUnitWeightKg;
  if (input.packContentsLabel !== undefined) row.pack_contents_label = input.packContentsLabel;
  if (input.taxTreatment !== undefined) row.tax_treatment = input.taxTreatment;

  const { data, error } = await getSupabase()
    .from("marketplace_products")
    .upsert(row, { onConflict: "id" })
    .select("id")
    .single();
  if (error) throw error;
  return data.id;
}

// ─── Price versions (spec §5) ────────────────────────────────────────────
// Thin wrapper around fn_marketplace_write_price_version. The RPC handles
// cascade resolution, bidirectional entry, rounding, and one-current-row
// enforcement — this function just marshals inputs and returns the new id.

/**
 * A single row from marketplace_price_versions — the versioned history of a
 * product's shelf pricing. `effectiveTo` is null on the current row and set
 * to the close timestamp on superseded rows. Fed to the admin price-history
 * view so ops can answer "why did we change X's price last week?"
 */
export interface AdminPriceVersion {
  id: string;
  costRateKes: number;
  markupPct: number | null;
  effectiveMarkupPct: number;
  rawSellRateKes: number;
  shelfRateKes: number;
  roundingRule: MarketplaceRoundingRule;
  effectiveFrom: string;
  effectiveTo: string | null;
  changedBy: string;
  changeReason: string | null;
  createdAt: string;
}

export async function adminListPriceHistory(productId: string): Promise<AdminPriceVersion[]> {
  const { data, error } = await getSupabase()
    .from("marketplace_price_versions")
    .select(
      "id, cost_rate_kes, markup_pct, effective_markup_pct, raw_sell_rate_kes, shelf_rate_kes, rounding_rule, effective_from, effective_to, changed_by, change_reason, created_at",
    )
    .eq("product_id", productId)
    .order("effective_from", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((r) => ({
    id: r.id as string,
    costRateKes: num(r.cost_rate_kes as number | string),
    markupPct: r.markup_pct == null ? null : num(r.markup_pct as number | string),
    effectiveMarkupPct: num(r.effective_markup_pct as number | string),
    rawSellRateKes: num(r.raw_sell_rate_kes as number | string),
    shelfRateKes: num(r.shelf_rate_kes as number | string),
    roundingRule: r.rounding_rule as MarketplaceRoundingRule,
    effectiveFrom: r.effective_from as string,
    effectiveTo: (r.effective_to as string) ?? null,
    changedBy: r.changed_by as string,
    changeReason: (r.change_reason as string) ?? null,
    createdAt: r.created_at as string,
  }));
}

export interface PriceVersionInput {
  productId: string;
  costRateKes: number;
  /** Provide EITHER markupPct OR shelfRateKes (bidirectional entry). */
  markupPct?: number | null;
  shelfRateKes?: number | null;
  /** NULL = inherit rounding from the product's category cascade. */
  roundingRule?: MarketplaceRoundingRule | null;
  changeReason?: string | null;
}

export async function adminWritePriceVersion(
  input: PriceVersionInput,
): Promise<string> {
  const { data, error } = await getSupabase().rpc(
    "fn_marketplace_write_price_version",
    {
      p_product_id: input.productId,
      p_cost_rate_kes: input.costRateKes,
      p_markup_pct: input.markupPct ?? null,
      p_shelf_rate_kes: input.shelfRateKes ?? null,
      p_rounding_rule: input.roundingRule ?? null,
      p_change_reason: input.changeReason ?? null,
    },
  );
  if (error) throw error;
  return data as string;
}

export async function adminDeleteProduct(id: string): Promise<void> {
  const { error } = await getSupabase()
    .from("marketplace_products")
    .delete()
    .eq("id", id);
  if (error) throw error;
}

// ─── Units ────────────────────────────────────────────────────────────────

export interface UnitInput {
  id?: string;
  productId: string;
  unitLabel: string;
  unitQty: number;
  isDefault: boolean;
  priceKes: number;
  availability: MarketplaceProductUnit["availability"];
  displayOrder?: number;
}

export async function adminUpsertUnit(input: UnitInput): Promise<string> {
  const row = {
    id: input.id,
    product_id: input.productId,
    unit_label: input.unitLabel,
    unit_qty: input.unitQty,
    is_default: input.isDefault,
    price_kes: input.priceKes,
    availability: input.availability,
    display_order: input.displayOrder ?? 0,
  };
  const { data, error } = await getSupabase()
    .from("marketplace_product_units")
    .upsert(row, { onConflict: "id" })
    .select("id")
    .single();
  if (error) throw error;
  return data.id;
}

export async function adminDeleteUnit(id: string): Promise<void> {
  const { error } = await getSupabase()
    .from("marketplace_product_units")
    .delete()
    .eq("id", id);
  if (error) throw error;
}

/**
 * Replace the full set of units for a product in one transaction-ish flow —
 * cheap because the units table is small per product. Deletes rows not in
 * `desiredIds`, then upserts the payload. Callers must ensure exactly one
 * `isDefault: true`.
 */
export async function adminReplaceUnits(
  productId: string,
  units: UnitInput[],
): Promise<void> {
  const sb = getSupabase();
  const existing = await sb
    .from("marketplace_product_units")
    .select("id")
    .eq("product_id", productId);
  if (existing.error) throw existing.error;

  const desiredIds = new Set(units.filter((u) => u.id).map((u) => u.id!));
  const toDelete = (existing.data ?? [])
    .map((r) => r.id)
    .filter((id) => !desiredIds.has(id));

  if (toDelete.length > 0) {
    const del = await sb
      .from("marketplace_product_units")
      .delete()
      .in("id", toDelete);
    if (del.error) throw del.error;
  }

  if (units.length > 0) {
    const payload = units.map((u, i) => ({
      id: u.id,
      product_id: productId,
      unit_label: u.unitLabel,
      unit_qty: u.unitQty,
      is_default: u.isDefault,
      price_kes: u.priceKes,
      availability: u.availability,
      display_order: u.displayOrder ?? i,
    }));
    const up = await sb
      .from("marketplace_product_units")
      .upsert(payload, { onConflict: "id" });
    if (up.error) throw up.error;
  }
}

// ─── Scheduled prices ────────────────────────────────────────────────────

export async function adminListSchedules(): Promise<ScheduledPrice[]> {
  const { data, error } = await getSupabase()
    .from("marketplace_scheduled_prices")
    .select("id, product_unit_id, price_kes, effective_from, note")
    .order("effective_from", { ascending: true });
  if (error) throw error;
  return (data ?? []).map(mapSchedule);
}

export interface ScheduleInput {
  productUnitId: string;
  priceKes: number;
  effectiveFrom: string;
  note?: string;
}

export async function adminAddSchedule(input: ScheduleInput): Promise<string> {
  const row = {
    product_unit_id: input.productUnitId,
    price_kes: input.priceKes,
    effective_from: input.effectiveFrom,
    note: input.note ?? null,
  };
  const { data, error } = await getSupabase()
    .from("marketplace_scheduled_prices")
    .upsert(row, { onConflict: "product_unit_id,effective_from" })
    .select("id")
    .single();
  if (error) throw error;
  return data.id;
}

export async function adminRemoveSchedule(id: string): Promise<void> {
  const { error } = await getSupabase()
    .from("marketplace_scheduled_prices")
    .delete()
    .eq("id", id);
  if (error) throw error;
}

// ─── Inventory ───────────────────────────────────────────────────────────

export async function adminListInventory(): Promise<Record<string, InventoryRow>> {
  const { data, error } = await getSupabase()
    .from("marketplace_inventory")
    .select("product_unit_id, on_hand, reserved, updated_at");
  if (error) throw error;
  const map: Record<string, InventoryRow> = {};
  for (const r of data ?? []) {
    map[r.product_unit_id as string] = {
      productUnitId: r.product_unit_id as string,
      onHand: num(r.on_hand as number | string),
      reserved: num(r.reserved as number | string),
      updatedAt: r.updated_at as string,
    };
  }
  return map;
}

export interface InventoryUpsert {
  productUnitId: string;
  onHand: number;
  reserved: number;
}

export async function adminUpsertInventory(input: InventoryUpsert): Promise<void> {
  const { error } = await getSupabase()
    .from("marketplace_inventory")
    .upsert(
      {
        product_unit_id: input.productUnitId,
        on_hand: input.onHand,
        reserved: input.reserved,
      },
      { onConflict: "product_unit_id" },
    );
  if (error) throw error;
}

export async function adminListMovements(
  productUnitId: string,
  limit = 50,
): Promise<InventoryMovementRow[]> {
  const { data, error } = await getSupabase()
    .from("marketplace_inventory_movements")
    .select("id, product_unit_id, movement_type, quantity, reference, order_id, note, created_at")
    .eq("product_unit_id", productUnitId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []).map((r) => ({
    id: r.id as string,
    productUnitId: r.product_unit_id as string,
    movementType: r.movement_type as InventoryMovementRow["movementType"],
    quantity: num(r.quantity as number | string),
    reference: (r.reference as string) ?? null,
    orderId: (r.order_id as string) ?? null,
    note: (r.note as string) ?? null,
    createdAt: r.created_at as string,
  }));
}

export interface MovementInput {
  productUnitId: string;
  movementType: InventoryMovementRow["movementType"];
  quantity: number;
  reference?: string;
  orderId?: string;
  note?: string;
}

export async function adminRecordMovement(input: MovementInput): Promise<void> {
  const { error } = await getSupabase()
    .from("marketplace_inventory_movements")
    .insert({
      product_unit_id: input.productUnitId,
      movement_type: input.movementType,
      quantity: input.quantity,
      reference: input.reference ?? null,
      order_id: input.orderId ?? null,
      note: input.note ?? null,
    });
  if (error) throw error;
}

// ─── Image upload ────────────────────────────────────────────────────────

/**
 * Upload a file to the marketplace-media bucket and return the public URL.
 * Path convention: products/<slug>/<random>-<originalname>.
 */
export async function adminUploadImage(
  file: File,
  productSlug: string,
): Promise<string> {
  const sb = getSupabase();
  const ext = file.name.split(".").pop() ?? "jpg";
  const stem = crypto.randomUUID().slice(0, 8);
  const path = `products/${productSlug || "unfiled"}/${stem}-${Date.now()}.${ext}`;

  const { error: upErr } = await sb.storage
    .from("marketplace-media")
    .upload(path, file, { cacheControl: "3600", upsert: false });
  if (upErr) throw upErr;

  const { data } = sb.storage.from("marketplace-media").getPublicUrl(path);
  return data.publicUrl;
}
