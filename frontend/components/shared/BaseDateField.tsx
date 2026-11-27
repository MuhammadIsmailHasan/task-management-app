"use client";

import { CalendarDays, X } from "lucide-react";
import { useState } from "react";
import { Calendar } from "@/components/ui/calendar";
import { controlButtonClasses, controlClasses, controlSize } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { fromIso, toIso } from "@/lib/dates";
import { cn } from "@/lib/utils";

interface BaseDateFieldProps {
  label: string;
  value: string;
  onChange: (iso: string) => void;
  id?: string;
  min?: string;
  max?: string;
  placeholder?: string;
  disabled?: boolean;
  clearable?: boolean;
  size?: "md" | "sm";
  invalid?: boolean;
  describedBy?: string;
}

export function BaseDateField({ label, value, onChange, id, min, max, placeholder = "Pick a date", disabled, clearable, size = "md", invalid, describedBy }: BaseDateFieldProps) {
  const [open, setOpen] = useState(false);
  const day = value ? fromIso(value) : undefined;
  const text = day ? day.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" }) : placeholder;
  return (
    <div className="flex items-center gap-1">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            id={id}
            type="button"
            disabled={disabled}
            aria-label={`${label}: ${day ? text : "not set"}`}
            aria-invalid={invalid || undefined}
            aria-describedby={describedBy}
            aria-haspopup="dialog"
            className={cn(controlClasses, controlButtonClasses, controlSize[size])}
          >
            <span className={cn("truncate", !day && "text-ink-muted")}>{text}</span>
            <CalendarDays className="size-icon-sm shrink-0 text-ink-muted" aria-hidden="true" />
          </button>
        </PopoverTrigger>
        <PopoverContent aria-label={`${label} calendar`} className="w-auto">
          <div className="relative">
            <Calendar
              mode="single"
              selected={day}
              defaultMonth={day}
              disabled={[...(min ? [{ before: fromIso(min) }] : []), ...(max ? [{ after: fromIso(max) }] : [])]}
              onSelect={(picked) => {
                if (!picked) return;
                onChange(toIso(picked));
                setOpen(false);
              }}
            />
          </div>
        </PopoverContent>
      </Popover>
      {clearable && value && !disabled && (
        <button type="button" aria-label={`Clear ${label}`} onClick={() => onChange("")} className="inline-flex size-control-sm shrink-0 cursor-pointer items-center justify-center rounded-ui text-ink-muted hover:bg-surface-sunken hover:text-ink focus-ring">
          <X className="size-icon-sm" aria-hidden="true" />
        </button>
      )}
    </div>
  );
}
