import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { AppShell } from "../marketplace/components/AppShell";
import { BrowseHeader } from "../marketplace/components/BrowseHeader";
import { createSavedList, getSavedLists } from "../marketplace/api/marketplaceApi";
import { useCartStore } from "../marketplace/store/cartStore";
import { useAuth } from "@/hooks/use-auth";
import { ChevronRight, ListPlus, ShoppingBag } from "lucide-react";
import type { CartLine, SavedList } from "../marketplace/types/marketplace";

export const Route = createFileRoute("/lists/")({
  head: () => ({ meta: [{ title: "Saved lists — Tradly Market" }, { name: "robots", content: "noindex" }] }),
  component: Lists,
});

function Lists() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { isAuthenticated } = useAuth();
  const cartLines = useCartStore((s) => s.lines);
  const { data: lists = [] } = useQuery({ queryKey: ["lists"], queryFn: getSavedLists });

  const [busy, setBusy] = useState<"empty" | "from-cart" | null>(null);

  const create = useMutation<SavedList, Error, { name: string; items: CartLine[] }>({
    mutationFn: ({ name, items }) => createSavedList(name, items),
    onSuccess: (list) => {
      qc.invalidateQueries({ queryKey: ["lists"] });
      toast.success(
        list.items.length > 0
          ? `Saved "${list.name}" — ${list.items.length} item${list.items.length === 1 ? "" : "s"}`
          : `Created "${list.name}"`,
        {
          action: { label: "Open", onClick: () => navigate({ to: "/lists/$id", params: { id: list.id } }) },
        },
      );
    },
    onError: (e) => toast.error(e.message ?? "Could not create list"),
  });

  const requireAuth = (next: "/lists" = "/lists") => {
    if (isAuthenticated) return true;
    toast.error("Sign in to save lists.", {
      action: { label: "Sign in", onClick: () => navigate({ to: "/login", search: { next } }) },
    });
    return false;
  };

  const handleNewEmpty = () => {
    if (!requireAuth()) return;
    const name = window.prompt("Name your list", "Weekly essentials");
    if (name == null) return;
    setBusy("empty");
    create.mutate(
      { name: name.trim() || "Untitled list", items: [] },
      { onSettled: () => setBusy(null) },
    );
  };

  const handleFromCart = () => {
    if (cartLines.length === 0) return;
    if (!requireAuth()) return;
    const suggested = `Cart · ${new Date().toLocaleDateString("en-KE", { day: "numeric", month: "short" })}`;
    const name = window.prompt(`Name a list for the ${cartLines.length} item${cartLines.length === 1 ? "" : "s"} in your cart`, suggested);
    if (name == null) return;
    setBusy("from-cart");
    create.mutate(
      { name: name.trim() || "Untitled list", items: cartLines },
      { onSettled: () => setBusy(null) },
    );
  };

  return (
    <AppShell>
      <div className="px-4">
        <BrowseHeader title="Saved lists" back="/" />

        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={handleNewEmpty}
            disabled={busy !== null}
            className="inline-flex items-center gap-2 rounded-full border border-dashed border-divider bg-surface px-4 py-2.5 text-[13px] font-semibold text-ink disabled:opacity-60"
          >
            <ListPlus className="h-4 w-4" />
            {busy === "empty" ? "Creating…" : "New list"}
          </button>

          {cartLines.length > 0 && (
            <button
              type="button"
              onClick={handleFromCart}
              disabled={busy !== null}
              className="inline-flex items-center gap-2 rounded-full bg-ink px-4 py-2.5 text-[13px] font-semibold text-background disabled:opacity-60"
            >
              <ShoppingBag className="h-4 w-4" />
              {busy === "from-cart"
                ? "Saving…"
                : `Save current cart · ${cartLines.length}`}
            </button>
          )}
        </div>

        {lists.length === 0 ? (
          <div className="mt-10 rounded-2xl border border-dashed border-divider bg-surface py-10 text-center">
            <ListPlus className="mx-auto h-6 w-6 text-ink-muted" />
            <p className="mt-3 text-[13px] font-semibold text-ink">No saved lists yet</p>
            <p className="mt-1 px-8 text-[12px] text-ink-muted">
              Create a fresh list, or save the items currently in your cart.
            </p>
          </div>
        ) : (
          <ul className="mt-4 space-y-3">
            {lists.map((l) => (
              <li key={l.id}>
                <Link
                  to="/lists/$id"
                  params={{ id: l.id }}
                  className="flex items-center gap-3 rounded-2xl border border-divider bg-surface p-4"
                >
                  <div className="flex -space-x-2">
                    {l.items.slice(0, 3).map((it) => (
                      <div key={it.productUnitId} className="h-11 w-11 overflow-hidden rounded-full border-2 border-surface bg-muted">
                        <img src={it.thumbnailUrl} alt="" className="h-full w-full object-cover" />
                      </div>
                    ))}
                    {l.items.length === 0 && (
                      <div className="grid h-11 w-11 place-items-center rounded-full border-2 border-surface bg-muted text-ink-muted">
                        <ListPlus className="h-4 w-4" />
                      </div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[15px] font-semibold text-ink">{l.name}</p>
                    <p className="mt-0.5 text-[12px] text-ink-muted">
                      {l.items.length === 0 ? "Empty" : `${l.items.length} item${l.items.length === 1 ? "" : "s"}`}
                    </p>
                  </div>
                  <ChevronRight className="h-4 w-4 text-ink-muted" />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </AppShell>
  );
}
