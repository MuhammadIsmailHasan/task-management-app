"use client";

import { Check } from "lucide-react";
import { useState } from "react";
import { BasePopover } from "@/components/shared/BasePopover";
import { controlButtonClasses, controlClasses, controlSize } from "@/components/ui/input";
import { PALETTE, SOLID, type Tone } from "@/lib/tones";
import { cn } from "@/lib/utils";

interface ColorSwatchPickerProps {
  /** Accessible name, such as "Color of Bug". */
  label: string;
  value: Tone;
  onChange: (tone: Tone) => void;
}

/** The 18 category colours as a 6 by 3 grid of swatches in a popover (CATP-03). The chosen one carries a check and `aria-pressed`. */
export function ColorSwatchPicker({ label, value, onChange }: ColorSwatchPickerProps) {
  const [open, setOpen] = useState(false);
  const name = (t: string) => t[0].toUpperCase() + t.slice(1);
  return (
    <BasePopover
      label={label}
      open={open}
      onOpenChange={setOpen}
      trigger={
        <button type="button" aria-label={`${label}: ${name(value)}`} aria-haspopup="dialog" className={cn(controlClasses, controlButtonClasses, controlSize.md, "justify-start")}>
          <i aria-hidden="true" className={cn("size-icon rounded-ui", SOLID[value])} />
          <span className="truncate">{name(value)}</span>
        </button>
      }
    >
      <div role="group" aria-label={label} className="grid grid-cols-6 gap-2">
        {PALETTE.map((tone) => (
          <button
            key={tone}
            type="button"
            aria-label={name(tone)}
            aria-pressed={tone === value}
            onClick={() => {
              onChange(tone);
              setOpen(false);
            }}
            className={cn("inline-flex size-control-sm cursor-pointer items-center justify-center rounded-ui text-on-brand transition-transform duration-fast hover:scale-110 focus-ring", SOLID[tone])}
          >
            {tone === value && <Check className="size-icon-sm" strokeWidth={3} aria-hidden="true" />}
          </button>
        ))}
      </div>
    </BasePopover>
  );
}
