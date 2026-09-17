// Mode-aware quantity stepper (Household Commerce spec §5.8, plan D8).
//
// Three visible shapes:
//   by_weight — typeable decimal input, snaps to step on blur/enter,
//               renders unit suffix (kg / g / l / ml)
//   by_piece  — read-only integer counter with +/-
//   by_pack   — read-only integer counter with +/- (contents label is
//               rendered by the caller, not inside the stepper)
//
// Existing call sites that don't pass sellMode/step get integer-step
// behavior, matching the pre-D8 stepper. Weight callers must pass
// sellMode="by_weight" AND a step (e.g. 0.25) to unlock the input.

import { useEffect, useState } from "react";
import { Minus, Plus } from "lucide-react";
import type { SellMode } from "../types/marketplace";

type Size = "sm" | "md";

export interface QuantityStepperProps {
  value: number;
  onChange: (v: number) => void;
  /** Smallest orderable quantity. Below this the − button is disabled. */
  min?: number;
  /** Increment. Defaults to 1 (integer stepping). Weight products pass e.g. 0.25. */
  step?: number;
  size?: Size;
  /** When "by_weight", renders a typeable numeric input in the middle. */
  sellMode?: SellMode;
  /** Suffix rendered next to the number (kg, g, l, ml). Ignored for piece/pack. */
  baseUnit?: string;
}

/**
 * Snap `raw` to the nearest multiple of `step` above `min`, respecting
 * `min` as the floor. Weight products want (round to step, but never below
 * min). Numeric arithmetic handles 0.25/0.1/0.5 exactly; no epsilon needed.
 */
function snapToGrid(raw: number, min: number, step: number): number {
  if (!Number.isFinite(raw) || raw <= min) return min;
  const offset = raw - min;
  const snappedOffset = Math.round(offset / step) * step;
  const snapped = min + snappedOffset;
  // Kill floating-point tails introduced by Math.round on decimals like
  // 0.1 by rounding to a sane precision. 3 dp covers grams / ml.
  return Math.round(snapped * 1000) / 1000;
}

function formatValue(v: number, isWeight: boolean, step: number): number | string {
  if (!isWeight) return Math.floor(v);
  // For weight, show enough decimals to represent the step without noise.
  // step 1 → 0dp, 0.5 → 1dp, 0.25 → 2dp, 0.1 → 1dp, 0.001 → 3dp.
  const decimals = step >= 1 ? 0 : step >= 0.1 ? Math.max(1, decimalsOf(step)) : 3;
  return v.toFixed(decimals);
}

function decimalsOf(step: number): number {
  const s = step.toString();
  const dot = s.indexOf(".");
  return dot === -1 ? 0 : s.length - dot - 1;
}

export function QuantityStepper({
  value,
  onChange,
  min = 0,
  step = 1,
  size = "md",
  sellMode,
  baseUnit,
}: QuantityStepperProps) {
  const isWeight = sellMode === "by_weight";
  const btn = size === "sm" ? "h-7 w-7" : "h-9 w-9";
  const numText = size === "sm" ? "text-sm" : "text-base";

  // Draft text state for the typeable weight input. Committed on blur/enter.
  const [draft, setDraft] = useState<string>(() =>
    isWeight ? String(formatValue(value, true, step)) : "",
  );

  // Keep the draft in sync when the parent-controlled value changes (e.g.
  // step-button clicks) so the input reflects reality.
  useEffect(() => {
    if (isWeight) setDraft(String(formatValue(value, true, step)));
  }, [isWeight, value, step]);

  const inc = () => onChange(snapToGrid(value + step, min, step));
  const dec = () => onChange(snapToGrid(value - step, min, step));

  const commitDraft = () => {
    const parsed = Number(draft);
    if (!Number.isFinite(parsed)) {
      setDraft(String(formatValue(value, true, step)));
      return;
    }
    const snapped = snapToGrid(parsed, min, step);
    onChange(snapped);
    setDraft(String(formatValue(snapped, true, step)));
  };

  return (
    <div className="inline-flex items-center rounded-full border border-divider bg-surface">
      <button
        type="button"
        onClick={dec}
        disabled={value <= min}
        className={`${btn} grid place-items-center rounded-full text-ink-muted hover:text-ink disabled:opacity-40`}
        aria-label="Decrease quantity"
      >
        <Minus className="h-4 w-4" />
      </button>

      {isWeight ? (
        <input
          type="text"
          inputMode="decimal"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commitDraft}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              (e.target as HTMLInputElement).blur();
            }
          }}
          className={`${numText} w-14 bg-transparent text-center font-semibold tabular-nums text-ink focus:outline-none`}
          aria-label="Quantity"
        />
      ) : (
        <span className={`${numText} inline-block w-8 text-center font-semibold tabular-nums`}>
          {Math.floor(value)}
        </span>
      )}

      {baseUnit && isWeight && (
        <span className={`${numText === "text-sm" ? "text-[11px]" : "text-[12px]"} pr-2 font-medium text-ink-muted`}>
          {baseUnit}
        </span>
      )}

      <button
        type="button"
        onClick={inc}
        className={`${btn} grid place-items-center rounded-full text-ink-muted hover:text-ink`}
        aria-label="Increase quantity"
      >
        <Plus className="h-4 w-4" />
      </button>
    </div>
  );
}
