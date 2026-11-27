"use client";

import type { ReactNode } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

interface BasePopoverProps {
  trigger: ReactNode;
  children: ReactNode;
  label: string;
  wide?: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function BasePopover({ trigger, children, label, wide = false, open, onOpenChange }: BasePopoverProps) {
  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      <PopoverContent aria-label={label} className={cn("w-popover", wide && "w-popover-wide")}>
        {children}
      </PopoverContent>
    </Popover>
  );
}
