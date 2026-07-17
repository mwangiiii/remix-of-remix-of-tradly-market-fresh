import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { AppShell } from "../marketplace/components/AppShell";
import { BrowseHeader } from "../marketplace/components/BrowseHeader";
import {
  createSavedList,
  deleteSavedList,
  getSavedLists,
  updateSavedList,
} from "../marketplace/api/marketplaceApi";
import { useCartStore } from "../marketplace/store/cartStore";
import { useAuth } from "@/hooks/use-auth";
import { NameDialog } from "../marketplace/components/NameDialog";
import { ConfirmDialog } from "../marketplace/components/ConfirmDialog";
import {
  ChevronRight,
  ListPlus,
  LogIn,
  MoreVertical,
  Pencil,
  ShoppingBag,
  Trash2,
} from "lucide-react";
import type { CartLine, SavedList } from "../marketplace/types/marketplace";

type Dialog =
  | { kind: "new-empty" }
  | { kind: "new-from-cart" }
  | { kind: "rename"; list: SavedList }
  | { kind: "delete"; list: SavedList }
  | null;

export const Route = createFileRoute("/lists/")({
  head: () => ({
    meta: [{ title: "Saved lists — Tradly Market" }, { name: "robots", content: "noindex" }],
  }),
  component: Lists,
});

