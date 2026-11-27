import { useLayoutEffect, useRef, type RefObject } from "react";

export function useFlip(root: RefObject<HTMLElement | null>) {
  const previous = useRef(new Map<string, DOMRect>());
  useLayoutEffect(() => {
    const el = root.current;
    if (!el) return;
    const reduced = typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const next = new Map<string, DOMRect>();
    el.querySelectorAll<HTMLElement>("[data-flip-id]").forEach((node) => {
      const id = node.dataset.flipId as string;
      const rect = node.getBoundingClientRect();
      next.set(id, rect);
      const old = previous.current.get(id);
      if (!old || reduced || typeof node.animate !== "function") return;
      const dx = old.left - rect.left;
      const dy = old.top - rect.top;
      if (dx || dy) {
        node.animate([{ transform: `translate(${dx}px, ${dy}px)` }, { transform: "none" }], {
          duration: 180,
          easing: "cubic-bezier(.2,.8,.2,1)",
        });
      }
    });
    previous.current = next;
  });
}
