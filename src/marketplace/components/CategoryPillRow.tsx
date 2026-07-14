import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { getCategories } from "../api/marketplaceApi";

export function CategoryPillRow({ activeSlug }: { activeSlug?: string }) {
  // Live from Supabase — same query key as everywhere else so the browse
  // pages, search, and category page share one cached list.
  const { data: categories = [], isLoading } = useQuery({
    queryKey: ["categories"],
    queryFn: getCategories,
    staleTime: 60_000,
  });

  if (isLoading && categories.length === 0) {
    return (
      <nav className="hide-scrollbar -mx-4 overflow-x-auto px-4" aria-label="Categories">
        <ul className="flex gap-2 pb-1">
          {[0, 1, 2, 3, 4].map((i) => (
            <li
              key={i}
              className="h-8 w-24 shrink-0 animate-pulse rounded-full bg-surface"
            />
          ))}
        </ul>
      </nav>
    );
  }

  if (categories.length === 0) return null;

  return (
    <nav className="hide-scrollbar -mx-4 overflow-x-auto px-4" aria-label="Categories">
      <ul className="flex gap-2 pb-1">
        {categories.map((c) => {
          const active = c.slug === activeSlug;
          return (
            <li key={c.id} className="shrink-0">
              <Link
                to="/category/$slug"
                params={{ slug: c.slug }}
                className={`inline-flex shrink-0 items-center whitespace-nowrap rounded-full px-4 py-2 text-[13px] font-medium transition-colors ${
                  active
                    ? "bg-farm text-farm-foreground"
                    : "bg-surface text-ink border border-divider hover:border-farm/40"
                }`}
              >
                {c.name}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