function Lists() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { isAuthenticated, isInitializing, buyer } = useAuth();
  const cartLines = useCartStore((s) => s.lines);

  // Key by business_id so a login/logout naturally swaps caches. Gated on
  // auth-ready so the initial fetch runs AFTER silent refresh restores the
  // JWT — otherwise the anon request hits RLS with no business_id and comes
  // back empty, leaving stale "no lists" state until the next mutation.
  const listsQuery = useQuery({
    queryKey: ["lists", buyer?.businessId ?? null],
    queryFn: getSavedLists,
    enabled: !isInitializing && isAuthenticated,
  });
  const lists: SavedList[] = listsQuery.data ?? [];

  const invalidateLists = () =>
    qc.invalidateQueries({ queryKey: ["lists", buyer?.businessId ?? null] });

  const [dialog, setDialog] = useState<Dialog>(null);

  const create = useMutation<SavedList, Error, { name: string; items: CartLine[] }>({
    mutationFn: ({ name, items }) => createSavedList(name, items),
    onSuccess: (list) => {
      invalidateLists();
      setDialog(null);
      toast.success(
        list.items.length > 0
          ? `Saved "${list.name}" — ${list.items.length} item${list.items.length === 1 ? "" : "s"}`
          : `Created "${list.name}"`,
        {
          action: {
            label: "Open",
            onClick: () => navigate({ to: "/lists/$id", params: { id: list.id } }),
          },
        },
      );
    },
    onError: (e) => toast.error(e.message ?? "Could not create list"),
  });

  const rename = useMutation<SavedList, Error, { id: string; name: string }>({
    mutationFn: ({ id, name }) => updateSavedList(id, { name }),
    onSuccess: (list) => {
      invalidateLists();
      qc.setQueryData(["lists", list.id], list);
      setDialog(null);
      toast.success(`Renamed to "${list.name}"`);
    },
    onError: (e) => toast.error(e.message ?? "Could not rename list"),
  });

  const remove = useMutation<void, Error, { id: string; name: string }>({
    mutationFn: ({ id }) => deleteSavedList(id),
    onMutate: async ({ id }) => {
      await qc.cancelQueries({ queryKey: ["lists", buyer?.businessId ?? null] });
      const prev = qc.getQueryData<SavedList[]>(["lists", buyer?.businessId ?? null]);
      qc.setQueryData<SavedList[]>(["lists", buyer?.businessId ?? null], (old) =>
        (old ?? []).filter((l) => l.id !== id),
      );
      return { prev };
    },
    onError: (e, _v, ctx) => {
      // Roll back on failure so the row reappears.
      const snapshot = ctx as { prev: SavedList[] | undefined } | undefined;
      if (snapshot) qc.setQueryData(["lists", buyer?.businessId ?? null], snapshot.prev);
      toast.error(e.message ?? "Could not delete list");
    },
    onSuccess: (_v, { name }) => {
      invalidateLists();
      setDialog(null);
      toast.success(`Deleted "${name}"`);
    },
  });

  const requireAuth = (next: "/lists" = "/lists") => {
    if (isAuthenticated) return true;
    toast.error("Sign in to save lists.", {
      action: { label: "Sign in", onClick: () => navigate({ to: "/login", search: { next } }) },
    });
    return false;
  };

  const openNewEmpty = () => {
    if (!requireAuth()) return;
    setDialog({ kind: "new-empty" });
  };

  const openNewFromCart = () => {
    if (cartLines.length === 0) return;
    if (!requireAuth()) return;
    setDialog({ kind: "new-from-cart" });
  };

  const suggestedCartName = () =>
    `Cart · ${new Date().toLocaleDateString("en-KE", { day: "numeric", month: "short" })}`;

  // Loading state — keep the shell so back-nav feels fast.
  const showSpinner = isInitializing || (isAuthenticated && listsQuery.isLoading);

  return (
    <AppShell>
      <div className="px-4">
        <BrowseHeader title="Saved lists" back="/" />

        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={openNewEmpty}
            className="inline-flex items-center gap-2 rounded-full border border-dashed border-divider bg-surface px-4 py-2.5 text-[13px] font-semibold text-ink"
          >
            <ListPlus className="h-4 w-4" />
            New list
          </button>

          {cartLines.length > 0 && (
            <button
              type="button"
              onClick={openNewFromCart}
              className="inline-flex items-center gap-2 rounded-full bg-ink px-4 py-2.5 text-[13px] font-semibold text-background"
            >
              <ShoppingBag className="h-4 w-4" />
              Save current cart · {cartLines.length}
            </button>
          )}
        </div>

        {!isInitializing && !isAuthenticated ? (
          <div className="mt-10 rounded-2xl border border-dashed border-divider bg-surface py-10 text-center">
            <LogIn className="mx-auto h-6 w-6 text-ink-muted" />
            <p className="mt-3 text-[13px] font-semibold text-ink">Sign in to see your lists</p>
            <p className="mt-1 px-8 text-[12px] text-ink-muted">
              Saved lists are stored with your account so they stay put across devices and sessions.
            </p>
            <button
              type="button"
              onClick={() => navigate({ to: "/login", search: { next: "/lists" } })}
              className="mt-4 inline-flex items-center gap-2 rounded-full bg-ink px-4 py-2 text-[13px] font-semibold text-background"
            >
              Sign in
            </button>
          </div>
        ) : showSpinner ? (
          <ul className="mt-4 space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <li
                key={i}
                className="flex items-center gap-3 rounded-2xl border border-divider bg-surface p-4"
                aria-hidden="true"
              >
                <div className="h-11 w-11 rounded-full bg-muted" />
                <div className="flex-1 space-y-2">
                  <div className="h-3 w-1/2 rounded bg-muted" />
                  <div className="h-2.5 w-1/4 rounded bg-muted" />
                </div>
              </li>
            ))}
          </ul>
        ) : lists.length === 0 ? (
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
              <ListRow
                key={l.id}
                list={l}
                onRename={() => setDialog({ kind: "rename", list: l })}
                onDelete={() => setDialog({ kind: "delete", list: l })}
              />
            ))}
          </ul>
        )}
      </div>

      <NameDialog
        open={dialog?.kind === "new-empty"}
        onOpenChange={(o) => (o ? null : setDialog(null))}
        title="Name your list"
        description="Group products you order regularly for one-tap reorders."
        label="List name"
        placeholder="Weekly essentials"
        defaultValue="Weekly essentials"
        submitLabel="Create"
        pending={create.isPending && dialog?.kind === "new-empty"}
        onSubmit={(name) => create.mutate({ name, items: [] })}
      />

      <NameDialog
        open={dialog?.kind === "new-from-cart"}
        onOpenChange={(o) => (o ? null : setDialog(null))}
        title={`Save ${cartLines.length} cart item${cartLines.length === 1 ? "" : "s"} as a list`}
        description="This snapshots your cart — you can add to cart from the list anytime."
        label="List name"
        defaultValue={suggestedCartName()}
        submitLabel="Save list"
        pending={create.isPending && dialog?.kind === "new-from-cart"}
        onSubmit={(name) => create.mutate({ name, items: cartLines })}
      />

      <NameDialog
        open={dialog?.kind === "rename"}
        onOpenChange={(o) => (o ? null : setDialog(null))}
        title="Rename list"
        label="List name"
        defaultValue={dialog?.kind === "rename" ? dialog.list.name : ""}
        submitLabel="Rename"
        pending={rename.isPending}
        onSubmit={(name) => {
          if (dialog?.kind !== "rename") return;
          if (name === dialog.list.name) {
            setDialog(null);
            return;
          }
          rename.mutate({ id: dialog.list.id, name });
        }}
      />

      <ConfirmDialog
        open={dialog?.kind === "delete"}
        onOpenChange={(o) => (o ? null : setDialog(null))}
        title={dialog?.kind === "delete" ? `Delete "${dialog.list.name}"?` : "Delete list?"}
        description="This can't be undone. Items in the list are removed too — your cart is unaffected."
        confirmLabel="Delete list"
        pending={remove.isPending}
        onConfirm={() => {
          if (dialog?.kind !== "delete") return;
          remove.mutate({ id: dialog.list.id, name: dialog.list.name });
        }}
      />
    </AppShell>
  );
}

