import { Minus, Plus } from "lucide-react";

export function QuantityStepper({
  value, onChange, min = 0, size = "md",
}: { value: number; onChange: (v: number) => void; min?: number; size?: "sm" | "md" }) {
  const btn = size === "sm" ? "h-7 w-7" : "h-9 w-9";
  const text = size === "sm" ? "text-sm w-6" : "text-base w-8";
  return (
    <div className="inline-flex items-center rounded-full border border-divider bg-surface">
      <button
        type="button"
        onClick={() => onChange(Math.max(min, value - 1))}
        className={`${btn} grid place-items-center rounded-full text-ink-muted hover:text-ink disabled:opacity-40`}
        disabled={value <= min}
        aria-label="Decrease quantity"
      >
        <Minus className="h-4 w-4" />
      </button>
      <span className={`${text} text-center font-semibold tabular-nums`}>{value}</span>
      <button
        type="button"
        onClick={() => onChange(value + 1)}
        className={`${btn} grid place-items-center rounded-full text-ink-muted hover:text-ink`}
        aria-label="Increase quantity"
      >
        <Plus className="h-4 w-4" />
      </button>
    </div>
  );
}
