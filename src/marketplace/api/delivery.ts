// Household Commerce delivery API — zones + household addresses + zone
// resolution helper. Wraps PostgREST + one RPC (fn_resolve_zone).
//
// RLS shape:
//   * marketplace_delivery_zones: public read (anon + authenticated); writes
//     are super-admin only (D-admin-zones ships that UI).
//   * household_addresses: RLS-scoped by current_business_id(). Buyers see
//     and edit only their own rows.

import { getSupabase } from "@/lib/supabase";
import type {
  DeliveryZone,
  DistanceBand,
  HouseholdAddress,
} from "../types/marketplace";

// ─── Row shapes ──────────────────────────────────────────────────────────

type ZoneRow = {
  id: string;
  name: string;
  county: string;
  areas: string[];
  customer_fee_kes: number | string;
  default_distance_band: DistanceBand;
  same_day_cutoff_time: string;
  is_active: boolean;
  sort_order: number;
};

type AddressRow = {
  id: string;
  business_id: string;
  label: string | null;
  area: string;
  estate_or_building: string | null;
  house_or_door: string | null;
  landmark: string | null;
  zone_id: string | null;
  lat: number | string | null;
  lng: number | string | null;
  delivery_notes: string | null;
  is_default: boolean;
  created_at: string;
  updated_at: string | null;
};

const num = (v: number | string | null): number =>
  v == null ? 0 : typeof v === "number" ? v : Number(v);

function mapZone(r: ZoneRow): DeliveryZone {
  return {
    id: r.id,
    name: r.name,
    county: r.county,
    areas: r.areas,
    customerFeeKes: num(r.customer_fee_kes),
    defaultDistanceBand: r.default_distance_band,
    sameDayCutoffTime: r.same_day_cutoff_time,
    isActive: r.is_active,
    sortOrder: r.sort_order,
  };
}

