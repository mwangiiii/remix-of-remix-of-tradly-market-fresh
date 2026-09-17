import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AppShell } from "../marketplace/components/AppShell";
import { BrowseHeader } from "../marketplace/components/BrowseHeader";
import { CategoryPillRow } from "../marketplace/components/CategoryPillRow";
import { ProductCard } from "../marketplace/components/ProductCard";
import { SearchBar } from "../marketplace/components/SearchBar";
import { ProductGridSkeleton } from "../marketplace/components/Skeletons";
import { getAllProducts } from "../marketplace/api/marketplaceApi";
import {
  siteUrl,
  jsonLd,
  collectionPageLd,
  SITE_NAME,
} from "../marketplace/lib/seo";
import type { MarketplaceProduct } from "../marketplace/types/marketplace";

const PAGE_DESCRIPTION =
  "Every product on Tradly Market — fresh vegetables, fruits, dairy, cereals, tubers, and kitchen essentials. Delivered same-day in Nairobi.";

export const Route = createFileRoute("/products")({
  head: () => ({
    meta: [
      { title: `All products — ${SITE_NAME}` },
      { name: "description", content: PAGE_DESCRIPTION },
      { property: "og:type", content: "website" },
      { property: "og:url", content: siteUrl("/products") },
      { property: "og:title", content: `All products — ${SITE_NAME}` },
      { property: "og:description", content: PAGE_DESCRIPTION },
    ],
    links: [{ rel: "canonical", href: siteUrl("/products") }],
    scripts: [
      jsonLd(
        collectionPageLd({
          path: "/products",
          name: "All products",
          description: PAGE_DESCRIPTION,
        }),
        "ld-products-collection",
      ),
    ],
  }),
  loader: async () => {
    const products = await getAllProducts();
    return { products };
  },
  component: ProductsView,
});

function ProductsView() {
  const { products: initial } = Route.useLoaderData() as {
    products: MarketplaceProduct[];
  };
  const { data: products = initial, isFetching } = useQuery({
    queryKey: ["products"],
    queryFn: getAllProducts,
    initialData: initial,
  });

  return (
    <AppShell>
      <div className="px-4 lg:px-8">
        <div className="lg:hidden">
          <BrowseHeader title="All products" back="/" />
        </div>
        <div className="hidden pt-10 pb-4 lg:block">
          <Link to="/" className="text-[13px] font-medium text-ink-muted hover:text-ink">
            ← Home
          </Link>
          <h1 className="mt-3 text-[36px] font-semibold tracking-tight text-ink">
            All products
          </h1>
          <p className="mt-2 max-w-2xl text-[14px] leading-relaxed text-ink-muted">
            Every product on Tradly Market. Filter by category above, or search the whole catalogue.
          </p>
        </div>

        <SearchBar />
        <div className="pt-3 lg:pt-5">
          <CategoryPillRow />
        </div>

        {isFetching && products.length === 0 ? (
          <div className="pt-5 lg:pt-8">
            <ProductGridSkeleton count={12} />
          </div>
        ) : products.length === 0 ? (
          <p className="py-16 text-center text-sm text-ink-muted">
            No products yet.{" "}
            <Link to="/" className="font-semibold text-ink underline underline-offset-4">
              Back home
            </Link>
          </p>
        ) : (
          <>
            <p className="pt-4 text-[12px] font-medium uppercase tracking-wide text-ink-muted lg:pt-6">
              {products.length} product{products.length === 1 ? "" : "s"}
            </p>
            <div className="grid grid-cols-2 gap-4 pt-3 md:grid-cols-3 lg:grid-cols-4 lg:gap-6 lg:pt-4">
              {products.map((p, i) => (
                <ProductCard key={p.id} product={p} priority={i < 4} />
              ))}
            </div>
          </>
        )}
      </div>
    </AppShell>
  );
}
