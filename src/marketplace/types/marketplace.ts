export interface MarketplaceCategory {
  id: string;
  name: string;
  slug: string;
  parentId: string | null;
  displayOrder: number;
}

export interface MarketplaceProductUnit {
  id: string;
  unitLabel: string;
  unitQty: number;
  isDefault: boolean;
  priceKes: number;
  availability: "available" | "low_stock" | "out_of_stock" | "seasonal";
}

export interface MarketplaceProduct {
  id: string;
  categoryId: string;
  name: string;
  slug: string;
  description: string;
  origin?: string;
  thumbnailUrl: string;
  galleryUrls: string[];
  units: MarketplaceProductUnit[];
  isFeatured: boolean;
  keywords?: string[];
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
