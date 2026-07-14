import { createFileRoute, Link, notFound, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { AppShell } from "../marketplace/components/AppShell";
import { BrowseHeader } from "../marketplace/components/BrowseHeader";
import { QuantityStepper } from "../marketplace/components/QuantityStepper";
import { ProductCard } from "../marketplace/components/ProductCard";
import { FullscreenGallery } from "../marketplace/components/FullscreenGallery";
import { getCategories, getProduct, getAllProducts } from "../marketplace/api/marketplaceApi";
import type { MarketplaceCategory, MarketplaceProduct } from "../marketplace/types/marketplace";
import { useCartStore } from "../marketplace/store/cartStore";
import { formatKes } from "../marketplace/lib/format";
import {
  siteUrl,
  jsonLd,
  productLd,
  breadcrumbLd,
  SITE_NAME,
} from "../marketplace/lib/seo";
import {
  MapPin, Maximize2,
  Snowflake, Package, Clock, Thermometer, Globe2, ReceiptText, Boxes, ChevronLeft, ChevronRight,
} from "lucide-react";

/** Small dictionary of the country codes we're likely to see. Fallback is the raw code. */
const COUNTRY_LABEL: Record<string, string> = {
  KE: "Kenya", UG: "Uganda", TZ: "Tanzania", RW: "Rwanda", ET: "Ethiopia",
  ZA: "South Africa", EG: "Egypt", IN: "India", CN: "China", NL: "Netherlands",
  US: "United States", GB: "United Kingdom", AE: "United Arab Emirates",
};

const STORAGE_LABEL: Record<string, string> = {
  ambient: "Ambient",
  chilled: "Chilled",
  frozen:  "Frozen",
  dry:     "Dry storage",
};

const TAX_LABEL: Record<string, string> = {
  A: "Zero-rated (KRA A)",
  B: "16% VAT (KRA B)",
  C: "Exempt (KRA C)",
  E: "8% VAT (KRA E)",
};

export const Route = createFileRoute("/product/$slug")({
  head: ({ loaderData, params }) => {
    const data = loaderData as
      | { product?: MarketplaceProduct; category?: MarketplaceCategory }
      | undefined;
    const p = data?.product;
    const canonical = { rel: "canonical" as const, href: siteUrl(`/product/${params.slug}`) };
    if (!p) {
      return {
        meta: [{ title: `Product — ${SITE_NAME}` }, { name: "robots", content: "noindex" }],
        links: [canonical],
        scripts: [],
      };
    }
    const price = p.units.find((u) => u.isDefault)?.priceKes ?? p.units[0]?.priceKes ?? 0;
    const title = `${p.name} — ${SITE_NAME}`;
    const ogTitle = `${p.name} — ${formatKes(price)}`;
    const category = data?.category;
    return {
      meta: [
        { title },
        { name: "description", content: p.description },
        { property: "og:type", content: "product" },
        { property: "og:url", content: siteUrl(`/product/${p.slug}`) },
        { property: "og:title", content: ogTitle },
        { property: "og:description", content: p.description },
        { property: "og:image", content: p.thumbnailUrl },
        { property: "og:image:alt", content: p.name },
        { property: "product:price:amount", content: price.toString() },
        { property: "product:price:currency", content: "KES" },
        { name: "twitter:card", content: "summary_large_image" },
        { name: "twitter:title", content: ogTitle },
        { name: "twitter:description", content: p.description },
        { name: "twitter:image", content: p.thumbnailUrl },
      ],
      links: [canonical],
      scripts: [
        jsonLd(productLd(p, category), `ld-product-${p.slug}`),
        jsonLd(
          breadcrumbLd([
            { name: "Home", path: "/" },
            ...(category ? [{ name: category.name, path: `/category/${category.slug}` }] : []),
            { name: p.name, path: `/product/${p.slug}` },
          ]),
          `ld-breadcrumb-product-${p.slug}`,
        ),
      ],
    };
  },
  loader: async ({ params }) => {
    // Fetch product + all categories in parallel; look up the specific
    // category client-side so the head has real data (not mocks) for OG /
    // JSON-LD breadcrumb.
    const [product, categories] = await Promise.all([
      getProduct(params.slug),
      getCategories(),
    ]);
    if (!product) throw notFound();
    const category = categories.find((c) => c.id === product.categoryId);
    return { product, category };
  },
  component: ProductDetail,
});

function ProductDetail() {
  const { product: initial } = Route.useLoaderData() as {
    product: MarketplaceProduct;
    category?: MarketplaceCategory;
  };
  const { data: fresh } = useQuery({
    queryKey: ["product", initial.slug],
    queryFn: () => getProduct(initial.slug),
    initialData: initial,
  });
  const product = fresh ?? initial;

  const navigate = useNavigate();
  const [selectedUnitId, setSelectedUnitId] = useState(
    (product.units.find((u) => u.isDefault) ?? product.units[0]).id,
  );
  const [galleryIdx, setGalleryIdx] = useState(0);
  const [zoomOpen, setZoomOpen] = useState(false);
  const [qty, setQty] = useState(1);
  const [expanded, setExpanded] = useState(false);
  const [canThumbScrollLeft, setCanThumbScrollLeft] = useState(false);
  const [canThumbScrollRight, setCanThumbScrollRight] = useState(false);
  const swipeStartX = useRef<number | null>(null);
  const swipeActive = useRef(false);
  const suppressOpenTap = useRef(false);
  const desktopThumbRailRef = useRef<HTMLDivElement | null>(null);
  const addLine = useCartStore((s) => s.addLine);

  const unit = product.units.find((u) => u.id === selectedUnitId) ?? product.units[0];
  const outOfStock = unit.availability === "out_of_stock";

  // When the buyer switches pack (or lands on a unit with an MOQ > 1),
  // snap the quantity up to the minimum the DB says is orderable.
  useEffect(() => {
    if (unit.moq && qty < unit.moq) setQty(unit.moq);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unit.id, unit.moq]);
  // Structured media (images + videos) is the source of truth when present;
  // fall back to the legacy image-only gallery_urls for older rows.
  const galleryItems: import("../marketplace/components/FullscreenGallery").GalleryItem[] =
    product.media && product.media.length > 0
      ? product.media.map((m) => ({
          url: m.url,
          kind: m.kind,
          altText: m.altText ?? undefined,
          posterUrl: m.posterUrl ?? undefined,
          mimeType: m.mimeType ?? undefined,
        }))
      : (product.galleryUrls.length > 0 ? product.galleryUrls : [product.thumbnailUrl]).map(
          (url) => ({ url, kind: "image" as const }),
        );
  const currentItem = galleryItems[galleryIdx] ?? galleryItems[0];

  const onGalleryPointerDown = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (e.pointerType !== "touch" || galleryItems.length < 2) return;
    swipeStartX.current = e.clientX;
    swipeActive.current = false;
  };

  const onGalleryPointerMove = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (swipeStartX.current === null) return;
    if (Math.abs(e.clientX - swipeStartX.current) > 12) swipeActive.current = true;
  };

  const onGalleryPointerEnd = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (swipeStartX.current === null) return;
    const dx = e.clientX - swipeStartX.current;
    if (Math.abs(dx) > 50) {
      suppressOpenTap.current = true;
      setGalleryIdx((i) => {
        if (dx < 0) return Math.min(galleryItems.length - 1, i + 1);
        return Math.max(0, i - 1);
      });
    }
    swipeStartX.current = null;
    swipeActive.current = false;
  };

  useEffect(() => {
    const updateThumbRailState = () => {
      const rail = desktopThumbRailRef.current;
      if (!rail) {
        setCanThumbScrollLeft(false);
        setCanThumbScrollRight(false);
        return;
      }
      setCanThumbScrollLeft(rail.scrollLeft > 4);
      setCanThumbScrollRight(rail.scrollLeft + rail.clientWidth < rail.scrollWidth - 4);
    };

    updateThumbRailState();
    const rail = desktopThumbRailRef.current;
    if (!rail) return;

    rail.addEventListener("scroll", updateThumbRailState, { passive: true });
    window.addEventListener("resize", updateThumbRailState);
    return () => {
      rail.removeEventListener("scroll", updateThumbRailState);
      window.removeEventListener("resize", updateThumbRailState);
    };
  }, [galleryItems.length]);

  const scrollDesktopThumbRail = (direction: -1 | 1) => {
    const rail = desktopThumbRailRef.current;
    if (!rail) return;
    rail.scrollBy({ left: direction * Math.max(rail.clientWidth * 0.75, 160), behavior: "smooth" });
  };

  const { data: allProducts = [] } = useQuery({
    queryKey: ["products"],
    queryFn: getAllProducts,
  });
  const related = allProducts
    .filter((p) => p.categoryId === product.categoryId && p.id !== product.id)
    .slice(0, 4);

  const handleAdd = () => {
    addLine({
      productUnitId: unit.id,
      productId: product.id,
      productSlug: product.slug,
      thumbnailUrl: product.thumbnailUrl,
      productName: product.name,
      unitLabel: unit.unitLabel,
      quantity: qty,
      priceKes: unit.priceKes,
    });
    toast.success(`Added ${qty} × ${product.name}`, { duration: 1600 });
    navigate({ to: "/cart" });
  };

  return (
    <AppShell variant="focused">
      <div className="px-4 pb-32 lg:px-8 lg:pb-16">
        <div className="lg:hidden">
          <BrowseHeader title={product.name} back="/" />
        </div>

        <div className="lg:grid lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] lg:gap-14 lg:pt-8">
          {/* Gallery */}
          <div>
            <div className="-mx-4 bg-surface pb-4 lg:mx-0 lg:rounded-3xl lg:pb-0">
              {currentItem?.kind === "video" ? (
                <div className="group relative block aspect-square w-full overflow-hidden lg:rounded-3xl">
                  <video
                    key={currentItem.url}
                    src={currentItem.url}
                    poster={currentItem.posterUrl ?? product.thumbnailUrl}
                    preload="metadata"
                    controls
                    playsInline
                    className="h-full w-full object-cover"
                  />
                  <button
                    type="button"
                    onClick={() => setZoomOpen(true)}
                    className="absolute right-3 top-3 grid h-9 w-9 place-items-center rounded-full bg-black/40 text-white opacity-90 backdrop-blur transition hover:opacity-100"
                    aria-label="Open fullscreen video"
                  >
                    <Maximize2 className="h-4 w-4" />
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    if (suppressOpenTap.current) {
                      suppressOpenTap.current = false;
                      return;
                    }
                    setZoomOpen(true);
                  }}
                  onPointerDown={onGalleryPointerDown}
                  onPointerMove={onGalleryPointerMove}
                  onPointerUp={onGalleryPointerEnd}
                  onPointerCancel={onGalleryPointerEnd}
                  className="group relative block aspect-square w-full overflow-hidden lg:rounded-3xl"
                  aria-label="Open fullscreen gallery"
                >
                  <img
                    src={currentItem?.url ?? product.thumbnailUrl}
                    alt={currentItem?.altText ?? `Fresh ${product.name} from Tradly`}
                    className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
                  />
                  <span className="absolute right-3 top-3 grid h-9 w-9 place-items-center rounded-full bg-black/40 text-white opacity-80 backdrop-blur transition group-hover:opacity-100">
                    <Maximize2 className="h-4 w-4" />
                  </span>
                </button>
              )}
              {galleryItems.length > 1 && (
                <>
                  {/* Desktop thumbnail strip */}
                  <div className="relative mt-4 hidden lg:block">
                    <div
                      ref={desktopThumbRailRef}
                      className="hide-scrollbar flex gap-2 overflow-x-auto pb-1"
                    >
                      {galleryItems.map((it, i) => (
                        <button
                          key={`${it.url}-${i}`}
                          type="button"
                          onClick={() => setGalleryIdx(i)}
                          aria-label={`View ${it.kind === "video" ? "video" : "image"} ${i + 1} of ${galleryItems.length}`}
                          className={`relative h-20 w-20 shrink-0 overflow-hidden rounded-xl transition ${
                            i === galleryIdx ? "ring-2 ring-ink" : "opacity-70 hover:opacity-100"
                          }`}
                        >
                          {it.kind === "video" ? (
                            <>
                              <video
                                src={it.url}
                                poster={it.posterUrl ?? undefined}
                                preload="metadata"
                                muted
                                playsInline
                                className="h-full w-full object-cover"
                              />
                              <span className="absolute inset-0 grid place-items-center">
                                <span className="grid h-7 w-7 place-items-center rounded-full bg-black/50 text-[10px] text-white">▶</span>
                              </span>
                            </>
                          ) : (
                            <img src={it.posterUrl ?? it.url} alt={`${product.name} thumbnail ${i + 1}`} className="h-full w-full object-cover" />
                          )}
                        </button>
                      ))}
                    </div>
                    <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center">
                      <button
                        type="button"
                        onClick={() => scrollDesktopThumbRail(-1)}
                        disabled={!canThumbScrollLeft}
                        aria-label="Scroll thumbnails left"
                        className="pointer-events-auto ml-1 grid h-8 w-8 place-items-center rounded-full bg-background/90 text-ink shadow transition disabled:opacity-0"
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </button>
                    </div>
                    <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center">
                      <button
                        type="button"
                        onClick={() => scrollDesktopThumbRail(1)}
                        disabled={!canThumbScrollRight}
                        aria-label="Scroll thumbnails right"
                        className="pointer-events-auto mr-1 grid h-8 w-8 place-items-center rounded-full bg-background/90 text-ink shadow transition disabled:opacity-0"
                      >
                        <ChevronRight className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                  {/* Mobile dots */}
                  <div className="mt-3 flex justify-center gap-2 lg:hidden">
                    {galleryItems.map((_, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => setGalleryIdx(i)}
                        className={`h-1.5 rounded-full transition-all ${
                          i === galleryIdx ? "w-6 bg-ink" : "w-1.5 bg-divider"
                        }`}
                        aria-label={`Show media ${i + 1}`}
                      />
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Details */}
          <div className="pt-5 lg:pt-2">
            <h1 className="text-3xl font-semibold tracking-tight text-ink lg:text-[40px] lg:leading-[1.05]">
              {product.name}
            </h1>
            {product.origin && (
              <p className="mt-2 flex items-center gap-1 text-[12px] text-ink-muted">
                <MapPin className="h-3.5 w-3.5" />
                Grown in {product.origin}
              </p>
            )}
            <p className="mt-4 text-[26px] font-semibold tabular-nums text-ink lg:text-[32px]">
              {formatKes(unit.priceKes)}
            </p>

            <p className={`mt-5 text-[15px] leading-relaxed text-ink-muted ${expanded ? "" : "line-clamp-3 lg:line-clamp-none"}`}>
              {product.description}
            </p>
            {product.description.length > 90 && (
              <button
                type="button"
                onClick={() => setExpanded((e) => !e)}
                className="mt-1 text-[13px] font-medium text-ink underline decoration-divider underline-offset-4 lg:hidden"
              >
                {expanded ? "Show less" : "Read more"}
              </button>
            )}

            <div className="mt-6">
              <p className="mb-2 text-[12px] font-medium uppercase tracking-[0.14em] text-ink-muted">Choose a pack</p>
              <div className="flex flex-wrap gap-2">
                {product.units.map((u) => {
                  const active = u.id === selectedUnitId;
                  const disabled = u.availability === "out_of_stock";
                  return (
                    <button
                      key={u.id}
                      type="button"
                      onClick={() => !disabled && setSelectedUnitId(u.id)}
                      disabled={disabled}
                      className={`rounded-full border px-4 py-2 text-[13px] font-medium transition-colors ${
                        active
                          ? "border-ink bg-ink text-background"
                          : "border-divider bg-surface text-ink hover:border-ink/40"
                      } ${disabled ? "cursor-not-allowed opacity-40" : ""}`}
                    >
                      {u.unitLabel} · {formatKes(u.priceKes)}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="mt-6 rounded-xl border border-trust/25 bg-trust/8 px-3.5 py-2.5 text-trust-deep">
              <span className="text-[12px] font-semibold uppercase tracking-[0.08em]">Sourced by Tradly</span>
            </div>

            <ProductDetailsList product={product} unit={unit} />

            {/* Desktop-only add-to-cart bar */}
            <div className="mt-8 hidden items-center gap-3 lg:flex">
              <QuantityStepper
                value={qty}
                onChange={(v) => setQty(Math.max(unit.moq ?? 1, v))}
                min={unit.moq ?? 1}
              />
              <button
                type="button"
                onClick={handleAdd}
                disabled={outOfStock}
                className="flex-1 rounded-full bg-ink px-6 py-3.5 text-[14px] font-semibold text-background transition hover:bg-ink/90 disabled:opacity-40"
              >
                {outOfStock ? "Currently unavailable" : `Add to cart · ${formatKes(unit.priceKes * qty)}`}
              </button>
            </div>
          </div>
        </div>

        {related.length > 0 && (
          <section className="pt-12 lg:pt-20">
            <h2 className="mb-4 text-[15px] font-medium tracking-tight text-ink lg:text-[22px] lg:font-semibold">
              Pairs well with
            </h2>
            <div className="hide-scrollbar -mx-4 flex gap-3 overflow-x-auto px-4 pb-1 lg:mx-0 lg:grid lg:grid-cols-4 lg:gap-6 lg:overflow-visible lg:px-0">
              {related.map((p) => (
                <div key={p.id} className="w-40 shrink-0 lg:w-auto">
                  <ProductCard product={p} />
                </div>
              ))}
            </div>
          </section>
        )}
      </div>

      {/* Mobile sticky add-to-cart bar */}
      <div className="fixed inset-x-0 bottom-16 z-30 border-t border-divider bg-surface/95 backdrop-blur lg:hidden">
        <div className="mx-auto flex max-w-lg items-center gap-3 px-4 py-3">
          <QuantityStepper
            value={qty}
            onChange={(v) => setQty(Math.max(unit.moq ?? 1, v))}
            min={unit.moq ?? 1}
          />
          <button
            type="button"
            onClick={handleAdd}
            disabled={outOfStock}
            className="flex-1 rounded-full bg-ink px-4 py-3 text-[14px] font-semibold text-background shadow-sm transition-colors disabled:opacity-40"
          >
            {outOfStock ? "Unavailable" : `Add · ${formatKes(unit.priceKes * qty)}`}
          </button>
        </div>
      </div>

      <FullscreenGallery
        items={galleryItems}
        alt={product.name}
        open={zoomOpen}
        onClose={() => setZoomOpen(false)}
        initialIndex={galleryIdx}
      />
    </AppShell>
  );
}

/**
 * Product details table — only renders a row for a field the DB actually has.
 * If none of the optional fields are set, the whole section stays hidden so
 * the storefront doesn't grow ugly empty rows for older / draft catalog rows.
 */
function ProductDetailsList({
  product,
  unit,
}: {
  product: import("../marketplace/types/marketplace").MarketplaceProduct;
  unit: import("../marketplace/types/marketplace").MarketplaceProductUnit;
}) {
  const rows: { icon: ReactNode; label: string; value: ReactNode }[] = [];

  if (product.countryOfOrigin) {
    const label =
      COUNTRY_LABEL[product.countryOfOrigin] ?? product.countryOfOrigin;
    rows.push({
      icon: <Globe2 className="h-4 w-4" />,
      label: "Country of origin",
      value: label,
    });
  }
  if (product.storageClass) {
    const cold =
      product.storageClass === "frozen" || product.storageClass === "chilled";
    rows.push({
      icon: cold ? <Snowflake className="h-4 w-4" /> : <Thermometer className="h-4 w-4" />,
      label: "Storage",
      value: STORAGE_LABEL[product.storageClass] ?? product.storageClass,
    });
  }
  if (typeof product.shelfLifeDays === "number" && product.shelfLifeDays > 0) {
    rows.push({
      icon: <Clock className="h-4 w-4" />,
      label: "Shelf life",
      value: `${product.shelfLifeDays} day${product.shelfLifeDays === 1 ? "" : "s"}`,
    });
  }
  if (typeof product.leadTimeDays === "number" && product.leadTimeDays >= 0) {
    const cutoff = product.orderCutoffTime?.slice(0, 5);
    rows.push({
      icon: <Clock className="h-4 w-4" />,
      label: "Delivery lead time",
      value:
        product.leadTimeDays === 0
          ? "Same-day"
          : cutoff
            ? `${product.leadTimeDays} day${product.leadTimeDays === 1 ? "" : "s"} (order by ${cutoff})`
            : `${product.leadTimeDays} day${product.leadTimeDays === 1 ? "" : "s"}`,
    });
  } else if (product.orderCutoffTime) {
    rows.push({
      icon: <Clock className="h-4 w-4" />,
      label: "Order cutoff",
      value: product.orderCutoffTime.slice(0, 5),
    });
  }
  if (unit.moq && unit.moq > 1) {
    rows.push({
      icon: <Package className="h-4 w-4" />,
      label: "Min. order",
      value: `${unit.moq} × ${unit.unitLabel}`,
    });
  }
  if (unit.casePackSize && unit.casePackSize > 0) {
    rows.push({
      icon: <Boxes className="h-4 w-4" />,
      label: "Case pack",
      value: `${unit.casePackSize} × ${unit.unitLabel}`,
    });
  }
  if (product.kraRegistered && product.taxTyCd) {
    rows.push({
      icon: <ReceiptText className="h-4 w-4" />,
      label: "KRA tax",
      value: TAX_LABEL[product.taxTyCd] ?? product.taxTyCd,
    });
  }

  if (rows.length === 0) return null;

  return (
    <dl className="mt-6 grid grid-cols-1 divide-y divide-divider rounded-2xl border border-divider bg-surface text-[13px] sm:grid-cols-2 sm:divide-y-0">
      {rows.map((row, i) => (
        <div
          key={row.label}
          className={`flex items-center gap-3 px-4 py-3 ${
            i % 2 === 0 ? "sm:border-r sm:border-divider" : ""
          } ${i < rows.length - (rows.length % 2 === 0 ? 2 : 1) ? "sm:border-b sm:border-divider" : ""}`}
        >
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-trust/10 text-trust">
            {row.icon}
          </span>
          <div className="min-w-0">
            <dt className="text-[11px] font-medium uppercase tracking-[0.14em] text-ink-muted">
              {row.label}
            </dt>
            <dd className="mt-0.5 text-ink truncate">{row.value}</dd>
          </div>
        </div>
      ))}
    </dl>
  );
}
