import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { CartLine } from "../types/marketplace";

interface CartState {
  lines: CartLine[];
  addLine: (line: CartLine) => void;
  setQuantity: (productUnitId: string, quantity: number) => void;
  removeLine: (productUnitId: string) => void;
  clear: () => void;
  loadLines: (lines: CartLine[]) => void;
}

export const useCartStore = create<CartState>()(
  persist(
    (set) => ({
      lines: [],
      addLine: (line) =>
        set((state) => {
          const existing = state.lines.find((l) => l.productUnitId === line.productUnitId);
          if (existing) {
            return {
              lines: state.lines.map((l) =>
                l.productUnitId === line.productUnitId
                  ? { ...l, quantity: l.quantity + line.quantity }
                  : l,
              ),
            };
          }
          return { lines: [...state.lines, line] };
        }),
      setQuantity: (productUnitId, quantity) =>
        set((state) => ({
          lines: quantity <= 0
            ? state.lines.filter((l) => l.productUnitId !== productUnitId)
            : state.lines.map((l) =>
                l.productUnitId === productUnitId ? { ...l, quantity } : l,
              ),
        })),
      removeLine: (productUnitId) =>
        set((state) => ({ lines: state.lines.filter((l) => l.productUnitId !== productUnitId) })),
      clear: () => set({ lines: [] }),
      loadLines: (lines) =>
        set((state) => {
          const merged = [...state.lines];
          for (const line of lines) {
            const idx = merged.findIndex((l) => l.productUnitId === line.productUnitId);
            if (idx >= 0) merged[idx] = { ...merged[idx], quantity: merged[idx].quantity + line.quantity };
            else merged.push(line);
          }
          return { lines: merged };
        }),
    }),
    { name: "tradly-marketplace-cart" },
  ),
);

export const cartCount = (lines: CartLine[]) => lines.reduce((s, l) => s + l.quantity, 0);
export const cartSubtotal = (lines: CartLine[]) => lines.reduce((s, l) => s + l.priceKes * l.quantity, 0);
