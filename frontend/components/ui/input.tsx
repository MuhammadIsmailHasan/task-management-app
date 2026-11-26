import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

/**
 * The one look of every form control (DS-15): input, textarea, select trigger, date trigger, colour trigger. Same
 * radius (`--radius-field`), fill, shadow, padding, text, hover, focus, disabled, and invalid states.
 */
export const controlClasses =
  "w-full rounded-ui bg-surface px-4 text-sm text-ink shadow-card placeholder:text-ink-muted transition-all duration-fast focus-ring-inset disabled:cursor-not-allowed disabled:bg-surface-sunken disabled:opacity-disabled aria-invalid:bg-danger-soft";

/** The extra classes of a control that is a button (a select, a date picker): content on one line, a pointer, a hover fill. */
export const controlButtonClasses = "inline-flex cursor-pointer items-center justify-between gap-2 text-left hover:bg-surface-sunken";

export const controlSize = { md: "min-h-control", sm: "min-h-control-sm" } as const;

export function Input({ className, ...props }: ComponentProps<"input">) {
  return <input data-slot="input" className={cn(controlClasses, controlSize.md, className)} {...props} />;
}

export function Textarea({ className, ...props }: ComponentProps<"textarea">) {
  return <textarea data-slot="textarea" className={cn(controlClasses, "min-h-textarea resize-y py-3", className)} {...props} />;
}

