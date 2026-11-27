import { BaseButton } from "@/components/shared/BaseButton";
import type { FieldState } from "@/hooks/useFieldSave";

export function FieldStatus({ field, state, onRetry }: { field: string; state?: FieldState; onRetry?: () => void }) {
  return (
    <span aria-live="polite" data-field-status={field} className="inline-flex min-h-5 items-center gap-2 text-xs text-ink-muted">
      {state?.state === "saving" && "Saving…"}
      {state?.state === "saved" && "Saved"}
      {state?.state === "error" && (
        <>
          <span className="text-danger">{state.message}</span>
          {onRetry && (
            <BaseButton variant="secondary" size="sm" className="h-auto min-h-0 px-2 py-1 text-xs" onClick={onRetry}>
              Retry
            </BaseButton>
          )}
        </>
      )}
    </span>
  );
}
