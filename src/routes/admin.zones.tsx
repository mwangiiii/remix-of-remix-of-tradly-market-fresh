// Admin: delivery zones CRUD (plan D-admin-zones).
//
// Ops uses this to add zones, edit fees + cutoffs, and (de)activate coverage
// areas without needing to write SQL. Backed by marketplace_delivery_zones;
// gated by the platform_super_admin RLS policy on the table + RequireAdmin
// on the route.

import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowLeft, MapPin, Plus, Save, Trash2, X } from "lucide-react";
import { RequireAdmin } from "@/components/RequireAdmin";
import {
  type DeliveryZoneInput,
  adminDeleteDeliveryZone,
  adminListDeliveryZones,
  adminUpsertDeliveryZone,
} from "../marketplace/api/delivery";
import { formatKes } from "../marketplace/lib/format";
import type { DeliveryZone, DistanceBand } from "../marketplace/types/marketplace";

export const Route = createFileRoute("/admin/zones")({
  head: () => ({
    meta: [{ title: "Delivery zones — Tradly Admin" }, { name: "robots", content: "noindex" }],
  }),
  component: () => (
    <RequireAdmin>
      <ZonesAdmin />
    </RequireAdmin>
  ),
});

function blankDraft(nextSortOrder: number): DeliveryZoneInput {
  return {
    name: "",
    county: "Nairobi",
    areas: [],
    customerFeeKes: 200,
    defaultDistanceBand: "short",
    sameDayCutoffTime: "14:00",
    isActive: true,
    sortOrder: nextSortOrder,
  };
}

function fromZone(z: DeliveryZone): DeliveryZoneInput {
  return {
    id: z.id,
    name: z.name,
    county: z.county,
    areas: [...z.areas],
    customerFeeKes: z.customerFeeKes,
    defaultDistanceBand: z.defaultDistanceBand,
    sameDayCutoffTime: z.sameDayCutoffTime.slice(0, 5),
    isActive: z.isActive,
    sortOrder: z.sortOrder,
  };
}

