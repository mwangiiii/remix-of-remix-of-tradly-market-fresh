import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, Plus, Trash2, Save, X, CalendarClock, Package } from "lucide-react";
import { useCatalogStore, getEffectiveCatalog } from "../marketplace/store/catalogStore";
import { formatKes } from "../marketplace/lib/format";
import type { MarketplaceProduct, MarketplaceProductUnit, ScheduledPrice } from "../marketplace/types/marketplace";

export const Route = createFileRoute("/admin/catalog")({
  head: () => ({ meta: [{ title: "Catalog — Tradly Admin" }, { name: "robots", content: "noindex" }] }),
  component: CatalogAdmin,
});

const slugify = (s: string) =>
  s.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

const emptyUnit = (): MarketplaceProductUnit => ({
  id: `u-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
  unitLabel: "1 KG",
  unitQty: 1,
  isDefault: true,
  priceKes: 0,
  availability: "available",
});

function blank(categoryId: string): MarketplaceProduct {
  return {
    id: `cp-${Date.now()}`,
    categoryId,
    name: "",
    slug: "",
    description: "",
    origin: "",
    thumbnailUrl: "",
    galleryUrls: [],
    units: [emptyUnit()],
    isFeatured: false,
    keywords: [],
  };
}

function CatalogAdmin() {
  const version = useCatalogStore((s) => s.version);
  const upsertProduct = useCatalogStore((s) => s.upsertProduct);
  const deleteProduct = useCatalogStore((s) => s.deleteProduct);
  const scheduledPrices = useCatalogStore((s) => s.scheduledPrices);
  const schedulePrice = useCatalogStore((s) => s.schedulePrice);
  const removeScheduledPrice = useCatalogStore((s) => s.removeScheduledPrice);

  const { products, categories } = useMemo(() => getEffectiveCatalog(), [version]);
  const [editing, setEditing] = useState<MarketplaceProduct | null>(null);
  const [query, setQuery] = useState("");

  const filtered = products.filter((p) =>
    !query.trim() || p.name.toLowerCase().includes(query.toLowerCase()),
  );

  const openNew = () => setEditing(blank(categories[0]?.id ?? "c1"));

  const save = () => {
    if (!editing) return;
    if (!editing.name.trim()) return toast.error("Name required");
    const slug = editing.slug || slugify(editing.name);
    upsertProduct({ ...editing, slug, thumbnailUrl: editing.thumbnailUrl || editing.galleryUrls[0] || "" });
    toast.success("Saved");
    setEditing(null);
  };

  return (
    <div className="min-h-screen bg-background text-ink">
      <header className="sticky top-0 z-30 border-b border-trust-deep/40 bg-trust-deep text-trust-deep-foreground">
        <div className="mx-auto flex max-w-7xl items-center gap-4 px-6 py-3.5">
          <Link to="/admin" className="grid h-9 w-9 place-items-center rounded-full hover:bg-white/10" aria-label="Back">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] opacity-70">Tradly Admin</p>
            <h1 className="text-[15px] font-semibold">Catalog</h1>
          </div>
          <nav className="ml-auto hidden gap-1 text-[13px] font-medium md:flex">
            <Link to="/admin/catalog" className="rounded-full bg-white/15 px-3 py-1.5">Catalog</Link>
            <Link to="/admin/categories" className="rounded-full px-3 py-1.5 opacity-80 hover:bg-white/10">Categories</Link>
            <Link to="/admin/inventory" className="rounded-full px-3 py-1.5 opacity-80 hover:bg-white/10">Inventory</Link>
            <Link to="/admin/orders" className="rounded-full px-3 py-1.5 opacity-80 hover:bg-white/10">Orders</Link>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 pb-24 pt-6 md:px-6">
        <div className="flex flex-wrap items-center gap-3">
          <input
            value={query} onChange={(e) => setQuery(e.target.value)}
            placeholder="Search products…"
            className="min-w-56 flex-1 rounded-full border border-divider bg-surface px-4 py-2.5 text-[13px] focus:border-trust focus:outline-none focus:ring-2 focus:ring-trust/20"
          />
          <button
            onClick={openNew}
            className="inline-flex items-center gap-1.5 rounded-full bg-ink px-4 py-2.5 text-[13px] font-semibold text-background hover:bg-ink/90"
          >
            <Plus className="h-4 w-4" /> New product
          </button>
        </div>

        <section className="mt-5 overflow-hidden rounded-2xl border border-divider bg-surface">
          <table className="w-full text-left text-[13px]">
            <thead className="border-b border-divider bg-background/60 text-[11px] uppercase tracking-wide text-ink-muted">
              <tr>
                <th className="px-5 py-3 font-semibold">Product</th>
                <th className="px-3 py-3 font-semibold">Category</th>
                <th className="px-3 py-3 font-semibold">Units</th>
                <th className="px-3 py-3 text-right font-semibold">Default price</th>
                <th className="w-32 px-3 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((p) => {
                const def = p.units.find((u) => u.isDefault) ?? p.units[0];
                return (
                  <tr key={p.id} className="border-b border-divider last:border-b-0 hover:bg-background/40">
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 shrink-0 overflow-hidden rounded-lg bg-muted">
                          {p.thumbnailUrl && <img src={p.thumbnailUrl} alt="" className="h-full w-full object-cover" />}
                        </div>
                        <div>
                          <p className="font-semibold text-ink">{p.name}</p>
                          <p className="text-[11px] text-ink-muted">{p.slug}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-3 text-ink-muted">{categories.find((c) => c.id === p.categoryId)?.name}</td>
                    <td className="px-3 py-3 text-ink-muted">{p.units.length}</td>
                    <td className="px-3 py-3 text-right font-medium tabular-nums text-ink">{formatKes(def.priceKes)}</td>
                    <td className="px-3 py-3 text-right">
                      <div className="flex justify-end gap-1">
                        <button
                          onClick={() => setEditing({ ...p, units: [...p.units], galleryUrls: [...p.galleryUrls] })}
                          className="rounded-full border border-divider bg-background px-3 py-1 text-[12px] font-semibold text-ink hover:border-ink/40"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => { if (confirm(`Delete ${p.name}?`)) { deleteProduct(p.id); toast.success("Deleted"); } }}
                          className="grid h-7 w-7 place-items-center rounded-full text-ink-muted hover:bg-destructive/10 hover:text-destructive"
                          aria-label="Delete"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr><td colSpan={5} className="px-5 py-14 text-center text-ink-muted">No products match.</td></tr>
              )}
            </tbody>
          </table>
        </section>

        <p className="mt-3 flex items-center gap-1.5 text-[11px] text-ink-muted">
          <Package className="h-3.5 w-3.5" /> Edits are stored client-side for this demo.
        </p>
      </main>

      {editing && (
        <ProductEditor
          value={editing}
          categories={categories}
          scheduledPrices={scheduledPrices}
          onChange={setEditing}
          onSave={save}
          onClose={() => setEditing(null)}
          onSchedule={(entry) => { schedulePrice(entry); toast.success("Price scheduled"); }}
          onRemoveSchedule={(id) => removeScheduledPrice(id)}
        />
      )}
    </div>
  );
}

function ProductEditor({
  value, categories, scheduledPrices,
  onChange, onSave, onClose, onSchedule, onRemoveSchedule,
}: {
  value: MarketplaceProduct;
  categories: { id: string; name: string }[];
  scheduledPrices: ScheduledPrice[];
  onChange: (p: MarketplaceProduct) => void;
  onSave: () => void;
  onClose: () => void;
  onSchedule: (entry: Omit<ScheduledPrice, "id">) => void;
  onRemoveSchedule: (id: string) => void;
}) {
  const [gallery, setGallery] = useState<string>("");
  const [schedUnit, setSchedUnit] = useState(value.units[0]?.id ?? "");
  const [schedPrice, setSchedPrice] = useState<number>(value.units[0]?.priceKes ?? 0);
  const [schedFrom, setSchedFrom] = useState(new Date().toISOString().slice(0, 10));

  const set = (patch: Partial<MarketplaceProduct>) => onChange({ ...value, ...patch });
  const setUnit = (id: string, patch: Partial<MarketplaceProductUnit>) =>
    onChange({ ...value, units: value.units.map((u) => (u.id === id ? { ...u, ...patch } : u)) });

  const addGalleryImage = () => {
    if (!gallery.trim()) return;
    const list = [...value.galleryUrls, gallery.trim()];
    onChange({ ...value, galleryUrls: list, thumbnailUrl: value.thumbnailUrl || list[0] });
    setGallery("");
  };

  const schedulesForUnit = (unitId: string) =>
    scheduledPrices
      .filter((s) => s.productUnitId === unitId)
      .sort((a, b) => a.effectiveFrom.localeCompare(b.effectiveFrom));

  return (
    <div className="fixed inset-0 z-50 flex bg-black/50" onClick={onClose}>
      <div
        className="ml-auto flex h-full w-full max-w-2xl flex-col bg-background shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-center justify-between border-b border-divider bg-surface px-6 py-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-muted">
              {value.id.startsWith("cp-") ? "New product" : "Edit product"}
            </p>
            <h2 className="text-[17px] font-semibold text-ink">{value.name || "Untitled"}</h2>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={onSave} className="inline-flex items-center gap-1.5 rounded-full bg-ink px-4 py-2 text-[13px] font-semibold text-background hover:bg-ink/90">
              <Save className="h-3.5 w-3.5" /> Save
            </button>
            <button onClick={onClose} className="grid h-9 w-9 place-items-center rounded-full text-ink-muted hover:bg-muted"><X className="h-5 w-5" /></button>
          </div>
        </header>

        <div className="flex-1 space-y-6 overflow-y-auto px-6 py-5">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Name"><input value={value.name} onChange={(e) => set({ name: e.target.value })} className={inputCls} /></Field>
            <Field label="Slug"><input value={value.slug} onChange={(e) => set({ slug: e.target.value })} placeholder="auto from name" className={inputCls} /></Field>
            <Field label="Category">
              <select value={value.categoryId} onChange={(e) => set({ categoryId: e.target.value })} className={inputCls}>
                {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </Field>
            <Field label="Origin"><input value={value.origin ?? ""} onChange={(e) => set({ origin: e.target.value })} className={inputCls} /></Field>
          </div>

          <Field label="Description">
            <textarea value={value.description} onChange={(e) => set({ description: e.target.value })} rows={3} className={inputCls} />
          </Field>

          <label className="flex items-center gap-2 text-[13px] text-ink">
            <input type="checkbox" checked={value.isFeatured} onChange={(e) => set({ isFeatured: e.target.checked })} />
            Feature on home
          </label>

          {/* Images */}
          <section>
            <p className="mb-2 text-[12px] font-semibold uppercase tracking-wide text-ink-muted">Images</p>
            <div className="grid grid-cols-4 gap-2">
              {value.galleryUrls.map((url, i) => (
                <div key={`${url}-${i}`} className="group relative aspect-square overflow-hidden rounded-lg border border-divider bg-muted">
                  <img src={url} alt="" className="h-full w-full object-cover" />
                  {i === 0 && <span className="absolute left-1 top-1 rounded bg-ink/80 px-1.5 py-0.5 text-[9px] font-bold uppercase text-background">Main</span>}
                  <button
                    onClick={() => {
                      const next = value.galleryUrls.filter((_, j) => j !== i);
                      onChange({ ...value, galleryUrls: next, thumbnailUrl: next[0] ?? "" });
                    }}
                    className="absolute right-1 top-1 hidden h-6 w-6 place-items-center rounded-full bg-black/60 text-white group-hover:grid"
                    aria-label="Remove"
                  ><X className="h-3 w-3" /></button>
                </div>
              ))}
            </div>
            <div className="mt-2 flex gap-2">
              <input value={gallery} onChange={(e) => setGallery(e.target.value)} placeholder="Paste image URL" className={inputCls} />
              <button onClick={addGalleryImage} className="rounded-full bg-ink px-4 py-2 text-[12px] font-semibold text-background">Add</button>
            </div>
            <p className="mt-1 text-[11px] text-ink-muted">First image is the main thumbnail. Add several for the gallery.</p>
          </section>

          {/* Units */}
          <section>
            <div className="mb-2 flex items-center justify-between">
              <p className="text-[12px] font-semibold uppercase tracking-wide text-ink-muted">Packaging & pricing</p>
              <button
                onClick={() => onChange({ ...value, units: [...value.units, emptyUnit()] })}
                className="inline-flex items-center gap-1 text-[12px] font-semibold text-ink hover:underline"
              >
                <Plus className="h-3 w-3" /> Add unit
              </button>
            </div>
            <div className="space-y-2">
              {value.units.map((u) => (
                <div key={u.id} className="grid grid-cols-[1fr_80px_1fr_auto_auto] items-center gap-2 rounded-xl border border-divider bg-surface p-2.5">
                  <input value={u.unitLabel} onChange={(e) => setUnit(u.id, { unitLabel: e.target.value })} placeholder="Label (e.g. 10 KG Bag)" className={inputCls} />
                  <input type="number" value={u.unitQty} onChange={(e) => setUnit(u.id, { unitQty: Number(e.target.value) || 0 })} className={inputCls} />
                  <input type="number" value={u.priceKes} onChange={(e) => setUnit(u.id, { priceKes: Number(e.target.value) || 0 })} placeholder="Price KES" className={inputCls} />
                  <label className="flex items-center gap-1 text-[11px] font-medium text-ink-muted">
                    <input type="radio" name="default-unit" checked={u.isDefault} onChange={() => onChange({ ...value, units: value.units.map((x) => ({ ...x, isDefault: x.id === u.id })) })} />
                    Default
                  </label>
                  <button
                    onClick={() => onChange({ ...value, units: value.units.filter((x) => x.id !== u.id) })}
                    disabled={value.units.length <= 1}
                    className="grid h-8 w-8 place-items-center rounded-full text-ink-muted hover:bg-destructive/10 hover:text-destructive disabled:opacity-30"
                    aria-label="Remove unit"
                  ><Trash2 className="h-3.5 w-3.5" /></button>
                </div>
              ))}
            </div>
          </section>

          {/* Price scheduler */}
          <section>
            <p className="mb-2 flex items-center gap-1.5 text-[12px] font-semibold uppercase tracking-wide text-ink-muted">
              <CalendarClock className="h-3.5 w-3.5" /> Effective-dated pricing
            </p>
            <div className="rounded-xl border border-divider bg-surface p-3">
              <div className="grid grid-cols-[1fr_120px_150px_auto] items-end gap-2">
                <Field label="Unit">
                  <select value={schedUnit} onChange={(e) => setSchedUnit(e.target.value)} className={inputCls}>
                    {value.units.map((u) => <option key={u.id} value={u.id}>{u.unitLabel}</option>)}
                  </select>
                </Field>
                <Field label="New price">
                  <input type="number" value={schedPrice} onChange={(e) => setSchedPrice(Number(e.target.value) || 0)} className={inputCls} />
                </Field>
                <Field label="Effective from">
                  <input type="date" value={schedFrom} onChange={(e) => setSchedFrom(e.target.value)} className={inputCls} />
                </Field>
                <button
                  onClick={() => onSchedule({ productUnitId: schedUnit, priceKes: schedPrice, effectiveFrom: schedFrom })}
                  className="rounded-full bg-trust px-4 py-2 text-[12px] font-semibold text-trust-foreground"
                >
                  Schedule
                </button>
              </div>

              <div className="mt-3 space-y-1.5">
                {value.units.flatMap((u) => schedulesForUnit(u.id).map((sp) => ({ u, sp }))).map(({ u, sp }) => (
                  <div key={sp.id} className="flex items-center justify-between rounded-lg bg-background px-3 py-2 text-[12px]">
                    <span className="text-ink-muted">
                      <span className="font-semibold text-ink">{u.unitLabel}</span> → <span className="font-semibold text-ink">{formatKes(sp.priceKes)}</span> from {sp.effectiveFrom}
                    </span>
                    <button onClick={() => onRemoveSchedule(sp.id)} className="text-ink-muted hover:text-destructive">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
                {scheduledPrices.filter((s) => value.units.some((u) => u.id === s.productUnitId)).length === 0 && (
                  <p className="text-[11px] text-ink-muted">No scheduled price changes for this product.</p>
                )}
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

const inputCls =
  "w-full rounded-lg border border-divider bg-background px-2.5 py-1.5 text-[13px] text-ink focus:border-trust focus:outline-none focus:ring-2 focus:ring-trust/20";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-ink-muted">{label}</span>
      {children}
    </label>
  );
}
