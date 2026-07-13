import { create } from "zustand";
import { persist } from "zustand/middleware";
import { products as baseProducts } from "../mockData/products";
import { categories as baseCategories } from "../mockData/categories";
import type {
  MarketplaceCategory,
  MarketplaceProduct,
  ScheduledPrice,
} from "../types/marketplace";

interface CatalogState {
  version: number;
  productOverrides: Record<string, Partial<MarketplaceProduct>>;
  customProducts: MarketplaceProduct[];
  deletedProductIds: string[];

  categoryOverrides: Record<string, Partial<MarketplaceCategory>>;
  customCategories: MarketplaceCategory[];
  deletedCategoryIds: string[];

  scheduledPrices: ScheduledPrice[];

  upsertProduct: (p: MarketplaceProduct) => void;
  deleteProduct: (id: string) => void;
  restoreProduct: (id: string) => void;

  upsertCategory: (c: MarketplaceCategory) => void;
  deleteCategory: (id: string) => void;

  schedulePrice: (entry: Omit<ScheduledPrice, "id"> & { id?: string }) => void;
  removeScheduledPrice: (id: string) => void;
}

const bump = (s: CatalogState) => ({ version: s.version + 1 });

export const useCatalogStore = create<CatalogState>()(
  persist(
    (set) => ({
      version: 0,
      productOverrides: {},
      customProducts: [],
      deletedProductIds: [],
      categoryOverrides: {},
      customCategories: [],
      deletedCategoryIds: [],
      scheduledPrices: [],

      upsertProduct: (p) =>
        set((s) => {
          // custom (id starts with "cp-") — write to customProducts
          if (p.id.startsWith("cp-") || !baseProducts.some((b) => b.id === p.id)) {
            const idx = s.customProducts.findIndex((x) => x.id === p.id);
            const next = [...s.customProducts];
            if (idx >= 0) next[idx] = p;
            else next.push(p);
            return { ...bump(s), customProducts: next };
          }
          // base product — write as override
          return { ...bump(s), productOverrides: { ...s.productOverrides, [p.id]: p } };
        }),
      deleteProduct: (id) =>
        set((s) => {
          if (s.customProducts.some((p) => p.id === id)) {
            return { ...bump(s), customProducts: s.customProducts.filter((p) => p.id !== id) };
          }
          if (!s.deletedProductIds.includes(id)) {
            return { ...bump(s), deletedProductIds: [...s.deletedProductIds, id] };
          }
          return s;
        }),
      restoreProduct: (id) =>
        set((s) => ({ ...bump(s), deletedProductIds: s.deletedProductIds.filter((x) => x !== id) })),

      upsertCategory: (c) =>
        set((s) => {
          if (c.id.startsWith("cc-") || !baseCategories.some((b) => b.id === c.id)) {
            const idx = s.customCategories.findIndex((x) => x.id === c.id);
            const next = [...s.customCategories];
            if (idx >= 0) next[idx] = c;
            else next.push(c);
            return { ...bump(s), customCategories: next };
          }
          return { ...bump(s), categoryOverrides: { ...s.categoryOverrides, [c.id]: c } };
        }),
      deleteCategory: (id) =>
        set((s) => {
          if (s.customCategories.some((c) => c.id === id)) {
            return { ...bump(s), customCategories: s.customCategories.filter((c) => c.id !== id) };
          }
          if (!s.deletedCategoryIds.includes(id)) {
            return { ...bump(s), deletedCategoryIds: [...s.deletedCategoryIds, id] };
          }
          return s;
        }),

      schedulePrice: (entry) =>
        set((s) => {
          const id = entry.id ?? `sp-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
          const next: ScheduledPrice = {
            id,
            productUnitId: entry.productUnitId,
            priceKes: entry.priceKes,
            effectiveFrom: entry.effectiveFrom,
            note: entry.note,
          };
          const others = s.scheduledPrices.filter((p) => p.id !== id);
          return { ...bump(s), scheduledPrices: [...others, next] };
        }),
      removeScheduledPrice: (id) =>
        set((s) => ({ ...bump(s), scheduledPrices: s.scheduledPrices.filter((p) => p.id !== id) })),
    }),
    { name: "tradly-marketplace-catalog", version: 1 },
  ),
);

const todayKey = () => new Date().toISOString().slice(0, 10);

/** Return the effective price for a unit given today's date and any scheduled prices. */
export function effectivePriceFor(
  productUnitId: string,
  basePriceKes: number,
  schedules: ScheduledPrice[],
  onDate: string = todayKey(),
): number {
  const applicable = schedules
    .filter((s) => s.productUnitId === productUnitId && s.effectiveFrom <= onDate)
    .sort((a, b) => b.effectiveFrom.localeCompare(a.effectiveFrom));
  return applicable[0]?.priceKes ?? basePriceKes;
}

/** Merge base data with overrides, custom, deletes, and scheduled prices. */
export function getEffectiveCatalog(state: CatalogState = useCatalogStore.getState()): {
  products: MarketplaceProduct[];
  categories: MarketplaceCategory[];
} {
  const today = todayKey();

  const cats: MarketplaceCategory[] = [
    ...baseCategories
      .filter((c) => !state.deletedCategoryIds.includes(c.id))
      .map((c) => ({ ...c, ...(state.categoryOverrides[c.id] ?? {}) })),
    ...state.customCategories,
  ].sort((a, b) => a.displayOrder - b.displayOrder);

  const applyPrices = (p: MarketplaceProduct): MarketplaceProduct => ({
    ...p,
    units: p.units.map((u) => ({
      ...u,
      priceKes: effectivePriceFor(u.id, u.priceKes, state.scheduledPrices, today),
    })),
  });

  const prods: MarketplaceProduct[] = [
    ...baseProducts
      .filter((p) => !state.deletedProductIds.includes(p.id))
      .map((p) => {
        const ov = state.productOverrides[p.id];
        return applyPrices(ov ? ({ ...p, ...ov } as MarketplaceProduct) : p);
      }),
    ...state.customProducts.map(applyPrices),
  ];

  return { products: prods, categories: cats };
}

export function getEffectiveProducts(): MarketplaceProduct[] {
  return getEffectiveCatalog().products;
}
export function getEffectiveCategories(): MarketplaceCategory[] {
  return getEffectiveCatalog().categories;
}

/** Hook consumers can use in a query key to auto-refetch when catalog changes. */
export const useCatalogVersion = () => useCatalogStore((s) => s.version);
