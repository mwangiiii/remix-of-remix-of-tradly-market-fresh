import type { SavedList } from "../types/marketplace";
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

export const savedLists: SavedList[] = [
  {
    id: "sl1",
    name: "Weekly Kitchen Order",
    items: [
      line("p1", 1, 3), line("p2", 0, 6), line("p5", 0, 4),
      line("p3", 0, 3), line("p4", 0, 4), line("p9", 0, 10),
      line("p20", 0, 4), line("p21", 1, 2),
    ],
  },
  {
    id: "sl2",
    name: "Monthly Dry Goods",
    items: [
      line("p18", 1, 4), line("p19", 0, 1), line("p17", 0, 3),
      line("p22", 0, 6), line("p15", 0, 2),
    ],
  },
];
