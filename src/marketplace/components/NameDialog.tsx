import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

/**
 * A small controlled dialog that replaces `window.prompt` for name entry.
 * Focus, Escape-to-close, click-outside-to-close all come from Radix.
 * The input's initial value is seeded from `defaultValue` every time the
 * dialog opens so re-opening after a rename shows the current name.
 */
export function NameDialog({
  open,
  onOpenChange,
  title,
  description,
  label = "Name",
  placeholder,
  defaultValue = "",
  submitLabel = "Save",
  pending = false,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  label?: string;
  placeholder?: string;
  defaultValue?: string;
  submitLabel?: string;
  pending?: boolean;
  onSubmit: (value: string) => void;
}) {
  const [value, setValue] = useState(defaultValue);

  useEffect(() => {
    if (open) setValue(defaultValue);
  }, [open, defaultValue]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = value.trim();
    if (!trimmed) return;
    onSubmit(trimmed);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            {description && <DialogDescription>{description}</DialogDescription>}
          </DialogHeader>

          <div className="mt-4 space-y-2">
            <label htmlFor="name-dialog-input" className="text-[13px] font-medium text-ink">
              {label}
            </label>
            <input
              id="name-dialog-input"
              type="text"
              autoFocus
              value={value}
              placeholder={placeholder}
              onChange={(e) => setValue(e.target.value)}
              className="w-full rounded-xl border border-divider bg-background px-3 py-2.5 text-[14px] text-ink outline-none focus:border-ink"
            />
          </div>

          <DialogFooter className="mt-6">
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              disabled={pending}
              className="rounded-full border border-divider bg-surface px-4 py-2 text-[13px] font-semibold text-ink-muted hover:text-ink disabled:opacity-60"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={pending || !value.trim()}
              className="rounded-full bg-ink px-4 py-2 text-[13px] font-semibold text-background disabled:opacity-60"
            >
              {pending ? "Saving…" : submitLabel}
            </button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
