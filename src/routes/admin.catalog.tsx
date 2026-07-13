import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  ArrowLeft, Plus, Trash2, Save, X, CalendarClock, Package, Upload,
} from "lucide-react";
import {
  adminListProducts,
  adminListCategories,
  adminListSchedules,
  adminUpsertProduct,
  adminDeleteProduct,
  adminReplaceUnits,
  adminAddSchedule,
  adminRemoveSchedule,
  adminUploadImage,
  type AdminProduct,
  type UnitInput,
} from "../marketplace/api/adminCatalog";
import { RequireAdmin } from "@/components/RequireAdmin";
import { formatKes } from "../marketplace/lib/format";
import type {
  MarketplaceCategory,
  MarketplaceProductUnit,
  ScheduledPrice,
} from "../marketplace/types/marketplace";

export const Route = createFileRoute("/admin/catalog")({
  head: () => ({ meta: [{ title: "Catalog — Tradly Admin" }, { name: "robots", content: "noindex" }] }),
  component: () => (
    <RequireAdmin>
      <CatalogAdmin />
    </RequireAdmin>
  ),
});

const slugify = (s: string) =>
  s.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

/** New units get a client-generated placeholder id; adminReplaceUnits uses
 * upsert so rows with a fresh UUID land as inserts. */
function newUnitDraft(overrides: Partial<MarketplaceProductUnit> = {}): MarketplaceProductUnit {
  return {
    id: crypto.randomUUID(),
    unitLabel: "1 KG",
    unitQty: 1,
    isDefault: true,
    priceKes: 0,
    availability: "available",
    ...overrides,
  };
}

function blankDraft(categoryId: string): AdminProduct {
  return {
    id: crypto.randomUUID(),
    categoryId,
    name: "",
    slug: "",
    description: "",
    origin: undefined,
    thumbnailUrl: "",
    galleryUrls: [],
    units: [newUnitDraft()],
    isFeatured: false,
    keywords: [],
    published: false,
  };
}

/** effectivePriceFor mirrors the SQL function marketplace_effective_price. */
function effectivePriceFor(
  unitId: string,
  basePriceKes: number,
  schedules: ScheduledPrice[],
  onDate: string,
): number {
  const applicable = schedules
    .filter((s) => s.productUnitId === unitId && s.effectiveFrom <= onDate)
    .sort((a, b) => b.effectiveFrom.localeCompare(a.effectiveFrom));
  return applicable[0]?.priceKes ?? basePriceKes;
}

