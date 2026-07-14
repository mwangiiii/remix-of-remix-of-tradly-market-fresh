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

export function jsonLd(payload: Record<string, unknown>): JsonLdScript {
  // U+2028 / U+2029 are valid JSON but break inline <script> parsing; </script
  // inside a string would prematurely close the tag. Escape both.
  const body = JSON.stringify(payload)
    .replace(LINE_SEP_RE, "\\u2028")
    .replace(PARA_SEP_RE, "\\u2029")
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

export function organizationLd() {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "Tradly",
    url: SITE_URL,
    logo: `${SITE_URL}/favicon.svg`,
    sameAs: [] as string[],
  };
}

export function websiteLd() {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: SITE_NAME,
    url: SITE_URL,
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
    case "low_stock":
    case "seasonal":
      return "https://schema.org/InStock";
    case "out_of_stock":
      return "https://schema.org/OutOfStock";
    default:
      return "https://schema.org/InStock";
  }
}

export function productLd(product: MarketplaceProduct, category?: MarketplaceCategory) {
  const offers = product.units.map((u) => ({
    "@type": "Offer",
    sku: u.id,
    price: u.priceKes.toFixed(2),
    priceCurrency: "KES",
    availability: schemaAvailability(u.availability),
    url: siteUrl(`/product/${product.slug}`),
    itemCondition: "https://schema.org/NewCondition",
    eligibleQuantity: u.moq
      ? { "@type": "QuantitativeValue", minValue: u.moq }
      : undefined,
  }));

  const images = product.media?.length
    ? product.media.filter((m) => m.kind === "image").map((m) => m.url)
    : product.galleryUrls;

  return {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    description: product.description,
    sku: product.id,
    image: images.length ? images : [product.thumbnailUrl],
    url: siteUrl(`/product/${product.slug}`),
    category: category?.name,
    brand: { "@type": "Brand", name: "Tradly" },
    countryOfOrigin: product.countryOfOrigin ?? undefined,
    offers:
      offers.length === 1
        ? offers[0]
        : {
            "@type": "AggregateOffer",
            priceCurrency: "KES",
            lowPrice: Math.min(...product.units.map((u) => u.priceKes)).toFixed(2),
            highPrice: Math.max(...product.units.map((u) => u.priceKes)).toFixed(2),
            offerCount: product.units.length,
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
