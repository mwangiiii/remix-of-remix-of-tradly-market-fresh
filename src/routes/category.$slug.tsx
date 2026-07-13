import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AppShell } from "../../marketplace/components/AppShell";
import { BrowseHeader } from "../../marketplace/components/BrowseHeader";
import { CategoryPillRow } from "../../marketplace/components/CategoryPillRow";
import { ProductCard } from "../../marketplace/components/ProductCard";
import { SearchBar } from "../../marketplace/components/SearchBar";
import { getProductsByCategory } from "../../marketplace/api/mockMarketplaceApi";
import { categories } from "../../marketplace/mockData/categories";

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
  const { data: products = [] } = useQuery({
    queryKey: ["category", category.slug],
    queryFn: () => getProductsByCategory(category.slug),
  });

  return (
    <AppShell>
      <div className="px-4">
        <BrowseHeader title={category.name} back="/" />
        <SearchBar />
        <div className="pt-3">
          <CategoryPillRow activeSlug={category.slug} />
        </div>

        {products.length === 0 ? (
          <p className="py-16 text-center text-sm text-ink-muted">
            No items yet in this category.{" "}
            <Link to="/" className="font-semibold text-trust">Browse home</Link>
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-4 pt-5">
            {products.map((p) => <ProductCard key={p.id} product={p} />)}
          </div>
        )}
      </div>
    </AppShell>
  );
}
