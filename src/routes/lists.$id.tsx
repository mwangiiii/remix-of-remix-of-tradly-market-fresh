import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { AppShell } from "../marketplace/components/AppShell";
import { BrowseHeader } from "../marketplace/components/BrowseHeader";
import { QuantityStepper } from "../marketplace/components/QuantityStepper";
import { deleteSavedList, getSavedList, updateSavedList } from "../marketplace/api/marketplaceApi";
import { useCartStore } from "../marketplace/store/cartStore";
import { formatKes } from "../marketplace/lib/format";
import { useAuth } from "@/hooks/use-auth";
import { NameDialog } from "../marketplace/components/NameDialog";
import { ConfirmDialog } from "../marketplace/components/ConfirmDialog";
import { ChevronRight, ListPlus, Pencil, Plus, ShoppingBag, Trash2, X } from "lucide-react";
import type { CartLine, SavedList } from "../marketplace/types/marketplace";

export const Route = createFileRoute("/lists/$id")({
  head: () => ({
    meta: [{ title: "Saved list — Tradly Market" }, { name: "robots", content: "noindex" }],
  }),
  component: ListDetail,
});

/**
 * List detail — fetched client-side (not via a router loader) because the
 * request needs the buyer's JWT for RLS. Loaders run before AuthProvider's
 * silent refresh completes on hard reloads, which would send an anon
 * request and 404 the row we know exists. Gating on auth-ready avoids that.
 */
