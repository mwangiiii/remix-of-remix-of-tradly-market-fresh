import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, Plus, Trash2 } from "lucide-react";
import { useCatalogStore, getEffectiveCatalog } from "../marketplace/store/catalogStore";
import type { MarketplaceCategory } from "../marketplace/types/marketplace";

export const Route = createFileRoute("/admin/categories")({
  head: () => ({ meta: [{ title: "Categories — Tradly Admin" }, { name: "robots", content: "noindex" }] }),
  component: CategoriesAdmin,
});

function CategoriesAdmin() {
  const version = useCatalogStore((s) => s.version);
  const upsertCategory = useCatalogStore((s) => s.upsertCategory);
  const deleteCategory = useCatalogStore((s) => s.deleteCategory);

  const { categories, products } = useMemo(() => getEffectiveCatalog(), [version]);
  const [draft, setDraft] = useState<MarketplaceCategory | null>(null);

  const start = (c?: MarketplaceCategory) =>
    setDraft(c ?? { id: `cc-${Date.now()}`, name: "", slug: "", parentId: null, displayOrder: categories.length + 1 });

  return (
    <div className="min-h-screen bg-background text-ink">
      <header className="sticky top-0 z-30 border-b border-trust-deep/40 bg-trust-deep text-trust-deep-foreground">
        <div className="mx-auto flex max-w-5xl items-center gap-4 px-6 py-3.5">
          <Link to="/admin" className="grid h-9 w-9 place-items-center rounded-full hover:bg-white/10"><ArrowLeft className="h-5 w-5" /></Link>
          <div><p className="text-[11px] font-semibold uppercase tracking-[0.14em] opacity-70">Tradly Admin</p><h1 className="text-[15px] font-semibold">Categories</h1></div>
          <nav className="ml-auto hidden gap-1 text-[13px] font-medium md:flex">
            <Link to="/admin/catalog" className="rounded-full px-3 py-1.5 opacity-80 hover:bg-white/10">Catalog</Link>
            <Link to="/admin/categories" className="rounded-full bg-white/15 px-3 py-1.5">Categories</Link>
            <Link to="/admin/inventory" className="rounded-full px-3 py-1.5 opacity-80 hover:bg-white/10">Inventory</Link>
            <Link to="/admin/orders" className="rounded-full px-3 py-1.5 opacity-80 hover:bg-white/10">Orders</Link>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 pb-20 pt-6">
        <div className="flex items-center justify-between">
          <p className="text-[13px] text-ink-muted">{categories.length} categories</p>
          <button onClick={() => start()} className="inline-flex items-center gap-1.5 rounded-full bg-ink px-4 py-2 text-[13px] font-semibold text-background hover:bg-ink/90"><Plus className="h-4 w-4" /> New category</button>
        </div>

        <ul className="mt-5 overflow-hidden rounded-2xl border border-divider bg-surface">
          {categories.map((c) => {
            const count = products.filter((p) => p.categoryId === c.id).length;
            return (
              <li key={c.id} className="flex items-center justify-between gap-3 border-b border-divider px-5 py-4 last:border-b-0">
                <div>
                  <p className="text-[14px] font-semibold text-ink">{c.name}</p>
                  <p className="text-[11.5px] text-ink-muted">/{c.slug} · {count} products · order {c.displayOrder}</p>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => start(c)} className="rounded-full border border-divider px-3 py-1 text-[12px] font-semibold text-ink hover:border-ink/40">Edit</button>
                  <button
                    onClick={() => { if (count > 0) return toast.error("Move products first"); if (confirm(`Delete ${c.name}?`)) { deleteCategory(c.id); toast.success("Deleted"); } }}
                    className="grid h-8 w-8 place-items-center rounded-full text-ink-muted hover:bg-destructive/10 hover:text-destructive"
                  ><Trash2 className="h-3.5 w-3.5" /></button>
                </div>
              </li>
            );
          })}
        </ul>
      </main>

      {draft && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4" onClick={() => setDraft(null)}>
          <div className="w-full max-w-md rounded-2xl bg-surface p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-[16px] font-semibold text-ink">{draft.id.startsWith("cc-") ? "New" : "Edit"} category</h2>
            <div className="mt-4 space-y-3">
              <label className="block">
                <span className="text-[11px] font-medium uppercase tracking-wide text-ink-muted">Name</span>
                <input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} className="mt-1 w-full rounded-lg border border-divider bg-background px-3 py-2 text-[14px]" />
              </label>
              <label className="block">
                <span className="text-[11px] font-medium uppercase tracking-wide text-ink-muted">Slug</span>
                <input value={draft.slug} onChange={(e) => setDraft({ ...draft, slug: e.target.value })} placeholder="auto" className="mt-1 w-full rounded-lg border border-divider bg-background px-3 py-2 text-[14px]" />
              </label>
              <label className="block">
                <span className="text-[11px] font-medium uppercase tracking-wide text-ink-muted">Display order</span>
                <input type="number" value={draft.displayOrder} onChange={(e) => setDraft({ ...draft, displayOrder: Number(e.target.value) || 0 })} className="mt-1 w-full rounded-lg border border-divider bg-background px-3 py-2 text-[14px]" />
              </label>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button onClick={() => setDraft(null)} className="rounded-full border border-divider px-4 py-2 text-[13px] font-semibold text-ink">Cancel</button>
              <button
                onClick={() => {
                  if (!draft.name.trim()) return toast.error("Name required");
                  const slug = draft.slug || draft.name.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-");
                  upsertCategory({ ...draft, slug });
                  toast.success("Saved");
                  setDraft(null);
                }}
                className="rounded-full bg-ink px-4 py-2 text-[13px] font-semibold text-background"
              >Save</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
