// Central SEO helpers. Two jobs:
//   1. build absolute canonical / og:url URLs from a single SITE_URL env var
//   2. build JSON-LD payloads for Organization, WebSite, Product, ItemList,
//      BreadcrumbList — the schemas Google actually surfaces as rich results.
//
// Runs at SSR (server) and CSR (client). VITE_SITE_URL is inlined at build
// time; SITE_URL (server-only) is a runtime fallback for the sitemap.

import type { MarketplaceCategory, MarketplaceProduct } from "../types/marketplace";

const RAW_SITE_URL =
  (import.meta.env.VITE_SITE_URL as string | undefined) ??
  (typeof process !== "undefined" ? process.env.SITE_URL : undefined) ??
  "https://market.tradly.co.ke";

export const SITE_URL: string = RAW_SITE_URL.replace(/\/+$/, "");
export const SITE_NAME = "Tradly Market";
export const SITE_LOCALE = "en_KE";
export const APPLE_TOUCH_ICON = `${SITE_URL}/apple-touch-icon.png`;
export const DEFAULT_OG_IMAGE = `${SITE_URL}/og-default.jpg`;

export function siteUrl(path = "/"): string {
  return `${SITE_URL}${path.startsWith("/") ? path : `/${path}`}`;
}

export type JsonLdScript = {
  type: "application/ld+json";
  children: string;
};

// U+2028 / U+2029 are valid JSON but break inline <script> parsing.
// Regexes built from char codes so this source file stays plain ASCII.
const LINE_SEP_RE = new RegExp(String.fromCharCode(0x2028), "g");
const PARA_SEP_RE = new RegExp(String.fromCharCode(0x2029), "g");

// Second arg is accepted for backwards compat with callers that pass a
// stable id — but not returned. TanStack Router's HeadContent spreads
// every top-level field on the script descriptor as an HTML attribute, so
// putting `key` there triggers React 19's "key spread onto JSX" warning.
// The router already dedupes scripts by JSON.stringify(tag), so identical
// content collapses without needing an explicit key.
export function jsonLd(payload: Record<string, unknown>, _key?: string): JsonLdScript {
  void _key;
  const body = JSON.stringify(payload)
    .replace(LINE_SEP_RE, "\\u2028")
    .replace(PARA_SEP_RE, "\\u2029")
    // </script inside a string would prematurely close the tag.
    .replace(/<\/(script)/gi, "<\\/$1");
  return {
    type: "application/ld+json",
    children: body,
  };
}

export function canonicalLink(path: string): { rel: "canonical"; href: string } {
  return { rel: "canonical", href: siteUrl(path) };
}

/* ---------- JSON-LD builders ---------- */

// Nairobi HQ — used by both Organization and LocalBusiness. Latitude/longitude
// are approximate to Westlands (Tradly's registered address).
const TRADLY_ADDRESS = {
  "@type": "PostalAddress",
  streetAddress: "Waiyaki Way",
  addressLocality: "Nairobi",
  addressRegion: "Nairobi",
  postalCode: "00100",
  addressCountry: "KE",
} as const;

const TRADLY_GEO = {
  "@type": "GeoCoordinates",
  latitude: -1.2634,
  longitude: 36.8055,
} as const;

const TRADLY_CONTACT = {
  "@type": "ContactPoint",
  contactType: "customer service",
  telephone: "+254-700-000000",
  email: "support@tradly.co.ke",
  areaServed: "KE",
  availableLanguage: ["English", "Swahili"],
} as const;

// Social profiles — feed Google's knowledge panel via sameAs. Verified
// with the operator on 2026-07-15; keep in sync when handles change.
const TRADLY_SOCIALS: string[] = [
  "https://www.linkedin.com/company/tradly-procurement-saas/",
  "https://www.instagram.com/tradly_app/",
  "https://www.facebook.com/tradlyapp",
];

// Counties Tradly Market delivers into. Represented as AdministrativeArea
// with `containedInPlace: Kenya` so Google understands the hierarchy.
const SERVED_COUNTIES = [
  "Nairobi",
  "Kiambu",
  "Kirinyaga",
  "Murang'a",
  "Embu",
] as const;

function servedCountyLd(name: string) {
  return {
    "@type": "AdministrativeArea",
    name: `${name} County`,
    containedInPlace: { "@type": "Country", name: "Kenya" },
  };
}

// Practical delivery radius. Centred on Nairobi CBD; 90 km reaches the
// Kirinyaga/Sagana line to the north and Konza to the south — covers
// every neighbourhood the ops team currently services.
const DELIVERY_RADIUS_METRES = 90_000;

const SERVICE_GEO = {
  "@type": "GeoCircle",
  geoMidpoint: {
    "@type": "GeoCoordinates",
    latitude: -1.286389,
    longitude: 36.817223,
  },
  geoRadius: DELIVERY_RADIUS_METRES,
} as const;

