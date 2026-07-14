import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { z } from "zod";
import { AppShell } from "../marketplace/components/AppShell";
import { BrowseHeader } from "../marketplace/components/BrowseHeader";
import { SearchBar } from "../marketplace/components/SearchBar";
import { ProductCard } from "../marketplace/components/ProductCard";
import { CategoryPillRow } from "../marketplace/components/CategoryPillRow";
import { getCategories, searchProducts } from "../marketplace/api/marketplaceApi";

const searchSchema = z.object({ q: z.string().optional() });

export const Route = createFileRoute("/search")({
  validateSearch: searchSchema,
  head: () => ({
    meta: [
      { title: "Search — Tradly Market" },
      { name: "description", content: "Search Tradly Market for fresh produce, dairy, rice and pantry staples." },
      { name: "robots", content: "noindex" },
      { property: "og:title", content: "Search — Tradly Market" },
      { property: "og:description", content: "Find fresh produce and pantry essentials on Tradly Market." },
      { property: "og:url", content: "https://market.tradly.co.ke/search" },
    ],
  }),
  component: SearchPage,
});

type Filter = "all" | "priceAsc" | "priceDesc" | "availableOnly";

function SearchPage() {
  const { q = "" } = Route.useSearch();
  const [category, setCategory] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("all");

  const { data = [], isFetching } = useQuery({
    queryKey: ["search", q],
    queryFn: () => searchProducts(q),
    enabled: q.trim().length > 0,
  });

  const { data: categories = [] } = useQuery({
    queryKey: ["categories"],
    queryFn: getCategories,
  });

  let results = data;
  if (category) results = results.filter((p) => {
    const c = categories.find((cc) => cc.slug === category);
    return c ? p.categoryId === c.id : true;
  });
  if (filter === "availableOnly") {
    results = results.filter((p) => p.units.some((u) => u.availability === "available"));
  }
  if (filter === "priceAsc" || filter === "priceDesc") {
    results = [...results].sort((a, b) => {
      const ap = a.units[0].priceKes; const bp = b.units[0].priceKes;
      return filter === "priceAsc" ? ap - bp : bp - ap;
    });
  }

  return (
    <AppShell>
      <div className="px-4">
        <BrowseHeader title="Search" back="/" />
        <SearchBar autoFocus />

        {q.trim().length === 0 ? (
          <div className="pt-4">
            <p className="mb-3 text-[13px] font-medium text-ink-muted">Or browse a category</p>
            <CategoryPillRow />
          </div>
        ) : (
          <>
            <div className="hide-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 pt-3">
              <FilterChip active={category === null} onClick={() => setCategory(null)}>All categories</FilterChip>
              {categories.map((c) => (
                <FilterChip key={c.id} active={category === c.slug} onClick={() => setCategory(c.slug)}>
                  {c.name}
                </FilterChip>
              ))}
            </div>
            <div className="hide-scrollbar -mx-4 mt-2 flex gap-2 overflow-x-auto px-4">
              <FilterChip active={filter === "priceAsc"} onClick={() => setFilter(filter === "priceAsc" ? "all" : "priceAsc")}>Price: low</FilterChip>
              <FilterChip active={filter === "priceDesc"} onClick={() => setFilter(filter === "priceDesc" ? "all" : "priceDesc")}>Price: high</FilterChip>
              <FilterChip active={filter === "availableOnly"} onClick={() => setFilter(filter === "availableOnly" ? "all" : "availableOnly")}>Available</FilterChip>
            </div>

            <div className="pt-5">
              {results.length === 0 && !isFetching ? (
                <div className="py-14 text-center">
                  <p className="text-sm text-ink">No matches for "{q}".</p>
                  <p className="mt-1 text-xs text-ink-muted">Try a category instead.</p>
                  <div className="mt-4"><CategoryPillRow /></div>
                </div>
              ) : (
                <div
                  key={q + filter + (category ?? "")}
                  className="grid grid-cols-2 gap-4 animate-in fade-in duration-150"
                >
                  {results.map((p) => <ProductCard key={p.id} product={p} />)}
                </div>
              )}
            </div>
          </>
        )}

        {q.trim().length === 0 && (
          <p className="pt-8 text-center text-xs text-ink-muted">
            Or <Link to="/" className="font-semibold text-trust">go back home</Link>.
          </p>
        )}
      </div>
    </AppShell>
  );
}

function FilterChip({ active, children, onClick }: { active: boolean; children: React.ReactNode; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`shrink-0 whitespace-nowrap rounded-full border px-3 py-1.5 text-[12px] font-medium transition-colors ${
        active
          ? "border-trust bg-trust text-trust-foreground"
          : "border-divider bg-surface text-ink-muted hover:text-ink"
      }`}
    >
      {children}
    </button>
  );
}
