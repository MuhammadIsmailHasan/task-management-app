"use client";

import * as PopoverPrimitive from "@radix-ui/react-popover";
import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

export const Popover = PopoverPrimitive.Root;
export const PopoverTrigger = PopoverPrimitive.Trigger;
export const PopoverClose = PopoverPrimitive.Close;

const SIDE_OFFSET = 8;
const COLLISION_PADDING = 8;

export function PopoverContent({ className, align = "start", sideOffset = SIDE_OFFSET, style, ...props }: ComponentProps<typeof PopoverPrimitive.Content>) {
  return (
    <PopoverPrimitive.Portal>
      <PopoverPrimitive.Content
        data-slot="popover-content"
        align={align}
        sideOffset={sideOffset}
        collisionPadding={COLLISION_PADDING}
        style={{ maxHeight: "var(--radix-popover-content-available-height)", ...style }}
        className={cn(
          "z-modal overflow-y-auto rounded-ui border border-line bg-surface-raised p-item shadow-popover focus:outline-none",
          "data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=closed]:animate-out data-[state=closed]:fade-out-0",
          className,
        )}
        {...props}
      />
    </PopoverPrimitive.Portal>
  );
}
