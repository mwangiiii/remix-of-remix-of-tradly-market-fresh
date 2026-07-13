import { Link } from "@tanstack/react-router";
import { categories } from "../mockData/categories";

export function CategoryPillRow({ activeSlug }: { activeSlug?: string }) {
  return (
    <nav className="hide-scrollbar -mx-4 overflow-x-auto px-4">
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
