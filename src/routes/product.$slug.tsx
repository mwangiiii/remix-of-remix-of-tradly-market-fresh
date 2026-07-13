import { createFileRoute, Link, notFound, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { AppShell } from "../marketplace/components/AppShell";
import { BrowseHeader } from "../marketplace/components/BrowseHeader";
import { QuantityStepper } from "../marketplace/components/QuantityStepper";
import { ProductCard } from "../marketplace/components/ProductCard";
import { FullscreenGallery } from "../marketplace/components/FullscreenGallery";
import { getProduct, getAllProducts } from "../marketplace/api/marketplaceApi";
import { products as productSeed } from "../marketplace/mockData/products";
import { useCartStore } from "../marketplace/store/cartStore";
import { formatKes } from "../marketplace/lib/format";
import { MapPin, ShieldCheck, Maximize2 } from "lucide-react";

export const Route = createFileRoute("/product/$slug")({
  head: ({ params }) => {
    const p = productSeed.find((x) => x.slug === params.slug);
    if (!p) return { meta: [{ title: "Product — Tradly Market" }] };
    const price = p.units.find((u) => u.isDefault)?.priceKes ?? p.units[0].priceKes;
    return {
      meta: [
        { title: `${p.name} — Tradly Market` },
        { name: "description", content: `${p.name} from Tradly. ${p.origin ? `From ${p.origin}. ` : ""}Order for same-day dispatch.` },
        { property: "og:title", content: `${p.name} — ${formatKes(price)}` },
        { property: "og:description", content: p.description },
        { property: "og:image", content: p.thumbnailUrl },
        { name: "twitter:image", content: p.thumbnailUrl },
      ],
    };
  },
  loader: async ({ params }) => {
    const p = await getProduct(params.slug);
    if (!p) throw notFound();
    return { product: p };
  },
  component: ProductDetail,
});

function ProductDetail() {
  const { product: initial } = Route.useLoaderData() as { product: import("../marketplace/types/marketplace").MarketplaceProduct };
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
  const addLine = useCartStore((s) => s.addLine);

  const unit = product.units.find((u) => u.id === selectedUnitId) ?? product.units[0];
  const outOfStock = unit.availability === "out_of_stock";
  const galleryImages = product.galleryUrls.length > 0 ? product.galleryUrls : [product.thumbnailUrl];

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
              <button
                type="button"
                onClick={() => { setZoomOpen(true); }}
                className="group relative block aspect-square w-full overflow-hidden lg:rounded-3xl"
                aria-label="Open fullscreen gallery"
              >
                <img
                  src={galleryImages[galleryIdx] ?? product.thumbnailUrl}
                  alt={product.name}
                  className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
                />
                <span className="absolute right-3 top-3 grid h-9 w-9 place-items-center rounded-full bg-black/40 text-white opacity-80 backdrop-blur transition group-hover:opacity-100">
                  <Maximize2 className="h-4 w-4" />
                </span>
              </button>
              {galleryImages.length > 1 && (
                <>
                  {/* Desktop thumbnail strip */}
                  <div className="mt-4 hidden gap-2 lg:flex">
                    {galleryImages.map((src, i) => (
                      <button
                        key={`${src}-${i}`}
                        type="button"
                        onClick={() => setGalleryIdx(i)}
                        className={`h-20 w-20 shrink-0 overflow-hidden rounded-xl transition ${
                          i === galleryIdx ? "ring-2 ring-ink" : "opacity-70 hover:opacity-100"
                        }`}
                      >
                        <img src={src} alt="" className="h-full w-full object-cover" />
                      </button>
                    ))}
                  </div>
                  {/* Mobile dots */}
                  <div className="mt-3 flex justify-center gap-2 lg:hidden">
                    {galleryImages.map((_, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => setGalleryIdx(i)}
                        className={`h-1.5 rounded-full transition-all ${
                          i === galleryIdx ? "w-6 bg-ink" : "w-1.5 bg-divider"
                        }`}
                        aria-label={`Show image ${i + 1}`}
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

            <div className="mt-6 flex items-center gap-2 rounded-2xl bg-trust/8 p-3.5 text-[12.5px] text-trust-deep">
              <ShieldCheck className="h-4 w-4 shrink-0" />
              <span>Sourced by Tradly. One supplier. One invoice. eTIMS-compliant.</span>
            </div>

            {/* Desktop-only add-to-cart bar */}
            <div className="mt-8 hidden items-center gap-3 lg:flex">
              <QuantityStepper value={qty} onChange={(v) => setQty(Math.max(1, v))} min={1} />
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
          <QuantityStepper value={qty} onChange={(v) => setQty(Math.max(1, v))} min={1} />
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
        images={galleryImages}
        alt={product.name}
        open={zoomOpen}
        onClose={() => setZoomOpen(false)}
        initialIndex={galleryIdx}
      />
    </AppShell>
  );
}
