// Marketplace API surface.
//
// Catalog reads + orders + notifications  — LIVE Supabase.
// Submit order                             — LIVE Edge Function.
// Branches                                 — LIVE REST API (/branches),
//                                            same endpoint the settings app
//                                            uses — branch visibility isn't
//                                            reliably exposed via direct
//                                            client-side Supabase RLS reads.
// Saved lists                              — returns empty until a real
//                                            marketplace_saved_lists table
//                                            is provisioned. NO mock data.

import { getSupabase } from "@/lib/supabase";
import { api, apiGet, apiPost } from "@/services/api";
import { SEARCH_SYNONYMS } from "../config/searchSynonyms";
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
  moq: number | string | null;
  case_pack_size: number | string | null;
};

type MediaRow = {
  id: string;
  url: string;
  kind: "image" | "video";
  mime_type: string | null;
  alt_text: string | null;
  poster_url: string | null;
  display_order: number;
  is_thumbnail: boolean;
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
  tax_ty_cd: string | null;
  item_cls_cd: string | null;
  item_cd: string | null;
  is_taxable: boolean | null;
  kra_registered: boolean | null;
  country_of_origin: string | null;
  storage_class: string | null;
  shelf_life_days: number | null;
  lead_time_days: number | null;
  order_cutoff_time: string | null;
  marketplace_product_units: UnitRow[] | null;
  marketplace_product_media: MediaRow[] | null;
};

const num = (v: number | string): number => (typeof v === "number" ? v : Number(v));

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
    moq: row.moq == null ? null : num(row.moq),
    casePackSize: row.case_pack_size == null ? null : num(row.case_pack_size),
  };
}

function mapProduct(row: ProductRow): MarketplaceProduct {
  const galleryLegacy = row.gallery_urls ?? [];
  const media = (row.marketplace_product_media ?? [])
    .slice()
    .sort((a, b) => a.display_order - b.display_order)
    .map((m) => ({
      id: m.id,
      url: m.url,
      kind: m.kind,
      mimeType: m.mime_type,
      altText: m.alt_text,
      posterUrl: m.poster_url,
      displayOrder: m.display_order,
      isThumbnail: m.is_thumbnail,
    }));
  const thumb =
    row.thumbnail_url ??
    media.find((m) => m.isThumbnail && m.kind === "image")?.url ??
    media.find((m) => m.kind === "image")?.url ??
    galleryLegacy[0] ??
    "";
  const derivedGallery =
    media.length > 0 ? media.filter((m) => m.kind === "image").map((m) => m.url) : galleryLegacy;
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
    galleryUrls: derivedGallery.length > 0 ? derivedGallery : thumb ? [thumb] : [],
    media,
    units,
    isFeatured: row.is_featured,
    keywords: row.keywords ?? undefined,
    taxTyCd: (row.tax_ty_cd as MarketplaceProduct["taxTyCd"]) ?? null,
    itemClsCd: row.item_cls_cd,
    itemCd: row.item_cd,
    isTaxable: row.is_taxable ?? undefined,
    kraRegistered: row.kra_registered ?? undefined,
    countryOfOrigin: row.country_of_origin,
    storageClass: (row.storage_class as MarketplaceProduct["storageClass"]) ?? null,
    shelfLifeDays: row.shelf_life_days,
    leadTimeDays: row.lead_time_days,
    orderCutoffTime: row.order_cutoff_time,
  };
}

