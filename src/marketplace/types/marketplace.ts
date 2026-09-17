export interface MarketplaceCategory {
  id: string;
  name: string;
  slug: string;
  parentId: string | null;
  displayOrder: number;
}

export type MarketplaceStorageClass = "ambient" | "chilled" | "frozen" | "dry";
export type MarketplaceTaxTypeCode = "A" | "B" | "C" | "E";

/**
 * Household Commerce spec v1.0 §5.2. Drives the storefront quantity stepper
 * shape and the admin product form layout.
 */
export type SellMode = "by_weight" | "by_piece" | "by_pack";

export type MarketplaceRoundingRule =
  | "exact"
  | "nearest_1"
  | "nearest_5"
  | "nearest_10"
  | "charm_down";

export type MarketplaceTaxTreatment = "exempt" | "zero_rated" | "standard";

/**
 * Household Commerce spec v1.0 §7.2. One row per rider-serviceable area.
 * Public-readable so /checkout can render fees and cutoffs to anonymous
 * browsers too.
 */
export type DistanceBand = "short" | "long";

export interface DeliveryZone {
  id: string;
  name: string;
  county: string;
  areas: string[];
  customerFeeKes: number;
  defaultDistanceBand: DistanceBand;
  /** Local time, Africa/Nairobi. Format "HH:MM:SS". */
  sameDayCutoffTime: string;
  isActive: boolean;
  sortOrder: number;
}

/**
 * Household Commerce spec v1.0 §16.2. Per-buyer delivery address.
 * Landmark trumps geocoding — checkout never gates on lat/lng.
 */
export interface HouseholdAddress {
  id: string;
  businessId: string;
  label: string | null;
  area: string;
  estateOrBuilding: string | null;
  houseOrDoor: string | null;
  landmark: string | null;
  zoneId: string | null;
  lat: number | null;
  lng: number | null;
  deliveryNotes: string | null;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string | null;
}

/**
 * The current row in marketplace_price_versions for a product (WHERE
 * effective_to IS NULL). Always present on products returned by the
 * storefront queries because those queries INNER-JOIN this table —
 * unpriced products are hidden by construction. Nullable in the type
 * only for admin surfaces that may hold a pre-priced product mid-edit.
 */
export interface CurrentPrice {
  priceVersionId: string;
  costRateKes: number;
  shelfRateKes: number;
  effectiveMarkupPct: number;
  roundingRule: MarketplaceRoundingRule;
}

export interface MarketplaceProductUnit {
  id: string;
  unitLabel: string;
  unitQty: number;
  isDefault: boolean;
  priceKes: number;
  availability: "available" | "low_stock" | "out_of_stock" | "seasonal";
  moq?: number | null;
  casePackSize?: number | null;
}

export type MarketplaceMediaKind = "image" | "video";

export interface MarketplaceMedia {
  id: string;
  url: string;
  kind: MarketplaceMediaKind;
  mimeType?: string | null;
  altText?: string | null;
  posterUrl?: string | null;
  displayOrder: number;
  isThumbnail: boolean;
}

export interface MarketplaceProduct {
  id: string;
  categoryId: string;
  name: string;
  slug: string;
  description: string;
  origin?: string;
  thumbnailUrl: string;
  /** @deprecated Use `media` for the mixed image + video list. */
  galleryUrls: string[];
  /** Structured media list — includes videos and per-item metadata. */
  media?: MarketplaceMedia[];
  /**
   * @deprecated Superseded by `currentPrice` + product-level `sellMode`
   * (Household Commerce spec §5). Kept on the type until the checkout
   * pipeline (Checkpoint E) moves off unit-keyed CartLines, at which point
   * this whole shape can go. New code should not read `units[*].priceKes`.
   */
  units: MarketplaceProductUnit[];
  isFeatured: boolean;
  keywords?: string[];
  // ── Pricing engine (spec §5) ──
  sellMode: SellMode;
  baseUnit: string;
  minQty: number;
  qtyStep: number;
  avgUnitWeightKg?: number | null;
  packContentsLabel?: string | null;
  taxTreatment?: MarketplaceTaxTreatment | null;
  /** Current shelf price for this product, resolved server-side. */
  currentPrice: CurrentPrice | null;
  // Compliance (may be absent on older rows / unpublished drafts)
  taxTyCd?: MarketplaceTaxTypeCode | null;
  itemClsCd?: string | null;
  itemCd?: string | null;
  isTaxable?: boolean;
  kraRegistered?: boolean;
  // Logistics (all optional)
  countryOfOrigin?: string | null;
  storageClass?: MarketplaceStorageClass | null;
  shelfLifeDays?: number | null;
  leadTimeDays?: number | null;
  orderCutoffTime?: string | null;
}

export interface CartLine {
  productUnitId: string;
  productId: string;
  productSlug: string;
  thumbnailUrl: string;
  productName: string;
  unitLabel: string;
  quantity: number;
  priceKes: number;
  // Pricing-engine hints so /cart's stepper can honour weight/piece/pack.
  // Optional — cart lines persisted before this field fall back to integer
  // stepping, matching the previous behaviour. Populated by ProductCard +
  // product-detail add flows.
  sellMode?: SellMode;
  baseUnit?: string;
  minQty?: number;
  qtyStep?: number;
}

