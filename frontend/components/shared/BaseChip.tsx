import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";
import type { Tone } from "@/lib/tones";

/** The category colour shows as a dot before the label; the chip itself follows the filter chip recipe. */
const DOT: Record<Tone, string> = {
  green: "bg-tone-green",
  blue: "bg-tone-blue",
  red: "bg-tone-red",
  purple: "bg-tone-purple",
  orange: "bg-tone-orange",
};

interface BaseChipProps extends ComponentProps<"button"> {
  tone?: Tone;
  active?: boolean;
}

/** Filter chip: a 24 pixel white pill with a shadow; the active one is filled with the brand colour. */
export function BaseChip({ tone, active = false, className, children, type = "button", ...rest }: BaseChipProps) {
  return (
    <button
      type={type}
      aria-pressed={active}
      className={cn(
        "touch-target inline-flex cursor-pointer items-center gap-2 min-h-chip shrink-0 rounded-full px-3 py-half text-xs whitespace-nowrap shadow-card transition-colors duration-fast ease-out focus-ring",
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