const PRODUCT_SELECT = `
  id, category_id, name, slug, description, origin,
  thumbnail_url, gallery_urls, keywords, is_featured,
  tax_ty_cd, item_cls_cd, item_cd, is_taxable, kra_registered,
  country_of_origin, storage_class, shelf_life_days, lead_time_days, order_cutoff_time,
  marketplace_product_units (
    id, unit_label, unit_qty, is_default, price_kes, availability, display_order,
    moq, case_pack_size
  ),
  marketplace_product_media (
    id, url, kind, mime_type, alt_text, poster_url, display_order, is_thumbnail
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

export async function getProductsByCategory(categorySlug: string): Promise<MarketplaceProduct[]> {
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

export async function getProduct(slug: string): Promise<MarketplaceProduct | undefined> {
  const { data, error } = await getSupabase()
    .from("marketplace_products")
    .select(PRODUCT_SELECT)
    .eq("slug", slug)
    .maybeSingle();
  if (error) throw error;
  return data ? mapProduct(data as ProductRow) : undefined;
}

export async function searchProducts(query: string): Promise<MarketplaceProduct[]> {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const expanded = new Set<string>([q]);
  for (const [k, syns] of Object.entries(SEARCH_SYNONYMS)) {
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
 * Buyer-facing OrderStatus enum. Values >= po_generated in the pipeline come
 * from the vw_marketplace_order_status view, which walks PR → PO → GRN →
 * invoice → payment and collapses to a single unified_status.
 */
function toOrderStatus(unified: string | null | undefined): OrderStatus {
  switch (unified) {
    case "draft":
      return "draft";
    case "pending_approval":
      return "pending_approval";
    case "approved":
      return "approved";
    case "po_generated":
      return "po_generated";
    case "delivered":
      return "delivered";
    case "invoiced":
      return "invoiced";
    case "paid":
      return "paid";
    case "cancelled":
      return "cancelled";
    case "rejected":
      return "cancelled";
    default:
      return "pending_approval";
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

type StatusRow = {
  unified_status: string | null;
  po_number: string | null;
  grn_number: string | null;
  grn_delivery_date: string | null;
  invoice_number: string | null;
  invoice_status: string | null;
  invoice_payment_status: string | null;
  invoice_total_kes: number | string | null;
  amount_paid_kes: number | string | null;
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

function mapOrder(r: PrRow, s?: StatusRow | null): MarketplaceOrder {
  const lines = (r.purchase_request_lines ?? []).map(mapLine);
  return {
    id: r.id,
    requestNumber: r.request_number,
    status: toOrderStatus(s?.unified_status ?? r.status),
    lines,
    totalKes: num(
      r.estimated_total_kes ?? lines.reduce((s2, l) => s2 + l.priceKes * l.quantity, 0),
    ),
    submittedAt: r.created_at,
    expectedDeliveryDate: r.expected_delivery_date ?? "",
    poNumber: s?.po_number ?? null,
    grnNumber: s?.grn_number ?? null,
    grnDeliveryDate: s?.grn_delivery_date ?? null,
    invoiceNumber: s?.invoice_number ?? null,
    invoiceStatus: s?.invoice_status ?? null,
    invoicePaymentStatus: s?.invoice_payment_status ?? null,
    invoiceTotalKes: s?.invoice_total_kes == null ? null : num(s.invoice_total_kes),
    amountPaidKes: s?.amount_paid_kes == null ? null : num(s.amount_paid_kes),
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

const STATUS_SELECT = `
  pr_id, unified_status, po_number, grn_number, grn_delivery_date,
  invoice_number, invoice_status, invoice_payment_status,
  invoice_total_kes, amount_paid_kes
