"use client";

// Holds the organisation chosen in the header "Select Organization" dropdown.
// Wrap the app layout in <OrgProvider>, then call useOrg() in any page.

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";

import { api, type Org } from "@/lib/api";

const STORAGE_KEY = "payroll_org";

interface OrgContextValue {
  orgs: Org[];
  current: Org | null;
  /** Shortcut for current?.org_code */
  orgCode: string | null;
  select: (orgCode: string) => void;
  /** Re-fetch the list (after adding / saving an organisation, or the header Refresh button) */
  refresh: () => Promise<void>;
  loading: boolean;
  error: string | null;
}

const OrgContext = createContext<OrgContextValue | null>(null);

export function OrgProvider({ children }: { children: ReactNode }) {
  const [orgs, setOrgs] = useState<Org[]>([]);
  const [orgCode, setOrgCode] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const list = await api.orgs.list();
      setOrgs(list);
      setError(null);
      setOrgCode((code) => {
        let saved: string | null = null;
        try {
          saved = window.localStorage.getItem(STORAGE_KEY);
        } catch {
          /* ignore */
        }
        const wanted = code ?? saved;
        return list.some((o) => o.org_code === wanted) ? wanted : (list[0]?.org_code ?? null);
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (api.auth.isLoggedIn()) void refresh();
    else setLoading(false);
  }, [refresh]);

  const select = useCallback((code: string) => {
    setOrgCode(code);
    try {
      window.localStorage.setItem(STORAGE_KEY, code);
    } catch {
      /* ignore */
    }
  }, []);

  const current = orgs.find((o) => o.org_code === orgCode) ?? null;
  return (
    <OrgContext.Provider value={{ orgs, current, orgCode, select, refresh, loading, error }}>
      {children}
    </OrgContext.Provider>
  );
}

export function useOrg(): OrgContextValue {
  const value = useContext(OrgContext);
  if (!value) throw new Error("useOrg must be used inside <OrgProvider>");
  return value;
}
