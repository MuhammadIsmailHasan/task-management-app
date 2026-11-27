"use client";

import { Calendar } from "@/components/ui/calendar";
import { fromIso, toIso } from "@/lib/dates";

interface BaseCalendarProps {
  start: string;
  end: string;
  onPick: (day: string) => void;
  notBefore?: string;
}

export function BaseCalendar({ start, end, onPick, notBefore }: BaseCalendarProps) {
  const from = start ? fromIso(start) : undefined;
  const to = end ? fromIso(end) : undefined;
  const min = notBefore ? fromIso(notBefore) : undefined;
  return (
    <div className="relative">
      <Calendar
        mode="range"
        selected={from ? { from, to } : undefined}
        defaultMonth={from ?? to}
        disabled={min ? { before: min } : undefined}
        onDayClick={(day) => onPick(toIso(day))}
        onSelect={() => undefined}
      />
    </div>
  );
}
