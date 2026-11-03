"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { downloadCsv } from "@/app/ui/dashboard/download";
import { useOrganizations } from "@/app/ui/dashboard/organization-context";
import { usePayslipRun } from "@/app/ui/dashboard/payslip-run-context";
import Toast from "@/app/ui/dashboard/toast";
import { formatPaise, sumPaise } from "@/app/ui/payslip-processor/money";
import { PAY_MONTH, PAY_PERIOD } from "@/app/ui/payslip-processor/sample-payslips";
import ImportSheetDialog from "@/app/ui/transaction/import-sheet-dialog";
import {
  CODE_HEADER,
  EMAIL_HEADER,
  EXCESS_LEAVE_HEADER,
  formatAmount,
  importCsv,
  initialRowsByOrganization,
  NAME_HEADER,
  salaryWorking,
  toCsv,
  type PayrollRow,
} from "@/app/ui/transaction/payroll-data";
import { validateRows, type RowIssue } from "@/app/ui/transaction/validate-rows";

interface Column {
  label: string;
  kind: "text" | "days" | "money";
  value: (row: PayrollRow) => string | number;
  // Days and amounts are totalled unless this is false.
  hasTotal?: boolean;
}

type TransactionView = "breakdown" | "consolidated";

const VIEWS: { value: TransactionView; label: string }[] = [
  { value: "breakdown", label: "Breakdown view" },
  { value: "consolidated", label: "Consolidated view" },
];

// Every attendance and salary column.
// TODO: the breakdown view's layout is still to be specified.
const breakdownColumns: Column[] = [
  { label: CODE_HEADER, kind: "text", value: (row) => row.code },
  { label: NAME_HEADER, kind: "text", value: (row) => row.name },
  { label: EMAIL_HEADER, kind: "text", value: (row) => row.email },
  { label: "Present", kind: "days", hasTotal: false, value: (row) => row.attendance.present },
  { label: "Leave", kind: "days", hasTotal: false, value: (row) => row.attendance.leave },
  {
    label: EXCESS_LEAVE_HEADER,
    kind: "days",
    hasTotal: false,
    value: (row) => row.excessLeave,
  },
  { label: "Basic Salary", kind: "money", value: (row) => row.salary.basic },
  { label: "Conveyance", kind: "money", value: (row) => row.salary.conveyance },
  { label: "Gross", kind: "money", value: (row) => salaryWorking(row.salary).gross },
  { label: "LOP", kind: "money", value: (row) => row.salary.lop },
  { label: "Income Tax (TDS)", kind: "money", value: (row) => row.salary.tds },
  {
    label: "Deductions",
    kind: "money",
    value: (row) => salaryWorking(row.salary).deductions,
  },
  { label: "Net", kind: "money", value: (row) => salaryWorking(row.salary).net },
];

// One line per employee: who, attendance summary, and the three totals.
const CONSOLIDATED_LABELS = [
  CODE_HEADER,
  NAME_HEADER,
  EMAIL_HEADER,
  "Present",
  "Leave",
  EXCESS_LEAVE_HEADER,
  "Gross",
  "Deductions",
  "Net",
];
const consolidatedColumns = CONSOLIDATED_LABELS.map(
  (label) => breakdownColumns.find((column) => column.label === label)!,
);

const VIEW_COLUMNS: Record<TransactionView, Column[]> = {
  breakdown: breakdownColumns,
  consolidated: consolidatedColumns,
};

const VIEW_NOTES: Record<TransactionView, string> = {
  breakdown:
    "Attendance and salary side by side · Amounts in ₹ · Gross = Basic Salary + Conveyance · Deductions = TDS + LOP · Net = Gross − Deductions",
  consolidated: "One line per employee · Amounts in ₹ · Net = Gross − Deductions",
};

function displayValue(column: Column, value: string | number) {
  if (column.kind === "money") return formatAmount(value as number);
  // Blank days read more easily than a wall of zeros.
  if (column.kind === "days") return value === 0 ? "" : String(value);
  return String(value);
}

