"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { currentPageSize } from "@/lib/paging";

interface Row {
  id: string;
}

export function usePagedList<T extends Row>(fetchPage: (page: { limit: number; before?: string }) => Promise<T[]>, deps: unknown[]) {
  const [rows, setRows] = useState<T[] | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const size = useRef(currentPageSize());
  const fetchRef = useRef(fetchPage);
  fetchRef.current = fetchPage;

  useEffect(() => {
    let live = true;
    setRows(null);
    setError(null);
    fetchRef
      .current({ limit: size.current })
      .then((page) => {
        if (!live) return;
        setRows(page);
        setHasMore(page.length === size.current);
      })
      .catch(() => live && setError("Could not load."));
    return () => {
      live = false;
    };
  }, deps);

  const loadMore = useCallback(async () => {
    if (!rows || rows.length === 0) return;
    setLoadingMore(true);
    try {
      const page = await fetchRef.current({ limit: size.current, before: rows[rows.length - 1].id });
      setRows((cur) => [...(cur ?? []), ...page]);
      setHasMore(page.length === size.current);
    } catch {
      setError("Could not load more.");
    } finally {
      setLoadingMore(false);
    }
  }, [rows]);

  return { rows, hasMore, loadingMore, error, loadMore, pageSize: size.current };
}
