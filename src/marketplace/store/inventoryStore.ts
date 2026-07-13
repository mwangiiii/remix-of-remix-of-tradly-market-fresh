import { create } from "zustand";
import { persist } from "zustand/middleware";
import { products } from "../mockData/products";
import type { MarketplaceProductUnit } from "../types/marketplace";

export type InventoryStatus = MarketplaceProductUnit["availability"];

export interface InventoryRecord {
  available: number;
  reserved: number;
  /** When set, admin has explicitly locked the status (overrides auto-derivation). */
  statusOverride?: InventoryStatus;
  updatedAt: string;
}

interface InventoryState {
  records: Record<string, InventoryRecord>;
  setAvailable: (unitId: string, available: number) => void;
  setReserved: (unitId: string, reserved: number) => void;
  setStatus: (unitId: string, status: InventoryStatus | null) => void;
  resetUnit: (unitId: string) => void;
  /** PO generated → hold qty against a unit. */
  reserve: (unitId: string, qty: number) => void;
  /** Order cancelled → release the hold back into pool. */
  releaseReservation: (unitId: string, qty: number) => void;
  /** GRN received → consume the hold from available stock. */
  fulfillReservation: (unitId: string, qty: number) => void;
}

// Seed defaults per unit based on availability label from mock data
const seedFor = (availability: InventoryStatus): InventoryRecord => {
  const base: Record<InventoryStatus, { available: number; reserved: number }> = {
    available:    { available: 240, reserved: 18 },
    low_stock:    { available: 22,  reserved: 6  },
    seasonal:     { available: 40,  reserved: 4  },
    out_of_stock: { available: 0,   reserved: 0  },
  };
  return { ...base[availability], updatedAt: new Date().toISOString() };
};

const initialRecords: Record<string, InventoryRecord> = {};
for (const p of products) {
  for (const u of p.units) initialRecords[u.id] = seedFor(u.availability);
}

const now = () => new Date().toISOString();
const clamp = (n: number) => Math.max(0, Math.floor(n));

const withRecord = (
  records: Record<string, InventoryRecord>,
  unitId: string,
  mut: (r: InventoryRecord) => InventoryRecord,
): Record<string, InventoryRecord> => {
  const cur = records[unitId] ?? { available: 0, reserved: 0, updatedAt: now() };
  return { ...records, [unitId]: { ...mut(cur), updatedAt: now() } };
};

export const useInventoryStore = create<InventoryState>()(
  persist(
    (set) => ({
      records: initialRecords,
      setAvailable: (unitId, available) =>
        set((s) => ({ records: withRecord(s.records, unitId, (r) => ({ ...r, available: clamp(available) })) })),
      setReserved: (unitId, reserved) =>
        set((s) => ({ records: withRecord(s.records, unitId, (r) => ({ ...r, reserved: clamp(reserved) })) })),
      setStatus: (unitId, status) =>
        set((s) => {
          return {
            records: withRecord(s.records, unitId, (r) => {
              const next: InventoryRecord = { ...r };
              if (status === null) delete next.statusOverride;
              else next.statusOverride = status;
              return next;
            }),
          };
        }),
      resetUnit: (unitId) =>
        set((s) => {
          const rest = { ...s.records };
          delete rest[unitId];
          return { records: rest };
        }),
      reserve: (unitId, qty) =>
        set((s) => ({ records: withRecord(s.records, unitId, (r) => ({ ...r, reserved: clamp(r.reserved + qty) })) })),
      releaseReservation: (unitId, qty) =>
        set((s) => ({ records: withRecord(s.records, unitId, (r) => ({ ...r, reserved: clamp(r.reserved - qty) })) })),
      fulfillReservation: (unitId, qty) =>
        set((s) =>
          ({ records: withRecord(s.records, unitId, (r) => ({
            ...r,
            reserved: clamp(r.reserved - qty),
            available: clamp(r.available - qty),
          })) }),
        ),
    }),
    {
      name: "tradly-marketplace-inventory",
      version: 2,
      // Merge persisted records over freshly-seeded defaults so newly-added
      // products still appear on next boot without clearing existing edits.
      merge: (persisted, current) => {
        const p = persisted as Partial<InventoryState> | undefined;
        return {
          ...current,
          records: { ...current.records, ...(p?.records ?? {}) },
        } as InventoryState;
      },
    },
  ),
);

export function remainingOf(r: InventoryRecord): number {
  return Math.max(0, r.available - r.reserved);
}

/** Auto-derive status from counts unless admin has pinned an override. */
export function deriveStatus(r: InventoryRecord): InventoryStatus {
  if (r.statusOverride) return r.statusOverride;
  const remaining = remainingOf(r);
  if (remaining === 0) return "out_of_stock";
  if (remaining <= 25) return "low_stock";
  return "available";
}