const AREA_SERVED_LD = [
  ...SERVED_COUNTIES.map(servedCountyLd),
  SERVICE_GEO,
];

export function organizationLd() {
  // OnlineStore is a subtype of Organization — Google treats it as
  // e-commerce-capable, so it's eligible for the merchant/brand knowledge
  // panel. Merging with LocalBusiness cues would be too narrow (single
  // physical store); we keep those in a separate LocalBusiness node.
  return {
    "@context": "https://schema.org",
    "@type": "OnlineStore",
    "@id": `${SITE_URL}/#organization`,
    name: "Tradly",
    legalName: "Tradly Ltd",
    url: SITE_URL,
    logo: {
      "@type": "ImageObject",
      url: `${SITE_URL}/favicon.svg`,
      caption: "Tradly",
    },
    image: DEFAULT_OG_IMAGE,
    description:
      "Kenya's single-source procurement platform for food-service and pantry staples. One supplier, one invoice, eTIMS-compliant.",
    address: TRADLY_ADDRESS,
    contactPoint: [TRADLY_CONTACT],
    areaServed: AREA_SERVED_LD,
    currenciesAccepted: "KES",
    paymentAccepted: ["Cash", "M-Pesa", "Bank Transfer", "Paystack"],
    sameAs: TRADLY_SOCIALS,
  };
}

/**
 * LocalBusiness for the Nairobi operating hub. Enables the "grocery store
 * near me" panel + map card when someone searches for Tradly in Nairobi.
 * GroceryStore is a Schema.org subtype specifically for food retailers.
 */
export function localBusinessLd() {
  return {
    "@context": "https://schema.org",
    "@type": "GroceryStore",
    "@id": `${SITE_URL}/#localbusiness`,
    name: "Tradly Market — Nairobi",
    url: SITE_URL,
    image: DEFAULT_OG_IMAGE,
    telephone: "+254-700-000000",
    priceRange: "KES",
    address: TRADLY_ADDRESS,
    geo: TRADLY_GEO,
    areaServed: AREA_SERVED_LD,
    sameAs: TRADLY_SOCIALS,
    openingHoursSpecification: [
      {
        "@type": "OpeningHoursSpecification",
        dayOfWeek: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
        opens: "07:00",
        closes: "19:00",
      },
      {
        "@type": "OpeningHoursSpecification",
        dayOfWeek: "Saturday",
        opens: "08:00",
        closes: "16:00",
      },
    ],
    currenciesAccepted: "KES",
    paymentAccepted: ["Cash", "M-Pesa", "Bank Transfer", "Paystack"],
  };
}

export function websiteLd() {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": `${SITE_URL}/#website`,
    name: SITE_NAME,
    url: SITE_URL,
    publisher: { "@id": `${SITE_URL}/#organization` },
    potentialAction: {
      "@type": "SearchAction",
      target: {
        "@type": "EntryPoint",
        urlTemplate: `${SITE_URL}/search?q={search_term_string}`,
      },
      "query-input": "required name=search_term_string",
    },
  };
}

/**
 * FAQPage — Google will render as an accordion under the home result IF the
 * same Q/A pairs are also visible in the rendered HTML. Callers must
 * therefore keep the FAQ_ITEMS array below in sync with the on-page copy.
 */
export const FAQ_ITEMS: Array<{ q: string; a: string }> = [
  {
    q: "Where does Tradly Market deliver?",
    a: "Tradly delivers across the whole of Nairobi and Kiambu (including Ruiru, Juja, Kikuyu, Kahawa Sukari, Kahawa West, Kahawa Wendani, Northlands, Membly and Kiambu town), the Thika corridor (Makuyu, Kenol, Kakuzi, Makutano), the Athi River corridor (Athi River, Kitengela, Mlolongo, Syokimau, JKIA, Konza Technopolis), plus Kirinyaga (Kagio, Sagana, Baricho), Murang'a and Embu — and to institutions inside all of those areas.",
  },
  {
    q: "How fast does Tradly Market deliver in Nairobi?",
    a: "Orders placed before 3 p.m. are dispatched the same day and typically delivered by end of day within Nairobi. Kiambu lands next day; Kirinyaga, Murang'a and Embu land within one to two days.",
  },
  {
    q: "Do I get a KRA-compliant invoice?",
    a: "Yes. Every order is invoiced through Tradly Finance and each invoice is eTIMS-compliant with KRA-registered supplier codes on every line item.",
  },
  {
    q: "Is there a minimum order?",
    a: "There's no cart-level minimum. Some pack sizes carry a minimum order quantity (MOQ) shown on the product page — the cart enforces it automatically.",
  },
  {
    q: "How do I pay?",
    a: "Business accounts receive a monthly invoice payable by bank transfer or M-Pesa. Ad-hoc orders can be paid at checkout via Paystack (card or M-Pesa).",
  },
];

