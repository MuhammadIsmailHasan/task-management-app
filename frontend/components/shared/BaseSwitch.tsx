"use client";

import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

interface BaseSwitchProps extends Omit<ComponentProps<"button">, "onChange" | "role" | "aria-checked"> {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  /** The accessible name; a switch has no visible text of its own. */
  label: string;
}

/** The only switch in the app: `role="switch"`, space and enter toggle it, a 44 pixel hit area around a small track. */
export function BaseSwitch({ checked, onCheckedChange, label, className, disabled, ...rest }: BaseSwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onCheckedChange(!checked)}
      className={cn("relative inline-flex min-h-touch min-w-touch shrink-0 cursor-pointer items-center justify-center focus-ring disabled:cursor-not-allowed disabled:opacity-disabled", className)}
      {...rest}
    >
      <span aria-hidden="true" className={cn("relative inline-flex h-switch-h w-switch items-center rounded-full transition-colors duration-fast", checked ? "bg-accent" : "bg-surface-strong")}>
        <span className={cn("absolute size-switch-thumb rounded-full bg-surface-raised shadow-card transition-all duration-fast", checked ? "left-switch-on" : "left-switch-off")} />
      </span>
    </button>
  );
}