/**
 * A single row on the /lists index. Owns its own popover menu (rename /
 * delete). The menu is a tiny hand-rolled disclosure — no extra dep — that
 * closes on outside click or Escape.
 */
function ListRow({
  list,
  onRename,
  onDelete,
}: {
  list: SavedList;
  onRename: () => void;
  onDelete: () => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <li className="relative">
      <div className="flex items-center gap-3 rounded-2xl border border-divider bg-surface p-4">
        <Link
          to="/lists/$id"
          params={{ id: list.id }}
          className="flex flex-1 items-center gap-3 min-w-0"
        >
          <div className="flex -space-x-2">
            {list.items.slice(0, 3).map((it) => (
              <div
                key={it.productUnitId}
                className="h-11 w-11 overflow-hidden rounded-full border-2 border-surface bg-muted"
              >
                <img src={it.thumbnailUrl} alt="" className="h-full w-full object-cover" />
              </div>
            ))}
            {list.items.length === 0 && (
              <div className="grid h-11 w-11 place-items-center rounded-full border-2 border-surface bg-muted text-ink-muted">
                <ListPlus className="h-4 w-4" />
              </div>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[15px] font-semibold text-ink">{list.name}</p>
            <p className="mt-0.5 text-[12px] text-ink-muted">
              {list.items.length === 0
                ? "Empty"
                : `${list.items.length} item${list.items.length === 1 ? "" : "s"}`}
            </p>
          </div>
          <ChevronRight className="h-4 w-4 text-ink-muted" />
        </Link>

        <div ref={ref} className="relative">
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-label={`Actions for ${list.name}`}
            aria-haspopup="menu"
            aria-expanded={open}
            className="grid h-8 w-8 place-items-center rounded-full text-ink-muted hover:bg-muted hover:text-ink"
          >
            <MoreVertical className="h-4 w-4" />
          </button>
          {open && (
            <div
              role="menu"
              className="absolute right-0 top-full z-10 mt-1 w-40 overflow-hidden rounded-xl border border-divider bg-surface soft-shadow"
            >
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setOpen(false);
                  onRename();
                }}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-[13px] text-ink hover:bg-muted"
              >
                <Pencil className="h-4 w-4 text-ink-muted" /> Rename
              </button>
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setOpen(false);
                  onDelete();
                }}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-[13px] text-destructive hover:bg-muted"
              >
                <Trash2 className="h-4 w-4" /> Delete
              </button>
            </div>
          )}
        </div>
      </div>
    </li>
  );
}
