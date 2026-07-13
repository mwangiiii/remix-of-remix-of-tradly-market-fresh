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
  ScheduledPrice,
} from "../types/marketplace";

// ─── Row shapes ──────────────────────────────────────────────────────────

type CategoryRow = {
  id: string;
  name: string;
  slug: string;
  parent_id: string | null;
  display_order: number;
  is_active: boolean;
};

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
  marketplace_product_units: UnitRow[] | null;
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

function mapCategory(r: CategoryRow): MarketplaceCategory & { isActive: boolean } {
  return {
    id: r.id,
    name: r.name,
    slug: r.slug,
    parentId: r.parent_id,
    displayOrder: r.display_order,
    isActive: r.is_active,
  } as MarketplaceCategory & { isActive: boolean };
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

const PRODUCT_SELECT = `
  id, category_id, name, slug, description, origin,
  thumbnail_url, gallery_urls, keywords, is_featured, published,
  marketplace_product_units (
    id, product_id, unit_label, unit_qty, is_default, price_kes, availability, display_order
  )
`;

// ─── Categories ──────────────────────────────────────────────────────────

export async function adminListCategories(): Promise<(MarketplaceCategory & { isActive: boolean })[]> {
  const { data, error } = await getSupabase()
    .from("marketplace_categories")
    .select("id, name, slug, parent_id, display_order, is_active")
    .order("display_order", { ascending: true });
  if (error) throw error;
  return (data ?? []).map(mapCategory);
}

export interface CategoryInput {
  id?: string;
  name: string;
  slug: string;
  parentId?: string | null;
  displayOrder: number;
  isActive?: boolean;
}

export async function adminUpsertCategory(input: CategoryInput): Promise<string> {
  const row = {
    id: input.id,
    name: input.name,
    slug: input.slug,
    parent_id: input.parentId ?? null,
    display_order: input.displayOrder,
    is_active: input.isActive ?? true,
  };
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
}

export async function adminUpsertProduct(input: ProductInput): Promise<string> {
  const row = {
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
  const { data, error } = await getSupabase()
    .from("marketplace_products")
    .upsert(row, { onConflict: "id" })
    .select("id")
    .single();
  if (error) throw error;
  return data.id;
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