export interface SavedList {
  id: string;
  name: string;
  items: CartLine[];
}

/**
 * Company (tenant) order status — walks the PR → PO → GRN → invoice →
 * payment chain and is what vw_marketplace_order_status collapses to.
 * Unchanged from the pre-Household-Commerce shape.
 */
export type TenantOrderStatus =
  | "draft"
  | "pending_approval"
  | "approved"
  | "po_generated"
  | "delivered"
  | "invoiced"
  | "paid"
  | "cancelled";

/**
 * Household (consumer) order status — spec §9.1. Never touches the tenant
 * chain. Statuses walk pending_payment → paid → picking → dispatched →
 * delivered (+ cancelled, expired).
 */
export type ConsumerOrderStatus =
  | "pending_payment"
  | "paid"
  | "picking"
  | "dispatched"
  | "delivered"
  | "cancelled"
  | "expired";

/** Deprecated alias. Retained for legacy code paths that predate the fork. */
export type OrderStatus = TenantOrderStatus;

export type FulfilmentMethod = "tradly_rider" | "customer_rider" | "self_pickup";

/**
 * Household Commerce spec v1.0 §11. Split by ORIGIN, not policy:
 *   refundable  — money the customer paid us; cashable via ops in Phase 2
 *   promotional — money we gave them; spend-only, never cashable
 */
export type CreditBucket = "refundable" | "promotional";

export interface CreditBalance {
  bucket: CreditBucket;
  balanceKes: number;
}

export interface CreditLedgerEntry {
  id: string;
  businessId: string;
  bucket: CreditBucket;
  direction: "credit" | "debit";
  amountKes: number;
  reason: string;
  orderId: string | null;
  expiresAt: string | null;
  createdAt: string;
}

/**
 * Household Commerce spec v1.0 §18 item 18 — recurring baskets.
 * Draft + confirm, never auto-charged.
 */
export type RecurringCadence = "weekly" | "fortnightly" | "monthly";

export interface RecurringBasketLine {
  product_id: string;
  qty: number;
}

export interface RecurringBasket {
  id: string;
  businessId: string;
  name: string;
  lines: RecurringBasketLine[];
  cadence: RecurringCadence;
  nextRunAt: string;
  fulfilmentMethod: FulfilmentMethod;
  deliveryAddressId: string | null;
  isActive: boolean;
  pauseUntil: string | null;
  createdAt: string;
  updatedAt: string | null;
}

export type RecurringBasketRunStatus = "generated" | "confirmed" | "skipped" | "expired";

export interface RecurringBasketRun {
  id: string;
  basketId: string;
  ranAt: string;
  generatedOrderId: string | null;
  status: RecurringBasketRunStatus;
}

/**
 * Snapshot line on a consumer order. product_name / sell_mode / base_unit /
 * shelf_rate_kes are frozen at init time — the row survives product
 * renames + re-prices.
 */
export interface ConsumerOrderLine {
  id: string;
  orderId: string;
  productId: string;
  priceVersionId: string;
  productName: string;
  sellMode: SellMode;
  baseUnit: string;
  qty: number;
  shelfRateKes: number;
  lineTotalKes: number;
  status: "ordered" | "cancelled";
}

/**
 * A row from consumer_orders + its consumer_order_lines. Never joins into
 * purchase_requests / vw_marketplace_order_status.
 */
export interface ConsumerOrder {
  id: string;
  orderNumber: string;              // TRD-xxxx
  businessId: string;
  status: ConsumerOrderStatus;
  fulfilmentMethod: FulfilmentMethod;
  deliveryAddressId: string | null;
  zoneId: string | null;
  requestedDate: string | null;
  goodsTotalKes: number;
  deliveryFeeKes: number;
  creditAppliedKes: number;
  roundingDeltaKes: number;
  totalKes: number;
  paystackReference: string | null;
  paidAt: string | null;
  createdAt: string;
  lines: ConsumerOrderLine[];
}

export interface MarketplaceOrder {
  id: string;
  requestNumber: string;
  status: OrderStatus;
  lines: CartLine[];
  totalKes: number;
  submittedAt: string;
  expectedDeliveryDate: string;
  // Downstream refs — populated as the order moves through PR → PO → GRN → invoice → payment.
  poNumber?: string | null;
  grnNumber?: string | null;
  grnDeliveryDate?: string | null;
  invoiceNumber?: string | null;
  invoiceStatus?: string | null;
  invoicePaymentStatus?: string | null;
  invoiceTotalKes?: number | null;
  amountPaidKes?: number | null;
}

export interface NotificationItem {
  id: string;
  title: string;
  body: string;
  timestamp: string;
  requestNumber?: string;
}

/** Scheduled effective-dated price for a specific product unit. */
export interface ScheduledPrice {
  id: string;
  productUnitId: string;
  priceKes: number;
  /** ISO date (YYYY-MM-DD). Applies on and after this date until superseded. */
  effectiveFrom: string;
  note?: string;
}
