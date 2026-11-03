"use client";

import { useCallback, useState } from "react";
import { useOrganizations } from "@/app/ui/dashboard/organization-context";
import { usePayslipRun } from "@/app/ui/dashboard/payslip-run-context";
import Toast from "@/app/ui/dashboard/toast";
import PayslipPreview from "@/app/ui/payslip-processor/payslip-preview";
import PayslipSummary from "@/app/ui/payslip-processor/payslip-summary";
import { PAY_MONTH, samplePayslips } from "@/app/ui/payslip-processor/sample-payslips";

type ProcessorTab = "preview" | "summary";

const TABS: { value: ProcessorTab; label: string }[] = [
  { value: "preview", label: "Payslip preview" },
  { value: "summary", label: "Payslip summary" },
];

const toolbarButtonClassName =
  "h-8 cursor-pointer rounded bg-navy px-3 text-sm font-semibold text-white transition-opacity hover:opacity-90 focus:ring-2 focus:ring-navy/30 focus:outline-none disabled:cursor-default disabled:opacity-50";
const pagerButtonClassName =
  "flex size-9 cursor-pointer items-center justify-center rounded-md border border-navy bg-white text-navy transition-colors hover:bg-navy hover:text-white focus:ring-2 focus:ring-navy/30 focus:outline-none disabled:cursor-default disabled:border-slate-300 disabled:text-slate-400 disabled:hover:bg-white";

// Preview only: payslips are validated and generated on the Transaction page,
// and the records it creates are listed in the summary tab.
export default function PayslipProcessor() {
  const { selectedOrganization: organization } = useOrganizations();
  const { recordsFor, markSent } = usePayslipRun();
  const [tab, setTab] = useState<ProcessorTab>("preview");
  const [payslipIndex, setPayslipIndex] = useState(0);
  const [toast, setToast] = useState<{ id: number; message: string } | null>(
    null,
  );
  const [shownOrganizationId, setShownOrganizationId] = useState(
    organization.id,
  );

  if (shownOrganizationId !== organization.id) {
    setShownOrganizationId(organization.id);
    setPayslipIndex(0);
    setToast(null);
  }

  const dismissToast = useCallback(() => setToast(null), []);
  const records = recordsFor(organization.id);
  const payslip = samplePayslips[payslipIndex];

  function showToast(message: string) {
    setToast({ id: Date.now(), message });
  }

  // TODO: there is no mail service yet; this only marks the records as sent.
  // TODO: no mail service yet; payslips are only marked as Sent, and added
  // people get nothing. The backend send API only mails employees.
  function handleSendMail(ids: string[], extraCount: number, template: "locked" | "custom") {
    markSent(organization.id, ids);
    const parts = [
      ids.length > 0 && `${ids.length} ${ids.length === 1 ? "payslip" : "payslips"} marked as sent`,
      extraCount > 0 && `${extraCount} added ${extraCount === 1 ? "person" : "people"} included`,
    ].filter(Boolean);
    showToast(
      `${parts.join(", ")} (${template === "locked" ? "locked email format" : "this send's email"}). Emails are not actually sent in this prototype.`,
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <header className="print:hidden">
        <h1 className="text-xl font-bold text-navy">Payslip processor</h1>
      </header>

      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 print:hidden">
        <div role="tablist" aria-label="Payslip steps" className="flex flex-wrap">
          {TABS.map(({ value, label }) => (
            <button
              key={value}
              type="button"
              role="tab"
              id={`processor-tab-${value}`}
              aria-selected={tab === value}
              aria-controls="processor-panel"
              onClick={() => setTab(value)}
              className={`cursor-pointer border-b-2 px-5 py-2.5 text-[15px] font-semibold text-navy transition-colors focus:ring-2 focus:ring-navy/30 focus:outline-none focus:ring-inset ${
                tab === value
                  ? "border-navy bg-white"
                  : "border-transparent hover:bg-white"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="flex gap-2 py-1.5">
          {tab === "preview" && (
            <button
              type="button"
              title="Print or save this payslip as a PDF"
              onClick={() => window.print()}
              className={toolbarButtonClassName}
            >
              Export
            </button>
          )}
        </div>
      </div>

      <div
        role="tabpanel"
        id="processor-panel"
        aria-labelledby={`processor-tab-${tab}`}
      >
        {tab === "preview" && (
          <section
            aria-labelledby="payslip-preview"
            className="overflow-hidden rounded-lg border border-slate-200 bg-white print:border-0"
          >
            <div className="border-b border-slate-200 px-4 py-3.5 sm:px-5 print:hidden">
              <h2 id="payslip-preview" className="text-lg font-bold text-navy">
                Payslip preview
              </h2>
            </div>

            <div className="overflow-x-auto px-4 py-4 sm:px-5 print:overflow-visible print:p-0">
              <PayslipPreview organization={organization} payslip={payslip} />
            </div>

            <div className="flex items-center justify-center gap-3 pb-4 print:hidden">
              <button
                type="button"
                aria-label="Previous employee"
                disabled={payslipIndex === 0}
                onClick={() => setPayslipIndex((index) => index - 1)}
                className={pagerButtonClassName}
              >
                <span aria-hidden="true">&lt;</span>
              </button>
              <p aria-live="polite" className="min-w-24 text-center text-sm text-black">
                {payslipIndex + 1} of {samplePayslips.length}
              </p>
              <button
                type="button"
                aria-label="Next employee"
                disabled={payslipIndex === samplePayslips.length - 1}
                onClick={() => setPayslipIndex((index) => index + 1)}
                className={pagerButtonClassName}
              >
                <span aria-hidden="true">&gt;</span>
              </button>
            </div>
          </section>
        )}

        {tab === "summary" && (
          <PayslipSummary
            key={organization.id}
            organization={organization}
            currentMonth={PAY_MONTH}
            records={records}
            onSendMail={handleSendMail}
          />
        )}
      </div>

      {toast && (
        <Toast key={toast.id} message={toast.message} onDismiss={dismissToast} />
      )}
    </div>
  );
}
