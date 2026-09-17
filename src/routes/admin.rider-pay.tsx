// Admin: rider pay + roster (Phase 2 Checkpoint G — G-admin-rider-pay).
//
// Two tabs:
//   Pay     — unpaid + paid-this-week per driver. Mark paid (fn_driver_pay_
//             mark_paid) records ops user + timestamp. Cash-only per spec §12.2.
//   Roster  — add/deactivate riders, rotate link tokens, copy the daily URL
//             ops sends to each rider. All under super_admin RLS.

import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { format } from "date-fns";
import {
  ArrowLeft, Copy, Loader2, Plus, RefreshCw, Save, Trash2, X,
} from "lucide-react";
import { RequireAdmin } from "@/components/RequireAdmin";
import {
  type Driver,
  type DriverInput,
  type DriverPayEntry,
  adminListDriverPayEntries,
  adminListDrivers,
  adminMarkPayPaid,
  adminRotateDriverToken,
  adminUpsertDriver,
} from "../marketplace/api/deliveries";
import { formatKes } from "../marketplace/lib/format";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/admin/rider-pay")({
  head: () => ({
    meta: [{ title: "Rider pay — Tradly Admin" }, { name: "robots", content: "noindex" }],
  }),
  component: () => (
    <RequireAdmin>
      <RiderPayAdmin />
    </RequireAdmin>
  ),
});

function RiderPayAdmin() {
  const [tab, setTab] = useState<"pay" | "roster">("pay");
  return (
    <div className="min-h-screen bg-background text-ink">
      <header className="sticky top-0 z-30 border-b border-trust-deep/40 bg-trust-deep text-trust-deep-foreground">
        <div className="mx-auto flex max-w-5xl items-center gap-4 px-6 py-3.5">
          <Link to="/admin" className="grid h-9 w-9 place-items-center rounded-full hover:bg-white/10" aria-label="Back">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] opacity-70">Tradly Admin</p>
            <h1 className="text-[15px] font-semibold">Rider pay & roster</h1>
          </div>
          <nav className="ml-auto hidden gap-1 text-[13px] font-medium md:flex">
            <Link to="/admin/deliveries" className="rounded-full px-3 py-1.5 opacity-80 hover:bg-white/10">Queue</Link>
            <Link to="/admin/rider-pay" className="rounded-full bg-white/15 px-3 py-1.5">Rider pay</Link>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 pb-24 pt-6 md:px-6">
        <div className="mb-5 flex gap-1 rounded-full border border-divider bg-surface p-1 w-fit">
          {(["pay","roster"] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={`rounded-full px-4 py-1.5 text-[13px] font-medium transition-colors ${
                tab === t ? "bg-ink text-background" : "text-ink-muted hover:text-ink"
              }`}
            >
              {t === "pay" ? "Pay" : "Roster"}
            </button>
          ))}
        </div>

        {tab === "pay" ? <PayTab /> : <RosterTab />}
      </main>
    </div>
  );
}

// ─── Pay tab ────────────────────────────────────────────────────────────

