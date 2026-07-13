import { createFileRoute, Link, notFound, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { AppShell } from "../marketplace/components/AppShell";
import { BrowseHeader } from "../marketplace/components/BrowseHeader";
import { QuantityStepper } from "../marketplace/components/QuantityStepper";
import { ProductCard } from "../marketplace/components/ProductCard";
import { getProduct, getAllProducts } from "../marketplace/api/mockMarketplaceApi";
import { products as productSeed } from "../marketplace/mockData/products";
import { useCartStore } from "../marketplace/store/cartStore";
import { formatKes } from "../marketplace/lib/format";
import { MapPin, ShieldCheck } from "lucide-react";

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
  const { product } = Route.useLoaderData() as { product: import("../marketplace/types/marketplace").MarketplaceProduct };
  const navigate = useNavigate();
  const [selectedUnitId, setSelectedUnitId] = useState(
    (product.units.find((u) => u.isDefault) ?? product.units[0]).id,
  );
  const [galleryIdx, setGalleryIdx] = useState(0);
  const [qty, setQty] = useState(1);
  const [expanded, setExpanded] = useState(false);
  const addLine = useCartStore((s) => s.addLine);

  const unit = product.units.find((u) => u.id === selectedUnitId)!;
  const outOfStock = unit.availability === "out_of_stock";

  const { data: allProducts = [] } = useQuery({ queryKey: ["products"], queryFn: getAllProducts });
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
    <AppShell>
      <div className="px-4 pb-32">
        <BrowseHeader title={product.name} back="/" />

        <div className="-mx-4 bg-surface pb-4">
          <div className="aspect-square w-full overflow-hidden">
            <img
              src={product.galleryUrls[galleryIdx] ?? product.thumbnailUrl}
              alt={product.name}
              className="h-full w-full object-cover"
            />
          </div>
          {product.galleryUrls.length > 1 && (
            <div className="mt-3 flex justify-center gap-2">
              {product.galleryUrls.map((_, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setGalleryIdx(i)}
                  className={`h-1.5 rounded-full transition-all ${
                    i === galleryIdx ? "w-6 bg-farm" : "w-1.5 bg-divider"
                  }`}
                  aria-label={`Show image ${i + 1}`}
                />
              ))}
            </div>
          )}
        </div>

        <div className="pt-5">
          <h1 className="text-2xl font-bold text-ink">{product.name}</h1>
          {product.origin && (
            <p className="mt-1 flex items-center gap-1 text-[12px] text-ink-muted">
              <MapPin className="h-3.5 w-3.5" />
              Grown in {product.origin}
            </p>
          )}
          <p className="mt-3 text-[22px] font-bold text-farm">{formatKes(unit.priceKes)}</p>

          <p className={`mt-4 text-[14px] leading-relaxed text-ink-muted ${expanded ? "" : "line-clamp-2"}`}>
            {product.description}
          </p>
          {product.description.length > 90 && (
            <button
              type="button"
              onClick={() => setExpanded((e) => !e)}
              className="mt-1 text-[13px] font-semibold text-trust"
            >
              {expanded ? "Show less" : "Read more"}
            </button>
          )}

          <div className="mt-5">
            <p className="mb-2 text-[12px] font-semibold uppercase tracking-wide text-ink-muted">Packaging</p>
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
                        ? "border-farm bg-farm text-farm-foreground"
                        : "border-divider bg-surface text-ink hover:border-farm/40"
                    } ${disabled ? "cursor-not-allowed opacity-40" : ""}`}
                  >
                    {u.unitLabel} · {formatKes(u.priceKes)}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="mt-5 flex items-center gap-2 rounded-xl bg-trust/8 p-3 text-[12px] text-trust-deep">
            <ShieldCheck className="h-4 w-4 shrink-0" />
            <span>Sourced from Tradly — one supplier, one invoice, eTIMS-compliant.</span>
          </div>
        </div>

        {related.length > 0 && (
          <section className="pt-10">
            <h2 className="mb-3 text-[15px] font-semibold text-ink">Frequently bought with</h2>
            <div className="hide-scrollbar -mx-4 flex gap-3 overflow-x-auto px-4 pb-1">
              {related.map((p) => (
                <div key={p.id} className="w-40 shrink-0">
                  <ProductCard product={p} />
                </div>
              ))}
            </div>
          </section>
        )}
      </div>

      {/* Sticky add-to-cart bar */}
      <div className="fixed inset-x-0 bottom-16 z-30 border-t border-divider bg-surface/95 backdrop-blur">
        <div className="mx-auto flex max-w-lg items-center gap-3 px-4 py-3">
          <QuantityStepper value={qty} onChange={(v) => setQty(Math.max(1, v))} min={1} />
          <button
            type="button"
            onClick={handleAdd}
            disabled={outOfStock}
            className="flex-1 rounded-full bg-farm px-4 py-3 text-[14px] font-semibold text-farm-foreground shadow-sm transition-colors hover:bg-farm/95 disabled:opacity-40"
          >
            {outOfStock ? "Out of stock" : `Add to cart · ${formatKes(unit.priceKes * qty)}`}
          </button>
        </div>
      </div>
    </AppShell>
  );
}
