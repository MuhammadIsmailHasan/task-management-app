"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { DayPicker, type DayPickerProps } from "react-day-picker";
import { cn } from "@/lib/utils";

/** shadcn/ui Calendar on react-day-picker, themed from the design tokens. */
export function Calendar({ className, classNames, ...props }: DayPickerProps) {
  return (
    <DayPicker
      showOutsideDays
      className={cn("text-sm", className)}
      classNames={{
        months: "flex flex-col",
        month: "flex flex-col gap-2",
        month_caption: "flex h-control-sm items-center justify-center font-semibold",
        nav: "absolute inset-x-0 top-0 flex items-center justify-between",
        button_previous: "inline-flex size-control-sm items-center justify-center rounded-ui text-ink-muted hover:bg-surface-sunken hover:text-ink focus-ring",
        button_next: "inline-flex size-control-sm items-center justify-center rounded-ui text-ink-muted hover:bg-surface-sunken hover:text-ink focus-ring",
        month_grid: "w-full border-collapse",
        weekday: "size-cell text-xs font-medium text-ink-muted",
        week: "",
        day: "size-cell p-0 text-center",
        day_button: "inline-flex size-cell items-center justify-center rounded-ui text-sm hover:bg-surface-sunken focus-ring",
        selected: "",
        range_start: "rounded-l-ui bg-brand text-on-brand",
        range_end: "rounded-r-ui bg-brand text-on-brand",
        range_middle: "bg-brand-tint text-brand",
        today: "font-bold text-brand",
        outside: "text-ink-muted opacity-muted",
        disabled: "text-ink-muted opacity-disabled",
        hidden: "invisible",
        ...classNames,
      }}
      components={{
        Chevron: ({ orientation }) => (orientation === "left" ? <ChevronLeft className="size-icon" aria-hidden="true" /> : <ChevronRight className="size-icon" aria-hidden="true" />),
      }}
      {...props}
    />
  );
}
