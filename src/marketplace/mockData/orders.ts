import type { MarketplaceOrder, NotificationItem } from "../types/marketplace";
import { products } from "./products";

const line = (productId: string, unitIdx: number, qty: number) => {
  const p = products.find((x) => x.id === productId)!;
  const u = p.units[unitIdx];
  return {
    productUnitId: u.id,
    productId: p.id,
    productSlug: p.slug,
    thumbnailUrl: p.thumbnailUrl,
    productName: p.name,
    unitLabel: u.unitLabel,
    quantity: qty,
    priceKes: u.priceKes,
  };
};

export const orders: MarketplaceOrder[] = [
  {
    id: "o1",
    requestNumber: "PR-0142",
    status: "delivered",
    lines: [line("p1", 1, 5), line("p2", 0, 8), line("p5", 0, 6), line("p20", 0, 4)],
    totalKes: 5 * 820 + 8 * 140 + 6 * 120 + 4 * 520,
    submittedAt: "2026-07-01T09:24:00Z",
    expectedDeliveryDate: "2026-07-03",
  },
  {
    id: "o2",
    requestNumber: "PR-0138",
    status: "invoiced",
    lines: [line("p18", 1, 2), line("p22", 0, 3)],
    totalKes: 2 * 5600 + 3 * 1450,
    submittedAt: "2026-06-24T14:10:00Z",
    expectedDeliveryDate: "2026-06-26",
  },
  {
    id: "o3",
    requestNumber: "PR-0131",
    status: "approved",
    lines: [line("p10", 0, 10), line("p14", 0, 5)],
    totalKes: 10 * 100 + 5 * 200,
    submittedAt: "2026-07-10T08:00:00Z",
    expectedDeliveryDate: "2026-07-14",
  },
  {
    id: "o4",
    requestNumber: "PR-0128",
    status: "paid",
    lines: [line("p3", 0, 4), line("p4", 0, 6), line("p9", 0, 12)],
    totalKes: 4 * 110 + 6 * 80 + 12 * 20,
    submittedAt: "2026-06-15T11:30:00Z",
    expectedDeliveryDate: "2026-06-17",
  },
];

export const notifications: NotificationItem[] = [
  { id: "n1", title: "Order delivered", body: "PR-0142 delivered — 23 items received in full.", timestamp: "2026-07-03T14:20:00Z", requestNumber: "PR-0142" },
  { id: "n2", title: "Order approved", body: "PR-0131 was approved by Grace M. — awaiting dispatch.", timestamp: "2026-07-10T10:15:00Z", requestNumber: "PR-0131" },
  { id: "n3", title: "Invoice ready", body: "Invoice for PR-0138 is ready to review.", timestamp: "2026-06-27T09:00:00Z", requestNumber: "PR-0138" },
  { id: "n4", title: "Order submitted", body: "PR-0131 submitted for approval.", timestamp: "2026-07-10T08:00:15Z", requestNumber: "PR-0131" },
];
