import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { format } from "date-fns";
import {
  ArrowLeft, Package, Search, ShieldCheck, History, X,
  ArrowDownRight, ArrowUpRight, CheckCircle2, SlidersHorizontal,
} from "lucide-react";
import {
  adminListProducts,
  adminListCategories,
  adminListInventory,
  adminListMovements,
  adminUpsertInventory,
  type InventoryMovementRow,
  type InventoryRow,
} from "../marketplace/api/adminCatalog";
import { RequireAdmin } from "@/components/RequireAdmin";
import { formatKes } from "../marketplace/lib/format";
import type { MarketplaceProductUnit } from "../marketplace/types/marketplace";

export const Route = createFileRoute("/admin/inventory")({
  head: () => ({
    meta: [
      { title: "Inventory — Tradly Admin" },
      { name: "description", content: "Manage marketplace stock levels, reservations and availability status across all products." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: () => (
    <RequireAdmin>
      <InventoryAdmin />
    </RequireAdmin>
  ),
});

type AvailabilityFilter = MarketplaceProductUnit["availability"] | "all";

const AVAILABILITY_META: Record<
  MarketplaceProductUnit["availability"],
  { label: string; tone: string }
> = {
  available:    { label: "Available",    tone: "bg-farm/12 text-farm border-farm/30" },
  low_stock:    { label: "Low stock",    tone: "bg-ripe/15 text-[oklch(0.42_0.11_65)] border-ripe/40" },
  seasonal:     { label: "Seasonal",     tone: "bg-ripe/15 text-[oklch(0.42_0.11_65)] border-ripe/40" },
  out_of_stock: { label: "Out of stock", tone: "bg-destructive/12 text-destructive border-destructive/30" },
};

function InventoryAdmin() {
  const qc = useQueryClient();

  const { data: products = [] } = useQuery({
    queryKey: ["admin", "products"],
    queryFn: adminListProducts,
  });
  const { data: categories = [] } = useQuery({
    queryKey: ["admin", "categories"],
    queryFn: adminListCategories,
  });
  const { data: inventory = {}, isLoading: invLoading } = useQuery({
    queryKey: ["admin", "inventory"],
    queryFn: adminListInventory,
  });

  const upsert = useMutation({
    mutationFn: adminUpsertInventory,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin", "inventory"] }),
    onError: (e: Error) => toast.error(e.message ?? "Save failed"),
  });

  const [query, setQuery] = useState("");
  const [categoryId, setCategoryId] = useState<string | "all">("all");
  const [availabilityFilter, setAvailabilityFilter] = useState<AvailabilityFilter>("all");
  const [logUnit, setLogUnit] = useState<{ unitId: string; productName: string; unitLabel: string } | null>(null);

  // Local unsaved edits — flush on blur to avoid a network round-trip per keystroke.
  const [pending, setPending] = useState<Record<string, { onHand?: number; reserved?: number }>>({});

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return products
      .filter((p) => categoryId === "all" || p.categoryId === categoryId)
      .filter((p) => !q || p.name.toLowerCase().includes(q) || p.slug.includes(q))
      .flatMap((p) =>
        p.units.map((u) => {
          const rec = inventory[u.id];
          return { product: p, unit: u, rec };
        }),
      )
      .filter(({ unit }) =>
        availabilityFilter === "all" || unit.availability === availabilityFilter,
      );
  }, [products, inventory, query, categoryId, availabilityFilter]);

  const totals = useMemo(() => {
    const rowsAll = products.flatMap((p) => p.units.map((u) => ({ u, rec: inventory[u.id] })));
    const onHand = rowsAll.reduce((s, x) => s + (x.rec?.onHand ?? 0), 0);
    const reserved = rowsAll.reduce((s, x) => s + (x.rec?.reserved ?? 0), 0);
    return {
      units: rowsAll.length,
      onHand,
      reserved,
      available: rowsAll.filter((x) => x.u.availability === "available").length,
      low: rowsAll.filter((x) => x.u.availability === "low_stock").length,
      out: rowsAll.filter((x) => x.u.availability === "out_of_stock").length,
    };
  }, [products, inventory]);

  const effective = (unitId: string, key: "onHand" | "reserved", rec?: InventoryRow) => {
    const p = pending[unitId]?.[key];
    if (p !== undefined) return p;
    return rec?.[key] ?? 0;
  };

  const stagePending = (unitId: string, key: "onHand" | "reserved", value: number) => {
    setPending((s) => ({ ...s, [unitId]: { ...s[unitId], [key]: value } }));
  };

  const flush = (unitId: string) => {
    const patch = pending[unitId];
    if (!patch) return;
    const current = inventory[unitId];
    const next = {
      productUnitId: unitId,
      onHand: patch.onHand ?? current?.onHand ?? 0,
      reserved: patch.reserved ?? current?.reserved ?? 0,
    };
    // Client-side guard so we don't fire an obviously-invalid request that
    // will just get rejected by the reserved<=onHand check constraint.
    if (next.reserved > next.onHand) {
      toast.error("Reserved cannot exceed on-hand");
      setPending((s) => {
        const { [unitId]: _, ...rest } = s;
        return rest;
      });
      return;
    }
    upsert.mutate(next, {
      onSuccess: () =>
        setPending((s) => {
          const { [unitId]: _, ...rest } = s;
          return rest;
        }),
    });
  };

  return (
    <div className="min-h-screen bg-background text-ink">
      <header className="sticky top-0 z-30 border-b border-trust-deep/40 bg-trust-deep text-trust-deep-foreground">
        <div className="mx-auto flex max-w-6xl items-center gap-4 px-6 py-3.5">
          <Link to="/admin" className="grid h-9 w-9 place-items-center rounded-full hover:bg-white/10" aria-label="Back to admin">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] opacity-70">Tradly Admin</p>
            <h1 className="text-[15px] font-semibold">Inventory</h1>
          </div>
          <nav className="ml-auto hidden gap-1 text-[13px] font-medium md:flex">
            <Link to="/admin/catalog" className="rounded-full px-3 py-1.5 opacity-80 hover:bg-white/10">Catalog</Link>
            <Link to="/admin/categories" className="rounded-full px-3 py-1.5 opacity-80 hover:bg-white/10">Categories</Link>
            <Link to="/admin/inventory" className="rounded-full bg-white/15 px-3 py-1.5">Inventory</Link>
            <Link to="/admin/orders" className="rounded-full px-3 py-1.5 opacity-80 hover:bg-white/10">Orders</Link>
          </nav>
          <div className="ml-3 hidden items-center gap-2 rounded-full bg-white/10 px-3 py-1.5 text-[12px] font-medium lg:flex">
            <ShieldCheck className="h-3.5 w-3.5" /> Sole supplier · Tradly Fresh Produce
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 pb-24 pt-6 md:px-6">
        <section className="grid grid-cols-2 gap-3 md:grid-cols-5">
          <Tile label="SKUs tracked" value={totals.units.toString()} />
          <Tile label="Units on hand" value={totals.onHand.toLocaleString("en-KE")} accent="farm" />
          <Tile label="Reserved" value={totals.reserved.toLocaleString("en-KE")} accent="trust" />
          <Tile label="Low stock" value={totals.low.toString()} accent="ripe" />
          <Tile label="Out of stock" value={totals.out.toString()} accent="danger" />
        </section>

        <section className="mt-6 flex flex-wrap items-center gap-3">
          <label className="relative flex min-w-64 flex-1 items-center">
            <Search className="pointer-events-none absolute left-3.5 h-4 w-4 text-ink-muted" />
            <input
              value={query} onChange={(e) => setQuery(e.target.value)}
              placeholder="Search product or SKU…"
              className="w-full rounded-full border border-divider bg-surface py-2.5 pl-10 pr-4 text-[13px] focus:border-trust focus:outline-none focus:ring-2 focus:ring-trust/20"
            />
          </label>
          <select
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value as typeof categoryId)}
            className="rounded-full border border-divider bg-surface px-3 py-2.5 text-[13px] font-medium text-ink focus:border-trust focus:outline-none"
          >
            <option value="all">All categories</option>
            {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <select
            value={availabilityFilter}
            onChange={(e) => setAvailabilityFilter(e.target.value as AvailabilityFilter)}
            className="rounded-full border border-divider bg-surface px-3 py-2.5 text-[13px] font-medium text-ink focus:border-trust focus:outline-none"
          >
            <option value="all">All statuses</option>
            <option value="available">Available</option>
            <option value="low_stock">Low stock</option>
            <option value="out_of_stock">Out of stock</option>
            <option value="seasonal">Seasonal</option>
          </select>
        </section>

        <section className="mt-5 overflow-hidden rounded-2xl border border-divider bg-surface">
          <div className="hidden md:block">
            <table className="w-full text-left text-[13px]">
              <thead className="border-b border-divider bg-background/60 text-[11px] uppercase tracking-wide text-ink-muted">
                <tr>
                  <th className="px-5 py-3 font-semibold">Product</th>
                  <th className="px-3 py-3 font-semibold">Unit</th>
                  <th className="px-3 py-3 text-right font-semibold">Price</th>
                  <th className="w-32 px-3 py-3 text-right font-semibold">On hand</th>
                  <th className="w-32 px-3 py-3 text-right font-semibold">Reserved</th>
                  <th className="w-24 px-3 py-3 text-right font-semibold">Remaining</th>
                  <th className="w-44 px-3 py-3 font-semibold">Availability</th>
                  <th className="w-10 px-3 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {rows.map(({ product, unit, rec }) => {
                  const onHand = effective(unit.id, "onHand", rec);
                  const reserved = effective(unit.id, "reserved", rec);
                  const remaining = Math.max(0, onHand - reserved);
                  const meta = AVAILABILITY_META[unit.availability];
                  return (
                    <tr key={unit.id} className="border-b border-divider last:border-b-0 hover:bg-background/40">
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 shrink-0 overflow-hidden rounded-lg bg-muted">
                            {product.thumbnailUrl && <img src={product.thumbnailUrl} alt="" className="h-full w-full object-cover" />}
                          </div>
                          <div className="min-w-0">
                            <p className="truncate font-semibold text-ink">{product.name}</p>
                            <p className="text-[11px] text-ink-muted">{categories.find((c) => c.id === product.categoryId)?.name}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-3 text-ink-muted">{unit.unitLabel}</td>
                      <td className="px-3 py-3 text-right font-medium tabular-nums text-ink">{formatKes(unit.priceKes)}</td>
                      <td className="px-3 py-3 text-right">
                        <NumberInput
                          value={onHand}
                          onChange={(v) => stagePending(unit.id, "onHand", v)}
                          onBlur={() => flush(unit.id)}
                        />
                      </td>
                      <td className="px-3 py-3 text-right">
                        <NumberInput
                          value={reserved}
                          tone="trust"
                          onChange={(v) => stagePending(unit.id, "reserved", v)}
                          onBlur={() => flush(unit.id)}
                        />
                      </td>
                      <td className="px-3 py-3 text-right font-bold tabular-nums text-farm">{remaining.toLocaleString("en-KE")}</td>
                      <td className="px-3 py-3">
                        <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold ${meta.tone}`}>
                          <span className="h-1.5 w-1.5 rounded-full bg-current" />
                          {meta.label}
                        </span>
                        <p className="mt-1 flex items-center gap-1 text-[10px] text-ink-muted">
                          <SlidersHorizontal className="h-3 w-3" /> Edit in Catalog
                        </p>
                      </td>
                      <td className="px-3 py-3 text-right">
                        <button
                          type="button"
                          onClick={() => setLogUnit({ unitId: unit.id, productName: product.name, unitLabel: unit.unitLabel })}
                          className="grid h-7 w-7 place-items-center rounded-full text-ink-muted hover:bg-muted hover:text-ink"
                          aria-label="View movement history"
                          title="Movement history"
                        >
                          <History className="h-3.5 w-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
                {!invLoading && rows.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-5 py-16 text-center text-sm text-ink-muted">
                      {products.length === 0
                        ? "No products yet — create a product to start tracking stock."
                        : "No SKUs match these filters."}
                    </td>
                  </tr>
                )}
                {invLoading && (
                  <tr><td colSpan={8} className="px-5 py-16 text-center text-sm text-ink-muted">Loading…</td></tr>
                )}
              </tbody>
            </table>
          </div>

          <ul className="divide-y divide-divider md:hidden">
            {rows.map(({ product, unit, rec }) => {
              const onHand = effective(unit.id, "onHand", rec);
              const reserved = effective(unit.id, "reserved", rec);
              const remaining = Math.max(0, onHand - reserved);
              const meta = AVAILABILITY_META[unit.availability];
              return (
                <li key={unit.id} className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="h-11 w-11 shrink-0 overflow-hidden rounded-lg bg-muted">
                      {product.thumbnailUrl && <img src={product.thumbnailUrl} alt="" className="h-full w-full object-cover" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[14px] font-semibold text-ink">{product.name}</p>
                      <p className="text-[11px] text-ink-muted">{unit.unitLabel} · {formatKes(unit.priceKes)}</p>
                    </div>
                    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${meta.tone}`}>
                      {meta.label}
                    </span>
                  </div>
                  <div className="mt-3 grid grid-cols-3 gap-2 text-[12px]">
                    <MobileField label="On hand">
                      <NumberInput full value={onHand} onChange={(v) => stagePending(unit.id, "onHand", v)} onBlur={() => flush(unit.id)} />
                    </MobileField>
                    <MobileField label="Reserved">
                      <NumberInput full tone="trust" value={reserved} onChange={(v) => stagePending(unit.id, "reserved", v)} onBlur={() => flush(unit.id)} />
                    </MobileField>
                    <MobileField label="Remaining">
                      <span className="block rounded-lg bg-farm/10 px-2 py-2 text-center font-bold tabular-nums text-farm">
                        {remaining.toLocaleString("en-KE")}
                      </span>
                    </MobileField>
                  </div>
                  <button
                    type="button"
                    onClick={() => setLogUnit({ unitId: unit.id, productName: product.name, unitLabel: unit.unitLabel })}
                    className="mt-3 inline-flex items-center gap-1.5 text-[12px] font-semibold text-trust"
                  >
                    <History className="h-3.5 w-3.5" /> Movement history
                  </button>
                </li>
              );
            })}
            {!invLoading && rows.length === 0 && (
              <li className="p-10 text-center text-sm text-ink-muted">No SKUs match.</li>
            )}
          </ul>
        </section>

        <p className="mt-4 flex items-center gap-2 text-[11px] text-ink-muted">
          <Package className="h-3.5 w-3.5" />
          Remaining = On-hand − Reserved. Availability is set on each unit in the Catalog editor.
        </p>
      </main>

      {logUnit && (
        <MovementLogModal
          title={`${logUnit.productName} · ${logUnit.unitLabel}`}
          unitId={logUnit.unitId}
          onClose={() => setLogUnit(null)}
        />
      )}
    </div>
  );
}

