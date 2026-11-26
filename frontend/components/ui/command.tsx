"use client";

import { Command as CommandPrimitive } from "cmdk";
import { Search } from "lucide-react";
import { useEffect, useRef, useState, type ComponentProps } from "react";
import { cn } from "@/lib/utils";

/**
 * cmdk marks the first item selected as soon as the list opens, which reads as "already chosen" (DS-07). The keyboard
 * highlight (`aria-selected`) therefore shows only after a key was pressed (`data-kb`); the pointer highlight is ours (CommandItem).
 */
export function Command({ className, onKeyDown, ...props }: ComponentProps<typeof CommandPrimitive>) {
  const [kb, setKb] = useState(false);
  return (
    <CommandPrimitive
      data-slot="command"
      data-kb={kb ? "true" : "false"}
      disablePointerSelection
      className={cn("group/cmd flex w-full flex-col gap-2", className)}
      onKeyDown={(e) => {
        if (e.key.length === 1 || e.key.startsWith("Arrow") || e.key === "Home" || e.key === "End") setKb(true);
        onKeyDown?.(e);
      }}
      onPointerMove={() => setKb(false)}
      {...props}
    />
  );
}

export function CommandInput({ className, ...props }: ComponentProps<typeof CommandPrimitive.Input>) {
  return (
    <div className="flex min-h-control items-center gap-2 rounded-ui bg-surface px-3 focus-ring-within">
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
  return <CommandPrimitive.Empty className={cn("px-2 py-3 text-center text-sm text-ink-muted", className)} {...props} />;
}

/** The pointer highlight (`data-hovered`) follows the pointer and clears when it leaves; the keyboard highlight is `aria-selected`. */
export function CommandItem({ className, ...props }: ComponentProps<typeof CommandPrimitive.Item>) {
  const ref = useRef<HTMLDivElement>(null);
  const [hovered, setHovered] = useState(false);
  // cmdk sets its own pointer handlers on the item, so ours are native listeners
  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const on = () => setHovered(true);
    const off = () => setHovered(false);
    node.addEventListener("pointermove", on);
    node.addEventListener("pointerleave", off);
    return () => {
      node.removeEventListener("pointermove", on);
      node.removeEventListener("pointerleave", off);
    };
  }, []);
  return (
    <CommandPrimitive.Item
      ref={ref}
      data-slot="command-item"
      data-hovered={hovered ? "true" : undefined}
      className={cn(
        "flex min-h-control cursor-pointer items-center gap-3 rounded-ui px-3 py-2 text-sm text-ink group-data-[kb=true]/cmd:aria-selected:bg-surface-sunken data-[hovered=true]:bg-surface-sunken",
        className,
      )}
      {...props}
    />
  );
}
