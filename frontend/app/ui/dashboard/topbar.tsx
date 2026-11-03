"use client";

import { usePathname } from "next/navigation";
import {
  MONTH_NAMES,
  PAYROLL_YEARS,
  splitPayrollMonth,
  toPayrollMonth,
} from "@/app/ui/dashboard/months";
import { useOrganizations } from "@/app/ui/dashboard/organization-context";
import { navItems } from "@/app/ui/dashboard/sidebar";

const selectClassName =
  "h-[31px] rounded bg-white px-2 text-navy outline-none focus:ring-2 focus:ring-white/50";

export default function Topbar() {
  const pathname = usePathname();
  const {
    organizations,
    selectedOrganization,
    selectOrganization,
    resetOrganizations,
    payrollMonth,
    selectPayrollMonth,
  } = useOrganizations();
  const pageLabel = navItems.find(({ href }) => href === pathname)?.label;
  const { year, monthNumber } = splitPayrollMonth(payrollMonth);
  // Keep a year outside the usual range selectable if it is the current pick.
  const years = PAYROLL_YEARS.includes(year)
    ? PAYROLL_YEARS
    : [...PAYROLL_YEARS, year].sort((a, b) => b - a);

  return (
    <header className="flex min-h-[51px] flex-wrap items-center justify-between gap-2 px-6 py-2 text-sm text-slate-200 print:hidden">
      <p>Payroll Generator › {pageLabel}</p>

      <div className="flex flex-wrap items-center gap-2">
        <label htmlFor="payroll-month">Month</label>
        <select
          id="payroll-month"
          value={monthNumber}
          onChange={(event) => selectPayrollMonth(toPayrollMonth(year, Number(event.target.value)))}
          className={`${selectClassName} w-[120px]`}
        >
          {MONTH_NAMES.map((name, index) => (
            <option key={name} value={index + 1}>
              {name}
            </option>
          ))}
        </select>
        <label htmlFor="payroll-year" className="sr-only">
          Year
        </label>
        <select
          id="payroll-year"
          value={year}
          onChange={(event) => selectPayrollMonth(toPayrollMonth(Number(event.target.value), monthNumber))}
          className={`${selectClassName} w-[80px]`}
        >
          {years.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>

        <label htmlFor="organization" className="ml-2">
          Organization
        </label>
        <select
          id="organization"
          value={selectedOrganization.id}
          onChange={(event) => selectOrganization(event.target.value)}
          className={`${selectClassName} w-[190px]`}
        >
          {organizations.map((organization) => (
            <option key={organization.id} value={organization.id}>
              {organization.name}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={resetOrganizations}
          title="Restore the sample organizations and templates"
          className="flex h-[31px] cursor-pointer items-center gap-1.5 rounded border border-slate-200 bg-white px-3 text-xs font-medium text-navy transition-colors hover:bg-slate-100 focus:ring-2 focus:ring-white/50 focus:outline-none"
        >
          <svg
            aria-hidden="true"
            className="size-3.5"
            fill="none"
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            viewBox="0 0 24 24"
          >
            <path d="M4 12a8 8 0 1 0 2.3-5.7M4 4v4h4" />
          </svg>
          Reset
        </button>
      </div>
    </header>
  );
}
