import type { MarketplaceProduct } from "../types/marketplace";

const img = (q: string, seed: number) =>
  `https://images.unsplash.com/photo-${q}?auto=format&fit=crop&w=800&q=80&sig=${seed}`;

// Curated Unsplash food photo IDs (stable, well-lit on white/neutral)
const P = {
  potato: "1518977676601-b53f82aba655",
  tomato: "1592841200221-a6898f307baa",
  carrot: "1447175008436-054170c2e979",
  cabbage: "1594282486552-05b4d80fbb9f",
  onion: "1580201092675-a0a6a6cafbb1",
  greenPepper: "1563565375-f3fdfdbefa83",
  redPepper: "1583663848692-6a1c39e77c6a",
  yellowPepper: "1596496638317-c9c3a15c5f68",
  coriander: "1615485500704-8e990f9900f7",
  bananaRipe: "1571771894821-ce9b6c11b08e",
  bananaGreen: "1603833665858-e61d17a86224",
  watermelon: "1587049352846-4a222e784d38",
  pineapple: "1550258987-190a2d41a8ba",
  avocado: "1519162808019-7de1683fa2ad",
  garlic: "1615485291234-9d694218aeb0",
  turmeric: "1615485500834-bc10199bc727",
  greenGram: "1596797038530-2c107229654b",
  rice: "1586201375761-83865001e31c",
  maize: "1601593768799-76d3c1c9d0fc",
  eggs: "1587486913049-53fc88980cfc",
  milk: "1550583724-b2692b85b150",
  oil: "1599940824399-b87987ceb72a",
};

const gallery = (main: string, others: string[]): string[] => [main, ...others];

