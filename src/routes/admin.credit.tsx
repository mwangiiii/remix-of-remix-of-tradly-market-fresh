// Admin: issue Tradly Credit (Phase 2 Checkpoint H — H-admin-credit).
//
// Ops looks up a business (by email, phone, or UUID), picks a bucket +
// amount + reason, optionally sets an expiry (promotional only), and
// hits Issue. Backed by fn_credit_issue (SECURITY DEFINER + role gate).
//
// Also shows recent ledger entries for that business so ops can spot
// duplicate issuances before hitting the button.

import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { format } from "date-fns";
import { ArrowLeft, Gift, Loader2, Save, Search, Wallet } from "lucide-react";
import { RequireAdmin } from "@/components/RequireAdmin";
import { getSupabase } from "@/lib/supabase";
import {
  adminIssueCredit,
  adminListCreditForBusiness,
} from "../marketplace/api/credit";
import { formatKes } from "../marketplace/lib/format";
import type { CreditBucket } from "../marketplace/types/marketplace";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const Route = createFileRoute("/admin/credit")({
  head: () => ({
    meta: [{ title: "Credit — Tradly Admin" }, { name: "robots", content: "noindex" }],
  }),
  component: () => (
    <RequireAdmin>
      <CreditAdmin />
    </RequireAdmin>
  ),
});

interface FoundBusiness {
  id: string;
  name: string;
  businessType: string | null;
  email: string | null;
  phone: string | null;
}

async function lookupBusiness(query: string): Promise<FoundBusiness[]> {
  const q = query.trim();
  if (!q) return [];
  const sb = getSupabase();
  if (UUID_RE.test(q)) {
    const { data, error } = await sb
      .from("businesses")
      .select("id, name, business_type, email, phone")
      .eq("id", q)
      .maybeSingle();
    if (error) throw error;
    return data ? [mapBiz(data)] : [];
  }
  // Ilike on email OR phone. Super_admin RLS bypass makes this a full scan
  // limited to a small result — fine at Phase-2 volume (dozens of households).
  const like = `%${q}%`;
  const { data, error } = await sb
    .from("businesses")
    .select("id, name, business_type, email, phone")
    .or(`email.ilike.${like},phone.ilike.${like},name.ilike.${like}`)
    .limit(20);
  if (error) throw error;
  return (data ?? []).map(mapBiz);
}

function mapBiz(r: Record<string, unknown>): FoundBusiness {
  return {
    id: r.id as string,
    name: (r.name as string) ?? "(no name)",
    businessType: (r.business_type as string) ?? null,
    email: (r.email as string | null) ?? null,
    phone: (r.phone as string | null) ?? null,
  };
}

