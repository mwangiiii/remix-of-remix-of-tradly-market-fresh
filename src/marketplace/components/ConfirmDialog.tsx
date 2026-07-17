import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

/**
 * Replaces `window.confirm` for destructive actions. Uses Radix's
 * AlertDialog — focus-trapped, Escape closes, click-outside is disabled by
 * default (an alert-dialog must be explicitly acknowledged). The action
 * button styles as destructive; the cancel is subtle.
 */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = "Delete",
  cancelLabel = "Cancel",
  destructive = true,
  pending = false,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  pending?: boolean;
  onConfirm: () => void;
}) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="sm:max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          {description && <AlertDialogDescription>{description}</AlertDialogDescription>}
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel
            disabled={pending}
            className="rounded-full border border-divider bg-surface px-4 py-2 text-[13px] font-semibold text-ink-muted hover:text-ink disabled:opacity-60"
          >
            {cancelLabel}
          </AlertDialogCancel>
          <AlertDialogAction
            disabled={pending}
            onClick={(e) => {
              // Prevent Radix from closing immediately — the parent
              // controls `open` and can keep the dialog up while a mutation
              // is in flight, then close on success.
              e.preventDefault();
              onConfirm();
            }}
            className={
              destructive
                ? "rounded-full bg-destructive px-4 py-2 text-[13px] font-semibold text-destructive-foreground hover:bg-destructive/90 disabled:opacity-60"
                : "rounded-full bg-ink px-4 py-2 text-[13px] font-semibold text-background hover:bg-ink/90 disabled:opacity-60"
            }
          >
            {pending ? "Working…" : confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
