// Admin: consignment settlement queue (Phase 2 Checkpoint J — J-admin-settlements).
//
// One row per (supplier, period). Cron populates drafts every Monday
// 06:00 EAT; ops walks each run through draft → confirmed → invoiced → paid.
// Invoice delivery is manual out-of-band (email/PDF); "Mark invoiced" just
// records that the invoice went out. "Mark paid" records the M-Pesa/bank
// reference for the actual settlement transfer.
//
// Includes an ad-hoc "Generate now" for backfills and on-demand runs.

import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { format, formatDistanceToNow } from "date-fns";
import {
  ArrowLeft, BanknoteArrowUp, Check, ChevronRight, FileText, Loader2, Play, Save, X,
} from "lucide-react";
import { RequireAdmin } from "@/components/RequireAdmin";
import { useAuth } from "@/hooks/use-auth";
import {
  type SettlementRun,
  type SettlementStatus,
  adminConfirmSettlement,
  adminGenerateSettlement,
  adminListSettlementLines,
  adminListSettlementRuns,
  adminMarkInvoiced,
  adminMarkSettlementPaid,
} from "../marketplace/api/settlements";
import { formatKes } from "../marketplace/lib/format";

export const Route = createFileRoute("/admin/settlements")({
  head: () => ({
    meta: [{ title: "Settlements — Tradly Admin" }, { name: "robots", content: "noindex" }],
  }),
  component: () => (
    <RequireAdmin>
      <SettlementsAdmin />
    </RequireAdmin>
  ),
});

const BUCKETS: { label: string; statuses: SettlementStatus[]; className: string }[] = [
  { label: "Draft",     statuses: ["draft"],     className: "bg-muted text-ink-muted" },
  { label: "Confirmed", statuses: ["confirmed"], className: "bg-trust/15 text-trust-deep" },
  { label: "Invoiced",  statuses: ["invoiced"],  className: "bg-trust/15 text-trust-deep" },
  { label: "Paid",      statuses: ["paid"],      className: "bg-farm/15 text-farm" },
];