function PayTab() {
  const { buyer } = useAuth();
  const qc = useQueryClient();

  const { data: entries = [], isLoading: entriesLoading } = useQuery({
    queryKey: ["admin", "driver-pay"],
    queryFn: adminListDriverPayEntries,
    refetchInterval: 30_000,
  });
  const { data: drivers = [] } = useQuery({
    queryKey: ["admin", "drivers", "all"],
    queryFn: () => adminListDrivers(true),
    staleTime: 60_000,
  });

  const invalidate = () =>
    qc.invalidateQueries({ queryKey: ["admin", "driver-pay"] });

  const markPaid = useMutation({
    mutationFn: (id: string) => {
      if (!buyer?.id) throw new Error("Sign in as ops to record cash handovers");
      return adminMarkPayPaid(id, buyer.id);
    },
    onSuccess: (remaining) => {
      invalidate();
      toast.success(
        remaining > 0 ? `Marked paid — ${formatKes(remaining)} still owed` : "Marked paid — nothing owed",
      );
    },
    onError: (e: Error) => toast.error(e.message ?? "Mark paid failed"),
  });

  const grouped = useMemo(() => {
    const map: Record<string, { unpaid: DriverPayEntry[]; paidThisWeek: DriverPayEntry[] }> = {};
    const weekStart = startOfWeek(new Date());
    for (const e of entries) {
      const bucket = map[e.driverId] ??= { unpaid: [], paidThisWeek: [] };
      if (!e.paidAt) bucket.unpaid.push(e);
      else if (new Date(e.paidAt) >= weekStart) bucket.paidThisWeek.push(e);
    }
    return map;
  }, [entries]);

  return (
    <>
      {entriesLoading && (
        <div className="mt-6 flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-ink-muted" /></div>
      )}
      {!entriesLoading && drivers.length === 0 && (
        <div className="mt-6 rounded-2xl border border-dashed border-divider p-10 text-center text-[13px] text-ink-muted">
          No riders yet — add one on the Roster tab.
        </div>
      )}
      {!entriesLoading && drivers.length > 0 && (
        <div className="space-y-4">
          {drivers.filter((d) => grouped[d.id]?.unpaid.length || grouped[d.id]?.paidThisWeek.length).map((driver) => {
            const bucket = grouped[driver.id] ?? { unpaid: [], paidThisWeek: [] };
            const unpaidTotal = bucket.unpaid.reduce((s, e) => s + e.amountKes, 0);
            const paidTotal = bucket.paidThisWeek.reduce((s, e) => s + e.amountKes, 0);
            return (
              <section key={driver.id} className="rounded-2xl border border-divider bg-surface p-5">
                <div className="flex items-baseline justify-between gap-3">
                  <div>
                    <p className="text-[14px] font-semibold text-ink">{driver.fullName}</p>
                    <p className="text-[11px] text-ink-muted">{driver.phone}</p>
                  </div>
                  <p className="text-[13px] tabular-nums">
                    <span className={unpaidTotal > 0 ? "font-semibold text-destructive" : "text-ink-muted"}>
                      Owed {formatKes(unpaidTotal)}
                    </span>
                    <span className="text-ink-muted"> · Paid this week {formatKes(paidTotal)}</span>
                  </p>
                </div>

                {bucket.unpaid.length > 0 && (
                  <ul className="mt-4 divide-y divide-divider">
                    {bucket.unpaid.map((e) => (
                      <li key={e.id} className="flex items-center justify-between gap-3 py-2 text-[13px]">
                        <span className="min-w-0 truncate text-ink-muted">
                          {e.orderNumber && <span className="font-mono text-[11.5px]">{e.orderNumber}</span>}
                          {e.zoneName && <> · {e.zoneName}</>}
                          {e.distanceBand && <> · {e.distanceBand}</>}
                          {" · "}
                          created {format(new Date(e.createdAt), "d MMM HH:mm")}
                        </span>
                        <span className="shrink-0 flex items-center gap-3">
                          <span className="font-semibold tabular-nums text-ink">{formatKes(e.amountKes)}</span>
                          <button
                            type="button"
                            onClick={() => markPaid.mutate(e.id)}
                            disabled={markPaid.isPending}
                            className="rounded-full bg-ink px-3 py-1 text-[11.5px] font-semibold text-background hover:bg-ink/90 disabled:opacity-60"
                          >
                            Mark paid
                          </button>
                        </span>
                      </li>
                    ))}
                  </ul>
                )}

                {bucket.paidThisWeek.length > 0 && (
                  <details className="mt-3 text-[12px]">
                    <summary className="cursor-pointer text-ink-muted hover:text-ink">
                      Paid this week ({bucket.paidThisWeek.length})
                    </summary>
                    <ul className="mt-2 divide-y divide-divider">
                      {bucket.paidThisWeek.map((e) => (
                        <li key={e.id} className="flex justify-between py-1.5 text-ink-muted">
                          <span>
                            {e.orderNumber && <span className="font-mono">{e.orderNumber}</span>}
                            {e.paidAt && <> · paid {format(new Date(e.paidAt), "EEE d MMM HH:mm")}</>}
                          </span>
                          <span className="tabular-nums text-ink">{formatKes(e.amountKes)}</span>
                        </li>
                      ))}
                    </ul>
                  </details>
                )}
              </section>
            );
          })}
          {drivers.every((d) => !grouped[d.id]?.unpaid.length && !grouped[d.id]?.paidThisWeek.length) && (
            <div className="rounded-2xl border border-dashed border-divider p-10 text-center text-[13px] text-ink-muted">
              No pay entries yet — assign a delivery to see one appear.
            </div>
          )}
        </div>
      )}
    </>
  );
}

