"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { BaseButton } from "@/components/shared/BaseButton";

const SCROLL_FRACTION = 0.8;

export function ChipStrip({ children, label }: { children: ReactNode; label: string }) {
  const strip = useRef<HTMLDivElement>(null);
  const [edges, setEdges] = useState({ left: false, right: false });

  const measure = useCallback(() => {
    const el = strip.current;
    if (!el) return;
    setEdges({ left: el.scrollLeft > 0, right: el.scrollLeft + el.clientWidth < el.scrollWidth - 1 });
  }, []);

  useEffect(() => {
    measure();
    const el = strip.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [measure, children]);

  const scroll = (direction: -1 | 1) => {
    const el = strip.current;
    if (el) el.scrollBy({ left: direction * el.clientWidth * SCROLL_FRACTION, behavior: "smooth" });
  };

  return (
    <div className="flex min-w-0 items-center gap-1">
      {edges.left && (
        <BaseButton variant="ghost" size="sm" className="size-control-sm shrink-0 px-0" aria-label={`Scroll ${label} left`} onClick={() => scroll(-1)}>
          <ChevronLeft aria-hidden="true" />
        </BaseButton>
      )}
      <div ref={strip} onScroll={measure} className="no-scrollbar min-w-0 flex-1 overflow-x-auto">
        {children}
      </div>
      {edges.right && (
        <BaseButton variant="ghost" size="sm" className="size-control-sm shrink-0 px-0" aria-label={`Scroll ${label} right`} onClick={() => scroll(1)}>
          <ChevronRight aria-hidden="true" />
        </BaseButton>
      )}
    </div>
  );
}