function CreditAdmin() {
  const qc = useQueryClient();
  const [query, setQuery] = useState("");
  const [ranQuery, setRanQuery] = useState("");
  const [selected, setSelected] = useState<FoundBusiness | null>(null);

  const search = useQuery({
    queryKey: ["admin", "credit", "lookup", ranQuery],
    queryFn: () => lookupBusiness(ranQuery),
    enabled: ranQuery.length > 0,
  });

  const history = useQuery({
    queryKey: ["admin", "credit", "history", selected?.id],
    queryFn: () => adminListCreditForBusiness(selected!.id, 50),
    enabled: !!selected?.id,
  });

  const [form, setForm] = useState<{
    bucket: CreditBucket;
    amountKes: string;   // string in state so blank input renders cleanly
    reason: string;
    expiresAt: string;   // YYYY-MM-DD, optional
  }>({ bucket: "promotional", amountKes: "", reason: "goodwill", expiresAt: "" });

  const canIssue = useMemo(() => {
    const amt = Number(form.amountKes);
    return !!selected && Number.isFinite(amt) && amt > 0 && form.reason.trim().length > 0;
  }, [selected, form]);

  const issue = useMutation({
    mutationFn: () => {
      if (!selected) throw new Error("Pick a business first");
      const amt = Number(form.amountKes);
      return adminIssueCredit({
        businessId: selected.id,
        bucket: form.bucket,
        amountKes: amt,
        reason: form.reason.trim(),
        expiresAt: form.bucket === "promotional" && form.expiresAt
          ? new Date(form.expiresAt + "T23:59:59+03:00").toISOString()
          : null,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "credit", "history"] });
      toast.success(`Issued ${formatKes(Number(form.amountKes))} ${form.bucket} to ${selected?.name}`);
      setForm((f) => ({ ...f, amountKes: "" }));
    },
    onError: (e: Error) => toast.error(e.message ?? "Issue failed"),
  });

  return (
    <div className="min-h-screen bg-background text-ink">
      <header className="sticky top-0 z-30 border-b border-trust-deep/40 bg-trust-deep text-trust-deep-foreground">
        <div className="mx-auto flex max-w-5xl items-center gap-4 px-6 py-3.5">
          <Link to="/admin" className="grid h-9 w-9 place-items-center rounded-full hover:bg-white/10" aria-label="Back">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] opacity-70">Tradly Admin</p>
            <h1 className="text-[15px] font-semibold">Credit</h1>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 pb-24 pt-6 md:px-6">
        <p className="max-w-2xl text-[13px] leading-relaxed text-ink-muted">
          Issue Tradly Credit to a household. Promotional (given by us) is not
          withdrawable; refundable (owed back) can be cashed out on request.
        </p>

        {/* Lookup */}
        <section className="mt-5 rounded-2xl border border-divider bg-surface p-4">
          <div className="flex gap-2">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { setRanQuery(query); setSelected(null); } }}
              placeholder="Email, phone, name, or business UUID"
              className="flex-1 rounded-full border border-divider bg-background px-4 py-2 text-[13px] focus:border-trust focus:outline-none focus:ring-2 focus:ring-trust/20"
            />
            <button
              type="button"
              onClick={() => { setRanQuery(query); setSelected(null); }}
              className="inline-flex items-center gap-1.5 rounded-full bg-ink px-4 py-2 text-[13px] font-semibold text-background hover:bg-ink/90"
            >
              <Search className="h-4 w-4" /> Look up
            </button>
          </div>

          {ranQuery.length > 0 && search.isLoading && (
            <div className="mt-3 flex justify-center py-4"><Loader2 className="h-4 w-4 animate-spin text-ink-muted" /></div>
          )}
          {ranQuery.length > 0 && !search.isLoading && (search.data ?? []).length === 0 && (
            <p className="mt-3 text-[12px] text-ink-muted">No matches for "{ranQuery}".</p>
          )}
          {(search.data ?? []).length > 0 && (
            <ul className="mt-3 space-y-1">
              {search.data!.map((b) => {
                const active = selected?.id === b.id;
                return (
                  <li key={b.id}>
                    <button
                      type="button"
                      onClick={() => setSelected(b)}
                      className={`flex w-full items-start justify-between gap-2 rounded-xl border px-3 py-2 text-left transition-colors ${
                        active ? "border-ink bg-ink/5" : "border-divider bg-background hover:border-ink/40"
                      }`}
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-[13px] font-semibold text-ink">
                          {b.name}
                          {b.businessType && (
                            <span className="ml-1.5 text-[10px] font-normal text-ink-muted uppercase tracking-wide">
                              {b.businessType}
                            </span>
                          )}
                        </p>
                        <p className="text-[11px] text-ink-muted">
                          {b.email ?? "no email"} · {b.phone ?? "no phone"}
                        </p>
                        <p className="mt-0.5 font-mono text-[10.5px] text-ink-muted">{b.id}</p>
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {selected && (
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            {/* Issue form */}
            <section className="rounded-2xl border border-divider bg-surface p-4">
              <p className="text-[12px] font-semibold uppercase tracking-wide text-ink-muted">
                Issue to {selected.name}
              </p>
              <div className="mt-3 space-y-3">
                <label className="block">
                  <span className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-ink-muted">Bucket</span>
                  <div className="grid grid-cols-2 gap-2">
                    {(["promotional","refundable"] as CreditBucket[]).map((b) => {
                      const active = form.bucket === b;
                      const Icon = b === "promotional" ? Gift : Wallet;
                      return (
                        <button
                          key={b}
                          type="button"
                          onClick={() => setForm((f) => ({ ...f, bucket: b, expiresAt: b === "refundable" ? "" : f.expiresAt }))}
                          className={`rounded-xl border px-3 py-2 text-left text-[13px] transition-colors ${
                            active ? "border-ink bg-ink text-background" : "border-divider bg-background text-ink hover:border-ink/40"
                          }`}
                        >
                          <Icon className={`h-4 w-4 ${active ? "" : "text-ink-muted"}`} />
                          <p className="mt-1 font-semibold">{b === "promotional" ? "Promotional" : "Refundable"}</p>
                          <p className={`mt-0.5 text-[10.5px] ${active ? "text-background/80" : "text-ink-muted"}`}>
                            {b === "promotional" ? "Given by us — spend-only" : "Owed back — cashable"}
                          </p>
                        </button>
                      );
                    })}
                  </div>
                </label>

                <label className="block">
                  <span className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-ink-muted">Amount (KES)</span>
                  <input
                    type="number"
                    min="1"
                    step="1"
                    value={form.amountKes}
                    onChange={(e) => setForm((f) => ({ ...f, amountKes: e.target.value }))}
                    placeholder="500"
                    className="w-full rounded-lg border border-divider bg-background px-3 py-2 text-[13px] focus:border-trust focus:outline-none focus:ring-2 focus:ring-trust/20"
                  />
                </label>

                <label className="block">
                  <span className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-ink-muted">Reason</span>
                  <select
                    value={form.reason}
                    onChange={(e) => setForm((f) => ({ ...f, reason: e.target.value }))}
                    className="w-full rounded-lg border border-divider bg-background px-3 py-2 text-[13px] focus:border-trust focus:outline-none focus:ring-2 focus:ring-trust/20"
                  >
                    <option value="goodwill">goodwill</option>
                    <option value="launch">launch</option>
                    <option value="referral">referral</option>
                    <option value="shortfall">shortfall</option>
                    <option value="cancellation">cancellation</option>
                    <option value="refund_manual">refund_manual</option>
                  </select>
                </label>

                {form.bucket === "promotional" && (
                  <label className="block">
                    <span className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-ink-muted">Expires (optional)</span>
                    <input
                      type="date"
                      value={form.expiresAt}
                      onChange={(e) => setForm((f) => ({ ...f, expiresAt: e.target.value }))}
                      className="w-full rounded-lg border border-divider bg-background px-3 py-2 text-[13px] focus:border-trust focus:outline-none focus:ring-2 focus:ring-trust/20"
                    />
                    <span className="mt-1 block text-[10.5px] text-ink-muted">Blank = never expires.</span>
                  </label>
                )}

                <button
                  type="button"
                  onClick={() => issue.mutate()}
                  disabled={!canIssue || issue.isPending}
                  className="inline-flex items-center gap-1.5 rounded-full bg-ink px-4 py-2 text-[13px] font-semibold text-background hover:bg-ink/90 disabled:opacity-60"
                >
                  <Save className="h-3.5 w-3.5" /> {issue.isPending ? "Issuing…" : "Issue credit"}
                </button>
              </div>
            </section>

            {/* Recent history for the selected business */}
            <section className="rounded-2xl border border-divider bg-surface p-4">
              <p className="text-[12px] font-semibold uppercase tracking-wide text-ink-muted">
                Recent activity ({history.data?.length ?? 0})
              </p>
              {history.isLoading && (
                <div className="mt-3 flex justify-center py-4"><Loader2 className="h-4 w-4 animate-spin text-ink-muted" /></div>
              )}
              {!history.isLoading && (history.data ?? []).length === 0 && (
                <p className="mt-3 text-[12px] text-ink-muted">No credit activity yet.</p>
              )}
              <ul className="mt-3 divide-y divide-divider max-h-96 overflow-y-auto">
                {(history.data ?? []).map((e) => (
                  <li key={e.id} className="flex items-center justify-between gap-2 py-2 text-[12px]">
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-ink truncate">{e.reason}</p>
                      <p className="text-[10.5px] text-ink-muted">
                        {format(new Date(e.createdAt), "d MMM · HH:mm")}
                        {" · "}
                        <span className={e.bucket === "promotional" ? "text-farm" : "text-trust-deep"}>{e.bucket}</span>
                      </p>
                    </div>
                    <span className={`shrink-0 text-[13px] font-semibold tabular-nums ${
                      e.direction === "credit" ? "text-ink" : "text-ink-muted"
                    }`}>
                      {e.direction === "credit" ? "+" : "−"}{formatKes(e.amountKes)}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          </div>
        )}
      </main>
    </div>
  );
}