// Delivery zones, grouped so both the schema-side FAQ and the on-page
// "Where we deliver" section can render from a single source. Neighbourhood
// text is what powers long-tail search ("grocery delivery kileleshwa") so
// this list is intentionally comprehensive rather than tidy.
export const DELIVERY_ZONES: Array<{ zone: string; places: string[] }> = [
  {
    zone: "Nairobi CBD & central",
    places: [
      "Nairobi CBD", "Moi Avenue", "Kenyatta Avenue", "Haile Selassie",
      "Kirinyaga Road", "Museum Hill", "Desai Road", "Upper Hill",
      "Capital Centre", "Railways", "SGR", "Cabanas", "Nyayo",
    ],
  },
  {
    zone: "Nairobi west & suburbs",
    places: [
      "Westlands", "Parklands", "Spring Valley", "Lavington", "Kileleshwa",
      "Hurlingham", "Karen", "Ngong", "Langata", "Nairobi West",
      "South B", "South C",
    ],
  },
  {
    zone: "Nairobi east & north",
    places: [
      "Buruburu", "Donholm", "Muthaiga", "Pangani", "Eastleigh",
      "Outer Ring Road", "Roysambu", "Zimmerman", "Mirema",
      "Garden City", "Mountain Mall (TRM)", "Thika Road estates",
    ],
  },
  {
    zone: "Kiambu — Ruiru & Thika Road corridor",
    places: [
      "Ruiru", "Northlands", "Membly", "Juja", "Kahawa Sukari",
      "Kahawa West", "Kahawa Wendani", "Kiambu town", "Limuru",
    ],
  },
  {
    zone: "Machakos — Athi River corridor",
    places: [
      "Athi River", "Kitengela", "Mlolongo", "Syokimau",
      "JKIA & Airport Road", "Southern Bypass entrances", "Konza Technopolis",
    ],
  },
  {
    zone: "Thika corridor to Central Kenya",
    places: [
      "Makuyu", "Kenol", "Kakuzi", "Makutano", "Murang'a town",
      "Kirinyaga (Kagio, Sagana, Baricho)", "Embu",
    ],
  },
];

/**
 * CollectionPage schema for the storefront home. Anchors the page as
 * commerce (not a support/FAQ page) so Google doesn't get mixed signals
 * from having, say, a small FAQ teaser present. The dedicated /faq route
 * is where FAQPage lives.
 */
export function collectionPageLd(opts: {
  path: string;
  name: string;
  description: string;
}) {
  return {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    "@id": siteUrl(opts.path) + "#page",
    url: siteUrl(opts.path),
    name: opts.name,
    description: opts.description,
    isPartOf: { "@id": `${SITE_URL}/#website` },
    about: { "@id": `${SITE_URL}/#organization` },
  };
}

export function faqPageLd() {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: FAQ_ITEMS.map(({ q, a }) => ({
      "@type": "Question",
      name: q,
      acceptedAnswer: {
        "@type": "Answer",
        text: a,
      },
    })),
  };
}

export function breadcrumbLd(items: Array<{ name: string; path: string }>) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((it, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: it.name,
      item: siteUrl(it.path),
    })),
  };
}

function schemaAvailability(a: string): string {
  switch (a) {
    case "available":
      return "https://schema.org/InStock";
    case "low_stock":
      return "https://schema.org/LimitedAvailability";
    case "seasonal":
      return "https://schema.org/PreOrder";
    case "out_of_stock":
      return "https://schema.org/OutOfStock";
    default:
      return "https://schema.org/InStock";
  }
}

/**
 * ISO date `priceValidUntil` value ~30 days out. Google's Product rich
 * result validator warns when this is missing — provide a rolling window
 * so the offer is always considered "current".
 */
function priceValidUntil(): string {
  const d = new Date();
  d.setDate(d.getDate() + 30);
  return d.toISOString().slice(0, 10);
}

/**
 * Shipping details — enables the "free delivery" / "delivers in N days"
 * chips in Google Shopping cards. Three zones matching the ops team's
 * actual coverage:
 *   1. Nairobi County   — same-day dispatch, same-day delivery
 *   2. Kiambu County    — same-day dispatch, next-day delivery
 *   3. Extended metro   — next-day dispatch, 1–2 day delivery
 *      (Kirinyaga, Murang'a, Embu — plus Konza & Athi River corridor)
 * Rate is 0 because Tradly bundles fulfilment into the invoice.
 */
