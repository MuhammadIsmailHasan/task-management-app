"use client";

import { Check, ChevronDown } from "lucide-react";
import { useState, type ReactElement, type ReactNode } from "react";
import { BasePopover } from "@/components/shared/BasePopover";
import { controlButtonClasses, controlClasses, controlSize } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { Command, CommandEmpty, CommandInput, CommandItem, CommandList } from "@/components/ui/command";

export interface ComboOption {
  value: string;
  label: string;
  keywords?: string[];
  render?: ReactNode;
}

export const SEARCH_FROM = 6;

interface BaseComboboxProps {
  options: ComboOption[];
  value: string;
  onChange: (value: string) => void;
  label: string;
  placeholder?: string;
  searchable?: boolean;
  wide?: boolean;
  trigger?: ReactElement;
}

export function BaseCombobox({ options, value, onChange, label, placeholder = "Select…", searchable, wide, trigger }: BaseComboboxProps) {
  const [open, setOpen] = useState(false);
  const showSearch = searchable ?? options.length >= SEARCH_FROM;
  const selected = options.find((o) => o.value === value);
  return (
    <BasePopover
      wide={wide}
      label={label}
      open={open}
      onOpenChange={setOpen}
      trigger={
        trigger ?? (
          <button type="button" className={cn(controlClasses, controlButtonClasses, controlSize.md)} aria-label={`${label}: ${selected?.label ?? placeholder}`} aria-haspopup="listbox">
            <span className={selected ? "truncate" : "truncate text-ink-muted"}>{selected?.label ?? placeholder}</span>
            <ChevronDown className="size-icon-sm shrink-0 text-ink-muted" aria-hidden="true" />
          </button>
        )
      }
    >
      <Command label={label}>
        {showSearch && <CommandInput placeholder="Search…" aria-label={`Search ${label}`} />}
        <CommandList aria-label={label}>
          <CommandEmpty>No matches</CommandEmpty>
          {options.map((o) => (
            <CommandItem
              key={o.value}
              value={`${o.label} ${o.keywords?.join(" ") ?? ""}`}
              data-checked={o.value === value}
              onSelect={() => {
                onChange(o.value);
                setOpen(false);
              }}
            >
              <span className="min-w-0 flex-1">{o.render ?? o.label}</span>
              {o.value === value && <Check className="size-icon-sm shrink-0 text-brand" aria-hidden="true" />}
            </CommandItem>
          ))}
        </CommandList>
      </Command>
    </BasePopover>
  );
}
