// Tradly Credit client API (Phase 2 Checkpoint H).
//
// Reads: vw_credit_balance + credit_ledger under RLS (buyer sees own).
// Writes: fn_credit_issue via admin surfaces only (SECURITY DEFINER +
//         role-gated inside). Households never call issue directly.
//
// Apply happens server-side inside fn_consumer_order_init; the client
// just passes credit_apply_kes on the checkout body.

import { getSupabase } from "@/lib/supabase";
import type {
  CreditBalance,
  CreditBucket,
  CreditLedgerEntry,
} from "../types/marketplace";

// ─── Balances ────────────────────────────────────────────────────────────

export async function listMyCreditBalance(): Promise<CreditBalance[]> {
  // vw_credit_balance is RLS-scoped by business_id via the same policy on
  // credit_ledger — buyer sees only their own aggregates.
  const { data, error } = await getSupabase()
    .from("vw_credit_balance")
    .select("bucket, balance_kes");
  if (error) throw error;
  return (data ?? []).map((r) => ({
    bucket: r.bucket as CreditBucket,
    balanceKes: Number(r.balance_kes),
  }));
}

/** Convenience: max spendable at checkout = sum of buckets. */
export function totalSpendable(balances: CreditBalance[]): number {
  return balances.reduce((s, b) => s + b.balanceKes, 0);
}

// ─── Ledger history ──────────────────────────────────────────────────────

export async function listMyCreditHistory(sinceDays = 90): Promise<CreditLedgerEntry[]> {
  const since = new Date(Date.now() - sinceDays * 86400_000).toISOString();
  const { data, error } = await getSupabase()
    .from("credit_ledger")
    .select("id, business_id, bucket, direction, amount_kes, reason, order_id, expires_at, created_at")
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) throw error;
  return (data ?? []).map((r) => ({
    id: r.id as string,
    businessId: r.business_id as string,
    bucket: r.bucket as CreditBucket,
    direction: r.direction as "credit" | "debit",
    amountKes: Number(r.amount_kes),
    reason: r.reason as string,
    orderId: (r.order_id as string | null) ?? null,
    expiresAt: (r.expires_at as string | null) ?? null,
    createdAt: r.created_at as string,
  }));
}

// ─── Admin: issue credit ─────────────────────────────────────────────────

export interface CreditIssueInput {
  businessId: string;
  bucket: CreditBucket;
  amountKes: number;
  reason: string;
  orderId?: string | null;
  expiresAt?: string | null;
  metadata?: Record<string, unknown> | null;
}

export async function adminIssueCredit(input: CreditIssueInput): Promise<string> {
  const { data, error } = await getSupabase().rpc("fn_credit_issue", {
    p_business_id: input.businessId,
    p_bucket:      input.bucket,
    p_amount_kes:  input.amountKes,
    p_reason:      input.reason,
    p_order_id:    input.orderId ?? null,
    p_expires_at:  input.expiresAt ?? null,
    p_created_by:  null,   // RPC falls back to auth.uid()
    p_metadata:    input.metadata ?? null,
  });
  if (error) throw error;
  return data as string;
}

// ─── Refund requests (spec §10 + §11.3) ─────────────────────────────────

export type RefundRequestStatus = "pending" | "processing" | "fulfilled" | "cancelled";

export interface RefundRequest {
  id: string;
  businessId: string;
  creditLedgerId: string | null;
  amountKes: number;
  status: RefundRequestStatus;
  requestedAt: string;
  fulfilledAt: string | null;
  payoutReference: string | null;
  notes: string | null;
}

function mapRefundRequest(r: Record<string, unknown>): RefundRequest {
  return {
    id: r.id as string,
    businessId: r.business_id as string,
    creditLedgerId: (r.credit_ledger_id as string | null) ?? null,
    amountKes: Number(r.amount_kes),
    status: r.status as RefundRequestStatus,
    requestedAt: r.requested_at as string,
    fulfilledAt: (r.fulfilled_at as string | null) ?? null,
    payoutReference: (r.payout_reference as string | null) ?? null,
    notes: (r.notes as string | null) ?? null,
  };
}

/** Buyer's own refund requests (RLS-scoped). */
export async function listMyRefundRequests(): Promise<RefundRequest[]> {
  const { data, error } = await getSupabase()
    .from("refund_requests")
    .select("id, business_id, credit_ledger_id, amount_kes, status, requested_at, fulfilled_at, payout_reference, notes")
    .order("requested_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map(mapRefundRequest);
}

export async function createRefundRequest(
  creditLedgerId: string,
  notes?: string,
): Promise<string> {
  const { data, error } = await getSupabase().rpc("fn_refund_request_create", {
    p_credit_ledger_id: creditLedgerId,
    p_notes: notes ?? null,
  });
  if (error) throw error;
  return data as string;
}

// ─── Admin refund-request queue + fulfil ────────────────────────────────

export async function adminListRefundRequests(
  statuses: RefundRequestStatus[] = ["pending", "processing"],
): Promise<RefundRequest[]> {
  const { data, error } = await getSupabase()
    .from("refund_requests")
    .select("id, business_id, credit_ledger_id, amount_kes, status, requested_at, fulfilled_at, payout_reference, notes")
    .in("status", statuses)
    .order("requested_at", { ascending: true });
  if (error) throw error;
  return (data ?? []).map(mapRefundRequest);
}

export async function adminFulfilRefundRequest(
  requestId: string,
  payoutReference: string,
  notes?: string,
): Promise<string> {
  const { data, error } = await getSupabase().rpc("fn_refund_request_fulfil", {
    p_request_id: requestId,
    p_payout_reference: payoutReference,
    p_notes: notes ?? null,
  });
  if (error) throw error;
  return data as string;
}

/**
 * List recent credit entries for any business — admin support view.
 * Uses the super_admin RLS bypass so ops can inspect a household without
 * being that household.
 */
export async function adminListCreditForBusiness(
  businessId: string,
  limit = 50,
): Promise<CreditLedgerEntry[]> {
  const { data, error } = await getSupabase()
    .from("credit_ledger")
    .select("id, business_id, bucket, direction, amount_kes, reason, order_id, expires_at, created_at")
    .eq("business_id", businessId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []).map((r) => ({
    id: r.id as string,
    businessId: r.business_id as string,
    bucket: r.bucket as CreditBucket,
    direction: r.direction as "credit" | "debit",
    amountKes: Number(r.amount_kes),
    reason: r.reason as string,
    orderId: (r.order_id as string | null) ?? null,
    expiresAt: (r.expires_at as string | null) ?? null,
    createdAt: r.created_at as string,
  }));
}
