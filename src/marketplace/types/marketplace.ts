export interface MarketplaceCategory {
  id: string;
  name: string;
  slug: string;
  parentId: string | null;
  displayOrder: number;
}

export type MarketplaceStorageClass = "ambient" | "chilled" | "frozen" | "dry";
export type MarketplaceTaxTypeCode = "A" | "B" | "C" | "E";

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
  media: MarketplaceMedia[];
  units: MarketplaceProductUnit[];
  isFeatured: boolean;
  keywords?: string[];
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
}

export interface SavedList {
  id: string;
  name: string;
  items: CartLine[];
}

export type OrderStatus =
  | "draft"
  | "pending_approval"
  | "approved"
  | "po_generated"
  | "delivered"
  | "invoiced"
  | "paid"
  | "cancelled";

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
