// Consignment settlement admin API (Phase 2 Checkpoint J).
//
// Reads settlement_runs + settlement_lines under ops RLS (super_admin +
// platform_fulfilment_ops + marketplace_ops). Writes go through RPCs
// (fn_settlement_generate) or direct UPDATEs (state flips + payout ref).
//
// Cron auto-populates weekly on Monday 06:00 EAT; this API supports both
// browsing existing runs and ad-hoc generation for custom periods.

import { getSupabase } from "@/lib/supabase";

export type SettlementStatus = "draft" | "confirmed" | "invoiced" | "paid" | "cancelled";

export interface SettlementRun {
  id: string;
  supplierBusinessId: string;
  supplierName?: string | null;
  periodStart: string;
  periodEnd: string;
  status: SettlementStatus;
  goodsTotalKes: number;
  lineCount: number;
  generatedAt: string;
  confirmedAt: string | null;
  invoicedAt: string | null;
  paidAt: string | null;
  paidReference: string | null;
  notes: string | null;
}

export interface SettlementLine {
  id: string;
  runId: string;
  productId: string;
  productName: string;
  qtyConsumed: number;
  costRateKes: number;
  amountKes: number;
  sourceType: "consumer_order" | "tenant_order";
}

const num = (v: number | string | null | undefined): number =>
  v == null ? 0 : typeof v === "number" ? v : Number(v);

// ─── Reads ──────────────────────────────────────────────────────────────

export async function adminListSettlementRuns(): Promise<SettlementRun[]> {
  // Two-step: runs + business names (super_admin RLS bypasses the tenant
  // isolation on businesses, so we can look up supplier names in one shot).
  const { data: runs, error } = await getSupabase()
    .from("settlement_runs")
    .select("id, supplier_business_id, period_start, period_end, status, goods_total_kes, line_count, generated_at, confirmed_at, invoiced_at, paid_at, paid_reference, notes")
    .order("period_end", { ascending: false })
    .order("supplier_business_id", { ascending: true })
    .limit(200);
  if (error) throw error;

  const supplierIds = Array.from(new Set((runs ?? []).map((r) => r.supplier_business_id as string)));
  let nameById = new Map<string, string>();
  if (supplierIds.length > 0) {
    const { data: bizs } = await getSupabase()
      .from("businesses")
      .select("id, name")
      .in("id", supplierIds);
    nameById = new Map((bizs ?? []).map((b) => [b.id as string, b.name as string]));
  }

  return (runs ?? []).map((r) => ({
    id: r.id as string,
    supplierBusinessId: r.supplier_business_id as string,
    supplierName: nameById.get(r.supplier_business_id as string) ?? null,
    periodStart: r.period_start as string,
    periodEnd: r.period_end as string,
    status: r.status as SettlementStatus,
    goodsTotalKes: num(r.goods_total_kes as number | string),
    lineCount: r.line_count as number,
    generatedAt: r.generated_at as string,
    confirmedAt: (r.confirmed_at as string | null) ?? null,
    invoicedAt: (r.invoiced_at as string | null) ?? null,
    paidAt: (r.paid_at as string | null) ?? null,
    paidReference: (r.paid_reference as string | null) ?? null,
    notes: (r.notes as string | null) ?? null,
  }));
}

export async function adminListSettlementLines(runId: string): Promise<SettlementLine[]> {
  const { data, error } = await getSupabase()
    .from("settlement_lines")
    .select("id, run_id, product_id, product_name, qty_consumed, cost_rate_kes, amount_kes, source_type")
    .eq("run_id", runId)
    .order("amount_kes", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((r) => ({
    id: r.id as string,
    runId: r.run_id as string,
    productId: r.product_id as string,
    productName: r.product_name as string,
    qtyConsumed: num(r.qty_consumed as number | string),
    costRateKes: num(r.cost_rate_kes as number | string),
    amountKes: num(r.amount_kes as number | string),
    sourceType: r.source_type as "consumer_order" | "tenant_order",
  }));
}

// ─── Generate / advance ─────────────────────────────────────────────────

export async function adminGenerateSettlement(
  periodStart: string,
  periodEnd: string,
): Promise<number> {
  const { data, error } = await getSupabase().rpc("fn_settlement_generate", {
    p_period_start: periodStart,
    p_period_end: periodEnd,
  });
  if (error) throw error;
  return Array.isArray(data) ? data.length : 0;
}

async function updateRunStatus(
  runId: string,
  patch: Record<string, unknown>,
): Promise<void> {
  const { error } = await getSupabase()
    .from("settlement_runs")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", runId);
  if (error) throw error;
}

export async function adminConfirmSettlement(runId: string, opsUserId: string): Promise<void> {
  return updateRunStatus(runId, {
    status: "confirmed",
    confirmed_at: new Date().toISOString(),
    confirmed_by: opsUserId,
  });
}

export async function adminMarkInvoiced(runId: string): Promise<void> {
  return updateRunStatus(runId, {
    status: "invoiced",
    invoiced_at: new Date().toISOString(),
  });
}

export async function adminMarkSettlementPaid(
  runId: string,
  payoutReference: string,
): Promise<void> {
  return updateRunStatus(runId, {
    status: "paid",
    paid_at: new Date().toISOString(),
    paid_reference: payoutReference,
  });
}
