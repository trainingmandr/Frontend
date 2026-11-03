"use client";

import Link from "next/link";
import { longMonth, shortMonth } from "@/app/ui/dashboard/months";
import { useOrganizations } from "@/app/ui/dashboard/organization-context";
import { api, ApiError, type PayrollStatus } from "@/lib/api";
import { formatINR } from "@/lib/api/format";
import { useApi } from "@/lib/use-api";

const panelClassName =
  "rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5";

const statusClassNames: Record<PayrollStatus, string> = {
  DRAFT: "bg-amber-50 text-amber-900 ring-amber-200",
  PROCESSED: "bg-emerald-50 text-emerald-800 ring-emerald-200",
  LOCKED: "bg-navy text-white ring-navy",
};

function plural(count: number, word: string) {
  return `${count} ${word}${count === 1 ? "" : "s"}`;
}

function Metric({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className={panelClassName}>
      <p className="text-xs text-black">{label}</p>
      <p className="mt-2.5 mb-1 text-2xl font-extrabold text-navy tabular-nums">
        {value}
      </p>
      <p className="text-[11px] text-black">{hint}</p>
    </div>
  );
}

function Line({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-2 border-b border-slate-100 py-2.5 text-xs last:border-b-0">
      <dt className="text-black">{label}</dt>
      <dd className="font-bold text-navy tabular-nums">{value}</dd>
    </div>
  );
}

interface TrendPoint {
  key: string;
  month: string;
  net: number;
}