// ─── Roster tab ─────────────────────────────────────────────────────────

function RosterTab() {
  const qc = useQueryClient();
  const { data: drivers = [], isLoading } = useQuery({
    queryKey: ["admin", "drivers", "all"],
    queryFn: () => adminListDrivers(true),
  });

  const [editing, setEditing] = useState<DriverInput | null>(null);

  const invalidate = () =>
    qc.invalidateQueries({ queryKey: ["admin", "drivers"] });

  const save = useMutation({
    mutationFn: adminUpsertDriver,
    onSuccess: () => {
      invalidate();
      toast.success(editing?.id ? "Rider updated" : "Rider added");
      setEditing(null);
    },
    onError: (e: Error) => toast.error(e.message ?? "Save failed"),
  });

  const rotate = useMutation({
    mutationFn: adminRotateDriverToken,
    onSuccess: () => {
      invalidate();
      toast.success("Link rotated — send the rider a fresh URL");
    },
    onError: (e: Error) => toast.error(e.message ?? "Rotate failed"),
  });

  const copyLink = async (driver: Driver) => {
    const url = `${window.location.origin}/rider/${driver.id}?t=${driver.linkToken}`;
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Link copied");
    } catch {
      toast.error("Copy failed — long-press to share");
    }
  };

  return (
    <>
      <div className="mb-4 flex items-center justify-between">
        <p className="text-[13px] text-ink-muted">
          Fixed roster per spec §12. Rotate a link if a phone is lost or the URL leaks.
        </p>
        <button
          type="button"
          onClick={() =>
            setEditing({ fullName: "", phone: "", vehicleType: "motorcycle", isActive: true })
          }
          className="inline-flex items-center gap-1.5 rounded-full bg-ink px-4 py-2 text-[13px] font-semibold text-background hover:bg-ink/90"
        >
          <Plus className="h-4 w-4" /> Add rider
        </button>
      </div>

      {isLoading && (
        <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-ink-muted" /></div>
      )}
      {!isLoading && drivers.length === 0 && (
        <div className="rounded-2xl border border-dashed border-divider p-10 text-center text-[13px] text-ink-muted">
          No riders yet — add one to get started.
        </div>
      )}

      <ul className="space-y-2">
        {drivers.map((d) => (
          <li key={d.id} className={`rounded-2xl border border-divider bg-surface p-4 ${d.isActive ? "" : "opacity-60"}`}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="text-[14px] font-semibold text-ink">{d.fullName}</p>
                  {!d.isActive && (
                    <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold uppercase text-ink-muted">Inactive</span>
                  )}
                </div>
                <p className="text-[12px] text-ink-muted">
                  {d.phone}
                  {d.vehicleType && <> · {d.vehicleType}</>}
                  {d.vehicleRegistration && <> · {d.vehicleRegistration}</>}
                </p>
                {d.notes && <p className="mt-0.5 text-[11px] italic text-ink-muted">"{d.notes}"</p>}
              </div>
              <div className="flex flex-wrap items-center gap-1">
                <button
                  type="button"
                  onClick={() => copyLink(d)}
                  className="inline-flex items-center gap-1 rounded-full border border-divider bg-background px-3 py-1 text-[11.5px] font-semibold text-ink hover:border-ink/40"
                  title="Copy the rider's daily URL"
                >
                  <Copy className="h-3 w-3" /> Copy link
                </button>
                <button
                  type="button"
                  onClick={() => { if (confirm(`Rotate link for ${d.fullName}? Their current URL will stop working.`)) rotate.mutate(d.id); }}
                  disabled={rotate.isPending}
                  className="inline-flex items-center gap-1 rounded-full border border-divider bg-background px-3 py-1 text-[11.5px] font-semibold text-ink hover:border-ink/40 disabled:opacity-60"
                >
                  <RefreshCw className="h-3 w-3" /> Rotate
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setEditing({
                      id: d.id,
                      fullName: d.fullName,
                      phone: d.phone,
                      vehicleType: d.vehicleType,
                      vehicleRegistration: d.vehicleRegistration,
                      notes: d.notes,
                      isActive: d.isActive,
                    })
                  }
                  className="rounded-full border border-divider bg-background px-3 py-1 text-[11.5px] font-semibold text-ink hover:border-ink/40"
                >
                  Edit
                </button>
              </div>
            </div>
          </li>
        ))}
      </ul>

      {editing && (
        <DriverEditor
          value={editing}
          onChange={setEditing}
          onSave={() => save.mutate(editing)}
          onClose={() => setEditing(null)}
          saving={save.isPending}
        />
      )}
    </>
  );
}