`;

/**
 * Fetch the enriched status rows for a set of PR ids in one round-trip
 * and index by pr_id. Order-of-magnitude cheaper than N+1 per-row lookups.
 */
async function loadStatuses(prIds: string[]): Promise<Record<string, StatusRow>> {
  if (prIds.length === 0) return {};
  const { data, error } = await getSupabase()
    .from("vw_marketplace_order_status")
    .select(STATUS_SELECT)
    .in("pr_id", prIds);
  if (error) throw error;
  const byId: Record<string, StatusRow> = {};
  for (const row of data ?? []) {
    byId[row.pr_id as string] = row as unknown as StatusRow;
  }
  return byId;
}

export async function getOrders(): Promise<MarketplaceOrder[]> {
  const { data, error } = await getSupabase()
    .from("purchase_requests")
    .select(ORDER_SELECT)
    .contains("flags", ["marketplace"])
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) throw error;
  const rows = (data ?? []) as unknown as PrRow[];
  const statuses = await loadStatuses(rows.map((r) => r.id));
  return rows.map((r) => mapOrder(r, statuses[r.id]));
}

export async function getOrder(id: string): Promise<MarketplaceOrder | undefined> {
  const sb = getSupabase();
  const [prRes, statusRes] = await Promise.all([
    sb.from("purchase_requests").select(ORDER_SELECT).eq("id", id).maybeSingle(),
    sb.from("vw_marketplace_order_status").select(STATUS_SELECT).eq("pr_id", id).maybeSingle(),
  ]);
  if (prRes.error) throw prRes.error;
  if (statusRes.error) throw statusRes.error;
  return prRes.data
    ? mapOrder(
        prRes.data as unknown as PrRow,
        (statusRes.data ?? null) as unknown as StatusRow | null,
      )
    : undefined;
}

// ─────────────────────────────────────────────────────────────────────
// Branches (delivery points)
//   Goes through the /branches REST endpoint — the same one BranchesTab
//   (settings app) uses — rather than a direct Supabase table read.
//   Branch visibility depends on more than business_id (role/branch
//   scoping via user_roles.branch_id), so it isn't safely exposed as a
//   plain RLS-scoped client read the way `businesses` is.
// ─────────────────────────────────────────────────────────────────────

export interface MarketplaceBranch {
  id: string;
  name: string;
  address: string | null;
  city: string | null;
  phone: string | null;
  isDefault: boolean;
  isActive: boolean;
}

type BranchApiRow = {
  id: string;
  name: string;
  address: string | null;
  city: string | null;
  phone: string | null;
  is_active: boolean;
  is_default: boolean;
};

export async function getBranches(): Promise<MarketplaceBranch[]> {
  // Bypass apiGet's fixed envelope unwrap because /branches has historically
  // shipped in three shapes across environments:
  //   1. Tradly envelope:  { data: { branches: [...] }, error }
  //   2. Wrapped:          { branches: [...] }
  //   3. Bare array:       [ ...rows ]
  // Normalise here so the checkout page doesn't silently show "no branches"
  // when the function is healthy but shaped differently.
  const res = await api.get<unknown>("/branches", {
    params: { include_inactive: "false" },
  });
  const rows = extractBranchRows(res.data);
  return rows
    .filter((b) => b.is_active)
    .sort((a, b) => Number(b.is_default) - Number(a.is_default) || a.name.localeCompare(b.name))
    .map((b) => ({
      id: b.id,
      name: b.name,
      address: b.address,
      city: b.city,
      phone: b.phone,
      isDefault: b.is_default,
      isActive: b.is_active,
    }));
}

function extractBranchRows(body: unknown): BranchApiRow[] {
  if (Array.isArray(body)) return body as BranchApiRow[];
  if (body && typeof body === "object") {
    const o = body as Record<string, unknown>;
    if (Array.isArray(o.branches)) return o.branches as BranchApiRow[];
    if (o.data && typeof o.data === "object") {
      const d = o.data as Record<string, unknown>;
      if (Array.isArray(d.branches)) return d.branches as BranchApiRow[];
      if (Array.isArray(o.data as unknown)) return o.data as BranchApiRow[];
    }
    if (Array.isArray(o.data)) return o.data as BranchApiRow[];
  }
  return [];
}

// ─────────────────────────────────────────────────────────────────────
// Submit — Edge Function marketplace-submit-order
// ─────────────────────────────────────────────────────────────────────

export async function submitMarketplaceOrder(
  lines: CartLine[],
  expectedDeliveryDate: string,
  options?: { idempotencyKey?: string; kraPin?: string; branchId?: string },
): Promise<{ requestNumber: string; id: string }> {
  const payload = {
    lines: lines.map((l) => ({
      product_unit_id: l.productUnitId,
      quantity: l.quantity,
    })),
    expected_delivery_date: expectedDeliveryDate,
    idempotency_key: options?.idempotencyKey,
    kra_pin: options?.kraPin,
    branch_id: options?.branchId,
  };
  const data = await apiPost<{ pr_id: string; request_number: string }>(
    "/marketplace-submit-order",
    payload,
  );
  return { requestNumber: data.request_number, id: data.pr_id };
}

// ─────────────────────────────────────────────────────────────────────
// Buyer's business (for the /account page)
//   businesses.RLS is `id = current_business_id()` (from the JWT claim),
//   so any authenticated buyer gets back a single row — their own.
// ─────────────────────────────────────────────────────────────────────

export interface BuyerBusiness {
  id: string;
  name: string;
  /**
   * Discriminator (company | individual | supplier_vendor). Individuals
   * are OTP-signed-in buyers who haven't upgraded to a full company
   * workspace yet — the /account page shows an "Upgrade" CTA for them
   * that deep-links into tradly-flow's /upgrade wizard (spec §9).
   */
  businessType: string | null;
  kraPin: string | null;
  email: string | null;
  phone: string | null;
  city: string | null;
  address: string | null;
  industry: string | null;
  logoUrl: string | null;
}

export async function getMyBusiness(): Promise<BuyerBusiness | null> {
  const { data, error } = await getSupabase()
    .from("businesses")
    .select("id, name, business_type, kra_pin, email, phone, city, address, industry, logo_url")
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return {
    id: data.id as string,
    name: (data.name as string) ?? "",
    businessType: (data.business_type as string) ?? null,
    kraPin: (data.kra_pin as string) ?? null,
    email: (data.email as string) ?? null,
    phone: (data.phone as string) ?? null,
    city: (data.city as string) ?? null,
    address: (data.address as string) ?? null,
    industry: (data.industry as string) ?? null,
    logoUrl: (data.logo_url as string) ?? null,
  };
}

// ─────────────────────────────────────────────────────────────────────
// Buyer surfaces that don't have a DB table yet
// ─────────────────────────────────────────────────────────────────────

export async function updateOrderStatus(
  _id: string,
  _next: OrderStatus,
): Promise<MarketplaceOrder | undefined> {
  // Buyer surface never mutates PR state — admin ops live in tradly-flow.
  // Kept as a no-op so admin.orders.tsx keeps compiling.
  return undefined;
}

// ─────────────────────────────────────────────────────────────────────
// Saved lists — backed by public.marketplace_saved_lists (JSONB items).
// RLS scopes to business_id from the JWT, so buyers only see their own.
// ─────────────────────────────────────────────────────────────────────

type SavedListRow = { id: string; name: string; items: unknown; created_at: string };

function normalizeItems(raw: unknown): CartLine[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((v): v is Record<string, unknown> => !!v && typeof v === "object")
    .map((v) => ({
      productUnitId: String(v.productUnitId ?? ""),
      productId: String(v.productId ?? ""),
      productSlug: String(v.productSlug ?? ""),
      thumbnailUrl: String(v.thumbnailUrl ?? ""),
      productName: String(v.productName ?? ""),
      unitLabel: String(v.unitLabel ?? ""),
      quantity: Number(v.quantity ?? 0),
      priceKes: Number(v.priceKes ?? 0),
    }))
    .filter((l) => l.productUnitId && l.quantity > 0);
}

/** Extract the buyer's business_id from the in-memory JWT (RLS needs it). */
async function currentBusinessId(): Promise<string | null> {
  const { useAuthStore } = await import("@/store/useAuthStore");
  const token = useAuthStore.getState().accessToken;
  if (!token) return null;
  try {
    const [, payload] = token.split(".");
    const claims = JSON.parse(atob(payload.replace(/-/g, "+").replace(/_/g, "/")));
    return (claims.business_id as string) ?? null;
  } catch {
    return null;
  }
}

export async function getSavedLists(): Promise<SavedList[]> {
  const { data, error } = await getSupabase()
    .from("marketplace_saved_lists")
    .select("id, name, items, created_at")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((r) => {
    const row = r as unknown as SavedListRow;
    return { id: row.id, name: row.name, items: normalizeItems(row.items) };
  });
}

export async function getSavedList(id: string): Promise<SavedList | undefined> {
  const { data, error } = await getSupabase()
    .from("marketplace_saved_lists")
    .select("id, name, items, created_at")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  if (!data) return undefined;
  const row = data as unknown as SavedListRow;
  return { id: row.id, name: row.name, items: normalizeItems(row.items) };
}

/** Save a cart snapshot as a named list. */
export async function createSavedList(name: string, items: CartLine[]): Promise<SavedList> {
  const businessId = await currentBusinessId();
  if (!businessId) throw new Error("Sign in to save lists.");
  const { data, error } = await getSupabase()
    .from("marketplace_saved_lists")
    .insert({
      business_id: businessId,
      name: name.trim() || "Untitled list",
      items,
    })
    .select("id, name, items")
    .single();
  if (error) throw error;
  return {
    id: data.id as string,
    name: data.name as string,
    items: normalizeItems((data as { items: unknown }).items),
  };
}

export async function deleteSavedList(id: string): Promise<void> {
  const { error } = await getSupabase().from("marketplace_saved_lists").delete().eq("id", id);
  if (error) throw error;
}

/**
 * Patch an existing saved list. Any subset of {name, items} can be sent.
 * Items are stored as JSONB so we always replace the whole array — the
 * caller is responsible for computing the new items list (add / remove /
 * bump-quantity). RLS on marketplace_saved_lists restricts writes to the
 * caller's own business_id, so no extra guard is needed here.
 */
export async function updateSavedList(
  id: string,
  patch: { name?: string; items?: CartLine[] },
): Promise<SavedList> {
  const payload: Record<string, unknown> = {};
  if (typeof patch.name === "string") payload.name = patch.name.trim() || "Untitled list";
  if (patch.items) payload.items = patch.items;
  if (Object.keys(payload).length === 0) {
    // Nothing to update — round-trip a read so callers still get the current row.
    const current = await getSavedList(id);
    if (!current) throw new Error("List not found");
    return current;
  }
  const { data, error } = await getSupabase()
    .from("marketplace_saved_lists")
    .update(payload)
    .eq("id", id)
    .select("id, name, items")
    .single();
  if (error) throw error;
  return {
    id: data.id as string,
    name: data.name as string,
    items: normalizeItems((data as { items: unknown }).items),
  };
}

/**
 * Buyer notifications, sourced from public.tradly_inbox. RLS scopes to the
 * buyer's business_id, so this is safe to call from any signed-in surface.
 * Anonymous callers get an empty list (RLS filters everything out).
 *
 * The `request_number` field on NotificationItem is populated whenever the
 * inbox row references a purchase_request or purchase_order — the UI shows
 * "PR-042" / "PO-042" chips inline.
 */
type InboxRow = {
  id: string;
  subject: string | null;
  body: string;
  created_at: string;
  entity_type: string | null;
  entity_id: string | null;
  metadata: Record<string, unknown> | null;
};

function inboxReference(row: InboxRow): string | undefined {
  const meta = row.metadata ?? {};
  const rn = (meta["request_number"] ??
    meta["po_number"] ??
    meta["grn_number"] ??
    meta["invoice_number"] ??
    meta["payment_number"]) as string | undefined;
  return rn ?? undefined;
}

export async function getNotifications(): Promise<NotificationItem[]> {
  const { data, error } = await getSupabase()
    .from("tradly_inbox")
    .select("id, subject, body, created_at, entity_type, entity_id, metadata")
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) throw error;
  return (data ?? []).map((r) => {
    const row = r as unknown as InboxRow;
    return {
      id: row.id,
      title: row.subject ?? "Update",
      body: row.body,
      timestamp: row.created_at,
      requestNumber: inboxReference(row),
    };
  });
}
