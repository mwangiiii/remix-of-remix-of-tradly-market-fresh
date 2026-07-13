// Marketplace API surface.
//
// Reads (catalog + orders)  — LIVE Supabase (public.marketplace_* + public.purchase_*).
// Writes (submit order)     — LIVE Edge Function `marketplace-submit-order`.
// Saved lists + notifications — still in-memory stubs; Phase 6 wires those.

import { getSupabase } from "@/lib/supabase";
import { apiPost } from "@/services/api";
import { searchSynonyms } from "../mockData/products";
import { savedLists as seedLists } from "../mockData/savedLists";
import { notifications as seedNotifications } from "../mockData/orders";
import type {
  CartLine,
  MarketplaceCategory,
  MarketplaceProduct,
  MarketplaceProductUnit,
  MarketplaceOrder,
  OrderStatus,
  SavedList,
  NotificationItem,
} from "../types/marketplace";

// ─────────────────────────────────────────────────────────────────────
// Catalog row shapes (Supabase → domain)
// ─────────────────────────────────────────────────────────────────────

type CategoryRow = {
  id: string;
  name: string;
  slug: string;
  parent_id: string | null;
  display_order: number;
};

type UnitRow = {
  id: string;
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
  marketplace_product_units: UnitRow[] | null;
};

const num = (v: number | string): number =>
  typeof v === "number" ? v : Number(v);

function mapCategory(row: CategoryRow): MarketplaceCategory {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    parentId: row.parent_id,
    displayOrder: row.display_order,
  };
}

function mapUnit(row: UnitRow): MarketplaceProductUnit {
  return {
    id: row.id,
    unitLabel: row.unit_label,
    unitQty: num(row.unit_qty),
    isDefault: row.is_default,
    priceKes: num(row.price_kes),
    availability: row.availability,
  };
}

function mapProduct(row: ProductRow): MarketplaceProduct {
  const gallery = row.gallery_urls ?? [];
  const thumb = row.thumbnail_url ?? gallery[0] ?? "";
  const units = (row.marketplace_product_units ?? [])
    .slice()
    .sort((a, b) => a.display_order - b.display_order)
    .map(mapUnit);
  return {
    id: row.id,
    categoryId: row.category_id,
    name: row.name,
    slug: row.slug,
    description: row.description,
    origin: row.origin ?? undefined,
    thumbnailUrl: thumb,
    galleryUrls: gallery.length > 0 ? gallery : thumb ? [thumb] : [],
    units,
    isFeatured: row.is_featured,
    keywords: row.keywords ?? undefined,
  };
}

const PRODUCT_SELECT = `
  id, category_id, name, slug, description, origin,
  thumbnail_url, gallery_urls, keywords, is_featured,
  marketplace_product_units (
    id, unit_label, unit_qty, is_default, price_kes, availability, display_order
  )
`;

// ─────────────────────────────────────────────────────────────────────
// Catalog reads
// ─────────────────────────────────────────────────────────────────────

export async function getCategories(): Promise<MarketplaceCategory[]> {
  const { data, error } = await getSupabase()
    .from("marketplace_categories")
    .select("id, name, slug, parent_id, display_order")
    .order("display_order", { ascending: true });
  if (error) throw error;
  return (data ?? []).map(mapCategory);
}

export async function getAllProducts(): Promise<MarketplaceProduct[]> {
  const { data, error } = await getSupabase()
    .from("marketplace_products")
    .select(PRODUCT_SELECT)
    .order("name", { ascending: true });
  if (error) throw error;
  return (data ?? []).map(mapProduct);
}

export async function getProductsByCategory(
  categorySlug: string,
): Promise<MarketplaceProduct[]> {
  const sb = getSupabase();
  const cat = await sb
    .from("marketplace_categories")
    .select("id")
    .eq("slug", categorySlug)
    .maybeSingle();
  if (cat.error) throw cat.error;
  if (!cat.data) return [];
  const { data, error } = await sb
    .from("marketplace_products")
    .select(PRODUCT_SELECT)
    .eq("category_id", cat.data.id)
    .order("name", { ascending: true });
  if (error) throw error;
  return (data ?? []).map(mapProduct);
}

export async function getProduct(
  slug: string,
): Promise<MarketplaceProduct | undefined> {
  const { data, error } = await getSupabase()
    .from("marketplace_products")
    .select(PRODUCT_SELECT)
    .eq("slug", slug)
    .maybeSingle();
  if (error) throw error;
  return data ? mapProduct(data as ProductRow) : undefined;
}

export async function searchProducts(
  query: string,
): Promise<MarketplaceProduct[]> {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const expanded = new Set<string>([q]);
  for (const [k, syns] of Object.entries(searchSynonyms)) {
    if (q.includes(k)) syns.forEach((s) => expanded.add(s));
    if (syns.some((s) => s.includes(q))) expanded.add(k);
  }
  const orParts: string[] = [];
  for (const t of expanded) {
    const safe = t.replace(/[%_,()]/g, "");
    if (!safe) continue;
    orParts.push(`name.ilike.%${safe}%`);
    orParts.push(`slug.ilike.%${safe}%`);
    orParts.push(`keywords.cs.{${safe}}`);
  }
  if (orParts.length === 0) return [];
  const { data, error } = await getSupabase()
    .from("marketplace_products")
    .select(PRODUCT_SELECT)
    .or(orParts.join(","))
    .limit(50);
  if (error) throw error;
  return (data ?? []).map(mapProduct);
}

