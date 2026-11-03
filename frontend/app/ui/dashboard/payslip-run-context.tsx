"use client";

import { createContext, use, useState, type ReactNode } from "react";
import type { PayslipRecord } from "@/app/ui/payslip-processor/payslip-summary";

interface PayslipRunContextValue {
  recordsFor: (organizationId: string) => PayslipRecord[];
  // Replaces the organization's records for that month (generating again).
  savePayslips: (organizationId: string, month: string, records: PayslipRecord[]) => void;
  markSent: (organizationId: string, ids: string[]) => void;
}

const PayslipRunContext = createContext<PayslipRunContextValue | null>(null);

export function usePayslipRun() {
  const value = use(PayslipRunContext);
  if (!value) {
    throw new Error("usePayslipRun must be used inside PayslipRunProvider");
  }
  return value;
}

// Payslip records created by Transaction's "Generate payslips" and listed in
// Payslip processor's summary.
// TODO: records live in React state until the backend exists, so they are
// lost on reload; no PDFs are created and no emails are sent.
export default function PayslipRunProvider({ children }: { children: ReactNode }) {
  const [recordsByOrganization, setRecordsByOrganization] = useState<
    Record<string, PayslipRecord[]>
  >({});

  function savePayslips(organizationId: string, month: string, records: PayslipRecord[]) {
    setRecordsByOrganization((current) => ({
      ...current,
      [organizationId]: [
        ...records,
        ...(current[organizationId] ?? []).filter((record) => record.month !== month),
      ],
    }));
  }

  function markSent(organizationId: string, ids: string[]) {
    setRecordsByOrganization((current) => ({
      ...current,
      [organizationId]: (current[organizationId] ?? []).map((record) =>
        ids.includes(record.id) ? { ...record, status: "Sent", error: "" } : record,
      ),
    }));
  }

  return (
    <PayslipRunContext
      value={{
        recordsFor: (organizationId) => recordsByOrganization[organizationId] ?? [],
        savePayslips,
        markSent,
      }}
    >
      {children}
    </PayslipRunContext>
  );
}
