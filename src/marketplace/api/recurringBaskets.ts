// Recurring-baskets client API (Phase 3 Checkpoint L).
//
// Reads: recurring_baskets + recurring_basket_runs under buyer-own RLS.
// Writes: fn_recurring_basket_upsert + _skip RPCs; direct DELETE for
//         removal (RLS blocks other buyers' rows).

import { getSupabase } from "@/lib/supabase";
import type {
  FulfilmentMethod,
  RecurringBasket,
  RecurringBasketLine,
  RecurringBasketRun,
  RecurringCadence,
} from "../types/marketplace";

type BasketRow = {
  id: string;
  business_id: string;
  name: string;
  lines: RecurringBasketLine[];
  cadence: RecurringCadence;
  next_run_at: string;
  fulfilment_method: FulfilmentMethod;
  delivery_address_id: string | null;
  is_active: boolean;
  pause_until: string | null;
  created_at: string;
  updated_at: string | null;
};

function mapBasket(r: BasketRow): RecurringBasket {
  return {
    id: r.id,
    businessId: r.business_id,
    name: r.name,
    lines: r.lines ?? [],
    cadence: r.cadence,
    nextRunAt: r.next_run_at,
    fulfilmentMethod: r.fulfilment_method,
    deliveryAddressId: r.delivery_address_id,
    isActive: r.is_active,
    pauseUntil: r.pause_until,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

const BASKET_SELECT = "id, business_id, name, lines, cadence, next_run_at, fulfilment_method, delivery_address_id, is_active, pause_until, created_at, updated_at";

// ─── Reads ──────────────────────────────────────────────────────────────

export async function listMyRecurringBaskets(): Promise<RecurringBasket[]> {
  const { data, error } = await getSupabase()
    .from("recurring_baskets")
    .select(BASKET_SELECT)
    .order("next_run_at", { ascending: true });
  if (error) throw error;
  return (data ?? []).map((r) => mapBasket(r as unknown as BasketRow));
}

/**
 * List runs for a specific basket (last 20). Used to render "notification
 * fired today, awaiting confirm" on the manage page.
 */
export async function listBasketRuns(basketId: string): Promise<RecurringBasketRun[]> {
  const { data, error } = await getSupabase()
    .from("recurring_basket_runs")
    .select("id, basket_id, ran_at, generated_order_id, status")
    .eq("basket_id", basketId)
    .order("ran_at", { ascending: false })
    .limit(20);
  if (error) throw error;
  return (data ?? []).map((r) => ({
    id: r.id as string,
    basketId: r.basket_id as string,
    ranAt: r.ran_at as string,
    generatedOrderId: (r.generated_order_id as string | null) ?? null,
    status: r.status as RecurringBasketRun["status"],
  }));
}

// ─── Writes ─────────────────────────────────────────────────────────────

export interface RecurringBasketInput {
  id?: string;
  name: string;
  lines: RecurringBasketLine[];
  cadence: RecurringCadence;
  nextRunAt: string;          // ISO timestamp
  fulfilmentMethod: FulfilmentMethod;
  deliveryAddressId?: string | null;
  isActive?: boolean;
  pauseUntil?: string | null;
}

export async function upsertRecurringBasket(input: RecurringBasketInput): Promise<string> {
  const { data, error } = await getSupabase().rpc("fn_recurring_basket_upsert", {
    p_id: input.id ?? null,
    p_name: input.name.trim(),
    p_lines: input.lines,
    p_cadence: input.cadence,
    p_next_run_at: input.nextRunAt,
    p_fulfilment_method: input.fulfilmentMethod,
    p_delivery_address_id: input.deliveryAddressId ?? null,
    p_is_active: input.isActive ?? true,
    p_pause_until: input.pauseUntil ?? null,
  });
  if (error) throw error;
  return data as string;
}

export async function skipRecurringBasket(basketId: string): Promise<string> {
  const { data, error } = await getSupabase().rpc("fn_recurring_basket_skip", {
    p_id: basketId,
  });
  if (error) throw error;
  return data as string;
}

export async function deleteRecurringBasket(basketId: string): Promise<void> {
  // RLS blocks other buyers' rows; direct DELETE is fine.
  const { error } = await getSupabase()
    .from("recurring_baskets")
    .delete()
    .eq("id", basketId);
  if (error) throw error;
}

export async function pauseRecurringBasket(basketId: string, until: string | null): Promise<void> {
  const { error } = await getSupabase()
    .from("recurring_baskets")
    .update({ pause_until: until, updated_at: new Date().toISOString() })
    .eq("id", basketId);
  if (error) throw error;
}
