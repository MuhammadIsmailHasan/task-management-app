"use client";

import { useId, useState } from "react";
import { BaseCalendar } from "@/components/shared/BaseCalendar";
import { BaseCheckbox } from "@/components/shared/BaseCheckbox";
import { BaseDateField } from "@/components/shared/BaseDateField";
import { isRangeValid, minSelectable, normalizeRange, withStart, type Range } from "@/lib/dates";

interface DateRangePickerProps {
  value: Range;
  onChange: (range: Range) => void;
}

/** One range calendar plus optional Start date and End date fields; the rules are in lib/dates.ts. */
export function DateRangePicker({ value, onChange }: DateRangePickerProps) {
  const id = useId();
  const [hint, setHint] = useState<string | null>(null);
  // The checkboxes decide whether a field is in use, so clearing a field while typing never disables it.
  const [useStart, setUseStart] = useState(!!value.start);
  const [useEnd, setUseEnd] = useState(!!value.end);
  const startOn = useStart || !!value.start;
  const endOn = useEnd || !!value.end;
  const valid = isRangeValid(value.start, value.end);

  function setStart(start: string) {
    const next = withStart(value, start);
    setHint(next.cleared ? "The end date was cleared because the start moved past it." : null);
    onChange({ start: next.start, end: next.end });
  }

  function setEnd(end: string) {
    setHint(null);
    onChange({ start: value.start, end });
  }

  return (
    <div className="flex flex-col gap-field">
      <BaseCalendar
        start={value.start}
        end={value.end}
        notBefore={minSelectable(value)}
        onPick={(day) => {
          setHint(null);
          onChange(normalizeRange(value.start, value.end, day));
        }}
      />
      <div className="grid grid-cols-date-row items-center gap-label">
        <BaseCheckbox
          aria-label="Use a start date"
          checked={startOn}
          onChange={(e) => {
            setUseStart(e.target.checked);
            setStart(e.target.checked ? value.end || todayIso() : "");
          }}
        />
        <label htmlFor={`${id}-start`} className="text-sm font-semibold">
          Start date
        </label>
        <BaseDateField id={`${id}-start`} label="Start date" value={value.start} disabled={!startOn} onChange={setStart} />
        <BaseCheckbox
          aria-label="Use an end date"
          checked={endOn}
          onChange={(e) => {
            setUseEnd(e.target.checked);
            setEnd(e.target.checked ? value.start || todayIso() : "");
          }}
        />
        <label htmlFor={`${id}-end`} className="text-sm font-semibold">
          End date
        </label>
        <BaseDateField
          id={`${id}-end`}
          label="End date"
          min={value.start || undefined}
          value={value.end}
          disabled={!endOn}
          invalid={!valid}
          describedBy={valid ? undefined : `${id}-error`}
          onChange={setEnd}
        />
      </div>
      <div className="flex flex-col gap-label empty:hidden">
        {!valid && (
          <p id={`${id}-error`} role="alert" className="text-xs text-danger">
            The end date cannot be before the start date.
          </p>
        )}
        {hint && (
          <p role="status" className="text-xs text-ink-muted">
            {hint}
          </p>
        )}
      </div>
    </div>
  );
}

function todayIso(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
