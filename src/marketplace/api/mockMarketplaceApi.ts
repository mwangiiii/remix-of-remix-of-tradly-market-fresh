import { categories } from "../mockData/categories";
import { products, searchSynonyms } from "../mockData/products";
import { orders as seedOrders, notifications as seedNotifications } from "../mockData/orders";
import { savedLists as seedLists } from "../mockData/savedLists";
import type {
  CartLine,
  MarketplaceCategory,
  MarketplaceProduct,
  MarketplaceOrder,
  SavedList,
  NotificationItem,
} from "../types/marketplace";

const delay = (ms = 120) => new Promise((r) => setTimeout(r, ms));

let orderStore: MarketplaceOrder[] = [...seedOrders];
let listStore: SavedList[] = seedLists.map((l) => ({ ...l, items: [...l.items] }));
let orderCounter = 143;

export async function getCategories(): Promise<MarketplaceCategory[]> {
  await delay(); return categories;
}

export async function getAllProducts(): Promise<MarketplaceProduct[]> {
  await delay(); return products;
}

export async function getProductsByCategory(categorySlug: string): Promise<MarketplaceProduct[]> {
  await delay();
  const cat = categories.find((c) => c.slug === categorySlug);
  if (!cat) return [];
  return products.filter((p) => p.categoryId === cat.id);
}

export async function searchProducts(query: string): Promise<MarketplaceProduct[]> {
  await delay(80);
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const expanded = new Set<string>([q]);
  for (const [k, syns] of Object.entries(searchSynonyms)) {
    if (q.includes(k)) syns.forEach((s) => expanded.add(s));
    if (syns.some((s) => s.includes(q))) expanded.add(k);
  }
  return products.filter((p) => {
    const hay = [
      p.name.toLowerCase(),
      p.slug,
      (p.origin ?? "").toLowerCase(),
      (p.keywords ?? []).join(" ").toLowerCase(),
      categories.find((c) => c.id === p.categoryId)?.name.toLowerCase() ?? "",
    ].join(" ");
    return [...expanded].some((term) => hay.includes(term));
  });
}

export async function getProduct(slug: string): Promise<MarketplaceProduct | undefined> {
  await delay(); return products.find((p) => p.slug === slug);
}

export async function getOrders(): Promise<MarketplaceOrder[]> {
  await delay();
  return [...orderStore].sort((a, b) => b.submittedAt.localeCompare(a.submittedAt));
}

export async function submitMarketplaceOrder(
  lines: CartLine[], expectedDeliveryDate: string,
): Promise<{ requestNumber: string; id: string }> {
  await delay(250);
  const requestNumber = `PR-0${orderCounter++}`;
  const id = `o-${Date.now()}`;
  const total = lines.reduce((s, l) => s + l.priceKes * l.quantity, 0);
  const order: MarketplaceOrder = {
    id, requestNumber, status: "pending_approval",
    lines: [...lines], totalKes: total,
    submittedAt: new Date().toISOString(),
    expectedDeliveryDate,
  };
  orderStore = [order, ...orderStore];
  return { requestNumber, id };
}

export async function getOrder(id: string): Promise<MarketplaceOrder | undefined> {
  await delay(); return orderStore.find((o) => o.id === id);
}

export async function getSavedLists(): Promise<SavedList[]> {
  await delay(); return listStore;
}

export async function getSavedList(id: string): Promise<SavedList | undefined> {
  await delay(); return listStore.find((l) => l.id === id);
}

export async function getNotifications(): Promise<NotificationItem[]> {
  await delay();
  return [...seedNotifications].sort((a, b) => b.timestamp.localeCompare(a.timestamp));
}