function DriverEditor({
  value, onChange, onSave, onClose, saving,
}: {
  value: DriverInput;
  onChange: (v: DriverInput) => void;
  onSave: () => void;
  onClose: () => void;
  saving: boolean;
}) {
  const set = (patch: Partial<DriverInput>) => onChange({ ...value, ...patch });
  const canSave = value.fullName.trim().length > 0 && value.phone.trim().length > 0 && !saving;

  return (
    <div className="fixed inset-0 z-50 flex bg-black/50" onClick={onClose}>
      <div
        className="ml-auto flex h-full w-full max-w-md flex-col bg-background shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-center justify-between border-b border-divider bg-surface px-5 py-3.5">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-muted">
              {value.id ? "Edit rider" : "New rider"}
            </p>
            <h2 className="text-[16px] font-semibold text-ink">{value.fullName || "Untitled"}</h2>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onSave}
              disabled={!canSave}
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
          <Field label="Full name">
            <input value={value.fullName} onChange={(e) => set({ fullName: e.target.value })} className={inputCls} autoFocus />
          </Field>
          <Field label="Phone">
            <input value={value.phone} onChange={(e) => set({ phone: e.target.value })} placeholder="+2547XXXXXXXX" className={inputCls} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Vehicle type">
              <select
                value={value.vehicleType ?? ""}
                onChange={(e) => set({ vehicleType: e.target.value || null })}
                className={inputCls}
              >
                <option value="">—</option>
                <option value="motorcycle">motorcycle</option>
                <option value="bicycle">bicycle</option>
                <option value="pickup">pickup</option>
                <option value="van">van</option>
                <option value="other">other</option>
              </select>
            </Field>
            <Field label="Registration">
              <input value={value.vehicleRegistration ?? ""} onChange={(e) => set({ vehicleRegistration: e.target.value || null })} className={inputCls} />
            </Field>
          </div>
          <Field label="Notes">
            <textarea value={value.notes ?? ""} onChange={(e) => set({ notes: e.target.value || null })} rows={2} className={inputCls} />
          </Field>
          <label className="mt-2 flex items-center gap-2 text-[13px] text-ink">
            <input
              type="checkbox"
              checked={value.isActive ?? true}
              onChange={(e) => set({ isActive: e.target.checked })}
            />
            <span className="font-semibold">Active</span>
            <span className="text-ink-muted">— appears in the assign dropdown</span>
          </label>
        </div>
      </div>
    </div>
  );
}

// ─── Helpers ────────────────────────────────────────────────────────────

function startOfWeek(d: Date): Date {
  // Monday of the same week, in local time. Matches fn_rider_day's
  // date_trunc('week', ...) which also starts on Monday for Postgres.
  const day = d.getDay();               // 0 (Sun) .. 6 (Sat)
  const diff = (day + 6) % 7;           // Sunday → 6 back, Monday → 0 back, ...
  const monday = new Date(d);
  monday.setDate(d.getDate() - diff);
  monday.setHours(0, 0, 0, 0);
  return monday;
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
