"use client";

import { useCallback, useEffect, useState } from "react";

const KEY = "revoboard.sidebar";

export function useSidebarState(): { expanded: boolean; toggle: () => void } {
  const [expanded, setExpanded] = useState(true);

  useEffect(() => {
    try {
      if (localStorage.getItem(KEY) === "collapsed") setExpanded(false);
    } catch {
    }
  }, []);

  const toggle = useCallback(() => {
    setExpanded((cur) => {
      const next = !cur;
      try {
        localStorage.setItem(KEY, next ? "expanded" : "collapsed");
      } catch {
      }
      return next;
    });
  }, []);

  return { expanded, toggle };
}
