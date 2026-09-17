// Buyer-facing credit + refunds page (Phase 2 Checkpoint H, reframed for K).
//
// Two independent surfaces on one page:
//   - Store credit (promotional bucket) — spend-only at Tradly, framed as a gift
//   - Refunds owed (refundable bucket) — each entry is an event tied to a paid
//     order; settled back to the original payment method, never pooled into a
//     cashable balance. See plans/checkpoint-k-restructured.md for the framing
//     rationale: pooling cashable value into a user-drawable balance reads as
//     e-money issuance under CBK. Refund-to-source keeps Tradly on the biller
//     side of the line.
//
// Individuals only — companies don't have credit at launch (spec §4.3).

import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { format } from "date-fns";
import { ArrowUpRight, BanknoteArrowUp, Gift, Loader2 } from "lucide-react";
import { AppShell } from "../marketplace/components/AppShell";
import { TrustHeader } from "../marketplace/components/TrustHeader";
import { friendlyError } from "../marketplace/lib/friendlyError";
import { useAuth } from "@/hooks/use-auth";
import {
  createRefundRequest,
  listMyCreditBalance,
  listMyCreditHistory,
  listMyRefundRequests,
  type RefundRequest,
} from "../marketplace/api/credit";
import { formatKes } from "../marketplace/lib/format";
import type { CreditBucket } from "../marketplace/types/marketplace";

