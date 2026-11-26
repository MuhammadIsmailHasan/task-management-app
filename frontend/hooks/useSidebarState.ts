"use client";

import { useCallback, useEffect, useState } from "react";

const KEY = "revoboard.sidebar";

/**
 * Sidebar expanded or collapsed, per browser (NAV-02, Open Question 48). The default is expanded; a missing key, an
 * unknown value, a storage error, and the server render all give expanded.
 */
export function useSidebarState(): { expanded: boolean; toggle: () => void } {
  const [expanded, setExpanded] = useState(true);

  useEffect(() => {
    try {
      if (localStorage.getItem(KEY) === "collapsed") setExpanded(false);
    } catch {
      /* storage unavailable: stay expanded */
    }
  }, []);

  const toggle = useCallback(() => {
    setExpanded((cur) => {
      const next = !cur;
      try {
        localStorage.setItem(KEY, next ? "expanded" : "collapsed");
      } catch {
        /* storage unavailable: the choice lasts for this page only */
      }
      return next;
    });
  }, []);

  return { expanded, toggle };
}
