"use client";

import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

export const TooltipProvider = TooltipPrimitive.Provider;
export const Tooltip = TooltipPrimitive.Root;
export const TooltipTrigger = TooltipPrimitive.Trigger;

const SIDE_OFFSET = 6;

export function TooltipContent({ className, sideOffset = SIDE_OFFSET, ...props }: ComponentProps<typeof TooltipPrimitive.Content>) {
  return (
    <TooltipPrimitive.Portal>
      <TooltipPrimitive.Content
        data-slot="tooltip-content"
        sideOffset={sideOffset}
        className={cn("z-modal rounded-ui bg-ink px-2 py-1 text-xs text-on-brand shadow-card", className)}
        {...props}
      />
    </TooltipPrimitive.Portal>
  );
}