function shippingDetails() {
  const rate = {
    "@type": "MonetaryAmount",
    value: "0",
    currency: "KES",
  } as const;

  const zone = (
    region: string | undefined,
    handling: [number, number],
    transit: [number, number],
  ) => ({
    "@type": "OfferShippingDetails",
    shippingRate: rate,
    shippingDestination: region
      ? { "@type": "DefinedRegion", addressCountry: "KE", addressRegion: region }
      : { "@type": "DefinedRegion", addressCountry: "KE" },
    deliveryTime: {
      "@type": "ShippingDeliveryTime",
      handlingTime: {
        "@type": "QuantitativeValue",
        minValue: handling[0],
        maxValue: handling[1],
        unitCode: "DAY",
      },
      transitTime: {
        "@type": "QuantitativeValue",
        minValue: transit[0],
        maxValue: transit[1],
        unitCode: "DAY",
      },
    },
  });

  return [
    zone("Nairobi", [0, 0], [0, 1]),
    zone("Kiambu", [0, 0], [1, 1]),
    zone("Kirinyaga", [0, 1], [1, 2]),
    zone("Murang'a", [0, 1], [1, 2]),
    zone("Embu", [0, 1], [1, 2]),
    zone(undefined, [0, 1], [1, 2]),
  ];
}

/**
 * Return-policy stub: Kenyan food-service norm is exchange-on-defect at
 * delivery, no post-consumption returns. Google still wants a policy
 * object so the shopping card doesn't drop the "returns" enrichment.
 */
function merchantReturnPolicy() {
  return {
    "@type": "MerchantReturnPolicy",
    applicableCountry: "KE",
    returnPolicyCategory: "https://schema.org/MerchantReturnFiniteReturnWindow",
    merchantReturnDays: 1,
    returnMethod: "https://schema.org/ReturnByMail",
    returnFees: "https://schema.org/FreeReturn",
  };
}

export function productLd(product: MarketplaceProduct, category?: MarketplaceCategory) {
  const validUntil = priceValidUntil();
  const shipping = shippingDetails();
  const returns = merchantReturnPolicy();

  const offers = product.units.map((u) => ({
    "@type": "Offer",
    sku: u.id,
    price: u.priceKes.toFixed(2),
    priceCurrency: "KES",
    availability: schemaAvailability(u.availability),
    url: siteUrl(`/product/${product.slug}`),
    itemCondition: "https://schema.org/NewCondition",
    priceValidUntil: validUntil,
    hasMerchantReturnPolicy: returns,
    shippingDetails: shipping,
    eligibleQuantity: u.moq
      ? { "@type": "QuantitativeValue", minValue: u.moq }
      : undefined,
  }));

  const images = product.media?.length
    ? product.media.filter((m) => m.kind === "image").map((m) => m.url)
    : product.galleryUrls;

  // Surface non-standard attributes (storage class, shelf life, origin) as
  // additionalProperty so Google can render them as a small key-value list
  // in the shopping card.
  const additionalProperty: Array<Record<string, unknown>> = [];
  if (product.storageClass) {
    additionalProperty.push({
      "@type": "PropertyValue",
      name: "Storage",
      value: product.storageClass,
    });
  }
  if (typeof product.shelfLifeDays === "number" && product.shelfLifeDays > 0) {
    additionalProperty.push({
      "@type": "PropertyValue",
      name: "Shelf life",
      value: `${product.shelfLifeDays} days`,
    });
  }
  if (product.origin) {
    additionalProperty.push({
      "@type": "PropertyValue",
      name: "Origin",
      value: product.origin,
    });
  }

  return {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    description: product.description,
    sku: product.id,
    // productID falls back on sku but is a stronger identifier for Google.
    productID: product.itemCd ?? product.id,
    image: images.length ? images : [product.thumbnailUrl],
    url: siteUrl(`/product/${product.slug}`),
    category: category?.name,
    brand: { "@type": "Brand", name: "Tradly" },
    countryOfOrigin: product.countryOfOrigin ?? undefined,
    additionalProperty: additionalProperty.length ? additionalProperty : undefined,
    offers:
      offers.length === 1
        ? offers[0]
        : {
            "@type": "AggregateOffer",
            priceCurrency: "KES",
            lowPrice: Math.min(...product.units.map((u) => u.priceKes)).toFixed(2),
            highPrice: Math.max(...product.units.map((u) => u.priceKes)).toFixed(2),
            offerCount: product.units.length,
            priceValidUntil: validUntil,
            offers,
          },
  };
}

export function categoryItemListLd(
  category: MarketplaceCategory,
  products: MarketplaceProduct[],
) {
  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: category.name,
    url: siteUrl(`/category/${category.slug}`),
    numberOfItems: products.length,
    itemListElement: products.map((p, i) => ({
      "@type": "ListItem",
      position: i + 1,
      url: siteUrl(`/product/${p.slug}`),
      name: p.name,
    })),
  };
}
