// Rider & deliveries admin API (Phase 2 checkpoint G).
//
// Reads: direct PostgREST against drivers / deliveries / driver_pay_entries,
//        under the staff RLS policies added in the rider-tooling migration.
// Writes: fn_delivery_assign / fn_delivery_advance / fn_driver_pay_mark_paid
//        RPCs (SECURITY DEFINER; auth gates enforced inside).

import { getSupabase } from "@/lib/supabase";
import type {
  ConsumerOrderStatus,
  DistanceBand,
  FulfilmentMethod,
} from "../types/marketplace";

// ─── Types ──────────────────────────────────────────────────────────────

export interface Driver {
  id: string;
  fullName: string;
  phone: string;
  vehicleType: string | null;
  vehicleRegistration: string | null;
  isActive: boolean;
  notes: string | null;
  linkToken: string;
  createdAt: string;
}

export type DeliveryStatus = "assigned" | "picked_up" | "delivered";

export interface Delivery {
  id: string;
  orderId: string;
  driverId: string;
  status: DeliveryStatus;
  dropoffAddressId: string | null;
  customerFeeKes: number;
  distanceBand: DistanceBand;
  driverEarningKes: number;
  customerConfirmedAt: string | null;
  assignedAt: string;
  pickedUpAt: string | null;
  deliveredAt: string | null;
  // Joined for convenience on the queue view.
  orderNumber?: string;
  orderTotalKes?: number;
  orderStatus?: ConsumerOrderStatus;
  fulfilmentMethod?: FulfilmentMethod;
  zoneName?: string | null;
  area?: string | null;
  landmark?: string | null;
  driverFullName?: string | null;
}

export interface UnassignedOrder {
  id: string;
  orderNumber: string;
  status: ConsumerOrderStatus;
  totalKes: number;
  fulfilmentMethod: FulfilmentMethod;
  requestedDate: string | null;
  createdAt: string;
  zoneId: string | null;
  zoneName: string | null;
  defaultDistanceBand: DistanceBand | null;
  address: {
    area: string | null;
    estateOrBuilding: string | null;
    houseOrDoor: string | null;
    landmark: string | null;
  } | null;
}

export interface DriverPayEntry {
  id: string;
  driverId: string;
  deliveryId: string;
  amountKes: number;
  paidAt: string | null;
  paidBy: string | null;
  createdAt: string;
  // Joined
  orderNumber?: string;
  distanceBand?: DistanceBand;
  zoneName?: string | null;
}

// ─── Helpers ────────────────────────────────────────────────────────────

const num = (v: number | string | null | undefined): number =>
  v == null ? 0 : typeof v === "number" ? v : Number(v);

// ─── Drivers ────────────────────────────────────────────────────────────

export async function adminListDrivers(includeInactive = false): Promise<Driver[]> {
  let q = getSupabase()
    .from("drivers")
    .select("id, full_name, phone, vehicle_type, vehicle_registration, is_active, notes, link_token, created_at")
    .order("full_name", { ascending: true });
  if (!includeInactive) q = q.eq("is_active", true);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []).map((r) => ({
    id: r.id as string,
    fullName: r.full_name as string,
    phone: r.phone as string,
    vehicleType: (r.vehicle_type as string | null) ?? null,
    vehicleRegistration: (r.vehicle_registration as string | null) ?? null,
    isActive: r.is_active as boolean,
    notes: (r.notes as string | null) ?? null,
    linkToken: r.link_token as string,
    createdAt: r.created_at as string,
  }));
}

export interface DriverInput {
  id?: string;
  fullName: string;
  phone: string;
  vehicleType?: string | null;
  vehicleRegistration?: string | null;
  notes?: string | null;
  isActive?: boolean;
}

export async function adminUpsertDriver(input: DriverInput): Promise<string> {
  const row: Record<string, unknown> = {
    full_name: input.fullName.trim(),
    phone: input.phone.trim(),
    vehicle_type: input.vehicleType || null,
    vehicle_registration: input.vehicleRegistration || null,
    notes: input.notes || null,
    is_active: input.isActive ?? true,
  };
  if (input.id) row.id = input.id;
  const { data, error } = await getSupabase()
    .from("drivers")
    .upsert(row, { onConflict: "id" })
    .select("id")
    .single();
  if (error) throw error;
  return data.id as string;
}

/**
 * Rotate a driver's link_token. Old link stops working immediately —
 * hand the driver a fresh URL after this.
 */
