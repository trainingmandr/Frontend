"use client";

// Minimal data-loading hook so pages don't repeat loading / error state.
//   const { data, loading, error, reload } = useApi(() => api.employees.list(orgCode!, { search }), [orgCode, search], !!orgCode);
// (If the project already uses SWR or React Query, use that instead with the same api.* functions.)

import { useCallback, useEffect, useRef, useState, type DependencyList } from "react";

import { ApiError } from "@/lib/api";

export function useApi<T>(load: () => Promise<T>, deps: DependencyList, enabled = true) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState<ApiError | Error | null>(null);
  const latest = useRef(0);

  const reload = useCallback(async () => {
    if (!enabled) return;
    const call = ++latest.current;
    setLoading(true);
    try {
      const result = await load();
      if (call === latest.current) {
        setData(result);
        setError(null);
      }
    } catch (e) {
      if (call === latest.current) setError(e instanceof Error ? e : new Error(String(e)));
    } finally {
      if (call === latest.current) setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, ...deps]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { data, setData, loading, error, reload };
}
