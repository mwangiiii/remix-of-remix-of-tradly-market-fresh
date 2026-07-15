import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AppShell } from "../marketplace/components/AppShell";
import { BrowseHeader } from "../marketplace/components/BrowseHeader";
import { CategoryPillRow } from "../marketplace/components/CategoryPillRow";
import { ProductCard } from "../marketplace/components/ProductCard";
import { SearchBar } from "../marketplace/components/SearchBar";
import { ProductGridSkeleton } from "../marketplace/components/Skeletons";
import {
  getCategories,
  getProductsByCategory,
} from "../marketplace/api/marketplaceApi";
import {
  siteUrl,
  jsonLd,
  categoryItemListLd,
  breadcrumbLd,
  SITE_NAME,
} from "../marketplace/lib/seo";
import type { MarketplaceCategory, MarketplaceProduct } from "../marketplace/types/marketplace";

export const Route = createFileRoute("/category/$slug")({
  head: ({ loaderData, params }) => {
    const cat = (loaderData as { category?: MarketplaceCategory } | undefined)?.category;
    const canonical = { rel: "canonical" as const, href: siteUrl(`/category/${params.slug}`) };
    if (!cat) {
      return {
        meta: [{ title: `Category — ${SITE_NAME}` }, { name: "robots", content: "noindex" }],
        links: [canonical],
        scripts: [],
      };
    }
    const title = `${cat.name} — ${SITE_NAME}`;
    const description = `Shop fresh ${cat.name.toLowerCase()} from Tradly. Delivered same-day, one invoice, eTIMS-ready.`;
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:type", content: "website" },
        { property: "og:url", content: siteUrl(`/category/${cat.slug}`) },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { name: "twitter:title", content: title },
        { name: "twitter:description", content: description },
      ],
      links: [canonical],
      scripts: [
        // categoryItemListLd needs the products list; loader also returns it
        // so JSON-LD can be rendered from real DB rows (not mock).
        jsonLd(
          categoryItemListLd(
            cat,
            (loaderData as { products?: MarketplaceProduct[] } | undefined)?.products ?? [],
          ),
          `ld-category-list-${cat.slug}`,
        ),
        jsonLd(
          breadcrumbLd([
            { name: "Home", path: "/" },
            { name: cat.name, path: `/category/${cat.slug}` },
          ]),
          `ld-breadcrumb-category-${cat.slug}`,
        ),
      ],
    };
  },
  loader: async ({ params }) => {
    // Fetch categories + products for this slug in parallel from the DB.
    // The category has to come from a query since there's no direct-by-slug
    // helper yet — filter client-side over the ordered list (small N).
    const [cats, products] = await Promise.all([
      getCategories(),
      getProductsByCategory(params.slug),
    ]);
    const category = cats.find((c) => c.slug === params.slug);
    if (!category) throw notFound();
    return { category, products };
  },
  component: CategoryView,
  notFoundComponent: () => (
    <AppShell>
      <div className="px-4">
        <BrowseHeader title="Not found" back="/" />
        <p className="py-16 text-center text-sm text-ink-muted">Category not found.</p>
      </div>
    </AppShell>
  ),
});

function CategoryView() {
  const { category, products: initial } = Route.useLoaderData() as {
    category: MarketplaceCategory;
    products: MarketplaceProduct[];
  };
  const { data: products = initial, isFetching } = useQuery({
    queryKey: ["category", category.slug],
    queryFn: () => getProductsByCategory(category.slug),
    initialData: initial,
  });

  return (
    <AppShell>
      <div className="px-4 lg:px-8">
        <div className="lg:hidden">
          <BrowseHeader title={category.name} back="/" />
        </div>
        <div className="hidden pt-10 pb-4 lg:block">
          <Link to="/" className="text-[13px] font-medium text-ink-muted hover:text-ink">
            ← All categories
          </Link>
          <h1 className="mt-3 text-[36px] font-semibold tracking-tight text-ink">{category.name}</h1>
        </div>

        <SearchBar />
        <div className="pt-3 lg:pt-5">
          <CategoryPillRow activeSlug={category.slug} />
        </div>

        {isFetching && products.length === 0 ? (
          <div className="pt-5 lg:pt-8">
            <ProductGridSkeleton count={8} />
          </div>
        ) : products.length === 0 ? (
          <p className="py-16 text-center text-sm text-ink-muted">
            No items yet in this category.{" "}
            <Link to="/" className="font-semibold text-ink underline underline-offset-4">Browse home</Link>
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-4 pt-5 md:grid-cols-3 lg:grid-cols-4 lg:gap-6 lg:pt-8">
            {products.map((p) => <ProductCard key={p.id} product={p} />)}
          </div>
        )}
      </div>
    </AppShell>
  );
}