export async function adminRotateDriverToken(driverId: string): Promise<string> {
  const { data, error } = await getSupabase()
    .from("drivers")
    .update({ link_token: crypto.randomUUID(), updated_at: new Date().toISOString() })
    .eq("id", driverId)
    .select("link_token")
    .single();
  if (error) throw error;
  return data.link_token as string;
}

// ─── Orders needing dispatch ────────────────────────────────────────────
// Paid + tradly_rider + no delivery row yet. Anti-join keeps this fast at
// the row counts we care about (dozens, not thousands).

export async function adminListUnassignedOrders(): Promise<UnassignedOrder[]> {
  // Two-step: fetch candidate paid orders, then filter out those already
  // assigned. Cheaper than a bespoke Postgres query given we can't LEFT
  // ANTI JOIN through supabase-js cleanly.
  const [ordersRes, deliveriesRes] = await Promise.all([
    getSupabase()
      .from("consumer_orders")
      .select("id, order_number, status, total_kes, fulfilment_method, requested_date, created_at, zone_id, delivery_address_id")
      .eq("status", "paid")
      .eq("fulfilment_method", "tradly_rider")
      .order("created_at", { ascending: true }),
    getSupabase()
      .from("deliveries")
      .select("order_id"),
  ]);
  if (ordersRes.error) throw ordersRes.error;
  if (deliveriesRes.error) throw deliveriesRes.error;
  const assignedIds = new Set((deliveriesRes.data ?? []).map((r) => r.order_id as string));
  const unassigned = (ordersRes.data ?? []).filter((o) => !assignedIds.has(o.id as string));
  if (unassigned.length === 0) return [];

  // Join zones + addresses in a follow-up call so the queue can show
  // where the rider is heading.
  const zoneIds = Array.from(new Set(unassigned.map((o) => o.zone_id as string | null).filter(Boolean))) as string[];
  const addrIds = Array.from(new Set(unassigned.map((o) => o.delivery_address_id as string | null).filter(Boolean))) as string[];

  const [zonesRes, addrsRes] = await Promise.all([
    zoneIds.length
      ? getSupabase()
          .from("marketplace_delivery_zones")
          .select("id, name, default_distance_band")
          .in("id", zoneIds)
      : Promise.resolve({ data: [] as { id: string; name: string; default_distance_band: DistanceBand }[], error: null }),
    addrIds.length
      ? getSupabase()
          .from("household_addresses")
          .select("id, area, estate_or_building, house_or_door, landmark")
          .in("id", addrIds)
      : Promise.resolve({ data: [] as Record<string, unknown>[], error: null }),
  ]);
  if (zonesRes.error) throw zonesRes.error;
  if (addrsRes.error) throw addrsRes.error;
  const zonesById = new Map((zonesRes.data ?? []).map((z) => [z.id as string, z]));
  const addrsById = new Map((addrsRes.data ?? []).map((a) => [a.id as string, a]));

  return unassigned.map((o) => {
    const z = o.zone_id ? zonesById.get(o.zone_id as string) : null;
    const a = o.delivery_address_id ? addrsById.get(o.delivery_address_id as string) : null;
    return {
      id: o.id as string,
      orderNumber: o.order_number as string,
      status: o.status as ConsumerOrderStatus,
      totalKes: num(o.total_kes as number | string),
      fulfilmentMethod: o.fulfilment_method as FulfilmentMethod,
      requestedDate: (o.requested_date as string | null) ?? null,
      createdAt: o.created_at as string,
      zoneId: (o.zone_id as string | null) ?? null,
      zoneName: (z?.name as string | null) ?? null,
      defaultDistanceBand: (z?.default_distance_band as DistanceBand | null) ?? null,
      address: a
        ? {
            area: (a.area as string | null) ?? null,
            estateOrBuilding: (a.estate_or_building as string | null) ?? null,
            houseOrDoor: (a.house_or_door as string | null) ?? null,
            landmark: (a.landmark as string | null) ?? null,
          }
        : null,
    };
  });
}

// ─── In-progress deliveries ─────────────────────────────────────────────

