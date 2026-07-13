import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AppShell } from "../marketplace/components/AppShell";
import { BrowseHeader } from "../marketplace/components/BrowseHeader";
import { CategoryPillRow } from "../marketplace/components/CategoryPillRow";
import { ProductCard } from "../marketplace/components/ProductCard";
import { SearchBar } from "../marketplace/components/SearchBar";
import { getProductsByCategory } from "../marketplace/api/mockMarketplaceApi";
import { categories } from "../marketplace/mockData/categories";
import { useCatalogVersion } from "../marketplace/store/catalogStore";

export const Route = createFileRoute("/category/$slug")({
  head: ({ params }) => {
    const cat = categories.find((c) => c.slug === params.slug);
    const title = cat ? `${cat.name} — Tradly Market` : "Category — Tradly Market";
    return {
      meta: [
        { title },
        { name: "description", content: `Shop fresh ${cat?.name.toLowerCase() ?? "produce"} from Tradly. Delivered same-day, one invoice.` },
        { property: "og:title", content: title },
      ],
    };
  },
  loader: ({ params }) => {
    const cat = categories.find((c) => c.slug === params.slug);
    if (!cat) throw notFound();
    return { category: cat };
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
  const { category } = Route.useLoaderData();
  const catalogVersion = useCatalogVersion();
  const { data: products = [] } = useQuery({
    queryKey: ["category", category.slug, catalogVersion],
    queryFn: () => getProductsByCategory(category.slug),
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

        {products.length === 0 ? (
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
