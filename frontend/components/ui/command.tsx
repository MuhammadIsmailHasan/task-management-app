"use client";

import { Command as CommandPrimitive } from "cmdk";
import { Search } from "lucide-react";
import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

export function Command({ className, ...props }: ComponentProps<typeof CommandPrimitive>) {
  return <CommandPrimitive data-slot="command" className={cn("flex w-full flex-col gap-2", className)} {...props} />;
}

export function CommandInput({ className, ...props }: ComponentProps<typeof CommandPrimitive.Input>) {
  return (
    <div className="flex min-h-control items-center gap-2 rounded-field bg-surface px-3 focus-ring-within">
      <Search className="size-icon-sm shrink-0 text-ink-muted" aria-hidden="true" />
      <CommandPrimitive.Input
        data-slot="command-input"
        className={cn("min-w-0 flex-1 border-0 bg-transparent text-sm text-ink outline-none placeholder:text-ink-muted", className)}
        {...props}
      />
    </div>
  );
}

export function CommandList({ className, ...props }: ComponentProps<typeof CommandPrimitive.List>) {
  return <CommandPrimitive.List data-slot="command-list" className={cn("flex max-h-popover-list flex-col gap-1 overflow-y-auto", className)} {...props} />;
}

export function CommandEmpty({ className, ...props }: ComponentProps<typeof CommandPrimitive.Empty>) {
  return <CommandPrimitive.Empty className={cn("px-2 py-3 text-center text-meta text-ink-muted", className)} {...props} />;
}

export function CommandItem({ className, ...props }: ComponentProps<typeof CommandPrimitive.Item>) {
  return (
    <CommandPrimitive.Item
      data-slot="command-item"
      className={cn(
        "flex min-h-control-sm cursor-pointer items-center gap-2 rounded-field px-2 text-sm text-ink aria-selected:bg-surface-sunken data-[checked=true]:bg-brand-tint",
        className,
      )}
      {...props}
    />
  );
}
