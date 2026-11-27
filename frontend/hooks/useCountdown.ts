"use client";

import { useEffect, useState } from "react";

export function useCountdown(seconds: number | null | undefined): number {
  const [left, setLeft] = useState(seconds && seconds > 0 ? seconds : 0);
  useEffect(() => {
    setLeft(seconds && seconds > 0 ? seconds : 0);
  }, [seconds]);
  useEffect(() => {
    if (left <= 0) return;
    const id = setTimeout(() => setLeft((s) => Math.max(0, s - 1)), 1000);
    return () => clearTimeout(id);
  }, [left]);
  return left;
}

export function formatCountdown(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}
