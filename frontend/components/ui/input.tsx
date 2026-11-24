import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

export const fieldClasses =
  "w-full rounded-field bg-surface px-4 text-sm text-ink placeholder:text-ink-muted transition-all duration-fast focus-ring disabled:cursor-not-allowed disabled:bg-surface-sunken disabled:opacity-disabled aria-invalid:bg-danger-soft";

export function Input({ className, ...props }: ComponentProps<"input">) {
  return <input data-slot="input" className={cn(fieldClasses, "min-h-control", className)} {...props} />;
}

export function Textarea({ className, ...props }: ComponentProps<"textarea">) {
  return <textarea data-slot="textarea" className={cn(fieldClasses, "min-h-textarea resize-y rounded-card py-3", className)} {...props} />;
}

