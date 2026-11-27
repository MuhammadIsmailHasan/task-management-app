import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";
import { SOLID, type Tone } from "@/lib/tones";

const DOT = SOLID;

interface BaseChipProps extends ComponentProps<"button"> {
  tone?: Tone;
  active?: boolean;
}

export function BaseChip({ tone, active = false, className, children, type = "button", ...rest }: BaseChipProps) {
  return (
    <button
      type={type}
      aria-pressed={active}
      className={cn(
        "touch-target inline-flex cursor-pointer items-center gap-2 min-h-control-sm shrink-0 rounded-ui px-3 text-sm whitespace-nowrap shadow-card transition-colors duration-fast ease-out focus-ring",
        active ? "bg-brand text-on-brand" : "bg-surface-raised text-ink-muted hover:bg-surface-sunken",
        className,
      )}
      {...rest}
    >
      {tone && <i aria-hidden="true" className={cn("size-dot shrink-0 rounded-full", DOT[tone])} />}
      {children}
    </button>
  );
}