// ─────────────────────────────────────────────────────────────────────
// Orders — real, backed by purchase_requests joined to marketplace units
// ─────────────────────────────────────────────────────────────────────

/**
 * Map flow's PR status to the buyer-facing OrderStatus enum. Statuses beyond
 * po_generated (delivered / invoiced / paid) require joining the PO / GRN /
 * invoice tables and land in Phase 6.
 */
function mapPrStatus(prStatus: string): OrderStatus {
  switch (prStatus) {
    case "draft":            return "draft";
    case "pending_approval": return "pending_approval";
    case "approved":         return "approved";
    case "po_generated":     return "po_generated";
    case "cancelled":        return "cancelled";
    case "rejected":         return "cancelled"; // no dedicated buyer surface
    default:                 return "pending_approval";
  }
}

type PrLineRow = {
  id: string;
  quantity: number | string;
  unit: string;
  item_name: string | null;
  estimated_unit_price_kes: number | string | null;
  marketplace_product_unit_id: string | null;
  marketplace_product_units: {
    id: string;
    product_id: string;
    marketplace_products: {
      id: string;
      slug: string;
      name: string;
      thumbnail_url: string | null;
    } | null;
  } | null;
};

type PrRow = {
  id: string;
  request_number: string;
  status: string;
  estimated_total_kes: number | string | null;
  created_at: string;
  expected_delivery_date: string | null;
  purchase_request_lines: PrLineRow[] | null;
};

function mapLine(r: PrLineRow): CartLine {
  const unit = r.marketplace_product_units;
  const prod = unit?.marketplace_products ?? null;
  return {
    productUnitId: r.marketplace_product_unit_id ?? "",
    productId: unit?.product_id ?? "",
    productSlug: prod?.slug ?? "",
    thumbnailUrl: prod?.thumbnail_url ?? "",
    productName: r.item_name ?? prod?.name ?? "Item",
    unitLabel: r.unit,
    quantity: num(r.quantity),
    priceKes: num(r.estimated_unit_price_kes ?? 0),
  };
}

function mapOrder(r: PrRow): MarketplaceOrder {
  const lines = (r.purchase_request_lines ?? []).map(mapLine);
  return {
    id: r.id,
    requestNumber: r.request_number,
    status: mapPrStatus(r.status),
    lines,
    totalKes: num(r.estimated_total_kes ?? lines.reduce((s, l) => s + l.priceKes * l.quantity, 0)),
    submittedAt: r.created_at,
    expectedDeliveryDate: r.expected_delivery_date ?? "",
  };
}

const ORDER_SELECT = `
  id, request_number, status, estimated_total_kes, created_at, expected_delivery_date,
  purchase_request_lines (
    id, quantity, unit, item_name, estimated_unit_price_kes, marketplace_product_unit_id,
    marketplace_product_units (
      id, product_id,
      marketplace_products ( id, slug, name, thumbnail_url )
    )
  )
`;

export async function getOrders(): Promise<MarketplaceOrder[]> {
  const { data, error } = await getSupabase()
    .from("purchase_requests")
    .select(ORDER_SELECT)
    .contains("flags", ["marketplace"])
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) throw error;
  return (data ?? []).map((r) => mapOrder(r as PrRow));
}

export async function getOrder(id: string): Promise<MarketplaceOrder | undefined> {
  const { data, error } = await getSupabase()
    .from("purchase_requests")
    .select(ORDER_SELECT)
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data ? mapOrder(data as PrRow) : undefined;
}

// ─────────────────────────────────────────────────────────────────────
// Submit — Edge Function marketplace-submit-order
// ─────────────────────────────────────────────────────────────────────

export async function submitMarketplaceOrder(
  lines: CartLine[],
  expectedDeliveryDate: string,
  options?: { idempotencyKey?: string; kraPin?: string },
): Promise<{ requestNumber: string; id: string }> {
  const payload = {
    lines: lines.map((l) => ({
      product_unit_id: l.productUnitId,
      quantity: l.quantity,
    })),
    expected_delivery_date: expectedDeliveryDate,
    idempotency_key: options?.idempotencyKey,
    kra_pin: options?.kraPin,
  };
  const data = await apiPost<{ pr_id: string; request_number: string }>(
    "/marketplace-submit-order",
    payload,
  );
  return { requestNumber: data.request_number, id: data.pr_id };
}

// ─────────────────────────────────────────────────────────────────────
// Still-stubbed surfaces (Phase 6 replaces these)
// ─────────────────────────────────────────────────────────────────────

const delay = (ms = 120) => new Promise((r) => setTimeout(r, ms));

const listStore: SavedList[] = seedLists.map((l) => ({ ...l, items: [...l.items] }));

export async function updateOrderStatus(
  _id: string,
  _next: OrderStatus,
): Promise<MarketplaceOrder | undefined> {
  // Admin-order status transitions live in tradly-flow proper (approve, GRN,
  // cancel). The market app is buyer-facing and should not mutate PR state
  // directly. Kept as a no-op so admin.orders.tsx keeps compiling until
  // Phase 6 rewires that surface.
  await delay(60);
  return undefined;
}

export async function getSavedLists(): Promise<SavedList[]> {
  await delay();
  return listStore;
}

export async function getSavedList(id: string): Promise<SavedList | undefined> {
  await delay();
  return listStore.find((l) => l.id === id);
}

export async function getNotifications(): Promise<NotificationItem[]> {
  await delay();
  return [...seedNotifications].sort((a, b) => b.timestamp.localeCompare(a.timestamp));
}