function SettlementsAdmin() {
  const qc = useQueryClient();
  const { buyer } = useAuth();

  const { data: runs = [], isLoading } = useQuery({
    queryKey: ["admin", "settlement-runs"],
    queryFn: adminListSettlementRuns,
    refetchInterval: 60_000,
  });

  const invalidate = () =>
    qc.invalidateQueries({ queryKey: ["admin", "settlement-runs"] });

  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [markingPaid, setMarkingPaid] = useState<SettlementRun | null>(null);
  const [genOpen, setGenOpen] = useState(false);

  const confirm = useMutation({
    mutationFn: (id: string) => {
      if (!buyer?.id) throw new Error("Sign in as ops");
      return adminConfirmSettlement(id, buyer.id);
    },
    onSuccess: () => { invalidate(); toast.success("Confirmed"); },
    onError: (e: Error) => toast.error(e.message ?? "Confirm failed"),
  });

  const markInvoiced = useMutation({
    mutationFn: adminMarkInvoiced,
    onSuccess: () => { invalidate(); toast.success("Marked invoiced"); },
    onError: (e: Error) => toast.error(e.message ?? "Mark invoiced failed"),
  });

  const grouped = useMemo(() => {
    const map: Record<string, SettlementRun[]> = {};
    for (const b of BUCKETS) map[b.label] = [];
    for (const r of runs) {
      const b = BUCKETS.find((bk) => bk.statuses.includes(r.status));
      if (b) map[b.label].push(r);
    }
    return map;
  }, [runs]);

  return (
    <div className="min-h-screen bg-background text-ink">
      <header className="sticky top-0 z-30 border-b border-trust-deep/40 bg-trust-deep text-trust-deep-foreground">
        <div className="mx-auto flex max-w-6xl items-center gap-4 px-6 py-3.5">
          <Link to="/admin" className="grid h-9 w-9 place-items-center rounded-full hover:bg-white/10" aria-label="Back">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] opacity-70">Tradly Admin</p>
            <h1 className="text-[15px] font-semibold">Consignment settlements</h1>
          </div>
          <button
            onClick={() => setGenOpen(true)}
            className="ml-auto inline-flex items-center gap-1.5 rounded-full bg-white/15 px-4 py-2 text-[13px] font-semibold hover:bg-white/25"
          >
            <Play className="h-3.5 w-3.5" /> Generate…
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 pb-24 pt-6 md:px-6">
        <p className="max-w-2xl text-[13px] leading-relaxed text-ink-muted">
          Auto-generated every Monday at 06:00 Nairobi for the previous week.
          Walk each run draft → confirmed → invoiced → paid. Invoice delivery
          is manual (email/PDF); "Mark invoiced" just records that it went out.
        </p>

        {isLoading && (
          <div className="mt-8 flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-ink-muted" /></div>
        )}
        {!isLoading && runs.length === 0 && (
          <div className="mt-6 rounded-2xl border border-dashed border-divider p-10 text-center text-[13px] text-ink-muted">
            No settlement runs yet. Wait until Monday, or click Generate to backfill a period.
          </div>
        )}

        {!isLoading && runs.length > 0 && (
          <div className="mt-6 space-y-6">
            {BUCKETS.map((bucket) => {
              const list = grouped[bucket.label];
              if (list.length === 0) return null;
              return (
                <section key={bucket.label}>
                  <div className="mb-2 flex items-baseline justify-between">
                    <h2 className="text-[12px] font-semibold uppercase tracking-wide text-ink-muted">
                      {bucket.label}
                    </h2>
                    <span className="text-[11px] tabular-nums text-ink-muted">
                      {list.length} · total {formatKes(list.reduce((s, r) => s + r.goodsTotalKes, 0))}
                    </span>
                  </div>
                  <ul className="space-y-2">
                    {list.map((r) => (
                      <RunRow
                        key={r.id}
                        run={r}
                        expanded={expandedId === r.id}
                        onToggle={() => setExpandedId(expandedId === r.id ? null : r.id)}
                        onConfirm={() => confirm.mutate(r.id)}
                        onMarkInvoiced={() => markInvoiced.mutate(r.id)}
                        onMarkPaid={() => setMarkingPaid(r)}
                        busy={confirm.isPending || markInvoiced.isPending}
                      />
                    ))}
                  </ul>
                </section>
              );
            })}
          </div>
        )}
      </main>

      {genOpen && (
        <GenerateDialog
          onClose={() => setGenOpen(false)}
          onGenerated={() => { invalidate(); setGenOpen(false); }}
        />
      )}
      {markingPaid && (
        <MarkPaidDialog
          run={markingPaid}
          onClose={() => setMarkingPaid(null)}
          onDone={() => { invalidate(); setMarkingPaid(null); }}
        />
      )}
    </div>
  );
}

function RunRow({
  run,
  expanded,
  onToggle,
  onConfirm,
  onMarkInvoiced,
  onMarkPaid,
  busy,
}: {
  run: SettlementRun;
  expanded: boolean;
  onToggle: () => void;
  onConfirm: () => void;
  onMarkInvoiced: () => void;
  onMarkPaid: () => void;
  busy: boolean;
}) {
  return (
    <li className="rounded-2xl border border-divider bg-surface">
      <div className="flex flex-wrap items-start justify-between gap-3 p-4">
        <div className="min-w-0 flex-1">
          <p className="text-[14px] font-semibold text-ink">
            {run.supplierName ?? run.supplierBusinessId.slice(0, 8)}
          </p>
          <p className="mt-0.5 text-[12px] text-ink-muted">
            {format(new Date(run.periodStart), "d MMM")} – {format(new Date(run.periodEnd), "d MMM yyyy")}
            {" · "}
            {run.lineCount} product{run.lineCount === 1 ? "" : "s"}
            {" · generated "}
            {formatDistanceToNow(new Date(run.generatedAt), { addSuffix: true })}
          </p>
          {run.paidReference && (
            <p className="mt-0.5 text-[11px] text-ink-muted">Paid ref: {run.paidReference}</p>
          )}
        </div>
        <div className="text-right">
          <p className="text-[18px] font-bold tabular-nums text-ink">{formatKes(run.goodsTotalKes)}</p>
          <div className="mt-2 flex flex-wrap justify-end gap-1">
            <button
              type="button"
              onClick={onToggle}
              className="inline-flex items-center gap-1 rounded-full border border-divider bg-background px-2.5 py-1 text-[11.5px] font-semibold text-ink hover:border-ink/40"
            >
              <ChevronRight className={`h-3 w-3 transition-transform ${expanded ? "rotate-90" : ""}`} />
              {expanded ? "Hide" : "Show"} lines
            </button>
            {run.status === "draft" && (
              <button
                type="button"
                onClick={onConfirm}
                disabled={busy}
                className="inline-flex items-center gap-1 rounded-full bg-ink px-3 py-1 text-[11.5px] font-semibold text-background hover:bg-ink/90 disabled:opacity-60"
              >
                <Check className="h-3 w-3" /> Confirm
              </button>
            )}
            {run.status === "confirmed" && (
              <button
                type="button"
                onClick={onMarkInvoiced}
                disabled={busy}
                className="inline-flex items-center gap-1 rounded-full bg-ink px-3 py-1 text-[11.5px] font-semibold text-background hover:bg-ink/90 disabled:opacity-60"
              >
                <FileText className="h-3 w-3" /> Mark invoiced
              </button>
            )}
            {run.status === "invoiced" && (
              <button
                type="button"
                onClick={onMarkPaid}
                className="inline-flex items-center gap-1 rounded-full bg-ink px-3 py-1 text-[11.5px] font-semibold text-background hover:bg-ink/90"
              >
                <BanknoteArrowUp className="h-3 w-3" /> Mark paid
              </button>
            )}
          </div>
        </div>
      </div>
      {expanded && <LinesTable runId={run.id} />}
    </li>
  );
}

