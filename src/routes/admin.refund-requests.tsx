// Admin: refund requests queue (Phase 2 Checkpoint I — I-admin-refund-requests).
//
// Buyers request cash refunds against refundable credit via /account/credit.
// This page is where ops fulfils them: enter M-Pesa or bank reference,
// optional notes, hit Mark refunded. fn_refund_request_fulfil writes the
// matching debit and closes the request.
//
// Payouts themselves happen out-of-band (M-Pesa / bank transfer) per spec
// §11.3 — no Paystack Transfers integration at this phase.

import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { ArrowLeft, BanknoteArrowUp, Check, Loader2, Save, X } from "lucide-react";
import { RequireAdmin } from "@/components/RequireAdmin";
import { getSupabase } from "@/lib/supabase";
import {
  adminFulfilRefundRequest,
  adminListRefundRequests,
  type RefundRequest,
} from "../marketplace/api/credit";
import { formatKes } from "../marketplace/lib/format";

export const Route = createFileRoute("/admin/refund-requests")({
  head: () => ({
    meta: [{ title: "Refund requests — Tradly Admin" }, { name: "robots", content: "noindex" }],
  }),
  component: () => (
    <RequireAdmin>
      <RefundRequestsAdmin />
    </RequireAdmin>
  ),
});

// Small helper: batch fetch business names for the pending requests so the
// queue shows "Peter Kimani" not "4479f4f7-…". Falls back to the UUID if
// the lookup fails (RLS shouldn't deny super_admin).
async function loadBusinessNames(businessIds: string[]): Promise<Map<string, { name: string; email: string | null; phone: string | null }>> {
  const uniqIds = Array.from(new Set(businessIds));
  if (uniqIds.length === 0) return new Map();
  const { data, error } = await getSupabase()
    .from("businesses")
    .select("id, name, email, phone")
    .in("id", uniqIds);
  if (error) throw error;
  const map = new Map<string, { name: string; email: string | null; phone: string | null }>();
  for (const b of data ?? []) {
    map.set(b.id as string, {
      name: (b.name as string) ?? "(no name)",
      email: (b.email as string | null) ?? null,
      phone: (b.phone as string | null) ?? null,
    });
  }
  return map;
}