function TrendChart({ trend }: { trend: TrendPoint[] }) {
  const max = Math.max(...trend.map(({ net }) => net), 1);

  return (
    <>
      <div className="flex h-[150px] items-end gap-2 px-1.5 pt-6 sm:gap-3.5">
        {trend.map(({ key, month, net }, index) => {
          const isCurrent = index === trend.length - 1;
          return (
            <div
              key={key}
              tabIndex={0}
              aria-label={`${month}: Net ${formatINR(net)}`}
              className="group relative flex h-full flex-1 flex-col justify-end text-center outline-none"
            >
              <span
                role="tooltip"
                className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1 hidden -translate-x-1/2 rounded bg-navy px-2 py-1 text-[11px] whitespace-nowrap text-white group-hover:block group-focus:block"
              >
                {month} · {formatINR(net)}
              </span>
              <div
                aria-hidden="true"
                style={{ height: `${Math.max((net / max) * 100, net > 0 ? 3 : 0)}%` }}
                className={`rounded-t ring-navy/30 group-focus:ring-2 ${
                  isCurrent ? "bg-teal" : "bg-navy/80 group-hover:bg-navy"
                }`}
              />
            </div>
          );
        })}
      </div>
      <div aria-hidden="true" className="flex gap-2 border-t border-slate-200 px-1.5 pt-1.5 sm:gap-3.5">
        {trend.map(({ key, month }) => (
          <span key={key} className="flex-1 text-center text-[10px] text-black">
            {month}
          </span>
        ))}
      </div>
      <table className="sr-only">
        <caption>Net payroll by month</caption>
        <thead>
          <tr>
            <th scope="col">Month</th>
            <th scope="col">Net payroll (₹)</th>
          </tr>
        </thead>
        <tbody>
          {trend.map(({ key, month, net }) => (
            <tr key={key}>
              <th scope="row">{month}</th>
              <td>{formatINR(net)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}

// Figures for the organization and month picked in the topbar, from the
// backend. The organization's code must exist there (MRA and ETPL do after
// `python -m app.seed_demo`).
export default function Dashboard() {
  const { selectedOrganization: organization, payrollMonth: month } = useOrganizations();
  const orgCode = organization.code;
  const { data, loading, error, reload } = useApi(
    () =>
      Promise.all([
        api.dashboard.get(orgCode, month),
        api.transactions.grid(orgCode, month),
        api.payslips.list(orgCode, month),
      ]),
    [orgCode, month],
  );
  const period = longMonth(month);

  const header = (
    <header>
      <h1 className="text-xl font-bold text-navy">Payroll Overview</h1>
      <p className="mt-1 flex flex-wrap items-center gap-2 text-xs text-black">
        {organization.name} · {period} payroll
        {data?.[0].payroll.status && (
          <span
            className={`rounded px-1.5 py-0.5 text-[10px] font-semibold tracking-wide ring-1 ${statusClassNames[data[0].payroll.status]}`}
          >
            {data[0].payroll.status}
          </span>
        )}
      </p>
    </header>
  );

  if (error) {
    const message =
      error instanceof ApiError && error.status === 404
        ? `${organization.name} (${orgCode}) is not in the payroll database yet.`
        : error.message;
    return (
      <div className="flex flex-col gap-4">
        {header}
        <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <p>{message}</p>
          <button
            type="button"
            onClick={() => void reload()}
            className="mt-2 cursor-pointer font-medium text-red-800 underline underline-offset-2 hover:no-underline"
          >
            Try again
          </button>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex flex-col gap-4">
        {header}
        <p role="status" className="py-12 text-center text-sm text-black">
          Loading {period} payroll…
        </p>
      </div>
    );
  }

  const [dashboard, grid, payslips] = data;
  const { payroll, emails } = dashboard;
  const hasPayroll = payroll.status !== null;
  const isProcessed = payroll.status === "PROCESSED" || payroll.status === "LOCKED";
  const money = (rupees: number) => (hasPayroll ? formatINR(rupees) : "—");

  const missingInputs = grid.rows.filter((row) => Object.keys(row.values).length === 0).length;
  const calculationErrors = grid.rows.filter((row) => row.net_pay < 0).length;

  const payslipCount = payslips.length;
  const notSent = Math.max(payslipCount - emails.sent - emails.failed - emails.pending, 0);
  const completion = payslipCount ? Math.round((emails.sent / payslipCount) * 100) : 0;
  const payslipIssues = [
    ...(hasPayroll && !isProcessed
      ? [{ key: "draft", employee: "Payroll", message: "Not processed yet, so payslips can't be sent." }]
      : []),
    ...payslips
      .filter(({ email }) => !email)
      .map(({ emp_code, emp_name }) => ({
        key: emp_code,
        employee: `${emp_code} · ${emp_name}`,
        message: "No email address, so the payslip can't be mailed.",
      })),
  ];

  const spansYears = dashboard.payroll_trend[0]?.month_year.slice(0, 4) !== month.slice(0, 4);
  const trend = dashboard.payroll_trend.map((point) => ({
    key: point.month_year,
    month: shortMonth(point.month_year, spansYears),
    net: point.net_payroll,
  }));
  const hasTrend = trend.some(({ net }) => net > 0);

  return (
    <div className={`flex flex-col gap-4 ${loading ? "opacity-60 transition-opacity" : ""}`}>
      {header}

      {!hasPayroll && (
        <p
          role="status"
          className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm text-amber-900"
        >
          No payroll entered for {organization.name} in {period}.{" "}
          <Link href="/transaction" className="font-medium underline underline-offset-2 hover:no-underline">
            Enter it on Transaction
          </Link>
          .
        </p>
      )}

      <section
        aria-label={`Payroll totals, ${period}`}
        className="grid grid-cols-2 gap-2 sm:gap-3 xl:grid-cols-4"
      >
        <Metric label="Employees" value={String(grid.rows.length)} hint="On this month's payroll" />
        <Metric label="Gross Payroll" value={money(payroll.gross_payroll)} hint="All earnings" />
        <Metric label="Deductions" value={money(payroll.total_deductions)} hint="All deductions" />
        <Metric
          label="Net Payroll"
          value={money(payroll.net_payroll)}
          hint={isProcessed ? "Processed total" : "Live total, not processed yet"}
        />
      </section>

      <div className="grid gap-4 lg:grid-cols-3">
        <section aria-labelledby="payroll-completion" className={panelClassName}>
          <h2 id="payroll-completion" className="text-lg font-bold text-navy">
            Payroll Completion
          </h2>
          <p className="mt-3 text-[28px] font-extrabold text-navy tabular-nums">
            {emails.sent} / {payslipCount}
          </p>
          <p className="text-xs text-black">Payslips emailed to employees</p>
          <div
            role="progressbar"
            aria-label="Payslips emailed"
            aria-valuemin={0}
            aria-valuemax={payslipCount}
            aria-valuenow={emails.sent}
            className="my-3 h-2.5 overflow-hidden rounded-full bg-slate-200"
          >
            <div className="h-full bg-teal" style={{ width: `${completion}%` }} />
          </div>
          <dl>
            <Line label="Sent" value={plural(emails.sent, "email")} />
            <Line label="Failed" value={plural(emails.failed, "email")} />
            {emails.pending > 0 && <Line label="Sending" value={plural(emails.pending, "email")} />}
            <Line label="Not sent yet" value={plural(notSent, "email")} />
          </dl>
        </section>

        <section aria-labelledby="to-resolve" className={panelClassName}>
          <h2 id="to-resolve" className="text-lg font-bold text-navy">
            To Resolve
          </h2>
          <dl className="mt-2">
            <Line label="Missing inputs" value={plural(missingInputs, "employee")} />
            <Line label="Calculation errors" value={plural(calculationErrors, "employee")} />
          </dl>
          <p className="mt-2 text-[11px] text-black">
            Employees on the payroll with nothing entered, and net pay below zero.
          </p>
        </section>

        <section aria-labelledby="payslip-processor" className={panelClassName}>
          <h2 id="payslip-processor" className="text-lg font-bold text-navy">
            Payslip Processor
          </h2>
          <dl className="mt-2">
            <Line label="Payslips ready" value={String(isProcessed ? payslipCount : 0)} />
            <Line label="Errors" value={String(payslipIssues.length)} />
          </dl>
          {payslipIssues.length > 0 && (
            <ul aria-label="Payslip errors" className="mt-2 flex flex-col gap-1.5">
              {payslipIssues.map(({ key, employee, message }) => (
                <li key={key} className="rounded-md bg-red-50 px-2.5 py-1.5 text-[11px] text-red-700">
                  <span className="font-semibold">{employee}:</span> {message}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <section aria-labelledby="payroll-trend" className={panelClassName}>
        <h2 id="payroll-trend" className="text-lg font-bold text-navy">
          Monthly Payroll Trend
        </h2>
        {hasTrend ? (
          <TrendChart trend={trend} />
        ) : (
          <p className="py-12 text-center text-sm text-black">
            No payroll for {organization.name} in the six months up to {period}.
          </p>
        )}
        <p className="mt-3 text-[11px] text-black">
          Net payroll for the six months up to {period} · {period} in teal
        </p>
      </section>
    </div>
  );
}