function LinesTable({ runId }: { runId: string }) {
  const { data: lines = [], isLoading } = useQuery({
    queryKey: ["admin", "settlement-lines", runId],
    queryFn: () => adminListSettlementLines(runId),
  });

  if (isLoading) return <div className="border-t border-divider p-6 text-center"><Loader2 className="mx-auto h-4 w-4 animate-spin text-ink-muted" /></div>;
  if (lines.length === 0) return <p className="border-t border-divider p-4 text-center text-[12px] text-ink-muted">No lines.</p>;

  return (
    <div className="border-t border-divider overflow-x-auto">
      <table className="w-full text-left text-[12.5px]">
        <thead className="bg-background/60 text-[10.5px] uppercase tracking-wide text-ink-muted">
          <tr>
            <th className="px-4 py-2 font-semibold">Product</th>
            <th className="px-3 py-2 text-right font-semibold">Qty</th>
            <th className="px-3 py-2 text-right font-semibold">Cost rate</th>
            <th className="px-3 py-2 text-right font-semibold">Amount</th>
          </tr>
        </thead>
        <tbody>
          {lines.map((l) => (
            <tr key={l.id} className="border-t border-divider">
              <td className="px-4 py-2">{l.productName}</td>
              <td className="px-3 py-2 text-right tabular-nums text-ink-muted">{l.qtyConsumed}</td>
              <td className="px-3 py-2 text-right tabular-nums text-ink-muted">{formatKes(l.costRateKes)}</td>
              <td className="px-3 py-2 text-right tabular-nums font-semibold text-ink">{formatKes(l.amountKes)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function GenerateDialog({
  onClose,
  onGenerated,
}: {
  onClose: () => void;
  onGenerated: () => void;
}) {
  // Default to the ISO week ending yesterday.
  const today = new Date();
  const day = today.getDay(); // Sun=0..Sat=6
  const daysToLastMonday = ((day + 6) % 7) + 7;
  const defaultEnd = new Date(today);
  defaultEnd.setDate(today.getDate() - daysToLastMonday + 6);
  const defaultStart = new Date(defaultEnd);
  defaultStart.setDate(defaultEnd.getDate() - 6);
  const iso = (d: Date) => d.toISOString().slice(0, 10);

  const [start, setStart] = useState(iso(defaultStart));
  const [end, setEnd] = useState(iso(defaultEnd));

  const generate = useMutation({
    mutationFn: () => adminGenerateSettlement(start, end),
    onSuccess: (count) => {
      toast.success(count > 0
        ? `Generated ${count} supplier run${count === 1 ? "" : "s"}`
        : "Nothing to settle in that period");
      onGenerated();
    },
    onError: (e: Error) => toast.error(e.message ?? "Generate failed"),
  });

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center" onClick={onClose}>
      <div
        className="w-full max-w-md rounded-t-3xl bg-background p-5 shadow-2xl sm:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-muted">Generate settlement</p>
            <p className="mt-1 text-[14px] font-semibold text-ink">Custom period</p>
          </div>
          <button onClick={onClose} className="grid h-9 w-9 place-items-center rounded-full text-ink-muted hover:bg-muted"><X className="h-5 w-5" /></button>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3">
          <label className="block">
            <span className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-ink-muted">Period start</span>
            <input type="date" value={start} onChange={(e) => setStart(e.target.value)}
              className="w-full rounded-lg border border-divider bg-background px-3 py-2 text-[13px] focus:border-trust focus:outline-none focus:ring-2 focus:ring-trust/20" />
          </label>
          <label className="block">
            <span className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-ink-muted">Period end</span>
            <input type="date" value={end} onChange={(e) => setEnd(e.target.value)}
              className="w-full rounded-lg border border-divider bg-background px-3 py-2 text-[13px] focus:border-trust focus:outline-none focus:ring-2 focus:ring-trust/20" />
          </label>
        </div>
        <p className="mt-2 text-[11px] text-ink-muted">
          Idempotent per (supplier, exact period). Re-running the same window is safe —
          existing runs are preserved.
        </p>

        <div className="mt-5 flex gap-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-full border border-divider bg-surface px-4 py-2.5 text-[13px] font-semibold text-ink hover:bg-muted"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => generate.mutate()}
            disabled={generate.isPending || !start || !end || start > end}
            className="flex-1 rounded-full bg-ink px-4 py-2.5 text-[13px] font-semibold text-background hover:bg-ink/90 disabled:opacity-60"
          >
            <Play className="mr-1 inline h-3.5 w-3.5" />
            {generate.isPending ? "Generating…" : "Generate"}
          </button>
        </div>
      </div>
    </div>
  );
}

function MarkPaidDialog({
  run,
  onClose,
  onDone,
}: {
  run: SettlementRun;
  onClose: () => void;
  onDone: () => void;
}) {
  const [reference, setReference] = useState("");
  const markPaid = useMutation({
    mutationFn: () => adminMarkSettlementPaid(run.id, reference.trim()),
    onSuccess: () => {
      toast.success(`Marked paid — ref ${reference.trim()}`);
      onDone();
    },
    onError: (e: Error) => toast.error(e.message ?? "Mark paid failed"),
  });

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center" onClick={onClose}>
      <div
        className="w-full max-w-md rounded-t-3xl bg-background p-5 shadow-2xl sm:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-muted">Mark paid</p>
            <p className="mt-1 text-[14px] font-semibold text-ink">{run.supplierName ?? run.supplierBusinessId.slice(0, 8)}</p>
            <p className="text-[18px] font-bold tabular-nums text-ink">{formatKes(run.goodsTotalKes)}</p>
          </div>
          <button onClick={onClose} className="grid h-9 w-9 place-items-center rounded-full text-ink-muted hover:bg-muted"><X className="h-5 w-5" /></button>
        </div>

        <label className="mt-4 block">
          <span className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-ink-muted">Payout reference</span>
          <input
            value={reference}
            onChange={(e) => setReference(e.target.value)}
            placeholder="Bank transfer ref or M-Pesa code"
            autoFocus
            className="w-full rounded-lg border border-divider bg-background px-3 py-2 text-[13px] focus:border-trust focus:outline-none focus:ring-2 focus:ring-trust/20"
          />
        </label>

        <div className="mt-5 flex gap-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-full border border-divider bg-surface px-4 py-2.5 text-[13px] font-semibold text-ink hover:bg-muted"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => markPaid.mutate()}
            disabled={markPaid.isPending || reference.trim().length === 0}
            className="flex-1 rounded-full bg-ink px-4 py-2.5 text-[13px] font-semibold text-background hover:bg-ink/90 disabled:opacity-60"
          >
            <Save className="mr-1 inline h-3.5 w-3.5" />
            {markPaid.isPending ? "Recording…" : "Confirm"}
          </button>
        </div>
      </div>
    </div>
  );
}
