// Household Commerce consumer-order client API (spec Checkpoint E).
//
// Reads: direct PostgREST against consumer_orders + consumer_order_lines
//        (RLS-scoped by current_business_id()).
// Writes: consumer-order-init / consumer-order-cancel Edge Functions
//        (via the shared axios `api` client that carries the auth cookie).

import { getSupabase } from "@/lib/supabase";
import { apiPost } from "@/services/api";
import type {
  ConsumerOrder,
  ConsumerOrderLine,
  ConsumerOrderStatus,
  FulfilmentMethod,
  SellMode,
} from "../types/marketplace";

// ─── Row shapes ──────────────────────────────────────────────────────────

type ConsumerOrderLineRow = {
  id: string;
  order_id: string;
  product_id: string;
  price_version_id: string;
  product_name: string;
  sell_mode: SellMode;
  base_unit: string;
  qty: number | string;
  shelf_rate_kes: number | string;
  line_total_kes: number | string;
  status: "ordered" | "cancelled";
};

type ConsumerOrderRow = {
  id: string;
  order_number: string;
  business_id: string;
  status: ConsumerOrderStatus;
  fulfilment_method: FulfilmentMethod;
  delivery_address_id: string | null;
  zone_id: string | null;
  requested_date: string | null;
  goods_total_kes: number | string;
  delivery_fee_kes: number | string;
  credit_applied_kes: number | string;
  rounding_delta_kes: number | string;
  total_kes: number | string;
  paystack_reference: string | null;
  paid_at: string | null;
  created_at: string;
  consumer_order_lines: ConsumerOrderLineRow[] | null;
};

const num = (v: number | string | null | undefined): number =>
  v == null ? 0 : typeof v === "number" ? v : Number(v);

function mapLine(r: ConsumerOrderLineRow): ConsumerOrderLine {
  return {
    id: r.id,
    orderId: r.order_id,
    productId: r.product_id,
    priceVersionId: r.price_version_id,
    productName: r.product_name,
    sellMode: r.sell_mode,
    baseUnit: r.base_unit,
    qty: num(r.qty),
    shelfRateKes: num(r.shelf_rate_kes),
    lineTotalKes: num(r.line_total_kes),
    status: r.status,
  };
}

function mapOrder(r: ConsumerOrderRow): ConsumerOrder {
  return {
    id: r.id,
    orderNumber: r.order_number,
    businessId: r.business_id,
    status: r.status,
    fulfilmentMethod: r.fulfilment_method,
    deliveryAddressId: r.delivery_address_id,
    zoneId: r.zone_id,
    requestedDate: r.requested_date,
    goodsTotalKes: num(r.goods_total_kes),
    deliveryFeeKes: num(r.delivery_fee_kes),
    creditAppliedKes: num(r.credit_applied_kes),
    roundingDeltaKes: num(r.rounding_delta_kes),
    totalKes: num(r.total_kes),
    paystackReference: r.paystack_reference,
    paidAt: r.paid_at,
    createdAt: r.created_at,
    lines: (r.consumer_order_lines ?? []).map(mapLine),
  };
}

const ORDER_SELECT = `
  id, order_number, business_id, status, fulfilment_method,
  delivery_address_id, zone_id, requested_date,
  goods_total_kes, delivery_fee_kes, credit_applied_kes, rounding_delta_kes, total_kes,
  paystack_reference, paid_at, created_at,
  consumer_order_lines (
    id, order_id, product_id, price_version_id, product_name,
    sell_mode, base_unit, qty, shelf_rate_kes, line_total_kes, status
  )
`;

// ─── Reads ────────────────────────────────────────────────────────────────

export async function getConsumerOrder(id: string): Promise<ConsumerOrder | null> {
  const { data, error } = await getSupabase()
    .from("consumer_orders")
    .select(ORDER_SELECT)
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data ? mapOrder(data as unknown as ConsumerOrderRow) : null;
}

/**
 * Look up a consumer order by its Paystack reference. Used by the
 * /order/callback route to resolve the reference Paystack appends to the
 * post-payment redirect back into an order id.
 */
export async function getConsumerOrderByReference(
  reference: string,
): Promise<ConsumerOrder | null> {
  const { data, error } = await getSupabase()
    .from("consumer_orders")
    .select(ORDER_SELECT)
    .eq("paystack_reference", reference)
    .maybeSingle();
  if (error) throw error;
  return data ? mapOrder(data as unknown as ConsumerOrderRow) : null;
}

export async function listMyConsumerOrders(): Promise<ConsumerOrder[]> {
  const { data, error } = await getSupabase()
    .from("consumer_orders")
    .select(ORDER_SELECT)
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) throw error;
  return (data ?? []).map((r) => mapOrder(r as unknown as ConsumerOrderRow));
}

// ─── Writes (via Edge Functions) ─────────────────────────────────────────