function RefundRequestsAdmin() {
  const qc = useQueryClient();

  const { data: requests = [], isLoading } = useQuery({
    queryKey: ["admin", "refund-requests", "open"],
    queryFn: () => adminListRefundRequests(["pending", "processing"]),
    refetchInterval: 30_000,
  });
  const { data: fulfilled = [] } = useQuery({
    queryKey: ["admin", "refund-requests", "fulfilled"],
    queryFn: () => adminListRefundRequests(["fulfilled"]),
    staleTime: 60_000,
  });

  const { data: businessNames } = useQuery({
    queryKey: ["admin", "refund-requests", "biz-names", requests.map((r) => r.businessId).join(",")],
    queryFn: () => loadBusinessNames(requests.map((r) => r.businessId)),
    enabled: requests.length > 0,
  });

  const [fulfilling, setFulfilling] = useState<RefundRequest | null>(null);

  const invalidate = () =>
    qc.invalidateQueries({ queryKey: ["admin", "refund-requests"] });

  const totalOwed = useMemo(
    () => requests.reduce((s, r) => s + r.amountKes, 0),
    [requests],
  );

  return (
    <div className="min-h-screen bg-background text-ink">
      <header className="sticky top-0 z-30 border-b border-trust-deep/40 bg-trust-deep text-trust-deep-foreground">
        <div className="mx-auto flex max-w-5xl items-center gap-4 px-6 py-3.5">
          <Link to="/admin" className="grid h-9 w-9 place-items-center rounded-full hover:bg-white/10" aria-label="Back">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] opacity-70">Tradly Admin</p>
            <h1 className="text-[15px] font-semibold">Refund requests</h1>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 pb-24 pt-6 md:px-6">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <p className="max-w-2xl text-[13px] leading-relaxed text-ink-muted">
            Households ask for cash refunds against refundable credit. Process the payout
            out-of-band (M-Pesa or bank), then record the reference here — the ledger
            debit is written automatically so balances stay accurate.
          </p>
          <div className="text-right">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-muted">Open total</p>
            <p className="text-[18px] font-bold tabular-nums text-ink">{formatKes(totalOwed)}</p>
          </div>
        </div>

        {isLoading && (
          <div className="mt-8 flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-ink-muted" /></div>
        )}

        {!isLoading && requests.length === 0 && (
          <div className="mt-6 rounded-2xl border border-dashed border-divider p-10 text-center text-[13px] text-ink-muted">
            No open refund requests. 🎉
          </div>
        )}

        {requests.length > 0 && (
          <section className="mt-6">
            <div className="mb-2 flex items-baseline justify-between">
              <h2 className="text-[12px] font-semibold uppercase tracking-wide text-ink-muted">Open</h2>
              <span className="text-[11px] tabular-nums text-ink-muted">{requests.length}</span>
            </div>
            <ul className="space-y-2">
              {requests.map((r) => {
                const biz = businessNames?.get(r.businessId);
                return (
                  <li key={r.id} className="rounded-2xl border border-divider bg-surface p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="text-[14px] font-semibold text-ink">
                          {biz?.name ?? r.businessId.slice(0, 8)}
                          <span className="ml-2 rounded-full bg-ripe/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-[oklch(0.42_0.11_65)]">
                            {r.status}
                          </span>
                        </p>
                        <p className="mt-1 text-[12px] text-ink-muted">
                          {biz?.phone ?? "no phone"} · {biz?.email ?? "no email"}
                          {" · "}
                          requested {formatDistanceToNow(new Date(r.requestedAt), { addSuffix: true })}
                        </p>
                        {r.notes && (
                          <p className="mt-1 rounded-xl bg-background px-3 py-2 text-[11.5px] italic text-ink-muted">
                            "{r.notes}"
                          </p>
                        )}
                        <p className="mt-1 font-mono text-[10.5px] text-ink-muted">
                          business {r.businessId} · credit {r.creditLedgerId?.slice(0, 8) ?? "—"}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-[18px] font-bold tabular-nums text-ink">{formatKes(r.amountKes)}</p>
                        <button
                          type="button"
                          onClick={() => setFulfilling(r)}
                          className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-ink px-3 py-1.5 text-[12px] font-semibold text-background hover:bg-ink/90"
                        >
                          <BanknoteArrowUp className="h-3.5 w-3.5" /> Mark refunded
                        </button>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>
        )}

        {fulfilled.length > 0 && (
          <section className="mt-8">
            <details>
              <summary className="cursor-pointer text-[12px] font-semibold uppercase tracking-wide text-ink-muted">
                Fulfilled recently · {fulfilled.length}
              </summary>
              <ul className="mt-3 divide-y divide-divider rounded-2xl border border-divider bg-surface">
                {fulfilled.slice(0, 25).map((r) => (
                  <li key={r.id} className="flex items-center justify-between gap-3 px-4 py-2 text-[12.5px]">
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium text-ink">
                        <Check className="mr-1 inline h-3 w-3 text-farm" />
                        {r.payoutReference ?? "no reference"}
                      </p>
                      <p className="text-[11px] text-ink-muted">
                        biz {r.businessId.slice(0, 8)} · fulfilled {r.fulfilledAt ? formatDistanceToNow(new Date(r.fulfilledAt), { addSuffix: true }) : ""}
                      </p>
                    </div>
                    <span className="shrink-0 tabular-nums text-ink-muted">{formatKes(r.amountKes)}</span>
                  </li>
                ))}
              </ul>
            </details>
          </section>
        )}
      </main>

      {fulfilling && (
        <FulfilDialog
          request={fulfilling}
          onClose={() => setFulfilling(null)}
          onFulfilled={() => {
            invalidate();
            setFulfilling(null);
          }}
        />
      )}
    </div>
  );
}

function FulfilDialog({
  request,
  onClose,
  onFulfilled,
}: {
  request: RefundRequest;
  onClose: () => void;
  onFulfilled: () => void;
}) {
  const [reference, setReference] = useState("");
  const [notes, setNotes] = useState("");

  const fulfil = useMutation({
    mutationFn: () => adminFulfilRefundRequest(request.id, reference.trim(), notes.trim() || undefined),
    onSuccess: () => {
      toast.success(`Refund of ${formatKes(request.amountKes)} marked fulfilled`);
      onFulfilled();
    },
    onError: (e: Error) => toast.error(e.message ?? "Fulfil failed"),
  });

  const canFulfil = reference.trim().length > 0 && !fulfil.isPending;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center" onClick={onClose}>
      <div
        className="w-full max-w-md rounded-t-3xl bg-background p-5 shadow-2xl sm:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-muted">Mark refunded</p>
            <p className="mt-1 text-[18px] font-bold tabular-nums text-ink">{formatKes(request.amountKes)}</p>
          </div>
          <button onClick={onClose} className="grid h-9 w-9 place-items-center rounded-full text-ink-muted hover:bg-muted">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="mt-4 space-y-3">
          <label className="block">
            <span className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-ink-muted">Payout reference</span>
            <input
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              placeholder="M-Pesa code or bank transfer ref"
              autoFocus
              className="w-full rounded-lg border border-divider bg-background px-3 py-2 text-[13px] focus:border-trust focus:outline-none focus:ring-2 focus:ring-trust/20"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-ink-muted">Notes (optional)</span>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder="Anything worth flagging"
              className="w-full rounded-lg border border-divider bg-background px-3 py-2 text-[13px] focus:border-trust focus:outline-none focus:ring-2 focus:ring-trust/20"
            />
          </label>
        </div>

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
            onClick={() => fulfil.mutate()}
            disabled={!canFulfil}
            className="flex-1 rounded-full bg-ink px-4 py-2.5 text-[13px] font-semibold text-background hover:bg-ink/90 disabled:opacity-60"
          >
            <Save className="mr-1 inline h-3.5 w-3.5" />
            {fulfil.isPending ? "Recording…" : "Confirm refund"}
          </button>
        </div>
      </div>
    </div>
  );
}