function ZonesAdmin() {
  const qc = useQueryClient();
  const { data: zones = [], isLoading } = useQuery({
    queryKey: ["admin", "delivery-zones"],
    queryFn: adminListDeliveryZones,
  });

  const [editing, setEditing] = useState<DeliveryZoneInput | null>(null);

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["admin", "delivery-zones"] });
    // Storefront + checkout read the anon-facing zones too — bust that cache.
    qc.invalidateQueries({ queryKey: ["delivery-zones"] });
  };

  const save = useMutation({
    mutationFn: adminUpsertDeliveryZone,
    onSuccess: () => {
      invalidate();
      toast.success(editing?.id ? "Zone updated" : "Zone added");
      setEditing(null);
    },
    onError: (e: Error) => toast.error(e.message ?? "Save failed"),
  });

  const del = useMutation({
    mutationFn: adminDeleteDeliveryZone,
    onSuccess: () => {
      invalidate();
      toast.success("Zone deleted");
    },
    onError: (e: Error) => toast.error(e.message ?? "Delete failed — is any address still using it?"),
  });

  const openNew = () => {
    const nextSort = zones.reduce((m, z) => Math.max(m, z.sortOrder), 0) + 10;
    setEditing(blankDraft(nextSort));
  };

  return (
    <div className="min-h-screen bg-background text-ink">
      <header className="sticky top-0 z-30 border-b border-trust-deep/40 bg-trust-deep text-trust-deep-foreground">
        <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-3.5 md:gap-4 md:px-6">
          <Link to="/admin" className="grid h-9 w-9 shrink-0 place-items-center rounded-full hover:bg-white/10" aria-label="Back">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] opacity-70">Tradly Admin</p>
            <h1 className="truncate text-[15px] font-semibold">Delivery zones</h1>
          </div>
          {/* On mobile, the label is icon-only to save space; full label at sm+. */}
          <button
            onClick={openNew}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-white/15 px-3 py-2 text-[13px] font-semibold hover:bg-white/25 sm:px-4"
            aria-label="New zone"
          >
            <Plus className="h-4 w-4" /> <span className="hidden sm:inline">New zone</span>
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 pb-24 pt-6 md:px-6">
        <p className="max-w-2xl text-[13px] leading-relaxed text-ink-muted">
          Zones drive the checkout flat fee, the same-day cutoff on the delivery-date picker, and
          the default rider pay band (short = KES 50, long = KES 100). Storefront readers cache for
          5 minutes; changes surface within that window.
        </p>

        {/* ── Mobile cards (hidden on md+) ──────────────────────────────── */}
        <section className="mt-5 space-y-2 md:hidden">
          {isLoading && <p className="py-14 text-center text-[13px] text-ink-muted">Loading…</p>}
          {!isLoading && zones.length === 0 && (
            <p className="py-14 text-center text-[13px] text-ink-muted">No zones yet — add one.</p>
          )}
          {zones.map((z) => (
            <div key={z.id} className="rounded-2xl border border-divider bg-surface p-4">
              {/* Row 1: name + status */}
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 shrink-0 text-trust" />
                  <div>
                    <p className="text-[14px] font-semibold text-ink">{z.name}</p>
                    <p className="text-[11px] text-ink-muted">{z.county}</p>
                  </div>
                </div>
                <span className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                  z.isActive ? "bg-farm/12 text-farm" : "bg-muted text-ink-muted"
                }`}>
                  <span className="h-1.5 w-1.5 rounded-full bg-current" />
                  {z.isActive ? "Active" : "Inactive"}
                </span>
              </div>
              {/* Row 2: areas */}
              <p className="mt-2 line-clamp-2 text-[12px] text-ink-muted">{z.areas.join(", ")}</p>
              {/* Row 3: stats */}
              <div className="mt-2 flex flex-wrap gap-3 text-[12px] text-ink-muted">
                <span>Fee: <span className="font-semibold text-ink tabular-nums">{formatKes(z.customerFeeKes)}</span></span>
                <span>Band: <span className="font-semibold text-ink">{z.defaultDistanceBand}</span></span>
                <span>Cutoff: <span className="font-semibold text-ink">{z.sameDayCutoffTime.slice(0, 5)}</span></span>
              </div>
              {/* Row 4: actions */}
              <div className="mt-3 flex items-center gap-2 border-t border-divider pt-3">
                <button
                  onClick={() => setEditing(fromZone(z))}
                  className="flex-1 rounded-full border border-divider bg-background py-2 text-center text-[12px] font-semibold text-ink"
                >
                  Edit
                </button>
                <button
                  onClick={() => { if (confirm(`Delete ${z.name}?`)) del.mutate(z.id); }}
                  className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-ink-muted hover:bg-destructive/10 hover:text-destructive"
                  aria-label="Delete"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
        </section>

        {/* ── Desktop table (hidden below md) ──────────────────────────── */}
        <section className="mt-5 hidden overflow-hidden rounded-2xl border border-divider bg-surface md:block">
          <table className="w-full text-left text-[13px]">
            <thead className="border-b border-divider bg-background/60 text-[11px] uppercase tracking-wide text-ink-muted">
              <tr>
                <th className="px-5 py-3 font-semibold">Zone</th>
                <th className="px-3 py-3 font-semibold">Areas</th>
                <th className="px-3 py-3 text-right font-semibold">Fee</th>
                <th className="px-3 py-3 font-semibold">Band</th>
                <th className="px-3 py-3 font-semibold">Cutoff</th>
                <th className="px-3 py-3 font-semibold">Status</th>
                <th className="w-24 px-3 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {zones.map((z) => (
                <tr key={z.id} className="border-b border-divider last:border-b-0 hover:bg-background/40">
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-2">
                      <MapPin className="h-4 w-4 text-trust" />
                      <div>
                        <p className="font-semibold text-ink">{z.name}</p>
                        <p className="text-[11px] text-ink-muted">{z.county} · sort {z.sortOrder}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-3 text-ink-muted">
                    <span className="line-clamp-1">{z.areas.join(", ")}</span>
                  </td>
                  <td className="px-3 py-3 text-right tabular-nums font-medium text-ink">{formatKes(z.customerFeeKes)}</td>
                  <td className="px-3 py-3 text-ink-muted">{z.defaultDistanceBand}</td>
                  <td className="px-3 py-3 text-ink-muted">{z.sameDayCutoffTime.slice(0, 5)}</td>
                  <td className="px-3 py-3">
                    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                      z.isActive ? "bg-farm/12 text-farm" : "bg-muted text-ink-muted"
                    }`}>
                      <span className="h-1.5 w-1.5 rounded-full bg-current" />
                      {z.isActive ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="px-3 py-3 text-right">
                    <div className="flex justify-end gap-1">
                      <button
                        onClick={() => setEditing(fromZone(z))}
                        className="rounded-full border border-divider bg-background px-3 py-1 text-[12px] font-semibold text-ink hover:border-ink/40"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => { if (confirm(`Delete ${z.name}?`)) del.mutate(z.id); }}
                        className="grid h-7 w-7 place-items-center rounded-full text-ink-muted hover:bg-destructive/10 hover:text-destructive"
                        aria-label="Delete"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {isLoading && (
                <tr><td colSpan={7} className="px-5 py-14 text-center text-ink-muted">Loading…</td></tr>
              )}
              {!isLoading && zones.length === 0 && (
                <tr><td colSpan={7} className="px-5 py-14 text-center text-ink-muted">No zones yet — add one.</td></tr>
              )}
            </tbody>
          </table>
        </section>
      </main>

      {editing && (
        <ZoneEditor
          value={editing}
          onChange={setEditing}
          onSave={() => save.mutate(editing)}
          onClose={() => setEditing(null)}
          saving={save.isPending}
        />
      )}
    </div>
  );
}

