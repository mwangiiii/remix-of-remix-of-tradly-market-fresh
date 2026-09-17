import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  ArrowLeft, Plus, Trash2, Save, X, Package, Upload,
} from "lucide-react";
import {
  adminListProducts,
  adminListCategories,
  adminUpsertProduct,
  adminDeleteProduct,
  adminReplaceUnits,
  adminUploadImage,
  adminWritePriceVersion,
  type AdminCategory,
  type AdminProduct,
  type UnitInput,
} from "../marketplace/api/adminCatalog";
import { RequireAdmin } from "@/components/RequireAdmin";
import { formatKes } from "../marketplace/lib/format";
import type {
  MarketplaceProductUnit,
  MarketplaceRoundingRule,
  MarketplaceTaxTreatment,
  SellMode,
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

/**
 * Platform-default markup used when neither the product nor its category
 * chain supplies one. Mirrors the constant baked into
 * fn_marketplace_resolve_defaults (tradly-flow migration
 * 20260910150000_marketplace_pricing_engine_rpcs.sql). Kept in sync by
 * convention — if the SQL constant changes, update here too.
 */
const PLATFORM_DEFAULT_MARKUP_PCT = 25;

/**
 * Client-side mirror of fn_marketplace_apply_rounding (same migration).
 * Powers the live shelf-price preview in the admin form. Server-side
 * write always re-applies the SQL function, so any drift is caught at
 * fn_marketplace_write_price_version — this is a UI convenience.
 */
function applyRounding(amount: number, rule: MarketplaceRoundingRule): number {
  if (!Number.isFinite(amount) || amount < 0) return 0;
  switch (rule) {
    case "exact":
      return Math.round(amount * 100) / 100;
    case "nearest_1":
      return Math.round(amount);
    case "nearest_5":
      return Math.round(amount / 5) * 5;
    case "nearest_10":
      return Math.round(amount / 10) * 10;
    case "charm_down":
      if (amount < 5) return Math.round(amount * 100) / 100;
      return Math.floor(amount / 5) * 5 - 0.05;
  }
}

const ROUNDING_LABEL: Record<MarketplaceRoundingRule, string> = {
  exact: "Exact",
  nearest_1: "Nearest 1",
  nearest_5: "Nearest 5",
  nearest_10: "Nearest 10",
  charm_down: "Charm (…95)",
};

const SELL_MODE_LABEL: Record<SellMode, string> = {
  by_weight: "By weight",
  by_piece: "By piece",
  by_pack: "By pack",
};

const BASE_UNITS_BY_MODE: Record<SellMode, string[]> = {
  by_weight: ["kg", "g", "l", "ml"],
  by_piece: ["piece"],
  by_pack: ["pack"],
};

/**
 * Payload the editor emits alongside the product upsert when the admin
 * checks "Update pricing" and fills the pricing block. Consumed by the
 * outer save mutation which routes it to fn_marketplace_write_price_version.
 */
export interface PricingSubmission {
  costRateKes: number;
  /** Provide EITHER markupPct OR shelfRateKes. If both, shelf wins. */
  markupPct?: number | null;
  shelfRateKes?: number | null;
  roundingRule?: MarketplaceRoundingRule | null;
  changeReason?: string;
}

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
    // Pricing engine defaults (spec §5). B-admin (Checkpoint B item 12)
    // will replace this legacy unit-based form with a sell-mode-aware one.
    // Until then, drafts land as by_piece/piece — the safest default that
    // satisfies the DB CHECK constraints.
    sellMode: "by_piece",
    baseUnit: "piece",
    minQty: 1,
    qtyStep: 1,
    avgUnitWeightKg: null,
    packContentsLabel: null,
    taxTreatment: null,
    currentPrice: null,
  };
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
  const invalidateAll = () => {
    qc.invalidateQueries({ queryKey: ["admin", "products"] });
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
    mutationFn: async ({
      product: p,
      pricing,
    }: {
      product: AdminProduct;
      pricing?: PricingSubmission;
    }) => {
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
        // Pricing engine columns (spec §5) — only present in the payload
        // when the editor set them, but a full-shape draft always includes
        // them so pass through unconditionally.
        sellMode: p.sellMode,
        baseUnit: p.baseUnit,
        minQty: p.minQty,
        qtyStep: p.qtyStep,
        avgUnitWeightKg: p.avgUnitWeightKg,
        packContentsLabel: p.packContentsLabel,
        taxTreatment: p.taxTreatment,
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
      // If the editor supplied a pricing update, write a new price version.
      // fn_marketplace_write_price_version closes the previous current row
      // and inserts a new one atomically. Fails loudly if e.g. cost is
      // missing or a bad rounding rule reaches it.
      if (pricing) {
        await adminWritePriceVersion({
          productId,
          costRateKes: pricing.costRateKes,
          markupPct: pricing.markupPct ?? null,
          shelfRateKes: pricing.shelfRateKes ?? null,
          roundingRule: pricing.roundingRule ?? null,
          changeReason: pricing.changeReason ?? null,
        });
      }
    },
    onSuccess: (_data, vars) => {
      invalidateAll();
      toast.success(vars.pricing ? "Saved · price updated" : "Saved");
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

  const save = (pricing?: PricingSubmission) => {
    if (!editing) return;
    if (!editing.name.trim()) return toast.error("Name required");
    if (!editing.categoryId) return toast.error("Category required");
    if (editing.units.length === 0) return toast.error("At least one unit required");
    if (!editing.units.some((u) => u.isDefault))
      return toast.error("One unit must be the default");
    saveProduct.mutate({ product: editing, pricing });
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
                <th className="px-3 py-3 font-semibold">Sell mode</th>
                <th className="px-3 py-3 text-right font-semibold">Shelf price</th>
                <th className="px-3 py-3 font-semibold">Status</th>
                <th className="w-32 px-3 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((p) => {
                const def = p.units.find((u) => u.isDefault) ?? p.units[0];
                const shelf = p.currentPrice?.shelfRateKes ?? def?.priceKes ?? null;
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
                    <td className="px-3 py-3 text-ink-muted">
                      {SELL_MODE_LABEL[p.sellMode]} <span className="text-[11px]">· {p.baseUnit}</span>
                    </td>
                    <td className="px-3 py-3 text-right font-medium tabular-nums text-ink">
                      {shelf != null ? formatKes(shelf) : "—"}
                      {!p.currentPrice && (
                        <span className="ml-1.5 text-[10px] font-semibold uppercase tracking-wide text-destructive">
                          Unpriced
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-3">
                      {/* Unpriced overrides Published/Draft — an unpriced
                          product is hidden from the storefront regardless
                          of published flag (spec §6.3 enforced by the
                          !inner join in marketplaceApi.getAllProducts). */}
                      {!p.currentPrice ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-destructive/10 px-2 py-0.5 text-[11px] font-semibold text-destructive">
                          <span className="h-1.5 w-1.5 rounded-full bg-current" />
                          Unpriced · hidden
                        </span>
                      ) : (
                        <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                          p.published ? "bg-farm/12 text-farm" : "bg-muted text-ink-muted"
                        }`}>
                          <span className="h-1.5 w-1.5 rounded-full bg-current" />
                          {p.published ? "Published" : "Draft"}
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-3 text-right">
                      <div className="flex justify-end gap-1">
                        <Link
                          to="/admin/product/$id/prices"
                          params={{ id: p.id }}
                          className="rounded-full border border-divider bg-background px-3 py-1 text-[12px] font-semibold text-ink-muted hover:border-ink/40 hover:text-ink"
                          title="Price history"
                        >
                          History
                        </Link>
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
          onChange={setEditing}
          onSave={save}
          onClose={() => setEditing(null)}
          saving={saveProduct.isPending}
        />
      )}
    </div>
  );
}

function ProductEditor({
  value, categories,
  onChange, onSave, onClose, saving,
}: {
  value: AdminProduct;
  categories: AdminCategory[];
  onChange: (p: AdminProduct) => void;
  onSave: (pricing?: PricingSubmission) => void;
  onClose: () => void;
  saving: boolean;
}) {
  const [gallery, setGallery] = useState<string>("");
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // ── Pricing engine (spec §5) — additive block. Off by default for
  //    routine edits (so we don't write a new price version by accident),
  //    but FORCED ON for products that have no current price yet — those
  //    products are invisible on the storefront (marketplace_price_versions
  //    !inner join in marketplaceApi.getAllProducts drops them), and the
  //    only way out is to write a price version. Toggle is disabled while
  //    priceRequired holds.
  const priceRequired = !value.currentPrice;
  const [pricingEnabled, setPricingEnabled] = useState(priceRequired);
  const [costRate, setCostRate] = useState<number | "">("");
  const [markupPct, setMarkupPct] = useState<number | "">("");
  const [shelfRate, setShelfRate] = useState<number | "">("");
  /** Which side was last edited — determines what we send to the RPC. */
  const [pricingSide, setPricingSide] = useState<"markup" | "shelf">("markup");
  /** null means "inherit from the category cascade" — passed as NULL to the RPC. */
  const [roundingRule, setRoundingRule] = useState<MarketplaceRoundingRule | null>(null);
  const [changeReason, setChangeReason] = useState("");

  const set = (patch: Partial<AdminProduct>) => onChange({ ...value, ...patch });
  const setUnit = (id: string, patch: Partial<MarketplaceProductUnit>) =>
    onChange({ ...value, units: value.units.map((u) => (u.id === id ? { ...u, ...patch } : u)) });

  // ── Live pricing math (mirrors fn_marketplace_write_price_version) ────
  const activeCategory = categories.find((c) => c.id === value.categoryId) ?? null;
  const inheritedRounding: MarketplaceRoundingRule =
    activeCategory?.defaultRoundingRule ?? "nearest_5";
  const effectiveRounding: MarketplaceRoundingRule = roundingRule ?? inheritedRounding;
  const inheritedMarkupPct: number =
    activeCategory?.defaultMarkupPct ?? PLATFORM_DEFAULT_MARKUP_PCT;

  const costNum = typeof costRate === "number" ? costRate : 0;
  const markupNum = typeof markupPct === "number" ? markupPct : inheritedMarkupPct;

  // When "markup" side is authoritative, derive raw and shelf; when "shelf"
  // is authoritative, raw = shelf (no rounding on our end) and effective
  // markup back-computes.
  const derivedShelfFromMarkup = costNum > 0 ? applyRounding(costNum * (1 + markupNum / 100), effectiveRounding) : 0;
  const shelfNum = pricingSide === "shelf" && typeof shelfRate === "number" ? shelfRate : derivedShelfFromMarkup;
  const effectiveMarginPct = costNum > 0 ? ((shelfNum / costNum) - 1) * 100 : 0;

  // Sell-mode change → snap base_unit to the first allowed for that mode.
  const setSellMode = (mode: SellMode) => {
    const allowed = BASE_UNITS_BY_MODE[mode];
    const nextBase = allowed.includes(value.baseUnit) ? value.baseUnit : allowed[0];
    // by_pack requires a non-empty pack_contents_label (CHECK constraint).
    // Seed one if switching in with none, so save doesn't fail on constraint.
    const nextPackLabel =
      mode === "by_pack" && !value.packContentsLabel ? "pack" : value.packContentsLabel;
    // Piece/pack require integer qty_step >= 1.
    const nextStep = mode === "by_weight" ? value.qtyStep : Math.max(1, Math.floor(value.qtyStep));
    onChange({
      ...value,
      sellMode: mode,
      baseUnit: nextBase,
      qtyStep: nextStep,
      packContentsLabel: nextPackLabel,
    });
  };

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

  const setDefaultUnit = (id: string) =>
    onChange({ ...value, units: value.units.map((x) => ({ ...x, isDefault: x.id === id })) });

  const handleSubmit = () => {
    if (!pricingEnabled) {
      if (priceRequired) {
        // Defensive — the checkbox is disabled while priceRequired holds,
        // so this only trips if state somehow desyncs. Still worth the guard.
        toast.error("This product has no price yet — set cost + markup or shelf before saving");
        return;
      }
      onSave();
      return;
    }
    // Validate before we call save — the RPC will also enforce these but
    // failing early keeps the sheet open with clean state.
    if (costNum <= 0) {
      toast.error("Cost rate must be greater than 0");
      return;
    }
    if (pricingSide === "shelf" && (typeof shelfRate !== "number" || shelfRate <= 0)) {
      toast.error("Shelf price must be greater than 0");
      return;
    }
    if (pricingSide === "markup"
        && (typeof markupPct !== "number" || markupPct < 0)
        && activeCategory?.defaultMarkupPct == null) {
      toast.error("Enter a markup % — this category has no default to inherit");
      return;
    }
    const pricing: PricingSubmission = {
      costRateKes: costNum,
      // Send only the side the admin last touched. If they typed markup,
      // send markup and let the RPC round. If they typed shelf, send shelf
      // and let the RPC back-compute the effective margin.
      markupPct: pricingSide === "markup" ? (typeof markupPct === "number" ? markupPct : null) : null,
      shelfRateKes: pricingSide === "shelf" ? (typeof shelfRate === "number" ? shelfRate : null) : null,
      roundingRule: roundingRule, // null = inherit from category cascade
      changeReason: changeReason.trim() || undefined,
    };
    onSave(pricing);
  };

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
              onClick={handleSubmit}
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

          {/* ── Sell mode & quantity rules (spec §5.2, §5.7) ────────── */}
          <section className="rounded-2xl border border-divider bg-surface p-4">
            <p className="mb-2 text-[12px] font-semibold uppercase tracking-wide text-ink-muted">
              How is this sold?
            </p>
            <div className="grid grid-cols-3 gap-2">
              {(Object.keys(SELL_MODE_LABEL) as SellMode[]).map((mode) => {
                const active = value.sellMode === mode;
                return (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => setSellMode(mode)}
                    className={`rounded-xl border px-3 py-2 text-left text-[13px] transition-colors ${
                      active
                        ? "border-ink bg-ink text-background"
                        : "border-divider bg-background text-ink hover:border-ink/40"
                    }`}
                  >
                    <p className="font-semibold">{SELL_MODE_LABEL[mode]}</p>
                    <p className={`mt-0.5 text-[11px] ${active ? "text-background/80" : "text-ink-muted"}`}>
                      {mode === "by_weight" && "kg / g / litre"}
                      {mode === "by_piece" && "each"}
                      {mode === "by_pack" && "tray, bundle, pack"}
                    </p>
                  </button>
                );
              })}
            </div>

            <div className="mt-3 grid grid-cols-3 gap-3">
              <Field label="Base unit">
                <select
                  value={value.baseUnit}
                  onChange={(e) => set({ baseUnit: e.target.value })}
                  className={inputCls}
                >
                  {BASE_UNITS_BY_MODE[value.sellMode].map((u) => (
                    <option key={u} value={u}>{u}</option>
                  ))}
                </select>
              </Field>
              <Field label="Minimum order">
                <input
                  type="number"
                  step={value.sellMode === "by_weight" ? "0.001" : "1"}
                  min={value.sellMode === "by_weight" ? "0.001" : "1"}
                  value={value.minQty}
                  onChange={(e) => set({ minQty: Number(e.target.value) || 1 })}
                  className={inputCls}
                />
              </Field>
              <Field label="Step">
                <input
                  type="number"
                  step={value.sellMode === "by_weight" ? "0.001" : "1"}
                  min={value.sellMode === "by_weight" ? "0.001" : "1"}
                  value={value.qtyStep}
                  onChange={(e) => set({ qtyStep: Number(e.target.value) || 1 })}
                  className={inputCls}
                />
              </Field>
            </div>

            {value.sellMode !== "by_weight" && (
              <Field label={value.sellMode === "by_pack" ? "Pack contains" : "Typical weight (kg, display only)"}>
                {value.sellMode === "by_pack" ? (
                  <input
                    value={value.packContentsLabel ?? ""}
                    onChange={(e) => set({ packContentsLabel: e.target.value || null })}
                    placeholder="tray of 30"
                    className={inputCls}
                  />
                ) : (
                  <input
                    type="number"
                    step="0.01"
                    value={value.avgUnitWeightKg ?? ""}
                    onChange={(e) =>
                      set({ avgUnitWeightKg: e.target.value ? Number(e.target.value) : null })
                    }
                    className={inputCls}
                  />
                )}
              </Field>
            )}
          </section>

          {/* ── Pricing engine (spec §5.4-5.7) ─────────────────────── */}
          <section className="rounded-2xl border border-divider bg-surface p-4">
            <div className="mb-3 flex items-center justify-between">
              <p className="text-[12px] font-semibold uppercase tracking-wide text-ink-muted">
                Pricing
              </p>
              <label className={`flex items-center gap-2 text-[12px] font-medium ${
                priceRequired ? "text-ink-muted" : "text-ink"
              }`}>
                <input
                  type="checkbox"
                  checked={pricingEnabled}
                  disabled={priceRequired}
                  onChange={(e) => setPricingEnabled(e.target.checked)}
                />
                {priceRequired ? "Pricing required" : "Update pricing on save"}
              </label>
            </div>

            {priceRequired && (
              <p className="mb-3 rounded-xl bg-destructive/10 px-3 py-2 text-[12px] font-medium text-destructive">
                This product has no current price and is <strong>hidden from the
                storefront</strong>. Set cost + markup (or cost + shelf) below
                before saving.
              </p>
            )}

            {value.currentPrice && !pricingEnabled && (
              <div className="rounded-xl border border-divider bg-background p-3 text-[13px]">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-muted">
                  Current price
                </p>
                <p className="mt-1 font-semibold text-ink">
                  {formatKes(value.currentPrice.shelfRateKes)} <span className="text-ink-muted">/ {value.baseUnit}</span>
                </p>
                <p className="mt-0.5 text-[11px] text-ink-muted">
                  Cost {formatKes(value.currentPrice.costRateKes)} · Frozen markup{" "}
                  {value.currentPrice.effectiveMarkupPct}% · Rounded {ROUNDING_LABEL[value.currentPrice.roundingRule]}
                </p>
              </div>
            )}

            {pricingEnabled && (
              <div className="space-y-3">
                <Field label={`Cost per ${value.baseUnit}`}>
                  <input
                    type="number"
                    step="0.01"
                    value={costRate}
                    onChange={(e) =>
                      setCostRate(e.target.value === "" ? "" : Number(e.target.value))
                    }
                    placeholder="From consignment intake"
                    className={inputCls}
                  />
                </Field>

                <div className="grid grid-cols-2 gap-3">
                  <Field label="Markup %">
                    <input
                      type="number"
                      step="0.01"
                      value={markupPct}
                      onFocus={() => setPricingSide("markup")}
                      onChange={(e) => {
                        setPricingSide("markup");
                        setMarkupPct(e.target.value === "" ? "" : Number(e.target.value));
                      }}
                      placeholder={`inherits ${inheritedMarkupPct}%`}
                      className={inputCls}
                    />
                  </Field>
                  <Field label={`Shelf per ${value.baseUnit}`}>
                    <input
                      type="number"
                      step="0.01"
                      value={shelfRate}
                      onFocus={() => setPricingSide("shelf")}
                      onChange={(e) => {
                        setPricingSide("shelf");
                        setShelfRate(e.target.value === "" ? "" : Number(e.target.value));
                      }}
                      placeholder={
                        pricingSide === "markup" && costNum > 0
                          ? formatKes(derivedShelfFromMarkup)
                          : ""
                      }
                      className={inputCls}
                    />
                  </Field>
                </div>

                <div className="flex items-end gap-2">
                  <div className="flex-1">
                    <Field label="Rounding">
                      <select
                        value={roundingRule ?? "__inherit__"}
                        onChange={(e) =>
                          setRoundingRule(
                            e.target.value === "__inherit__"
                              ? null
                              : (e.target.value as MarketplaceRoundingRule),
                          )
                        }
                        className={inputCls}
                      >
                        <option value="__inherit__">
                          Inherit from category ({ROUNDING_LABEL[inheritedRounding]})
                        </option>
                        {(Object.keys(ROUNDING_LABEL) as MarketplaceRoundingRule[]).map((r) => (
                          <option key={r} value={r}>
                            {ROUNDING_LABEL[r]}
                          </option>
                        ))}
                      </select>
                    </Field>
                  </div>
                  {markupPct !== "" && activeCategory?.defaultMarkupPct != null && (
                    <button
                      type="button"
                      onClick={() => {
                        setMarkupPct(activeCategory.defaultMarkupPct!);
                        setPricingSide("markup");
                      }}
                      className="rounded-full border border-divider bg-background px-3 py-2 text-[11px] font-semibold text-ink hover:border-ink/40"
                    >
                      Use category default
                    </button>
                  )}
                </div>

                <div className="rounded-xl bg-background p-3 text-[13px]">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-muted">
                    Customer sees
                  </p>
                  <p className="mt-1 font-semibold text-ink">
                    {formatKes(shelfNum)} <span className="text-ink-muted">/ {value.baseUnit}</span>
                  </p>
                  <p className="mt-0.5 text-[11px] text-ink-muted">
                    Margin after rounding:{" "}
                    <span className={effectiveMarginPct < markupNum - 1 ? "text-destructive" : ""}>
                      {effectiveMarginPct.toFixed(2)}%
                    </span>
                  </p>
                </div>

                <Field label="Change reason (optional, appears in audit log)">
                  <input
                    value={changeReason}
                    onChange={(e) => setChangeReason(e.target.value)}
                    placeholder="e.g. supplier price hike, promotional launch"
                    className={inputCls}
                  />
                </Field>
              </div>
            )}
          </section>

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
