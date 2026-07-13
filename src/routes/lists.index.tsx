import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AppShell } from "../marketplace/components/AppShell";
import { BrowseHeader } from "../marketplace/components/BrowseHeader";
import { getSavedLists } from "../marketplace/api/mockMarketplaceApi";
import { ChevronRight, ListPlus } from "lucide-react";

export const Route = createFileRoute("/lists")({
  head: () => ({ meta: [{ title: "Saved lists — Tradly Market" }, { name: "robots", content: "noindex" }] }),
  component: Lists,
});

function Lists() {
  const { data: lists = [] } = useQuery({ queryKey: ["lists"], queryFn: getSavedLists });

  return (
    <AppShell>
      <div className="px-4">
        <BrowseHeader title="Saved lists" back="/" />

        <button
          type="button"
          className="mt-4 inline-flex items-center gap-2 rounded-full border border-dashed border-divider bg-surface px-4 py-2.5 text-[13px] font-semibold text-ink"
        >
          <ListPlus className="h-4 w-4" /> New list
        </button>

        <ul className="mt-4 space-y-3">
          {lists.map((l) => (
            <li key={l.id}>
              <Link
                to="/lists/$id" params={{ id: l.id }}
                className="flex items-center gap-3 rounded-2xl border border-divider bg-surface p-4"
              >
                <div className="flex -space-x-2">
                  {l.items.slice(0, 3).map((it) => (
                    <div key={it.productUnitId} className="h-11 w-11 overflow-hidden rounded-full border-2 border-surface bg-muted">
                      <img src={it.thumbnailUrl} alt="" className="h-full w-full object-cover" />
                    </div>
                  ))}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[15px] font-semibold text-ink">{l.name}</p>
                  <p className="mt-0.5 text-[12px] text-ink-muted">{l.items.length} items</p>
                </div>
                <ChevronRight className="h-4 w-4 text-ink-muted" />
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </AppShell>
  );
}