export async function adminListInProgressDeliveries(): Promise<Delivery[]> {
  // Query deliveries + join to orders/drivers/zones/addresses.
  const { data, error } = await getSupabase()
    .from("deliveries")
    .select(`
      id, order_id, driver_id, status, dropoff_address_id,
      customer_fee_kes, distance_band, driver_earning_kes,
      customer_confirmed_at, assigned_at, picked_up_at, delivered_at,
      consumer_orders ( order_number, total_kes, status, fulfilment_method, zone_id, marketplace_delivery_zones ( name ) ),
      drivers ( full_name ),
      household_addresses ( area, landmark )
    `)
    .in("status", ["assigned", "picked_up"])
    .order("assigned_at", { ascending: true });
  if (error) throw error;

  type Row = {
    id: string; order_id: string; driver_id: string; status: DeliveryStatus;
    dropoff_address_id: string | null;
    customer_fee_kes: number | string; distance_band: DistanceBand; driver_earning_kes: number | string;
    customer_confirmed_at: string | null; assigned_at: string; picked_up_at: string | null; delivered_at: string | null;
    consumer_orders: { order_number: string; total_kes: number | string; status: ConsumerOrderStatus; fulfilment_method: FulfilmentMethod; zone_id: string | null; marketplace_delivery_zones: { name: string } | null } | null;
    drivers: { full_name: string } | null;
    household_addresses: { area: string; landmark: string | null } | null;
  };

  return (data as unknown as Row[]).map((r) => ({
    id: r.id,
    orderId: r.order_id,
    driverId: r.driver_id,
    status: r.status,
    dropoffAddressId: r.dropoff_address_id,
    customerFeeKes: num(r.customer_fee_kes),
    distanceBand: r.distance_band,
    driverEarningKes: num(r.driver_earning_kes),
    customerConfirmedAt: r.customer_confirmed_at,
    assignedAt: r.assigned_at,
    pickedUpAt: r.picked_up_at,
    deliveredAt: r.delivered_at,
    orderNumber: r.consumer_orders?.order_number,
    orderTotalKes: r.consumer_orders?.total_kes ? num(r.consumer_orders.total_kes) : undefined,
    orderStatus: r.consumer_orders?.status,
    fulfilmentMethod: r.consumer_orders?.fulfilment_method,
    zoneName: r.consumer_orders?.marketplace_delivery_zones?.name ?? null,
    area: r.household_addresses?.area ?? null,
    landmark: r.household_addresses?.landmark ?? null,
    driverFullName: r.drivers?.full_name ?? null,
  }));
}

// ─── Assign / advance RPCs ──────────────────────────────────────────────

export async function adminAssignDelivery(
  orderId: string,
  driverId: string,
  distanceBand?: DistanceBand,
): Promise<string> {
  const { data, error } = await getSupabase().rpc("fn_delivery_assign", {
    p_order_id: orderId,
    p_driver_id: driverId,
    p_distance_band: distanceBand ?? null,
  });
  if (error) throw error;
  return data as string;
}

export async function adminAdvanceDelivery(
  deliveryId: string,
  nextStatus: "picked_up" | "delivered",
): Promise<DeliveryStatus> {
  const { data, error } = await getSupabase().rpc("fn_delivery_advance", {
    p_delivery_id: deliveryId,
    p_next_status: nextStatus,
  });
  if (error) throw error;
  return data as DeliveryStatus;
}

// ─── Driver pay ─────────────────────────────────────────────────────────

export async function adminListDriverPayEntries(): Promise<DriverPayEntry[]> {
  const { data, error } = await getSupabase()
    .from("driver_pay_entries")
    .select(`
      id, driver_id, delivery_id, amount_kes, paid_at, paid_by, created_at,
      deliveries ( distance_band, consumer_orders ( order_number, zone_id, marketplace_delivery_zones ( name ) ) )
    `)
    .order("created_at", { ascending: false })
    .limit(500);
  if (error) throw error;

  type Row = {
    id: string; driver_id: string; delivery_id: string;
    amount_kes: number | string; paid_at: string | null; paid_by: string | null; created_at: string;
    deliveries: { distance_band: DistanceBand; consumer_orders: { order_number: string; zone_id: string | null; marketplace_delivery_zones: { name: string } | null } | null } | null;
  };

  return (data as unknown as Row[]).map((r) => ({
    id: r.id,
    driverId: r.driver_id,
    deliveryId: r.delivery_id,
    amountKes: num(r.amount_kes),
    paidAt: r.paid_at,
    paidBy: r.paid_by,
    createdAt: r.created_at,
    orderNumber: r.deliveries?.consumer_orders?.order_number,
    distanceBand: r.deliveries?.distance_band,
    zoneName: r.deliveries?.consumer_orders?.marketplace_delivery_zones?.name ?? null,
  }));
}

export async function adminMarkPayPaid(payEntryId: string, opsUserId: string): Promise<number> {
  const { data, error } = await getSupabase().rpc("fn_driver_pay_mark_paid", {
    p_pay_entry_id: payEntryId,
    p_paid_by: opsUserId,
  });
  if (error) throw error;
  return Number(data);
}