export interface ConsumerOrderInitLine {
  product_id: string;
  qty: number;
}

export interface ConsumerOrderInitInput {
  lines: ConsumerOrderInitLine[];
  fulfilmentMethod: FulfilmentMethod;
  deliveryAddressId: string | null;
  requestedDate: string;         // YYYY-MM-DD
  idempotencyKey: string;        // UUID
  callbackUrl: string;           // where Paystack redirects after payment
  /** Tradly Credit the buyer wants to burn; server caps by pre-credit total. */
  creditApplyKes?: number;
}

export interface ConsumerOrderInitResult {
  order_id: string;
  order_number: string;
  amount_kes: number;
  /** Actual credit consumed (≤ requested). May differ if balance short. */
  credit_applied_kes: number;
  paystack_reference: string;
  paystack_authorization_url: string;
  is_new: boolean;
}

/**
 * POST /functions/v1/consumer-order-init.
 *
 * Reprices the cart server-side, reserves stock, creates the order row,
 * initializes Paystack, and returns an authorization_url the browser
 * should redirect to. Idempotent on `idempotencyKey` — a retry with the
 * same key reuses the existing order and issues a fresh Paystack ref.
 */
export async function submitConsumerOrder(
  input: ConsumerOrderInitInput,
): Promise<ConsumerOrderInitResult> {
  return apiPost<ConsumerOrderInitResult>("/consumer-order-init", {
    lines: input.lines,
    fulfilment_method: input.fulfilmentMethod,
    delivery_address_id: input.deliveryAddressId,
    requested_date: input.requestedDate,
    idempotency_key: input.idempotencyKey,
    callback_url: input.callbackUrl,
    credit_apply_kes: input.creditApplyKes ?? 0,
  });
}

// ─── Admin: list + advance consumer orders (F3 unblock) ─────────────────
// Super-admins bypass the buyer-scoped RLS via the super_admin_all policy,
// so these direct-table reads/writes work under the admin JWT.

export async function adminListConsumerOrders(): Promise<ConsumerOrder[]> {
  const { data, error } = await getSupabase()
    .from("consumer_orders")
    .select(ORDER_SELECT)
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) throw error;
  return (data ?? []).map((r) => mapOrder(r as unknown as ConsumerOrderRow));
}

/**
 * Direct status flip for ops. Guards the transition graph client-side (the
 * DB CHECK only enforces the value is in the enum, not the transition
 * chain). Legal transitions:
 *
 *   paid       → picking
 *   picking    → dispatched
 *   dispatched → delivered
 *
 * Cancel + expire go through their own paths (consumer-order-cancel Edge
 * Function; the sweep cron). Payment (pending_payment → paid) is
 * webhook-only.
 */
const NEXT_STATUS: Partial<Record<ConsumerOrderStatus, ConsumerOrderStatus>> = {
  paid: "picking",
  picking: "dispatched",
  dispatched: "delivered",
};

export function nextConsumerStatus(
  current: ConsumerOrderStatus,
): ConsumerOrderStatus | null {
  return NEXT_STATUS[current] ?? null;
}

/**
 * Ops marks a specific order line unavailable (spec §10). RPC atomically
 * cancels the line, releases its stock reservation, issues refundable
 * credit for the line total, and notifies the buyer.
 */
export interface ShortfallResult {
  ok: true;
  line_id: string;
  order_id: string;
  credit_ledger_id: string;
  amount_kes: number;
}

export async function adminMarkLineShortfall(
  lineId: string,
): Promise<ShortfallResult> {
  const { data, error } = await getSupabase().rpc(
    "fn_consumer_order_line_shortfall",
    { p_line_id: lineId },
  );
  if (error) throw error;
  return data as ShortfallResult;
}

export async function adminAdvanceConsumerOrder(
  orderId: string,
  currentStatus: ConsumerOrderStatus,
): Promise<ConsumerOrderStatus> {
  const nextStatus = NEXT_STATUS[currentStatus];
  if (!nextStatus) {
    throw new Error(`Cannot advance from ${currentStatus}`);
  }
  // Atomic guard on `status = currentStatus` catches races with the sweep
  // or a concurrent cancel — 0 rows means we lost the race.
  const { data, error } = await getSupabase()
    .from("consumer_orders")
    .update({ status: nextStatus, updated_at: new Date().toISOString() })
    .eq("id", orderId)
    .eq("status", currentStatus)
    .select("status")
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error(`Order state changed under us; refresh and retry`);
  return data.status as ConsumerOrderStatus;
}

export interface ConsumerOrderCancelResult {
  order_id: string;
  order_number: string;
  status: "cancelled";
  needs_refund: boolean;
}

export async function cancelConsumerOrder(
  orderId: string,
  reason?: string,
): Promise<ConsumerOrderCancelResult> {
  return apiPost<ConsumerOrderCancelResult>("/consumer-order-cancel", {
    order_id: orderId,
    reason,
  });
}
