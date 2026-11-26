"use client";

import * as TabsPrimitive from "@radix-ui/react-tabs";
import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

export const Tabs = TabsPrimitive.Root;

/** shadcn/ui Tabs on Radix: role="tablist", arrow-key navigation, `aria-selected`. The track is the pill track recipe. */
export function TabsList({ className, ...props }: ComponentProps<typeof TabsPrimitive.List>) {
  return <TabsPrimitive.List data-slot="tabs-list" className={cn("flex w-full gap-1 rounded-ui bg-surface p-1", className)} {...props} />;
}

export function TabsTrigger({ className, ...props }: ComponentProps<typeof TabsPrimitive.Trigger>) {
  return (
    <TabsPrimitive.Trigger
      data-slot="tabs-trigger"
      className={cn(
        "inline-flex min-h-control flex-1 cursor-pointer items-center justify-center gap-2 rounded-ui px-4 text-sm font-medium text-ink-muted transition-colors duration-fast focus-ring",
        "data-[state=active]:bg-surface-raised data-[state=active]:font-semibold data-[state=active]:text-ink data-[state=active]:shadow-card",
        className,
      )}
      {...props}
    />
  );
}

export function TabsContent({ className, ...props }: ComponentProps<typeof TabsPrimitive.Content>) {
  return <TabsPrimitive.Content data-slot="tabs-content" className={cn("focus:outline-none", className)} {...props} />;
}