export const products: MarketplaceProduct[] = [
  // Vegetables
  {
    id: "p1", categoryId: "c1", name: "Potatoes", slug: "potatoes",
    description: "Fresh farm potatoes, hand-picked from the highlands of Nyandarua. Consistent size, low soil, kitchen-ready.",
    origin: "Nyandarua",
    thumbnailUrl: img(P.potato, 1),
    galleryUrls: gallery(img(P.potato, 1), [img(P.potato, 2), img(P.potato, 3)]),
    units: [
      { id: "u1a", unitLabel: "1 KG", unitQty: 1, isDefault: false, priceKes: 90, availability: "available" },
      { id: "u1b", unitLabel: "10 KG Bag", unitQty: 10, isDefault: true, priceKes: 820, availability: "available" },
      { id: "u1c", unitLabel: "50 KG Sack", unitQty: 50, isDefault: false, priceKes: 3900, availability: "low_stock" },
    ],
    isFeatured: true,
    keywords: ["pot", "spud", "irish"],
  },
  {
    id: "p2", categoryId: "c1", name: "Tomatoes", slug: "tomatoes",
    description: "Ripe, firm tomatoes ideal for sauces and salads. Delivered same-day from Mwea.",
    origin: "Mwea",
    thumbnailUrl: img(P.tomato, 1),
    galleryUrls: gallery(img(P.tomato, 1), [img(P.tomato, 2)]),
    units: [
      { id: "u2a", unitLabel: "1 KG", unitQty: 1, isDefault: true, priceKes: 140, availability: "available" },
      { id: "u2b", unitLabel: "5 KG Crate", unitQty: 5, isDefault: false, priceKes: 650, availability: "available" },
    ],
    isFeatured: true,
  },
  {
    id: "p3", categoryId: "c1", name: "Carrots", slug: "carrots",
    description: "Sweet, crunchy carrots. Uniform size for consistent prep.",
    origin: "Meru",
    thumbnailUrl: img(P.carrot, 1),
    galleryUrls: gallery(img(P.carrot, 1), [img(P.carrot, 2)]),
    units: [
      { id: "u3a", unitLabel: "1 KG", unitQty: 1, isDefault: true, priceKes: 110, availability: "available" },
      { id: "u3b", unitLabel: "10 KG Bag", unitQty: 10, isDefault: false, priceKes: 1000, availability: "available" },
    ],
    isFeatured: false,
  },
  {
    id: "p4", categoryId: "c1", name: "Cabbages", slug: "cabbages",
    description: "Large, tightly packed heads of green cabbage.",
    origin: "Limuru",
    thumbnailUrl: img(P.cabbage, 1),
    galleryUrls: gallery(img(P.cabbage, 1), [img(P.cabbage, 2)]),
    units: [
      { id: "u4a", unitLabel: "1 Head", unitQty: 1, isDefault: true, priceKes: 80, availability: "available" },
    ],
    isFeatured: false,
  },
  {
    id: "p5", categoryId: "c1", name: "Onions", slug: "onions",
    description: "Red onions, pungent and long-lasting.",
    origin: "Tanzania",
    thumbnailUrl: img(P.onion, 1),
    galleryUrls: gallery(img(P.onion, 1), [img(P.onion, 2)]),
    units: [
      { id: "u5a", unitLabel: "1 KG", unitQty: 1, isDefault: true, priceKes: 120, availability: "available" },
      { id: "u5b", unitLabel: "13 KG Net", unitQty: 13, isDefault: false, priceKes: 1500, availability: "available" },
    ],
    isFeatured: true,
  },
  {
    id: "p6", categoryId: "c1", name: "Green Hoho", slug: "green-hoho",
    description: "Crisp green bell peppers.",
    thumbnailUrl: img(P.greenPepper, 1),
    galleryUrls: gallery(img(P.greenPepper, 1), [img(P.greenPepper, 2)]),
    units: [
      { id: "u6a", unitLabel: "1 KG", unitQty: 1, isDefault: true, priceKes: 180, availability: "available" },
    ],
    isFeatured: false,
    keywords: ["pepper", "capsicum", "bell"],
  },
  {
    id: "p7", categoryId: "c1", name: "Red Hoho", slug: "red-hoho",
    description: "Sweet red bell peppers.",
    thumbnailUrl: img(P.redPepper, 1),
    galleryUrls: gallery(img(P.redPepper, 1), [img(P.redPepper, 2)]),
    units: [
      { id: "u7a", unitLabel: "1 KG", unitQty: 1, isDefault: true, priceKes: 240, availability: "available" },
    ],
    isFeatured: false,
    keywords: ["pepper", "capsicum", "bell"],
  },
  {
    id: "p8", categoryId: "c1", name: "Yellow Hoho", slug: "yellow-hoho",
    description: "Vibrant yellow bell peppers.",
    thumbnailUrl: img(P.yellowPepper, 1),
    galleryUrls: gallery(img(P.yellowPepper, 1), [img(P.yellowPepper, 2)]),
    units: [
      { id: "u8a", unitLabel: "1 KG", unitQty: 1, isDefault: true, priceKes: 260, availability: "seasonal" },
    ],
    isFeatured: false,
    keywords: ["pepper", "capsicum", "bell"],
  },
  {
    id: "p9", categoryId: "c1", name: "Coriander (Dhania)", slug: "coriander",
    description: "Fresh dhania, packed same morning.",
    thumbnailUrl: img(P.coriander, 1),
    galleryUrls: gallery(img(P.coriander, 1), [img(P.coriander, 2)]),
    units: [
      { id: "u9a", unitLabel: "1 Bunch", unitQty: 1, isDefault: true, priceKes: 20, availability: "available" },
    ],
    isFeatured: false,
    keywords: ["dhania", "cilantro"],
  },
  // Fruits
  {
    id: "p10", categoryId: "c2", name: "Ripe Bananas", slug: "ripe-bananas",
    description: "Sweet ripe bananas, ready to serve.",
    origin: "Kisii",
    thumbnailUrl: img(P.bananaRipe, 1),
    galleryUrls: gallery(img(P.bananaRipe, 1), [img(P.bananaRipe, 2)]),
    units: [
      { id: "u10a", unitLabel: "1 KG", unitQty: 1, isDefault: true, priceKes: 100, availability: "available" },
    ],
    isFeatured: true,
  },
  {
    id: "p11", categoryId: "c2", name: "Green Bananas (Matoke)", slug: "green-bananas",
    description: "Unripe cooking bananas — matoke.",
    origin: "Kisii",
    thumbnailUrl: img(P.bananaGreen, 1),
    galleryUrls: gallery(img(P.bananaGreen, 1), [img(P.bananaGreen, 2)]),
    units: [
      { id: "u11a", unitLabel: "1 Bunch", unitQty: 1, isDefault: true, priceKes: 350, availability: "available" },
    ],
    isFeatured: false,
    keywords: ["matoke"],
  },
  {
    id: "p12", categoryId: "c2", name: "Watermelon", slug: "watermelon",
    description: "Large sweet watermelons.",
    thumbnailUrl: img(P.watermelon, 1),
    galleryUrls: gallery(img(P.watermelon, 1), [img(P.watermelon, 2)]),
    units: [
      { id: "u12a", unitLabel: "1 Piece", unitQty: 1, isDefault: true, priceKes: 380, availability: "available" },
    ],
    isFeatured: false,
  },
  {
    id: "p13", categoryId: "c2", name: "Pineapples", slug: "pineapples",
    description: "Golden ripe pineapples.",
    origin: "Thika",
    thumbnailUrl: img(P.pineapple, 1),
    galleryUrls: gallery(img(P.pineapple, 1), [img(P.pineapple, 2)]),
    units: [
      { id: "u13a", unitLabel: "1 Piece", unitQty: 1, isDefault: true, priceKes: 220, availability: "available" },
    ],
    isFeatured: false,
  },
  {
    id: "p14", categoryId: "c2", name: "Avocadoes", slug: "avocadoes",
    description: "Hass avocadoes, ripe on arrival.",
    origin: "Muranga",
    thumbnailUrl: img(P.avocado, 1),
    galleryUrls: gallery(img(P.avocado, 1), [img(P.avocado, 2)]),
    units: [
      { id: "u14a", unitLabel: "1 KG", unitQty: 1, isDefault: true, priceKes: 200, availability: "available" },
    ],
    isFeatured: true,
  },
  // Herbs & Spices
  {
    id: "p15", categoryId: "c3", name: "Garlic", slug: "garlic",
    description: "Aromatic garlic bulbs.",
    thumbnailUrl: img(P.garlic, 1),
    galleryUrls: gallery(img(P.garlic, 1), [img(P.garlic, 2)]),
    units: [
      { id: "u15a", unitLabel: "1 KG", unitQty: 1, isDefault: true, priceKes: 700, availability: "available" },
    ],
    isFeatured: false,
  },
  {
    id: "p16", categoryId: "c3", name: "Turmeric", slug: "turmeric",
    description: "Fresh turmeric root.",
    thumbnailUrl: img(P.turmeric, 1),
    galleryUrls: gallery(img(P.turmeric, 1), [img(P.turmeric, 2)]),
    units: [
      { id: "u16a", unitLabel: "1 KG", unitQty: 1, isDefault: true, priceKes: 450, availability: "available" },
    ],
    isFeatured: false,
    keywords: ["manjano"],
  },
  {
    id: "p17", categoryId: "c3", name: "Green Grams (Minji)", slug: "green-grams",
    description: "Dry green grams, cleaned and sorted.",
    thumbnailUrl: img(P.greenGram, 1),
    galleryUrls: gallery(img(P.greenGram, 1), [img(P.greenGram, 2)]),
    units: [
      { id: "u17a", unitLabel: "2 KG Bag", unitQty: 2, isDefault: true, priceKes: 480, availability: "available" },
    ],
    isFeatured: false,
    keywords: ["minji", "ndengu"],
  },
  // Rice & Cereals
  {
    id: "p18", categoryId: "c4", name: "Pishori Rice", slug: "pishori-rice",
    description: "Aromatic pishori rice from the Mwea plains.",
    origin: "Mwea",
    thumbnailUrl: img(P.rice, 1),
    galleryUrls: gallery(img(P.rice, 1), [img(P.rice, 2)]),
    units: [
      { id: "u18a", unitLabel: "2 KG Pack", unitQty: 2, isDefault: false, priceKes: 480, availability: "available" },
      { id: "u18b", unitLabel: "25 KG Bag", unitQty: 25, isDefault: true, priceKes: 5600, availability: "available" },
    ],
    isFeatured: true,
  },
  {
    id: "p19", categoryId: "c4", name: "White Maize", slug: "white-maize",
    description: "Grade 1 dry white maize.",
    thumbnailUrl: img(P.maize, 1),
    galleryUrls: gallery(img(P.maize, 1), [img(P.maize, 2)]),
    units: [
      { id: "u19a", unitLabel: "90 KG Bag", unitQty: 90, isDefault: true, priceKes: 5200, availability: "available" },
    ],
    isFeatured: false,
  },
  // Dairy & Eggs
  {
    id: "p20", categoryId: "c5", name: "Fresh Eggs", slug: "fresh-eggs",
    description: "Farm-fresh eggs, tray of 30.",
    origin: "Kikuyu",
    thumbnailUrl: img(P.eggs, 1),
    galleryUrls: gallery(img(P.eggs, 1), [img(P.eggs, 2)]),
    units: [
      { id: "u20a", unitLabel: "Tray of 30", unitQty: 30, isDefault: true, priceKes: 520, availability: "available" },
    ],
    isFeatured: true,
  },
  {
    id: "p21", categoryId: "c5", name: "Whole Milk", slug: "whole-milk",
    description: "Pasteurised whole milk, 500ml packet.",
    thumbnailUrl: img(P.milk, 1),
    galleryUrls: gallery(img(P.milk, 1), [img(P.milk, 2)]),
    units: [
      { id: "u21a", unitLabel: "500 ML", unitQty: 1, isDefault: true, priceKes: 65, availability: "available" },
      { id: "u21b", unitLabel: "Crate of 12", unitQty: 12, isDefault: false, priceKes: 760, availability: "available" },
    ],
    isFeatured: false,
  },
  // Cooking Oil
  {
    id: "p22", categoryId: "c6", name: "Sunflower Cooking Oil", slug: "sunflower-cooking-oil",
    description: "Pure sunflower cooking oil, 5L jerrycan.",
    thumbnailUrl: img(P.oil, 1),
    galleryUrls: gallery(img(P.oil, 1), [img(P.oil, 2)]),
    units: [
      { id: "u22a", unitLabel: "5 L", unitQty: 5, isDefault: true, priceKes: 1450, availability: "available" },
      { id: "u22b", unitLabel: "20 L", unitQty: 20, isDefault: false, priceKes: 5600, availability: "low_stock" },
    ],
    isFeatured: true,
  },
];

// Simple synonym map for search
export const searchSynonyms: Record<string, string[]> = {
  pot: ["potato", "potatoes"],
  spud: ["potato"],
  dhania: ["coriander"],
  cilantro: ["coriander"],
  matoke: ["green bananas"],
  pepper: ["hoho"],
  capsicum: ["hoho"],
  ndengu: ["green grams"],
  minji: ["green grams"],
};