function ZoneEditor({
  value, onChange, onSave, onClose, saving,
}: {
  value: DeliveryZoneInput;
  onChange: (v: DeliveryZoneInput) => void;
  onSave: () => void;
  onClose: () => void;
  saving: boolean;
}) {
  const set = (patch: Partial<DeliveryZoneInput>) => onChange({ ...value, ...patch });
  const [areasText, setAreasText] = useState<string>(value.areas.join(", "));
  useMemo(() => setAreasText(value.areas.join(", ")), [value.id]); // reset on edit-switch

  const commitAreas = (text: string) => {
    setAreasText(text);
    const list = text.split(",").map((s) => s.trim()).filter(Boolean);
    onChange({ ...value, areas: list });
  };

  return (
    <div className="fixed inset-0 z-50 flex bg-black/50" onClick={onClose}>
      <div
        className="ml-auto flex h-full w-full flex-col bg-background shadow-2xl sm:max-w-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-center justify-between border-b border-divider bg-surface px-5 py-3.5">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-muted">
              {value.id ? "Edit zone" : "New zone"}
            </p>
            <h2 className="text-[16px] font-semibold text-ink">{value.name || "Untitled"}</h2>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onSave}
              disabled={saving || !value.name.trim() || value.areas.length === 0}
              className="inline-flex items-center gap-1.5 rounded-full bg-ink px-4 py-2 text-[13px] font-semibold text-background hover:bg-ink/90 disabled:opacity-60"
            >
              <Save className="h-3.5 w-3.5" /> {saving ? "Saving…" : "Save"}
            </button>
            <button onClick={onClose} className="grid h-9 w-9 place-items-center rounded-full text-ink-muted hover:bg-muted">
              <X className="h-5 w-5" />
            </button>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto px-5 py-5">
          <Field label="Name">
            <input value={value.name} onChange={(e) => set({ name: e.target.value })} placeholder="Kilimani & Kileleshwa" className={inputCls} autoFocus />
          </Field>

          <Field label="County">
            <input value={value.county} onChange={(e) => set({ county: e.target.value })} className={inputCls} />
          </Field>

          <Field label="Areas (comma-separated)">
            <textarea
              value={areasText}
              onChange={(e) => commitAreas(e.target.value)}
              rows={3}
              placeholder="Kilimani, Kileleshwa, Hurlingham, Yaya"
              className={inputCls}
            />
            <p className="mt-1 text-[11px] text-ink-muted">
              Address auto-resolution walks this list (case-insensitive).
              {value.areas.length > 0 && <> {value.areas.length} area{value.areas.length === 1 ? "" : "s"} parsed.</>}
            </p>
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Customer fee (KES)">
              <input
                type="number"
                min="0"
                step="10"
                value={value.customerFeeKes}
                onChange={(e) => set({ customerFeeKes: Number(e.target.value) || 0 })}
                className={inputCls}
              />
            </Field>
            <Field label="Rider band (default)">
              <select
                value={value.defaultDistanceBand}
                onChange={(e) => set({ defaultDistanceBand: e.target.value as DistanceBand })}
                className={inputCls}
              >
                <option value="short">Short (KES 50)</option>
                <option value="long">Long (KES 100)</option>
              </select>
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Same-day cutoff (Africa/Nairobi)">
              <input
                type="time"
                value={value.sameDayCutoffTime.slice(0, 5)}
                onChange={(e) => set({ sameDayCutoffTime: e.target.value })}
                className={inputCls}
              />
            </Field>
            <Field label="Sort order">
              <input
                type="number"
                step="10"
                value={value.sortOrder}
                onChange={(e) => set({ sortOrder: Number(e.target.value) || 0 })}
                className={inputCls}
              />
            </Field>
          </div>

          <label className="mt-2 flex items-center gap-2 text-[13px] text-ink">
            <input
              type="checkbox"
              checked={value.isActive}
              onChange={(e) => set({ isActive: e.target.checked })}
            />
            <span className="font-semibold">Active</span>
            <span className="text-ink-muted">— buyers see this zone at checkout</span>
          </label>
        </div>
      </div>
    </div>
  );
}

const inputCls =
  "w-full rounded-lg border border-divider bg-background px-3 py-2 text-[13px] text-ink focus:border-trust focus:outline-none focus:ring-2 focus:ring-trust/20";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="mb-4 block">
      <span className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-ink-muted">{label}</span>
      {children}
    </label>
  );
}
