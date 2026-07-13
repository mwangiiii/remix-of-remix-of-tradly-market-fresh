import type { MarketplaceCategory } from "../types/marketplace";

export const categories: MarketplaceCategory[] = [
  { id: "c1", name: "Vegetables", slug: "vegetables", parentId: null, displayOrder: 1 },
  { id: "c2", name: "Fruits", slug: "fruits", parentId: null, displayOrder: 2 },
  { id: "c3", name: "Herbs & Spices", slug: "herbs-spices", parentId: null, displayOrder: 3 },
  { id: "c4", name: "Rice & Cereals", slug: "rice-cereals", parentId: null, displayOrder: 4 },
  { id: "c5", name: "Dairy & Eggs", slug: "dairy-eggs", parentId: null, displayOrder: 5 },
  { id: "c6", name: "Cooking Oil", slug: "cooking-oil", parentId: null, displayOrder: 6 },
];