function mapAddress(r: AddressRow): HouseholdAddress {
  return {
    id: r.id,
    businessId: r.business_id,
    label: r.label,
    area: r.area,
    estateOrBuilding: r.estate_or_building,
    houseOrDoor: r.house_or_door,
    landmark: r.landmark,
    zoneId: r.zone_id,
    lat: r.lat == null ? null : Number(r.lat),
    lng: r.lng == null ? null : Number(r.lng),
    deliveryNotes: r.delivery_notes,
    isDefault: r.is_default,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

// ─── Zones ───────────────────────────────────────────────────────────────

export async function listDeliveryZones(): Promise<DeliveryZone[]> {
  const { data, error } = await getSupabase()
    .from("marketplace_delivery_zones")
    .select("id, name, county, areas, customer_fee_kes, default_distance_band, same_day_cutoff_time, is_active, sort_order")
    .eq("is_active", true)
    .order("sort_order", { ascending: true });
  if (error) throw error;
  return (data ?? []).map((r) => mapZone(r as unknown as ZoneRow));
}

/**
 * Case-insensitive area → zone_id lookup. Wraps the DB function so callers
 * don't have to remember its name. Returns null when the area is outside
 * every active zone (caller falls back to a manual zone picker).
 */
export async function resolveZoneByArea(area: string): Promise<string | null> {
  const trimmed = area.trim();
  if (!trimmed) return null;
  const { data, error } = await getSupabase().rpc("fn_resolve_zone", { p_area: trimmed });
  if (error) throw error;
  return (data as string | null) ?? null;
}

// ─── Household addresses ─────────────────────────────────────────────────

/** All addresses for the authenticated buyer's household (RLS-scoped). */
export async function listMyAddresses(): Promise<HouseholdAddress[]> {
  const { data, error } = await getSupabase()
    .from("household_addresses")
    .select("id, business_id, label, area, estate_or_building, house_or_door, landmark, zone_id, lat, lng, delivery_notes, is_default, created_at, updated_at")
    .order("is_default", { ascending: false })
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []).map((r) => mapAddress(r as unknown as AddressRow));
}

export interface AddressInput {
  id?: string;
  label?: string | null;
  area: string;
  estateOrBuilding?: string | null;
  houseOrDoor?: string | null;
  landmark?: string | null;
  /** If null AND area given, upsertAddress resolves via fn_resolve_zone. */
  zoneId?: string | null;
  lat?: number | null;
  lng?: number | null;
  deliveryNotes?: string | null;
  isDefault?: boolean;
}

/**
 * Read the current buyer's business_id from the JWT. RLS on household_
 * addresses restricts inserts to business_id = current_business_id(), and
 * the row also carries an explicit business_id column that we must populate.
 */
async function currentBusinessId(): Promise<string> {
  const { useAuthStore } = await import("@/store/useAuthStore");
  const token = useAuthStore.getState().accessToken;
  if (!token) throw new Error("Sign in to manage addresses.");
  try {
    const [, payload] = token.split(".");
    const claims = JSON.parse(atob(payload.replace(/-/g, "+").replace(/_/g, "/")));
    const bid = claims.business_id as string | undefined;
    if (!bid) throw new Error("Session missing business_id.");
    return bid;
  } catch {
    throw new Error("Could not read your session.");
  }
}

export async function upsertAddress(input: AddressInput): Promise<string> {
  const businessId = await currentBusinessId();
  // Resolve zone if the caller didn't supply one.
  const zoneId = input.zoneId ?? (await resolveZoneByArea(input.area));

  const row: Record<string, unknown> = {
    business_id: businessId,
    label: input.label ?? null,
    area: input.area.trim(),
    estate_or_building: input.estateOrBuilding ?? null,
    house_or_door: input.houseOrDoor ?? null,
    landmark: input.landmark ?? null,
    zone_id: zoneId,
    lat: input.lat ?? null,
    lng: input.lng ?? null,
    delivery_notes: input.deliveryNotes ?? null,
    is_default: input.isDefault ?? false,
  };
  if (input.id) row.id = input.id;

  const { data, error } = await getSupabase()
    .from("household_addresses")
    .upsert(row, { onConflict: "id" })
    .select("id")
    .single();
  if (error) throw error;
  return data.id as string;
}

// ─── Admin: delivery zones CRUD (D-admin-zones) ──────────────────────────
// Reads run against the same public policy anon uses (only active zones).
// The admin surface wants inactive ones too, so it uses a separate reader.
// Writes are gated by the super_admin RLS policy on the table.

export async function adminListDeliveryZones(): Promise<DeliveryZone[]> {
  const { data, error } = await getSupabase()
    .from("marketplace_delivery_zones")
    .select("id, name, county, areas, customer_fee_kes, default_distance_band, same_day_cutoff_time, is_active, sort_order")
    .order("sort_order", { ascending: true });
  if (error) throw error;
  return (data ?? []).map((r) => mapZone(r as unknown as ZoneRow));
}

export interface DeliveryZoneInput {
  id?: string;
  name: string;
  county: string;
  areas: string[];
  customerFeeKes: number;
  defaultDistanceBand: DistanceBand;
  sameDayCutoffTime: string;    // "HH:MM" or "HH:MM:SS"
  isActive: boolean;
  sortOrder: number;
}

export async function adminUpsertDeliveryZone(input: DeliveryZoneInput): Promise<string> {
  // Normalise the cutoff to HH:MM:SS which is what Postgres TIME expects
  // from a text literal via PostgREST.
  const cutoff = /^\d{2}:\d{2}$/.test(input.sameDayCutoffTime)
    ? `${input.sameDayCutoffTime}:00`
    : input.sameDayCutoffTime;

  const row: Record<string, unknown> = {
    name: input.name.trim(),
    county: input.county.trim() || "Nairobi",
    // Strip empty entries; trim whitespace; keep unique preserving order.
    areas: Array.from(new Set(input.areas.map((a) => a.trim()).filter(Boolean))),
    customer_fee_kes: input.customerFeeKes,
    default_distance_band: input.defaultDistanceBand,
    same_day_cutoff_time: cutoff,
    is_active: input.isActive,
    sort_order: input.sortOrder,
  };
  if (input.id) row.id = input.id;
  const { data, error } = await getSupabase()
    .from("marketplace_delivery_zones")
    .upsert(row, { onConflict: "id" })
    .select("id")
    .single();
  if (error) throw error;
  return data.id as string;
}

export async function adminDeleteDeliveryZone(id: string): Promise<void> {
  const { error } = await getSupabase()
    .from("marketplace_delivery_zones")
    .delete()
    .eq("id", id);
  if (error) throw error;
}

export async function deleteAddress(id: string): Promise<void> {
  const { error } = await getSupabase()
    .from("household_addresses")
    .delete()
    .eq("id", id);
  if (error) throw error;
}

/**
 * Two-step: clear is_default across the buyer's addresses, then set on
 * the target. Wrapped in a try; if the second call fails (race with a
 * concurrent set-default click), toast the error and let the caller retry.
 * The partial unique index blocks the "two defaults" invariant, so a
 * failed second UPDATE leaves the buyer with zero defaults briefly —
 * acceptable trade-off vs. an RPC round-trip for a single-user action.
 */
export async function setDefaultAddress(id: string): Promise<void> {
  const sb = getSupabase();
  // Step 1: clear.
  const clear = await sb
    .from("household_addresses")
    .update({ is_default: false })
    .eq("is_default", true);
  if (clear.error) throw clear.error;
  // Step 2: set.
  const setIt = await sb
    .from("household_addresses")
    .update({ is_default: true })
    .eq("id", id);
  if (setIt.error) throw setIt.error;
}
