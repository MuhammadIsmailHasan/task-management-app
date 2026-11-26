"use client";

import * as MenuPrimitive from "@radix-ui/react-dropdown-menu";
import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

export const DropdownMenu = MenuPrimitive.Root;
export const DropdownMenuTrigger = MenuPrimitive.Trigger;

const SIDE_OFFSET = 8;
const COLLISION_PADDING = 8;

/** shadcn/ui DropdownMenu on Radix: arrow keys move, Escape closes, focus returns to the trigger. */
export function DropdownMenuContent({ className, align = "end", sideOffset = SIDE_OFFSET, ...props }: ComponentProps<typeof MenuPrimitive.Content>) {
  return (
    <MenuPrimitive.Portal>
      <MenuPrimitive.Content
        data-slot="dropdown-menu-content"
        align={align}
        sideOffset={sideOffset}
        collisionPadding={COLLISION_PADDING}
        className={cn(
          "z-modal min-w-popover overflow-hidden rounded-ui border border-line bg-surface-raised p-2 shadow-popover",
          "data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=closed]:animate-out data-[state=closed]:fade-out-0",
          className,
        )}
        {...props}
      />
    </MenuPrimitive.Portal>
  );
}

export function DropdownMenuItem({ className, ...props }: ComponentProps<typeof MenuPrimitive.Item>) {
  return (
    <MenuPrimitive.Item
      data-slot="dropdown-menu-item"
      className={cn(
        "flex min-h-control cursor-pointer items-center gap-3 rounded-ui px-3 text-sm font-medium text-ink no-underline outline-none select-none",
        "data-highlighted:bg-surface-sunken data-disabled:pointer-events-none data-disabled:opacity-disabled [&_svg]:size-icon [&_svg]:shrink-0 [&_svg]:text-ink-muted",
        className,
      )}
      {...props}
    />
  );
}

export function DropdownMenuLabel({ className, ...props }: ComponentProps<typeof MenuPrimitive.Label>) {
  return <MenuPrimitive.Label className={cn("px-3 py-2 text-xs text-ink-muted", className)} {...props} />;
}

export function DropdownMenuSeparator({ className, ...props }: ComponentProps<typeof MenuPrimitive.Separator>) {
  return <MenuPrimitive.Separator className={cn("my-1 h-px bg-line", className)} {...props} />;
}