function CatalogAdmin() {
  const qc = useQueryClient();

  const { data: products = [], isLoading: productsLoading } = useQuery({
    queryKey: ["admin", "products"],
    queryFn: adminListProducts,
  });
  const { data: categories = [] } = useQuery({
    queryKey: ["admin", "categories"],
    queryFn: adminListCategories,
  });
  const { data: schedules = [] } = useQuery({
    queryKey: ["admin", "schedules"],
    queryFn: adminListSchedules,
  });

  const invalidateAll = () => {
    qc.invalidateQueries({ queryKey: ["admin", "products"] });
    qc.invalidateQueries({ queryKey: ["admin", "schedules"] });
    qc.invalidateQueries({ queryKey: ["products"] });
  };

  const [editing, setEditing] = useState<AdminProduct | null>(null);
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return products.filter((p) => !q || p.name.toLowerCase().includes(q) || p.slug.includes(q));
  }, [products, query]);

  const openNew = () => setEditing(blankDraft(categories[0]?.id ?? ""));

  const saveProduct = useMutation({
    mutationFn: async (p: AdminProduct) => {
      const slug = p.slug || slugify(p.name);
      const productId = await adminUpsertProduct({
        id: p.id,
        categoryId: p.categoryId,
        name: p.name,
        slug,
        description: p.description,
        origin: p.origin ?? null,
        thumbnailUrl: p.thumbnailUrl || p.galleryUrls[0] || null,
        galleryUrls: p.galleryUrls,
        keywords: p.keywords ?? [],
        isFeatured: p.isFeatured,
        published: p.published,
      });
      const unitPayload: UnitInput[] = p.units.map((u, i) => ({
        id: u.id,
        productId,
        unitLabel: u.unitLabel,
        unitQty: u.unitQty,
        isDefault: u.isDefault,
        priceKes: u.priceKes,
        availability: u.availability,
        displayOrder: i,
      }));
      await adminReplaceUnits(productId, unitPayload);
    },
    onSuccess: () => {
      invalidateAll();
      toast.success("Saved");
      setEditing(null);
    },
    onError: (e: Error) => toast.error(e.message ?? "Save failed"),
  });

  const deleteProduct = useMutation({
    mutationFn: adminDeleteProduct,
    onSuccess: () => {
      invalidateAll();
      toast.success("Deleted");
    },
    onError: (e: Error) => toast.error(e.message ?? "Delete failed"),
  });

  const addSchedule = useMutation({
    mutationFn: adminAddSchedule,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "schedules"] });
      toast.success("Price scheduled");
    },
    onError: (e: Error) => toast.error(e.message ?? "Could not schedule"),
  });

  const removeSchedule = useMutation({
    mutationFn: adminRemoveSchedule,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin", "schedules"] }),
    onError: (e: Error) => toast.error(e.message ?? "Delete failed"),
  });

  const save = () => {
    if (!editing) return;
    if (!editing.name.trim()) return toast.error("Name required");
    if (!editing.categoryId) return toast.error("Category required");
    if (editing.units.length === 0) return toast.error("At least one unit required");
    if (!editing.units.some((u) => u.isDefault))
      return toast.error("One unit must be the default");
    saveProduct.mutate(editing);
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
            disabled={categories.length === 0}
            className="inline-flex items-center gap-1.5 rounded-full bg-ink px-4 py-2.5 text-[13px] font-semibold text-background hover:bg-ink/90 disabled:opacity-50"
            title={categories.length === 0 ? "Create a category first" : undefined}
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
                <th className="px-3 py-3 font-semibold">Status</th>
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
                    <td className="px-3 py-3 text-ink-muted">{categories.find((c) => c.id === p.categoryId)?.name ?? "—"}</td>
                    <td className="px-3 py-3 text-ink-muted">{p.units.length}</td>
                    <td className="px-3 py-3 text-right font-medium tabular-nums text-ink">{def ? formatKes(def.priceKes) : "—"}</td>
                    <td className="px-3 py-3">
                      <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                        p.published ? "bg-farm/12 text-farm" : "bg-muted text-ink-muted"
                      }`}>
                        <span className="h-1.5 w-1.5 rounded-full bg-current" />
                        {p.published ? "Published" : "Draft"}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-right">
                      <div className="flex justify-end gap-1">
                        <button
                          onClick={() => setEditing({ ...p, units: [...p.units], galleryUrls: [...p.galleryUrls] })}
                          className="rounded-full border border-divider bg-background px-3 py-1 text-[12px] font-semibold text-ink hover:border-ink/40"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => { if (confirm(`Delete ${p.name}?`)) deleteProduct.mutate(p.id); }}
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
              {!productsLoading && filtered.length === 0 && (
                <tr><td colSpan={6} className="px-5 py-14 text-center text-ink-muted">
                  {products.length === 0 ? "No products yet — create the first one." : "No products match."}
                </td></tr>
              )}
              {productsLoading && (
                <tr><td colSpan={6} className="px-5 py-14 text-center text-ink-muted">Loading…</td></tr>
              )}
            </tbody>
          </table>
        </section>

        <p className="mt-3 flex items-center gap-1.5 text-[11px] text-ink-muted">
          <Package className="h-3.5 w-3.5" /> Only published products appear on market.tradly.co.ke.
        </p>
      </main>

      {editing && (
        <ProductEditor
          value={editing}
          categories={categories}
          scheduledPrices={schedules}
          onChange={setEditing}
          onSave={save}
          onClose={() => setEditing(null)}
          onSchedule={(entry) => addSchedule.mutate(entry)}
          onRemoveSchedule={(id) => removeSchedule.mutate(id)}
          saving={saveProduct.isPending}
        />
      )}
    </div>
  );
}

function ProductEditor({
  value, categories, scheduledPrices,
  onChange, onSave, onClose, onSchedule, onRemoveSchedule, saving,
}: {
  value: AdminProduct;
  categories: MarketplaceCategory[];
  scheduledPrices: ScheduledPrice[];
  onChange: (p: AdminProduct) => void;
  onSave: () => void;
  onClose: () => void;
  onSchedule: (entry: { productUnitId: string; priceKes: number; effectiveFrom: string }) => void;
  onRemoveSchedule: (id: string) => void;
  saving: boolean;
}) {
  const [gallery, setGallery] = useState<string>("");
  const [schedUnit, setSchedUnit] = useState(value.units[0]?.id ?? "");
  const [schedPrice, setSchedPrice] = useState<number>(value.units[0]?.priceKes ?? 0);
  const [schedFrom, setSchedFrom] = useState(new Date().toISOString().slice(0, 10));
  const [previewDate, setPreviewDate] = useState(new Date().toISOString().slice(0, 10));
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const set = (patch: Partial<AdminProduct>) => onChange({ ...value, ...patch });
  const setUnit = (id: string, patch: Partial<MarketplaceProductUnit>) =>
    onChange({ ...value, units: value.units.map((u) => (u.id === id ? { ...u, ...patch } : u)) });

  const addGalleryImage = () => {
    if (!gallery.trim()) return;
    const list = [...value.galleryUrls, gallery.trim()];
    onChange({ ...value, galleryUrls: list, thumbnailUrl: value.thumbnailUrl || list[0] });
    setGallery("");
  };

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const slug = value.slug || slugify(value.name || "unfiled");
      const url = await adminUploadImage(file, slug);
      const list = [...value.galleryUrls, url];
      onChange({ ...value, galleryUrls: list, thumbnailUrl: value.thumbnailUrl || url });
      toast.success("Image uploaded");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Upload failed";
      toast.error(msg);
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const schedulesForUnit = (unitId: string) =>
    scheduledPrices
      .filter((s) => s.productUnitId === unitId)
      .sort((a, b) => a.effectiveFrom.localeCompare(b.effectiveFrom));

  const setDefaultUnit = (id: string) =>
    onChange({ ...value, units: value.units.map((x) => ({ ...x, isDefault: x.id === id })) });

  return (
    <div className="fixed inset-0 z-50 flex bg-black/50" onClick={onClose}>
      <div
        className="ml-auto flex h-full w-full max-w-2xl flex-col bg-background shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-center justify-between border-b border-divider bg-surface px-6 py-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-muted">
              Edit product
            </p>
            <h2 className="text-[17px] font-semibold text-ink">{value.name || "Untitled"}</h2>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onSave}
              disabled={saving}
              className="inline-flex items-center gap-1.5 rounded-full bg-ink px-4 py-2 text-[13px] font-semibold text-background hover:bg-ink/90 disabled:opacity-60"
            >
              <Save className="h-3.5 w-3.5" /> {saving ? "Saving…" : "Save"}
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
            <Field label="Origin"><input value={value.origin ?? ""} onChange={(e) => set({ origin: e.target.value || undefined })} className={inputCls} /></Field>
          </div>

          <Field label="Description">
            <textarea value={value.description} onChange={(e) => set({ description: e.target.value })} rows={3} className={inputCls} />
          </Field>

          <div className="flex items-center gap-6 text-[13px] text-ink">
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={value.isFeatured} onChange={(e) => set({ isFeatured: e.target.checked })} />
              Feature on home
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={value.published} onChange={(e) => set({ published: e.target.checked })} />
              <span className="font-semibold">Published</span>
              <span className="text-ink-muted">(visible on the storefront)</span>
            </label>
          </div>

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

            <div className="mt-2 flex flex-wrap gap-2">
              <input value={gallery} onChange={(e) => setGallery(e.target.value)} placeholder="Paste image URL" className={inputCls + " flex-1 min-w-52"} />
              <button onClick={addGalleryImage} className="rounded-full bg-ink px-4 py-2 text-[12px] font-semibold text-background">Add URL</button>
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                disabled={uploading}
                className="inline-flex items-center gap-1.5 rounded-full border border-divider bg-surface px-4 py-2 text-[12px] font-semibold text-ink disabled:opacity-60"
              >
                <Upload className="h-3.5 w-3.5" /> {uploading ? "Uploading…" : "Upload file"}
              </button>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                onChange={handleFile}
                className="hidden"
              />
            </div>
            <p className="mt-1 text-[11px] text-ink-muted">
              First image is the main thumbnail. Uploads go to the marketplace-media bucket.
            </p>
          </section>

          {/* Units */}
          <section>
            <div className="mb-2 flex items-center justify-between">
              <p className="text-[12px] font-semibold uppercase tracking-wide text-ink-muted">Packaging & pricing</p>
              <button
                onClick={() => onChange({ ...value, units: [...value.units, newUnitDraft({ isDefault: value.units.length === 0 })] })}
                className="inline-flex items-center gap-1 text-[12px] font-semibold text-ink hover:underline"
              >
                <Plus className="h-3 w-3" /> Add unit
              </button>
            </div>
            <div className="space-y-2">
              {value.units.map((u) => (
                <div key={u.id} className="grid grid-cols-[1fr_80px_1fr_130px_auto_auto] items-center gap-2 rounded-xl border border-divider bg-surface p-2.5">
                  <input value={u.unitLabel} onChange={(e) => setUnit(u.id, { unitLabel: e.target.value })} placeholder="Label (e.g. 10 KG Bag)" className={inputCls} />
                  <input type="number" step="0.001" value={u.unitQty} onChange={(e) => setUnit(u.id, { unitQty: Number(e.target.value) || 0 })} className={inputCls} />
                  <input type="number" step="0.01" value={u.priceKes} onChange={(e) => setUnit(u.id, { priceKes: Number(e.target.value) || 0 })} placeholder="Price KES" className={inputCls} />
                  <select
                    value={u.availability}
                    onChange={(e) => setUnit(u.id, { availability: e.target.value as MarketplaceProductUnit["availability"] })}
                    className={inputCls}
                  >
                    <option value="available">Available</option>
                    <option value="low_stock">Low stock</option>
                    <option value="out_of_stock">Out of stock</option>
                    <option value="seasonal">Seasonal</option>
                  </select>
                  <label className="flex items-center gap-1 text-[11px] font-medium text-ink-muted">
                    <input type="radio" name="default-unit" checked={u.isDefault} onChange={() => setDefaultUnit(u.id)} />
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
                  onClick={() => {
                    if (!schedUnit) return toast.error("Save the product first, then schedule");
                    onSchedule({ productUnitId: schedUnit, priceKes: schedPrice, effectiveFrom: schedFrom });
                  }}
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

            <div className="mt-3 rounded-xl border border-divider bg-surface p-3">
              <div className="flex items-center justify-between gap-3">
                <p className="text-[12px] font-semibold text-ink">Price on date</p>
                <input
                  type="date"
                  value={previewDate}
                  onChange={(e) => setPreviewDate(e.target.value)}
                  className={inputCls + " w-[150px]"}
                />
              </div>
              <ul className="mt-2 divide-y divide-divider">
                {value.units.map((u) => {
                  const price = effectivePriceFor(u.id, u.priceKes, scheduledPrices, previewDate);
                  const isScheduled = price !== u.priceKes;
                  return (
                    <li key={u.id} className="flex items-center justify-between py-1.5 text-[12px]">
                      <span className="text-ink-muted">{u.unitLabel}</span>
                      <span className="flex items-baseline gap-2">
                        <span className={`font-semibold tabular-nums ${isScheduled ? "text-trust-deep" : "text-ink"}`}>
                          {formatKes(price)}
                        </span>
                        {isScheduled && (
                          <span className="rounded-full bg-trust/12 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-trust-deep">
                            Scheduled
                          </span>
                        )}
                      </span>
                    </li>
                  );
                })}
              </ul>
              <p className="mt-1 text-[11px] text-ink-muted">
                Preview mirrors the SQL function marketplace_effective_price the storefront uses.
              </p>
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