function ListDetail() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { isAuthenticated, isInitializing, buyer } = useAuth();
  const loadLines = useCartStore((s) => s.loadLines);
  const cartLines = useCartStore((s) => s.lines);
  const [dialog, setDialog] = useState<"rename" | "delete" | null>(null);

  const query = useQuery({
    queryKey: ["lists", id],
    queryFn: () => getSavedList(id),
    enabled: !isInitializing && isAuthenticated,
  });
  const list = query.data;

  const invalidateAll = () => {
    qc.invalidateQueries({ queryKey: ["lists", id] });
    qc.invalidateQueries({ queryKey: ["lists", buyer?.businessId ?? null] });
  };

  const patch = useMutation<SavedList, Error, { name?: string; items?: CartLine[] }>({
    mutationFn: (input) => updateSavedList(id, input),
    onMutate: async (input) => {
      await qc.cancelQueries({ queryKey: ["lists", id] });
      const prev = qc.getQueryData<SavedList | undefined>(["lists", id]);
      if (prev) {
        qc.setQueryData<SavedList>(["lists", id], {
          ...prev,
          name: input.name ?? prev.name,
          items: input.items ?? prev.items,
        });
      }
      return { prev };
    },
    onError: (e, _v, ctx) => {
      const snapshot = ctx as { prev: SavedList | undefined } | undefined;
      if (snapshot) qc.setQueryData(["lists", id], snapshot.prev);
      toast.error(e.message ?? "Could not save changes");
    },
    onSuccess: () => {
      invalidateAll();
      setDialog((d) => (d === "rename" ? null : d));
    },
  });

  const remove = useMutation<void, Error, void>({
    mutationFn: () => deleteSavedList(id),
    onSuccess: () => {
      qc.removeQueries({ queryKey: ["lists", id] });
      qc.invalidateQueries({ queryKey: ["lists", buyer?.businessId ?? null] });
      toast.success("List deleted");
      navigate({ to: "/lists" });
    },
    onError: (e) => toast.error(e.message ?? "Could not delete list"),
  });

  // Debounce qty changes so multi-tap ++ / -- doesn't hammer Supabase.
  // The optimistic update from patch.onMutate keeps the UI snappy.
  const flushTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pending = useRef<CartLine[] | null>(null);
  useEffect(
    () => () => {
      if (flushTimer.current) clearTimeout(flushTimer.current);
    },
    [],
  );

  const scheduleSaveItems = (nextItems: CartLine[]) => {
    // Optimistic update happens through patch.onMutate — but we still want
    // to snap the local cache immediately for the render pass.
    qc.setQueryData<SavedList>(["lists", id], (prev) =>
      prev ? { ...prev, items: nextItems } : prev,
    );
    pending.current = nextItems;
    if (flushTimer.current) clearTimeout(flushTimer.current);
    flushTimer.current = setTimeout(() => {
      if (pending.current) patch.mutate({ items: pending.current });
      pending.current = null;
    }, 400);
  };

  const handleQty = (productUnitId: string, next: number) => {
    if (!list) return;
    const items =
      next <= 0
        ? list.items.filter((it) => it.productUnitId !== productUnitId)
        : list.items.map((it) =>
            it.productUnitId === productUnitId ? { ...it, quantity: next } : it,
          );
    scheduleSaveItems(items);
  };

  const handleRemove = (productUnitId: string) => {
    if (!list) return;
    scheduleSaveItems(list.items.filter((it) => it.productUnitId !== productUnitId));
  };

  const openRename = () => {
    if (!list) return;
    setDialog("rename");
  };

  const openDelete = () => {
    if (!list) return;
    setDialog("delete");
  };

  const handleAppendCart = () => {
    if (!list || cartLines.length === 0) return;
    // Merge current cart into the list: bump quantities on existing units,
    // append new ones. Preserves order for rows that already existed.
    const merged: CartLine[] = list.items.map((it) => ({ ...it }));
    for (const c of cartLines) {
      const idx = merged.findIndex((m) => m.productUnitId === c.productUnitId);
      if (idx >= 0) merged[idx] = { ...merged[idx], quantity: merged[idx].quantity + c.quantity };
      else merged.push({ ...c });
    }
    patch.mutate({ items: merged });
    toast.success(`Added ${cartLines.length} cart item${cartLines.length === 1 ? "" : "s"}`);
  };

  const handleAddAllToCart = () => {
    if (!list || list.items.length === 0) return;
    loadLines(list.items);
    toast.success(`${list.items.length} item${list.items.length === 1 ? "" : "s"} added to cart`);
    navigate({ to: "/cart" });
  };

  // ── Guards ──────────────────────────────────────────────────────────────
  if (isInitializing) {
    return (
      <AppShell>
        <div className="px-4">
          <BrowseHeader title="Saved list" back="/lists" />
          <ul className="mt-4 divide-y divide-divider" aria-hidden="true">
            {Array.from({ length: 4 }).map((_, i) => (
              <li key={i} className="flex items-center gap-3 py-3">
                <div className="h-14 w-14 shrink-0 rounded-xl bg-muted" />
                <div className="flex-1 space-y-2">
                  <div className="h-3 w-2/3 rounded bg-muted" />
                  <div className="h-2.5 w-1/4 rounded bg-muted" />
                </div>
              </li>
            ))}
          </ul>
        </div>
      </AppShell>
    );
  }
  if (!isAuthenticated) {
    return (
      <AppShell>
        <div className="px-4">
          <BrowseHeader title="Saved list" back="/lists" />
          <div className="mt-10 rounded-2xl border border-dashed border-divider bg-surface py-10 text-center">
            <p className="text-[13px] font-semibold text-ink">Sign in to open this list</p>
            <button
              type="button"
              onClick={() => navigate({ to: "/login", search: { next: `/lists/${id}` } })}
              className="mt-4 inline-flex items-center gap-2 rounded-full bg-ink px-4 py-2 text-[13px] font-semibold text-background"
            >
              Sign in
            </button>
          </div>
        </div>
      </AppShell>
    );
  }
  if (query.isLoading) {
    return (
      <AppShell>
        <div className="px-4">
          <BrowseHeader title="Saved list" back="/lists" />
          <p className="mt-8 text-center text-[13px] text-ink-muted">Loading…</p>
        </div>
      </AppShell>
    );
  }
  if (!list) {
    return (
      <AppShell>
        <div className="px-4">
          <BrowseHeader title="Saved list" back="/lists" />
          <div className="mt-10 rounded-2xl border border-dashed border-divider bg-surface py-10 text-center">
            <p className="text-[13px] font-semibold text-ink">List not found</p>
            <p className="mt-1 px-8 text-[12px] text-ink-muted">
              It may have been deleted, or you may not have access to it.
            </p>
            <Link
              to="/lists"
              className="mt-4 inline-flex items-center gap-2 rounded-full bg-ink px-4 py-2 text-[13px] font-semibold text-background"
            >
              Back to lists
            </Link>
          </div>
        </div>
      </AppShell>
    );
  }

  const total = list.items.reduce((s, i) => s + i.priceKes * i.quantity, 0);

  return (
    <AppShell>
      <div className="px-4 pb-32">
        <BrowseHeader title={list.name} back="/lists" />

        <div className="mt-2 flex items-center gap-2">
          <button
            type="button"
            onClick={openRename}
            className="inline-flex items-center gap-1.5 rounded-full border border-divider bg-surface px-3 py-1.5 text-[12px] font-semibold text-ink-muted hover:text-ink"
          >
            <Pencil className="h-3.5 w-3.5" /> Rename
          </button>
          <button
            type="button"
            onClick={openDelete}
            className="inline-flex items-center gap-1.5 rounded-full border border-divider bg-surface px-3 py-1.5 text-[12px] font-semibold text-ink-muted hover:text-destructive"
          >
            <Trash2 className="h-3.5 w-3.5" /> Delete
          </button>
        </div>

        {list.items.length === 0 ? (
          <div className="mt-10 rounded-2xl border border-dashed border-divider bg-surface p-6 text-center">
            <ListPlus className="mx-auto h-6 w-6 text-ink-muted" />
            <p className="mt-3 text-[13px] font-semibold text-ink">This list is empty</p>
            <p className="mt-1 px-4 text-[12px] text-ink-muted">
              Add items from the marketplace to your cart, then save them here.
            </p>
            <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:justify-center">
              <Link
                to="/"
                className="inline-flex items-center justify-center gap-2 rounded-full bg-ink px-4 py-2 text-[13px] font-semibold text-background"
              >
                <ChevronRight className="h-4 w-4" /> Browse the market
              </Link>
              {cartLines.length > 0 && (
                <button
                  type="button"
                  onClick={handleAppendCart}
                  className="inline-flex items-center justify-center gap-2 rounded-full border border-divider bg-surface px-4 py-2 text-[13px] font-semibold text-ink"
                >
                  <Plus className="h-4 w-4" />
                  Add cart · {cartLines.length}
                </button>
              )}
            </div>
          </div>
        ) : (
          <>
            <ul className="mt-3 divide-y divide-divider">
              {list.items.map((it) => (
                <li key={it.productUnitId} className="flex items-center gap-3 py-3">
                  <Link
                    to="/product/$slug"
                    params={{ slug: it.productSlug }}
                    className="h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-surface soft-shadow"
                  >
                    <img
                      src={it.thumbnailUrl}
                      alt={it.productName}
                      className="h-full w-full object-cover"
                    />
                  </Link>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[14px] font-semibold text-ink">{it.productName}</p>
                    <p className="text-[12px] text-ink-muted">
                      {it.unitLabel} · {formatKes(it.priceKes)}
                    </p>
                    <p className="mt-0.5 text-[12px] font-semibold tabular-nums text-farm">
                      {formatKes(it.priceKes * it.quantity)}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <QuantityStepper
                      value={it.quantity}
                      onChange={(v) => handleQty(it.productUnitId, v)}
                      size="sm"
                    />
                    <button
                      type="button"
                      onClick={() => handleRemove(it.productUnitId)}
                      className="grid h-7 w-7 place-items-center rounded-full text-ink-muted hover:bg-muted hover:text-destructive"
                      aria-label={`Remove ${it.productName}`}
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                </li>
              ))}
            </ul>

            {cartLines.length > 0 && (
              <button
                type="button"
                onClick={handleAppendCart}
                className="mt-4 inline-flex items-center gap-2 rounded-full border border-divider bg-surface px-4 py-2 text-[13px] font-semibold text-ink"
              >
                <Plus className="h-4 w-4" />
                Add {cartLines.length} item{cartLines.length === 1 ? "" : "s"} from cart
              </button>
            )}
          </>
        )}
      </div>

      {list.items.length > 0 && (
        <div className="fixed inset-x-0 bottom-16 z-30 border-t border-divider bg-surface/95 backdrop-blur">
          <div className="mx-auto flex max-w-lg items-center justify-between gap-3 px-4 py-3">
            <div>
              <p className="text-[11px] font-medium uppercase tracking-wide text-ink-muted">
                Total
              </p>
              <p className="text-[16px] font-bold text-farm">{formatKes(total)}</p>
            </div>
            <button
              type="button"
              onClick={handleAddAllToCart}
              className="flex-1 rounded-full bg-farm px-5 py-3 text-[14px] font-semibold text-farm-foreground"
            >
              <span className="inline-flex items-center justify-center gap-2">
                <ShoppingBag className="h-4 w-4" />
                Add all to cart
              </span>
            </button>
          </div>
        </div>
      )}

      <NameDialog
        open={dialog === "rename"}
        onOpenChange={(o) => (o ? null : setDialog(null))}
        title="Rename list"
        label="List name"
        defaultValue={list.name}
        submitLabel="Rename"
        pending={patch.isPending}
        onSubmit={(name) => {
          if (name === list.name) {
            setDialog(null);
            return;
          }
          patch.mutate({ name });
        }}
      />

      <ConfirmDialog
        open={dialog === "delete"}
        onOpenChange={(o) => (o ? null : setDialog(null))}
        title={`Delete "${list.name}"?`}
        description="This can't be undone. Items in the list are removed too — your cart is unaffected."
        confirmLabel="Delete list"
        pending={remove.isPending}
        onConfirm={() => remove.mutate()}
      />
    </AppShell>
  );
}
