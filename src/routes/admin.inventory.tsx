import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { format } from "date-fns";
import {
  useInventoryStore,
  remainingOf,
  deriveStatus,
  type InventoryStatus,
  type InventoryEvent,
} from "../marketplace/store/inventoryStore";
import { products } from "../marketplace/mockData/products";
import { categories } from "../marketplace/mockData/categories";
import { formatKes } from "../marketplace/lib/format";
import {
  ArrowLeft, Package, Search, ShieldCheck, RotateCcw, History, X,
  ArrowDownRight, ArrowUpRight, CheckCircle2,
} from "lucide-react";

export const Route = createFileRoute("/admin/inventory")({
  head: () => ({
    meta: [
      { title: "Inventory — Tradly Admin" },
      { name: "description", content: "Manage marketplace stock levels, reservations and availability status across all products." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: InventoryAdmin,
});

const STATUSES: { value: InventoryStatus; label: string; tone: string }[] = [
  { value: "available",    label: "Available",    tone: "bg-farm/12 text-farm border-farm/30" },
  { value: "low_stock",    label: "Low stock",    tone: "bg-ripe/15 text-[oklch(0.42_0.11_65)] border-ripe/40" },
  { value: "seasonal",     label: "Seasonal",     tone: "bg-ripe/15 text-[oklch(0.42_0.11_65)] border-ripe/40" },
  { value: "out_of_stock", label: "Out of stock", tone: "bg-destructive/12 text-destructive border-destructive/30" },
];

const toneOf = (s: InventoryStatus) => STATUSES.find((x) => x.value === s)!.tone;
const labelOf = (s: InventoryStatus) => STATUSES.find((x) => x.value === s)!.label;

function InventoryAdmin() {
  const records = useInventoryStore((s) => s.records);
  const setAvailable = useInventoryStore((s) => s.setAvailable);
  const setReserved = useInventoryStore((s) => s.setReserved);
  const setStatus = useInventoryStore((s) => s.setStatus);

  const [query, setQuery] = useState("");
  const [categoryId, setCategoryId] = useState<string | "all">("all");
  const [statusFilter, setStatusFilter] = useState<InventoryStatus | "all">("all");

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return products
      .filter((p) => categoryId === "all" || p.categoryId === categoryId)
      .filter((p) => !q || p.name.toLowerCase().includes(q) || p.slug.includes(q))
      .flatMap((p) =>
        p.units.map((u) => {
          const rec = records[u.id] ?? { available: 0, reserved: 0, updatedAt: new Date().toISOString() };
          const status = deriveStatus(rec);
          return { product: p, unit: u, rec, status };
        }),
      )
      .filter((row) => statusFilter === "all" || row.status === statusFilter);
  }, [records, query, categoryId, statusFilter]);

  const totals = useMemo(() => {
    const all = Object.entries(records).map(([, r]) => ({ r, s: deriveStatus(r) }));
    return {
      units: all.length,
      available: all.filter((x) => x.s === "available").length,
      low: all.filter((x) => x.s === "low_stock").length,
      out: all.filter((x) => x.s === "out_of_stock").length,
      seasonal: all.filter((x) => x.s === "seasonal").length,
      onHand: all.reduce((sum, x) => sum + remainingOf(x.r), 0),
      reserved: all.reduce((sum, x) => sum + x.r.reserved, 0),
    };
  }, [records]);

  return (
    <div className="min-h-screen bg-background text-ink">
      {/* Admin trust-zone header, full-width (not the mobile shell) */}
      <header className="sticky top-0 z-30 border-b border-trust-deep/40 bg-trust-deep text-trust-deep-foreground">
        <div className="mx-auto flex max-w-6xl items-center gap-4 px-6 py-3.5">
          <Link to="/" className="grid h-9 w-9 place-items-center rounded-full hover:bg-white/10" aria-label="Back to marketplace">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] opacity-70">Tradly Admin</p>
            <h1 className="text-[15px] font-semibold">Inventory</h1>
          </div>
          <div className="ml-auto hidden items-center gap-2 rounded-full bg-white/10 px-3 py-1.5 text-[12px] font-medium md:flex">
            <ShieldCheck className="h-3.5 w-3.5" /> Sole supplier · Tradly Fresh Produce
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 pb-24 pt-6 md:px-6">
        {/* Summary tiles */}
        <section className="grid grid-cols-2 gap-3 md:grid-cols-5">
          <Tile label="SKUs tracked" value={totals.units.toString()} />
          <Tile label="Units on hand" value={totals.onHand.toLocaleString("en-KE")} accent="farm" />
          <Tile label="Reserved" value={totals.reserved.toLocaleString("en-KE")} accent="trust" />
          <Tile label="Low stock" value={totals.low.toString()} accent="ripe" />
          <Tile label="Out of stock" value={totals.out.toString()} accent="danger" />
        </section>

        {/* Controls */}
        <section className="mt-6 flex flex-wrap items-center gap-3">
          <label className="relative flex min-w-64 flex-1 items-center">
            <Search className="pointer-events-none absolute left-3.5 h-4 w-4 text-ink-muted" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
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
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
            className="rounded-full border border-divider bg-surface px-3 py-2.5 text-[13px] font-medium text-ink focus:border-trust focus:outline-none"
          >
            <option value="all">All statuses</option>
            {STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
        </section>

        {/* Table (desktop) / card list (mobile) */}
        <section className="mt-5 overflow-hidden rounded-2xl border border-divider bg-surface">
          {/* Desktop table */}
          <div className="hidden md:block">
            <table className="w-full text-left text-[13px]">
              <thead className="border-b border-divider bg-background/60 text-[11px] uppercase tracking-wide text-ink-muted">
                <tr>
                  <th className="px-5 py-3 font-semibold">Product</th>
                  <th className="px-3 py-3 font-semibold">Unit</th>
                  <th className="px-3 py-3 text-right font-semibold">Price</th>
                  <th className="w-32 px-3 py-3 text-right font-semibold">Available</th>
                  <th className="w-32 px-3 py-3 text-right font-semibold">Reserved</th>
                  <th className="w-24 px-3 py-3 text-right font-semibold">Remaining</th>
                  <th className="w-44 px-3 py-3 font-semibold">Status</th>
                  <th className="w-10 px-3 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {rows.map(({ product, unit, rec, status }) => {
                  const remaining = remainingOf(rec);
                  const pinned = Boolean(rec.statusOverride);
                  return (
                    <tr key={unit.id} className="border-b border-divider last:border-b-0 hover:bg-background/40">
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 shrink-0 overflow-hidden rounded-lg bg-muted">
                            <img src={product.thumbnailUrl} alt="" className="h-full w-full object-cover" />
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
                        <NumberInput value={rec.available} onChange={(v) => setAvailable(unit.id, v)} />
                      </td>
                      <td className="px-3 py-3 text-right">
                        <NumberInput value={rec.reserved} onChange={(v) => setReserved(unit.id, v)} tone="trust" />
                      </td>
                      <td className="px-3 py-3 text-right font-bold tabular-nums text-farm">{remaining.toLocaleString("en-KE")}</td>
                      <td className="px-3 py-3">
                        <StatusToggle
                          status={status}
                          pinned={pinned}
                          onChange={(next, pin) => {
                            setStatus(unit.id, pin ? next : null);
                            toast.success(`${product.name} · ${unit.unitLabel} → ${labelOf(next)}${pin ? " (locked)" : ""}`, { duration: 1600 });
                          }}
                        />
                      </td>
                      <td className="px-3 py-3 text-right">
                        {pinned && (
                          <button
                            type="button"
                            onClick={() => { setStatus(unit.id, null); toast.success("Status now auto-derived"); }}
                            className="grid h-7 w-7 place-items-center rounded-full text-ink-muted hover:bg-muted hover:text-ink"
                            aria-label="Reset to auto"
                            title="Reset to auto-derived status"
                          >
                            <RotateCcw className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
                {rows.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-5 py-16 text-center text-sm text-ink-muted">
                      No SKUs match these filters.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Mobile card list */}
          <ul className="divide-y divide-divider md:hidden">
            {rows.map(({ product, unit, rec, status }) => {
              const remaining = remainingOf(rec);
              const pinned = Boolean(rec.statusOverride);
              return (
                <li key={unit.id} className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="h-11 w-11 shrink-0 overflow-hidden rounded-lg bg-muted">
                      <img src={product.thumbnailUrl} alt="" className="h-full w-full object-cover" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[14px] font-semibold text-ink">{product.name}</p>
                      <p className="text-[11px] text-ink-muted">{unit.unitLabel} · {formatKes(unit.priceKes)}</p>
                    </div>
                    <StatusToggle
                      status={status} pinned={pinned}
                      onChange={(next, pin) => setStatus(unit.id, pin ? next : null)}
                      compact
                    />
                  </div>
                  <div className="mt-3 grid grid-cols-3 gap-2 text-[12px]">
                    <MobileField label="Available">
                      <NumberInput value={rec.available} onChange={(v) => setAvailable(unit.id, v)} full />
                    </MobileField>
                    <MobileField label="Reserved">
                      <NumberInput value={rec.reserved} onChange={(v) => setReserved(unit.id, v)} tone="trust" full />
                    </MobileField>
                    <MobileField label="Remaining">
                      <span className="block rounded-lg bg-farm/10 px-2 py-2 text-center font-bold tabular-nums text-farm">
                        {remaining.toLocaleString("en-KE")}
                      </span>
                    </MobileField>
                  </div>
                </li>
              );
            })}
            {rows.length === 0 && (
              <li className="p-10 text-center text-sm text-ink-muted">No SKUs match these filters.</li>
            )}
          </ul>
        </section>

        <p className="mt-4 flex items-center gap-2 text-[11px] text-ink-muted">
          <Package className="h-3.5 w-3.5" />
          Remaining = Available − Reserved. Status auto-derives (Out of stock at 0, Low stock at ≤ 25) unless pinned.
        </p>
      </main>
    </div>
  );
}

/* ---------- helpers ---------- */

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
  value, onChange, tone = "ink", full = false,
}: { value: number; onChange: (v: number) => void; tone?: "ink" | "trust"; full?: boolean }) {
  const color = tone === "trust" ? "text-trust" : "text-ink";
  return (
    <input
      type="number"
      inputMode="numeric"
      min={0}
      value={value}
      onChange={(e) => onChange(Number.parseInt(e.target.value || "0", 10))}
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

function StatusToggle({
  status, pinned, onChange, compact = false,
}: {
  status: InventoryStatus;
  pinned: boolean;
  onChange: (next: InventoryStatus, pin: boolean) => void;
  compact?: boolean;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        onBlur={() => setTimeout(() => setOpen(false), 120)}
        className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold ${toneOf(status)} ${compact ? "" : "min-w-32 justify-between"}`}
      >
        <span className="flex items-center gap-1.5">
          <span className="h-1.5 w-1.5 rounded-full bg-current" />
          {labelOf(status)}
        </span>
        {pinned && <span className="text-[9px] font-bold uppercase tracking-wide opacity-70">Pinned</span>}
      </button>
      {open && (
        <div className="absolute right-0 top-full z-20 mt-1 w-44 rounded-xl border border-divider bg-surface p-1 shadow-lg">
          {STATUSES.map((s) => (
            <button
              key={s.value}
              type="button"
              onMouseDown={(e) => { e.preventDefault(); onChange(s.value, true); setOpen(false); }}
              className={`flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-[12px] font-medium hover:bg-background ${
                s.value === status ? "text-ink" : "text-ink-muted"
              }`}
            >
              <span className={`h-2 w-2 rounded-full ${s.tone.split(" ")[0]}`} />
              {s.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