export const Route = createFileRoute("/account/credit")({
  head: () => ({
    meta: [
      { title: "Store credit & refunds — Tradly Market" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: CreditPage,
});

const BUCKET_META: Record<CreditBucket, { label: string; icon: typeof Gift; hint: string }> = {
  refundable: {
    label: "Refunds owed",
    icon: BanknoteArrowUp,
    hint: "Refunds tied to specific orders — each one is settled back to the way you paid.",
  },
  promotional: {
    label: "Store credit",
    icon: Gift,
    hint: "A gift from Tradly — spend it on your next order. Not cash, not withdrawable.",
  },
};

function CreditPage() {
  const navigate = useNavigate();
  const { isAuthenticated, isInitializing, buyer } = useAuth();

  if (!isInitializing && !isAuthenticated) {
    navigate({ to: "/login", search: { next: "/account/credit" } });
  }

  const { data: balances = [], isLoading: balancesLoading } = useQuery({
    queryKey: ["credit-balance"],
    queryFn: listMyCreditBalance,
    enabled: isAuthenticated,
  });
  const { data: history = [], isLoading: historyLoading } = useQuery({
    queryKey: ["credit-history"],
    queryFn: () => listMyCreditHistory(90),
    enabled: isAuthenticated,
  });
  const { data: refundRequests = [] } = useQuery({
    queryKey: ["refund-requests"],
    queryFn: listMyRefundRequests,
    enabled: isAuthenticated,
  });

  const qc = useQueryClient();
  const requestRefund = useMutation({
    mutationFn: (creditLedgerId: string) => createRefundRequest(creditLedgerId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["refund-requests"] });
      toast.success("Refund request sent — ops will process shortly.");
    },
    onError: (e: Error) => toast.error(friendlyError(e, "Could not send your refund request. Please try again.")),
  });

  // Index refund_requests by the credit they reference so we can render
  // the right CTA/status per credit-history row without an N+1 lookup.
  const refundByCredit = useMemo(() => {
    const map = new Map<string, RefundRequest>();
    for (const r of refundRequests) {
      if (r.creditLedgerId) map.set(r.creditLedgerId, r);
    }
    return map;
  }, [refundRequests]);

  if (isInitializing || !isAuthenticated) {
    return (
      <AppShell>
        <div className="px-4">
          <TrustHeader title="Credit" back="/account" />
          <p className="py-16 text-center text-sm text-ink-muted">Checking your session…</p>
        </div>
      </AppShell>
    );
  }

  // Companies use a different accounts model.
  if (buyer?.businessType === "company") {
    return (
      <AppShell>
        <div className="px-4">
          <TrustHeader title="Credit" back="/account" />
          <div className="mx-auto mt-8 max-w-md rounded-2xl border border-divider bg-surface p-6 text-center">
            <p className="text-[14px] font-semibold text-ink">Not available for company workspaces.</p>
            <p className="mt-2 text-[13px] text-ink-muted">
              Tradly Credit is a household feature. Company workspaces pay via monthly invoice.
            </p>
            <Link to="/account" className="mt-4 inline-block rounded-full bg-ink px-4 py-2 text-[13px] font-semibold text-background">
              Back to account
            </Link>
          </div>
        </div>
      </AppShell>
    );
  }

  const byBucket = new Map(balances.map((b) => [b.bucket, b.balanceKes]));
  const refundable  = byBucket.get("refundable") ?? 0;
  const promotional = byBucket.get("promotional") ?? 0;

  return (
    <AppShell>
      <div className="px-4 pb-24 lg:px-8">
        <TrustHeader title="Store credit & refunds" back="/account" />

        {/* Two independent cards — deliberately not summed. Store credit is
            spend-only-at-Tradly; refunds owed are per-order debts settled back
            to the original payment method. Presenting them as one "balance"
            implies pooled cashable value, which is the framing we're avoiding. */}
        <section className="mt-4 grid gap-3 md:grid-cols-2">
          {balancesLoading ? (
            <div className="col-span-full rounded-3xl border border-divider bg-surface p-5">
              <div className="flex justify-center py-4"><Loader2 className="h-5 w-5 animate-spin text-ink-muted" /></div>
            </div>
          ) : (
            <>
              <BalanceCard
                title="Store credit"
                amountKes={promotional}
                icon={Gift}
                accent="farm"
                hint="Applied automatically to your next order. Not cash."
              />
              <BalanceCard
                title="Refunds owed"
                amountKes={refundable}
                icon={BanknoteArrowUp}
                accent="trust"
                hint={
                  refundable > 0
                    ? "Each refund below is being sent back to the way you paid."
                    : "Nothing outstanding. Refunds appear here per order."
                }
              />
            </>
          )}
        </section>

        {/* Explainer */}
        <section className="mt-4 rounded-2xl border border-divider bg-surface p-4 text-[12.5px] text-ink-muted">
          <p>
            <strong className="text-ink">Store credit</strong> applies to your next order
            automatically at checkout — it's a gift from Tradly, spend-only, never
            withdrawable to M-Pesa or bank.
          </p>
          <p className="mt-2">
            <strong className="text-ink">Refunds</strong> for shortfalls and cancellations
            are sent back to the way you paid — same card, same M-Pesa number. Each one is
            tied to a specific order below and settled automatically. Nothing to do on your
            end; questions go to{" "}
            <Link to="/contact" className="font-semibold text-ink underline decoration-divider underline-offset-2 hover:decoration-ink">
              /contact
            </Link>
            .
          </p>
        </section>

        {/* History */}
        <section className="mt-6">
          <p className="mb-2 text-[12px] font-semibold uppercase tracking-wide text-ink-muted">
            Recent activity
          </p>

          {historyLoading && (
            <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-ink-muted" /></div>
          )}

          {!historyLoading && history.length === 0 && (
            <div className="rounded-2xl border border-dashed border-divider py-10 text-center text-[13px] text-ink-muted">
              No credit activity in the last 90 days.
            </div>
          )}

          <ul className="divide-y divide-divider rounded-2xl border border-divider bg-surface">
            {history.map((e) => {
              const isCredit = e.direction === "credit";
              const isPromo = e.bucket === "promotional";
              const meta = BUCKET_META[e.bucket];
              const Icon = isCredit ? meta.icon : ArrowUpRight;
              // Refund CTA is meaningful only on refundable CREDIT rows
              // (money we owe back). Debits + promotional rows don't qualify.
              const refundEligible = isCredit && e.bucket === "refundable";
              const existingRequest = refundEligible ? refundByCredit.get(e.id) : undefined;
              return (
                <li key={e.id} className="flex items-start gap-3 px-4 py-3">
                  <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-full ${
                    isCredit ? (isPromo ? "bg-farm/12 text-farm" : "bg-trust/12 text-trust-deep")
                             : "bg-muted text-ink-muted"
                  }`}>
                    <Icon className="h-4 w-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-[13.5px] font-semibold text-ink">
                      {humaniseReason(e.reason)}
                    </p>
                    <p className="text-[11.5px] text-ink-muted">
                      {format(new Date(e.createdAt), "d MMM yyyy · HH:mm")}
                      {" · "}
                      <span className={isPromo ? "text-farm" : "text-trust-deep"}>{meta.label}</span>
                      {e.orderId && (
                        <>
                          {" · "}
                          <Link
                            to="/order/$id"
                            params={{ id: e.orderId }}
                            className="hover:underline"
                          >
                            View order
                          </Link>
                        </>
                      )}
                    </p>
                    {e.expiresAt && isCredit && (
                      <p className="mt-0.5 text-[10.5px] italic text-amber-700">
                        Expires {format(new Date(e.expiresAt), "d MMM yyyy")}
                      </p>
                    )}
                    {refundEligible && (
                      <RefundCta
                        request={existingRequest}
                        onRequest={() => requestRefund.mutate(e.id)}
                        pending={requestRefund.isPending && requestRefund.variables === e.id}
                      />
                    )}
                  </div>
                  <span className={`shrink-0 text-[14px] font-semibold tabular-nums ${
                    isCredit ? "text-ink" : "text-ink-muted"
                  }`}>
                    {isCredit ? "+" : "−"}{formatKes(e.amountKes)}
                  </span>
                </li>
              );
            })}
          </ul>
        </section>
      </div>
    </AppShell>
  );
}

function BalanceCard({
  title,
  amountKes,
  icon: Icon,
  accent,
  hint,
}: {
  title: string;
  amountKes: number;
  icon: typeof Gift;
  accent: "farm" | "trust";
  hint: string;
}) {
  const accentBg = accent === "farm" ? "bg-farm/12 text-farm" : "bg-trust/12 text-trust-deep";
  return (
    <div className="rounded-3xl border border-divider bg-surface p-5">
      <div className="flex items-center gap-2">
        <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-full ${accentBg}`}>
          <Icon className="h-3.5 w-3.5" />
        </span>
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-muted">{title}</p>
      </div>
      <p className="mt-2 text-[28px] font-bold tabular-nums text-ink">{formatKes(amountKes)}</p>
      <p className="mt-1 text-[11.5px] leading-relaxed text-ink-muted">{hint}</p>
    </div>
  );
}

function RefundCta({
  request,
  onRequest,
  pending,
}: {
  request: RefundRequest | undefined;
  onRequest: () => void;
  pending: boolean;
}) {
  if (request?.status === "fulfilled") {
    return (
      <p className="mt-1.5 text-[10.5px] text-farm">
        Refunded {request.fulfilledAt ? format(new Date(request.fulfilledAt), "d MMM") : ""}
        {request.payoutReference && <> · ref {request.payoutReference}</>}
      </p>
    );
  }
  if (request?.status === "pending" || request?.status === "processing") {
    return (
      <p className="mt-1.5 text-[10.5px] font-medium text-trust-deep">
        Refund on the way — sending back to the way you paid
      </p>
    );
  }
  return (
    <button
      type="button"
      onClick={onRequest}
      disabled={pending}
      className="mt-2 inline-flex items-center gap-1 rounded-full border border-divider bg-background px-2.5 py-1 text-[10.5px] font-semibold text-ink hover:border-ink/40 disabled:opacity-60"
    >
      <BanknoteArrowUp className="h-3 w-3" />
      {pending ? "Sending…" : "Send this refund back"}
    </button>
  );
}

function humaniseReason(reason: string): string {
  switch (reason) {
    case "order_payment": return "Applied to order";
    case "shortfall":     return "Shortfall on order";
    case "cancellation":  return "Order cancellation";
    case "referral":      return "Referral bonus";
    case "goodwill":      return "Goodwill from Tradly";
    case "launch":        return "Launch credit";
    case "refund_manual": return "Refunded by ops";
    default:              return reason.replace(/_/g, " ");
  }
}