function MovementLogModal({
  title, unitId, onClose,
}: { title: string; unitId: string; onClose: () => void }) {
  const { data: events = [], isLoading } = useQuery({
    queryKey: ["admin", "movements", unitId],
    queryFn: () => adminListMovements(unitId),
  });
  return (
    <div className="fixed inset-0 z-50 flex bg-black/50" onClick={onClose}>
      <div className="ml-auto flex h-full w-full max-w-md flex-col bg-background shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <header className="flex items-center justify-between border-b border-divider bg-surface px-6 py-4">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-muted">Movement history</p>
            <h2 className="truncate text-[16px] font-semibold text-ink">{title}</h2>
          </div>
          <button onClick={onClose} className="grid h-9 w-9 place-items-center rounded-full text-ink-muted hover:bg-muted" aria-label="Close">
            <X className="h-5 w-5" />
          </button>
        </header>
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {isLoading ? (
            <p className="py-10 text-center text-[13px] text-ink-muted">Loading…</p>
          ) : events.length === 0 ? (
            <p className="py-10 text-center text-[13px] text-ink-muted">
              No movements yet. Events log when stock is adjusted, reserved (PO), released (cancel), or fulfilled (GRN).
            </p>
          ) : (
            <ol className="space-y-3">
              {events.map((e: InventoryMovementRow) => {
                const meta = MOVEMENT_META[e.movementType];
                const Icon = meta.icon;
                return (
                  <li key={e.id} className="flex gap-3 rounded-xl border border-divider bg-surface p-3">
                    <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-full ${meta.tone}`}>
                      <Icon className="h-4 w-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline justify-between gap-2">
                        <p className="text-[13px] font-semibold text-ink">
                          {meta.label}
                          <span className={`ml-2 font-bold tabular-nums ${meta.qtyTone}`}>
                            {meta.sign}{Math.abs(e.quantity)}
                          </span>
                        </p>
                        <span className="shrink-0 text-[11px] text-ink-muted">
                          {format(new Date(e.createdAt), "d MMM, HH:mm")}
                        </span>
                      </div>
                      <p className="mt-0.5 text-[12px] text-ink-muted">
                        {e.reference ? <span className="font-medium text-ink">{e.reference}</span> : "Manual"}
                        {e.note ? ` · ${e.note}` : ""}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ol>
          )}
        </div>
      </div>
    </div>
  );
}

const MOVEMENT_META = {
  adjust:  { label: "Adjusted",         sign: "±", tone: "bg-muted text-ink",          qtyTone: "text-ink",        icon: SlidersHorizontal },
  reserve: { label: "Reserved",         sign: "+", tone: "bg-trust/12 text-trust-deep", qtyTone: "text-trust-deep", icon: ArrowUpRight },
  release: { label: "Released",         sign: "−", tone: "bg-muted text-ink",           qtyTone: "text-ink",        icon: ArrowDownRight },
  fulfill: { label: "Fulfilled (GRN)",  sign: "−", tone: "bg-farm/15 text-farm",        qtyTone: "text-farm",       icon: CheckCircle2 },
} as const;

function Tile({ label, value, accent }: { label: string; value: string; accent?: "farm" | "trust" | "ripe" | "danger" }) {
  const tone =
    accent === "farm"   ? "text-farm" :
    accent === "trust"  ? "text-trust" :
    accent === "ripe"   ? "text-[oklch(0.55_0.14_65)]" :
    accent === "danger" ? "text-destructive" : "text-ink";
  return (
    <div className="rounded-2xl border border-divider bg-surface p-4">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-muted">{label}</p>
      <p className={`mt-1 text-2xl font-bold tabular-nums ${tone}`}>{value}</p>
    </div>
  );
}

function NumberInput({
  value, onChange, onBlur, tone = "ink", full = false,
}: {
  value: number;
  onChange: (v: number) => void;
  onBlur?: () => void;
  tone?: "ink" | "trust";
  full?: boolean;
}) {
  const color = tone === "trust" ? "text-trust" : "text-ink";
  return (
    <input
      type="number"
      inputMode="numeric"
      min={0}
      value={value}
      onChange={(e) => onChange(Number.parseFloat(e.target.value || "0") || 0)}
      onBlur={onBlur}
      className={`${full ? "w-full" : "w-24"} rounded-lg border border-divider bg-background px-2.5 py-1.5 text-right text-[13px] font-semibold tabular-nums ${color} focus:border-trust focus:outline-none focus:ring-2 focus:ring-trust/20`}
    />
  );
}

function MobileField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-ink-muted">{label}</span>
      {children}
    </label>
  );
}
