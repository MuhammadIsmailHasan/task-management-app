import { Check } from "lucide-react";
import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

/** The one checkbox (DS-10): a native checkbox kept for keyboard and screen readers, drawn with tokens. */
export function BaseCheckbox({ className, ...props }: Omit<ComponentProps<"input">, "type">) {
  return (
    <span className={cn("relative inline-flex size-checkbox shrink-0", className)}>
      <input
        type="checkbox"
        className="peer absolute inset-0 m-0 size-full cursor-pointer appearance-none rounded-ui border border-ink-faint bg-surface-raised transition-colors duration-fast checked:border-brand checked:bg-brand focus-ring disabled:cursor-not-allowed disabled:opacity-disabled"
        {...props}
      />
      <Check className="pointer-events-none absolute inset-0 m-auto size-icon-sm text-on-brand opacity-0 peer-checked:opacity-100" aria-hidden="true" strokeWidth={3} />
    </span>
  );
}
