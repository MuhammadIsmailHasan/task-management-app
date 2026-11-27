"use client";

import { useRef, type KeyboardEvent } from "react";
import { BaseButton } from "@/components/shared/BaseButton";
import { cn } from "@/lib/utils";

export interface SegmentOption<T extends string> {
  value: T;
  label: string;
}

interface BaseSegmentedProps<T extends string> {
  options: SegmentOption<T>[];
  value: T;
  onChange: (value: T) => void;
  label: string;
}

export function BaseSegmented<T extends string>({ options, value, onChange, label }: BaseSegmentedProps<T>) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);

  function onKeyDown(e: KeyboardEvent, index: number) {
    const step = e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : e.key === "ArrowLeft" || e.key === "ArrowUp" ? -1 : 0;
    if (!step) return;
    e.preventDefault();
    const next = (index + step + options.length) % options.length;
    onChange(options[next].value);
    refs.current[next]?.focus();
  }

  return (
    <div role="radiogroup" aria-label={label} className="inline-flex w-fit gap-1 rounded-ui bg-surface p-1">
      {options.map((o, i) => {
        const selected = o.value === value;
        return (
          <BaseButton
            key={o.value}
            ref={(el) => {
              refs.current[i] = el;
            }}
            variant="ghost"
            size="sm"
            role="radio"
            aria-checked={selected}
            tabIndex={selected || (!options.some((x) => x.value === value) && i === 0) ? 0 : -1}
            className={cn("rounded-ui px-4", selected ? "bg-surface-raised font-semibold text-ink shadow-card hover:bg-surface-raised" : "font-medium text-ink-muted")}
            onClick={() => onChange(o.value)}
            onKeyDown={(e) => onKeyDown(e, i)}
          >
            {o.label}
          </BaseButton>
        );
      })}
    </div>
  );
}