function columnTotal(column: Column, rows: PayrollRow[]) {
  const values = rows.map((row) => column.value(row) as number);
  return column.kind === "money"
    ? formatAmount(sumPaise(values))
    : String(values.reduce((total, value) => total + value, 0));
}

// Plain numbers without grouping commas, so spreadsheets read them as values.
function csvValue(column: Column, value: string | number) {
  if (column.kind === "money") {
    return formatPaise(value as number).replaceAll(",", "");
  }
  return String(value);
}

const toolbarButtonClassName =
  "h-8 cursor-pointer rounded bg-navy px-3 text-sm font-semibold text-white transition-opacity hover:opacity-90 focus:ring-2 focus:ring-navy/30 focus:outline-none disabled:cursor-default disabled:opacity-50";

export default function Transaction() {
  const { selectedOrganization: organization } = useOrganizations();
  const { savePayslips } = usePayslipRun();
  const [view, setView] = useState<TransactionView>("consolidated");
  const columns = VIEW_COLUMNS[view];
  const viewLabel = VIEWS.find(({ value }) => value === view)!.label;
  const [rowsByOrganization, setRowsByOrganization] = useState(
    initialRowsByOrganization,
  );
  // Organizations whose payslips were generated from the current figures.
  const [generatedIds, setGeneratedIds] = useState<string[]>([]);
  // The last validation of each organization's current figures; missing
  // means not validated yet. Generate needs one with no issues.
  const [issuesByOrganization, setIssuesByOrganization] = useState<
    Record<string, RowIssue[]>
  >({});
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [toast, setToast] = useState<{ id: number; message: string } | null>(
    null,
  );
  const [shownOrganizationId, setShownOrganizationId] = useState(
    organization.id,
  );

  if (shownOrganizationId !== organization.id) {
    setShownOrganizationId(organization.id);
    setIsImportOpen(false);
    setToast(null);
  }

  useEffect(() => {
    return () => {
      setIsImportOpen(false);
      setToast(null);
    };
  }, []);

  const dismissToast = useCallback(() => setToast(null), []);
  const rows = rowsByOrganization[organization.id] ?? [];
  const isGenerated = generatedIds.includes(organization.id);
  const issues = issuesByOrganization[organization.id];
  const isValidated = issues !== undefined && issues.length === 0;
  // Payslips are only generated from a locked payslip format.
  const canGenerate = isValidated && organization.isPayslipLocked && !isGenerated;
  const totalNet = sumPaise(rows.map((row) => salaryWorking(row.salary).net));

  function handleImport(text: string) {
    const result = importCsv(rows, text);
    if ("error" in result) return result.error;

    setRowsByOrganization((current) => ({
      ...current,
      [organization.id]: result.rows,
    }));
    // The figures changed, so the validation and any generated payslips are
    // out of date.
    setGeneratedIds((current) => current.filter((id) => id !== organization.id));
    setIssuesByOrganization((current) => {
      const next = { ...current };
      delete next[organization.id];
      return next;
    });
    setIsImportOpen(false);
    setToast({
      id: Date.now(),
      message: `${result.count} ${result.count === 1 ? "row" : "rows"} imported.`,
    });
    return null;
  }

  function handleExport() {
    const csv = toCsv([
      columns.map(({ label }) => label),
      ...rows.map((row) =>
        columns.map((column) => csvValue(column, column.value(row))),
      ),
    ]);
    const period = PAY_PERIOD.toLowerCase().replaceAll(" ", "-");
    downloadCsv(`${organization.code}-${view}-${period}.csv`, csv);
  }

  function handleValidate() {
    const found = validateRows(rows);
    setIssuesByOrganization((current) => ({ ...current, [organization.id]: found }));
    setToast({
      id: Date.now(),
      message:
        found.length === 0
          ? `All ${rows.length} rows passed validation. You can generate payslips now.`
          : `${found.length} ${found.length === 1 ? "issue" : "issues"} found. Fix them and validate again.`,
    });
  }

  function handleGenerate() {
    if (!canGenerate) return;
    const date = new Date().toISOString().slice(0, 10);
    // Listed in Payslip processor's summary; generating again replaces the
    // month's records.
    savePayslips(
      organization.id,
      PAY_MONTH,
      rows.map((row) => ({
        id: `${organization.id}-${PAY_MONTH}-${row.code}`,
        name: row.name,
        email: row.email,
        date,
        month: PAY_MONTH,
        status: "Generated",
        error: row.email ? "" : "No email address",
      })),
    );
    setGeneratedIds((current) => [...current, organization.id]);
    setToast({
      id: Date.now(),
      message: `Payslips generated for ${rows.length} employees.`,
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <header>
        <h1 className="text-xl font-bold text-navy">Transaction</h1>
      </header>

      <section
        aria-label={`Payroll workings, ${viewLabel}`}
        className="overflow-hidden rounded-lg border border-slate-200 bg-white"
      >
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pr-4">
          <div role="tablist" aria-label="Transaction views" className="flex flex-wrap">
            {VIEWS.map(({ value, label }) => (
              <button
                key={value}
                type="button"
                role="tab"
                id={`transaction-tab-${value}`}
                aria-selected={view === value}
                aria-controls="transaction-panel"
                onClick={() => setView(value)}
                className={`cursor-pointer border-b-2 px-5 py-3 text-[15px] font-semibold text-navy transition-colors focus:ring-2 focus:ring-navy/30 focus:outline-none focus:ring-inset ${
                  view === value ? "border-navy bg-slate-50" : "border-transparent hover:bg-slate-50"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="flex gap-2 py-2">
            <button
              type="button"
              onClick={() => setIsImportOpen(true)}
              className={toolbarButtonClassName}
            >
              Import
            </button>
            <button
              type="button"
              onClick={handleExport}
              disabled={rows.length === 0}
              className={toolbarButtonClassName}
            >
              Export
            </button>
          </div>
        </div>

        <p className="border-b border-navy bg-slate-50 px-5 py-2.5 text-[15px] text-navy">
          {VIEW_NOTES[view]}
        </p>

        <div
          role="tabpanel"
          id="transaction-panel"
          aria-labelledby={`transaction-tab-${view}`}
        >
        {rows.length === 0 ? (
          <p className="px-5 py-12 text-center text-sm text-black">
            No payroll workings for {organization.name} yet. Import a sheet to
            get started.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] border-collapse text-sm">
              <caption className="sr-only">
                {viewLabel}, {PAY_PERIOD}
              </caption>
              <thead>
                <tr className="border-b border-slate-200">
                  {columns.map((column) => (
                    <th
                      key={column.label}
                      scope="col"
                      className={`px-3 py-3 text-[11px] font-semibold whitespace-nowrap text-black first:pl-5 last:pr-5 ${
                        column.kind === "text" ? "text-left" : ""
                      } ${column.kind === "money" ? "text-right" : ""} ${
                        column.label === NAME_HEADER ? "uppercase" : ""
                      }`}
                    >
                      {column.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="text-black">
                {rows.map((row) => (
                  <tr
                    key={row.code}
                    className="border-b border-slate-200 even:bg-slate-50/60"
                  >
                    {columns.map((column) => {
                      const content = displayValue(column, column.value(row));
                      return column.label === NAME_HEADER ? (
                        <th
                          key={column.label}
                          scope="row"
                          className="px-3 py-2.5 text-left font-normal whitespace-nowrap first:pl-5"
                        >
                          {content}
                        </th>
                      ) : (
                        <td
                          key={column.label}
                          className={`px-3 py-2.5 whitespace-nowrap tabular-nums first:pl-5 last:pr-5 ${
                            column.kind === "days" ? "text-center" : ""
                          } ${column.kind === "money" ? "text-right" : ""} ${
                            column.kind === "text" ? "text-black" : ""
                          }`}
                        >
                          {content}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-slate-50 font-bold text-navy">
                <tr>
                  {columns.map((column, index) => (
                    <td
                      key={column.label}
                      className={`px-3 py-3 whitespace-nowrap tabular-nums first:pl-5 last:pr-5 ${
                        column.kind === "days" ? "text-center" : ""
                      } ${column.kind === "money" ? "text-right" : ""}`}
                    >
                      {index === 0
                        ? "Total"
                        : column.kind === "text"
                          ? ""
                          : column.hasTotal === false
                            ? "–"
                            : columnTotal(column, rows)}
                    </td>
                  ))}
                </tr>
              </tfoot>
            </table>
          </div>
        )}
        </div>
      </section>

      {issues && issues.length > 0 && (
        <div
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 px-5 py-3 text-sm text-red-700"
        >
          <p className="font-semibold">
            {issues.length} {issues.length === 1 ? "issue" : "issues"} found.
            Fix them, then validate again.
          </p>
          <ul className="mt-1.5 list-disc pl-5">
            {issues.map(({ code, name, message }) => (
              <li key={`${code}-${message}`}>
                <span className="font-medium">
                  {code} · {name}:
                </span>{" "}
                {message}
              </li>
            ))}
          </ul>
        </div>
      )}

      {rows.length > 0 && (
        <div className="flex flex-wrap items-center justify-end gap-3">
          {isValidated && !isGenerated && (
            <p role="status" className="text-sm text-emerald-700">
              All {rows.length} rows passed validation.
            </p>
          )}
          {isValidated && !isGenerated && !organization.isPayslipLocked && (
            <p className="text-sm text-black">
              Lock the payslip format in{" "}
              <Link
                href="/organization-setup"
                className="font-medium text-navy underline underline-offset-2 hover:no-underline"
              >
                Organization Setup
              </Link>{" "}
              before generating.
            </p>
          )}
          {isGenerated && (
            <p role="status" className="text-sm text-black">
              Payslips generated for {rows.length} employees · Net ₹{" "}
              {formatAmount(totalNet)} ·{" "}
              <Link
                href="/payslip-processor"
                className="font-medium text-navy underline underline-offset-2 hover:no-underline"
              >
                Open payslip processor
              </Link>
            </p>
          )}
          <button
            type="button"
            onClick={handleValidate}
            disabled={isGenerated}
            className="h-10 cursor-pointer rounded-md border border-navy bg-white px-4 text-base font-medium text-navy transition-colors hover:bg-slate-50 focus:ring-2 focus:ring-navy/30 focus:outline-none disabled:cursor-default disabled:opacity-50 disabled:hover:bg-white"
          >
            {isValidated ? "Validated" : "Validate"}
          </button>
          <button
            type="button"
            onClick={handleGenerate}
            disabled={!canGenerate}
            title={
              isGenerated
                ? undefined
                : !isValidated
                  ? "Validate the figures first"
                  : !organization.isPayslipLocked
                    ? "Lock the payslip format in Organization Setup first"
                    : undefined
            }
            className="h-10 cursor-pointer rounded-md bg-navy px-4 text-base font-medium text-white transition-opacity hover:opacity-90 focus:ring-2 focus:ring-navy/30 focus:outline-none disabled:cursor-default disabled:opacity-50"
          >
            {isGenerated ? "Payslips generated" : "Generate payslips"}
          </button>
        </div>
      )}

      {isImportOpen && (
        <ImportSheetDialog
          sheetName="consolidated sheet"
          onImport={handleImport}
          onClose={() => setIsImportOpen(false)}
        />
      )}

      {toast && (
        <Toast key={toast.id} message={toast.message} onDismiss={dismissToast} />
      )}
    </div>
  );
}
