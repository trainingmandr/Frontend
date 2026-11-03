"use client";

import { useCallback, useEffect, useState, type SetStateAction } from "react";
import { downloadCsv } from "@/app/ui/dashboard/download";
import { useOrganizations } from "@/app/ui/dashboard/organization-context";
import Toast from "@/app/ui/dashboard/toast";
import DetailsDialog, { type DetailsKind } from "@/app/ui/employee-master/details-dialog";
import EmployeeForm from "@/app/ui/employee-master/employee-form";
import EmployeeView from "@/app/ui/employee-master/employee-view";
import {
  employmentStatusLabel,
  exportColumns,
  formatEmployeeCode,
  formatGrossSalary,
  highestEmployeeNumber,
  initialEmployeesByOrganization,
  matchesSearch,
  sampleImportedEmployees,
  type Employee,
} from "@/app/ui/employee-master/employees";
import ImportDialog from "@/app/ui/employee-master/import-dialog";
import { toCsv } from "@/app/ui/transaction/payroll-data";

const NEW_EMPLOYEE = "new";
const PAGE_SIZE = 10;

// Keeps only the last 4 characters, e.g. "123456789012" -> "••••••••9012",
// so the list never shows full account, PAN or Aadhaar numbers.
function maskAll(value: string) {
  const compact = value.replace(/\s/g, "");
  return compact.length > 4 ? "•".repeat(compact.length - 4) + compact.slice(-4) : value;
}

interface DetailColumn {
  label: string;
  value: (employee: Employee) => string;
  wide?: boolean;
  // Shown as an eye icon that opens these details in a pop-up card.
  details?: DetailsKind;
}

function EyeIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="size-4"
    >
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

// Every employee detail after the checkbox and Action columns. `wide` cells
// wrap instead of stretching the table.
function detailColumnsFor(designationName: (code: string) => string): DetailColumn[] {
  return [
    { label: "Employee ID", value: (e) => e.code },
    { label: "Name", value: (e) => e.name },
    { label: "Designation", value: (e) => designationName(e.designation) },
    { label: "Email", value: (e) => e.email },
    { label: "Location", value: (e) => e.location },
    { label: "Status", value: (e) => employmentStatusLabel(e.employmentStatus) },
    { label: "Contact Number", value: (e) => e.contactNumber },
    { label: "Emergency Contact", value: (e) => e.emergencyContactNumber },
    { label: "Date of Birth", value: (e) => e.dateOfBirth },
    { label: "Blood Group", value: (e) => e.bloodGroup },
    { label: "Date of Joining", value: (e) => e.dateOfJoining },
    { label: "Date of Leaving", value: (e) => e.dateOfLeaving },
    { label: "Address", value: (e) => e.address, wide: true },
    { label: "PAN", value: (e) => maskAll(e.panNumber) },
    { label: "Aadhaar", value: (e) => maskAll(e.aadhaarNumber) },
    { label: "Bank Details", value: () => "", details: "bank" },
    { label: "Gross Salary", value: formatGrossSalary },
    { label: "Education Details", value: () => "", details: "education" },
  ];
}

// Labels only, so the header row doesn't depend on designation names.
const columns = ["Action", ...detailColumnsFor(() => "").map(({ label }) => label)];

const headerButtonClassName =
  "h-9 cursor-pointer rounded-lg bg-navy px-5 font-medium text-white transition-opacity hover:opacity-90 focus:ring-2 focus:ring-navy/30 focus:outline-none disabled:cursor-default disabled:opacity-50";
const checkboxClassName = "size-4 cursor-pointer accent-navy";
const pageButtonClassName =
  "h-8 min-w-8 cursor-pointer rounded-md border border-slate-300 bg-white px-2.5 text-sm text-navy transition-colors hover:bg-slate-50 focus:ring-2 focus:ring-navy/30 focus:outline-none disabled:cursor-default disabled:opacity-50 disabled:hover:bg-white";

// Page numbers to show: the first, the last, and the current one with its
// neighbours; gaps become "…".
function pageItems(current: number, count: number): (number | "gap")[] {
  const pages = [...new Set([1, current - 1, current, current + 1, count])]
    .filter((page) => page >= 1 && page <= count)
    .sort((a, b) => a - b);
  return pages.flatMap((page, index) =>
    index > 0 && page - pages[index - 1] > 1 ? ["gap" as const, page] : [page],
  );
}

function PencilIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="size-4"
    >
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
    </svg>
  );
}

export default function EmployeeMaster() {
  const {
    selectedOrganization: organization,
    designations,
    designationCodesFor,
  } = useOrganizations();
  const designationName = (code: string) =>
    designations.find((designation) => designation.code === code)?.name ?? code;
  const detailColumns = detailColumnsFor(designationName);
  // The organization's designations, in Organization Setup order, for the form.
  const usedDesignations = designationCodesFor(organization.id).flatMap(
    (code) => designations.filter((designation) => designation.code === code),
  );
  const [employeesByOrganization, setEmployeesByOrganization] = useState(
    initialEmployeesByOrganization,
  );
  // The code of the employee being edited, or NEW_EMPLOYEE while adding one.
  const [formTarget, setFormTarget] = useState<string | null>(null);
  const [isImportOpen, setIsImportOpen] = useState(false);
  // The employee and kind of details shown in the pop-up card, if any.
  const [detailsTarget, setDetailsTarget] = useState<{
    code: string;
    kind: DetailsKind;
  } | null>(null);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  // Codes of the ticked employees.
  const [selectedCodes, setSelectedCodes] = useState<string[]>([]);
  // Position in the ticked employees while viewing them, otherwise null.
  const [viewIndex, setViewIndex] = useState<number | null>(null);
  const [toast, setToast] = useState<{ id: number; message: string } | null>(
    null,
  );
  const [shownOrganizationId, setShownOrganizationId] = useState(
    organization.id,
  );

  // Switching organization closes anything showing the previous one's
  // employees, so its details never appear under the new one.
  if (shownOrganizationId !== organization.id) {
    setShownOrganizationId(organization.id);
    setFormTarget(null);
    setIsImportOpen(false);
    setDetailsTarget(null);
    setSearch("");
    setPage(1);
    setSelectedCodes([]);
    setViewIndex(null);
    setToast(null);
  }

  const employees = employeesByOrganization[organization.id] ?? [];

  function setEmployees(action: SetStateAction<Employee[]>) {
    setEmployeesByOrganization((current) => {
      const previous = current[organization.id] ?? [];
      return {
        ...current,
        [organization.id]:
          typeof action === "function" ? action(previous) : action,
      };
    });
  }

  const dismissToast = useCallback(() => setToast(null), []);

  // Next keeps this page mounted while hidden, so clear it on the way out or
  // the typed bank, PAN and Aadhaar details come back with it.
  useEffect(() => {
    return () => {
      setFormTarget(null);
      setIsImportOpen(false);
      setDetailsTarget(null);
      setSearch("");
      setSelectedCodes([]);
      setViewIndex(null);
      setToast(null);
    };
  }, []);

  const editingEmployee = employees.find(({ code }) => code === formTarget);
  // Everyone the search matches; Export uses all of them, not just one page.
  const visibleEmployees = editingEmployee
    ? [editingEmployee]
    : employees.filter((employee) =>
        matchesSearch(employee, search, designationName(employee.designation)),
      );
  const pageCount = Math.max(1, Math.ceil(visibleEmployees.length / PAGE_SIZE));
  // Clamped, so removing or filtering employees never leaves an empty page.
  const currentPage = Math.min(page, pageCount);
  const pageEmployees = visibleEmployees.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE,
  );
  // In table order, so Previous and Next follow the list.
  const selectedEmployees = employees.filter(({ code }) =>
    selectedCodes.includes(code),
  );
  const pageSelectedCount = pageEmployees.filter(({ code }) =>
    selectedCodes.includes(code),
  ).length;
  const isAllPageSelected =
    pageEmployees.length > 0 && pageSelectedCount === pageEmployees.length;
  const isViewing = viewIndex !== null && selectedEmployees.length > 0;

  function toggleSelected(code: string) {
    setSelectedCodes((current) =>
      current.includes(code)
        ? current.filter((entry) => entry !== code)
        : [...current, code],
    );
  }

  // Applies to the employees on this page; ticks on other pages are kept.
  function toggleAllOnPage() {
    const pageCodes = pageEmployees.map(({ code }) => code);
    setSelectedCodes((current) =>
      isAllPageSelected
        ? current.filter((code) => !pageCodes.includes(code))
        : [...new Set([...current, ...pageCodes])],
    );
  }

  function handleExport() {
    // Ticked employees, or everyone the search shows when nothing is ticked.
    const exported = selectedEmployees.length
      ? selectedEmployees
      : visibleEmployees;
    const exportFields = exportColumns(designationName);
    const csv = toCsv([
      exportFields.map(({ label }) => label),
      ...exported.map((employee) =>
        exportFields.map(({ value }) => value(employee)),
      ),
    ]);
    downloadCsv(`${organization.code}-employees.csv`, csv);
  }

  function showToast(message: string) {
    setToast({ id: Date.now(), message });
  }

  // The toast sits over the form's Save button, so clear it first.
  function openForm(target: string) {
    setToast(null);
    setViewIndex(null);
    setFormTarget(target);
  }

  function handleSave(employee: Employee) {
    if (editingEmployee) {
      setEmployees((current) =>
        current.map((entry) =>
          entry.code === formTarget ? employee : entry,
        ),
      );
      // Keep the tick if the employee code was changed.
      setSelectedCodes((current) =>
        current.map((code) => (code === formTarget ? employee.code : code)),
      );
      showToast("Employee data edited successfully.");
    } else {
      setEmployees((current) => [...current, employee]);
      showToast("New employee successfully added.");
    }
    setFormTarget(null);
  }

  function handleImport() {
    setEmployees((current) => {
      const highestNumber = highestEmployeeNumber(current);
      return [
        ...current,
        ...sampleImportedEmployees.map((employee, index) => ({
          ...employee,
          code: formatEmployeeCode(highestNumber + index + 1),
        })),
      ];
    });
    setIsImportOpen(false);
    showToast("Employees imported successfully.");
  }

  const form = formTarget && (
    <EmployeeForm
      key={formTarget}
      employee={editingEmployee}
      designations={usedDesignations}
      allDesignations={designations}
      takenCodes={employees
        .map(({ code }) => code)
        .filter((code) => code !== formTarget)}
      onSave={handleSave}
      onClose={() => setFormTarget(null)}
    />
  );

  return (
    <div className="flex flex-col gap-3.5">
      <header className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2">
        <h1 className="text-xl font-bold text-navy">
          Employee Master
        </h1>
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => setIsImportOpen(true)}
            className={headerButtonClassName}
          >
            Import
          </button>
          <button
            type="button"
            onClick={handleExport}
            disabled={visibleEmployees.length === 0 && selectedEmployees.length === 0}
            title={
              selectedEmployees.length
                ? `Export the ${selectedEmployees.length} ticked employees`
                : "Export the employees in the list"
            }
            className={headerButtonClassName}
          >
            Export{selectedEmployees.length > 0 && ` (${selectedEmployees.length})`}
          </button>
          <button
            type="button"
            onClick={() => {
              setFormTarget(null);
              setViewIndex(0);
            }}
            disabled={selectedEmployees.length === 0}
            title={
              selectedEmployees.length
                ? "View the ticked employees one at a time"
                : "Tick one or more employees to view them"
            }
            className={headerButtonClassName}
          >
            View{selectedEmployees.length > 0 && ` (${selectedEmployees.length})`}
          </button>
          <button
            type="button"
            onClick={() => openForm(NEW_EMPLOYEE)}
            className={headerButtonClassName}
          >
            Add Employee
          </button>
        </div>
      </header>

      {!formTarget && !isViewing && (
        <div>
          <label htmlFor="employee-search" className="sr-only">
            Search employees
          </label>
          <input
            id="employee-search"
            type="search"
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
            }}
            placeholder="Search...."
            className="h-10 w-full rounded-lg border border-slate-200 bg-white px-4 text-sm text-navy outline-none transition-shadow placeholder:text-slate-400 focus:border-navy focus:ring-2 focus:ring-navy/20"
          />
        </div>
      )}

      {isViewing ? (
        <EmployeeView
          employees={selectedEmployees}
          index={Math.min(viewIndex, selectedEmployees.length - 1)}
          designationName={designationName}
          onIndexChange={setViewIndex}
          onEdit={openForm}
          onClose={() => setViewIndex(null)}
        />
      ) : formTarget === NEW_EMPLOYEE ? (
        form
      ) : (
        <section className="rounded-lg border border-slate-200 bg-white p-4 sm:p-6">
          {!formTarget && selectedEmployees.length > 0 && (
            <div className="mb-3 flex flex-wrap items-center gap-3 text-sm text-black">
              <p aria-live="polite">
                {selectedEmployees.length} of {employees.length} employees
                selected
              </p>
              <button
                type="button"
                onClick={() => setSelectedCodes([])}
                className="cursor-pointer font-medium text-navy underline underline-offset-2 hover:no-underline focus:ring-2 focus:ring-navy/30 focus:outline-none"
              >
                Clear selection
              </button>
            </div>
          )}
          {/* Scrolls both ways; the header row and the checkbox and Action
              columns stay in place. */}
          <div
            tabIndex={0}
            role="region"
            aria-label="Employee details, scrollable"
            className="max-h-[65vh] overflow-auto rounded border border-slate-200 focus:ring-2 focus:ring-navy/30 focus:outline-none"
          >
            <table className="w-max min-w-full border-separate border-spacing-0 text-left">
              <thead className="text-sm text-white">
                <tr>
                  <th
                    scope="col"
                    className="sticky top-0 left-0 z-30 w-12 bg-navy px-4 py-3.5"
                  >
                    <input
                      type="checkbox"
                      aria-label="Select all employees on this page"
                      disabled={!!formTarget || pageEmployees.length === 0}
                      checked={isAllPageSelected}
                      ref={(element) => {
                        if (element) {
                          element.indeterminate =
                            pageSelectedCount > 0 && !isAllPageSelected;
                        }
                      }}
                      onChange={toggleAllOnPage}
                      className={checkboxClassName}
                    />
                  </th>
                  {columns.map((column, index) => (
                    <th
                      key={column}
                      scope="col"
                      className={`sticky top-0 bg-navy px-4 py-3.5 font-semibold whitespace-nowrap ${
                        index === 0 ? "left-12 z-30" : "z-20"
                      }`}
                    >
                      {column}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="text-[13px] text-black">
                {pageEmployees.map((employee) => (
                  <tr
                    key={employee.code}
                    className={`[&>td]:border-b [&>td]:border-slate-200 ${
                      selectedCodes.includes(employee.code)
                        ? "[&>td]:bg-slate-50"
                        : "[&>td]:bg-white"
                    }`}
                  >
                    <td className="sticky left-0 z-10 w-12 px-4 py-4">
                      <input
                        type="checkbox"
                        aria-label={`Select ${employee.name}`}
                        disabled={!!formTarget}
                        checked={selectedCodes.includes(employee.code)}
                        onChange={() => toggleSelected(employee.code)}
                        className={checkboxClassName}
                      />
                    </td>
                    <td className="sticky left-12 z-10 border-r border-slate-200 px-4 py-3">
                      <button
                        type="button"
                        aria-label={`Edit ${employee.name}`}
                        title="Edit"
                        onClick={() => openForm(employee.code)}
                        className={`flex size-8 cursor-pointer items-center justify-center rounded-md border border-navy transition-opacity hover:opacity-90 focus:ring-2 focus:ring-navy/30 focus:outline-none ${
                          formTarget === employee.code
                            ? "bg-white text-navy"
                            : "bg-navy text-white"
                        }`}
                      >
                        <PencilIcon />
                      </button>
                    </td>
                    {detailColumns.map(({ label, value, wide, details }) => {
                      if (details) {
                        return (
                          <td key={label} className="px-4 py-3 text-center">
                            <button
                              type="button"
                              aria-label={`View ${label.toLowerCase()} of ${employee.name}`}
                              title={`View ${label.toLowerCase()}`}
                              onClick={() => setDetailsTarget({ code: employee.code, kind: details })}
                              className="inline-flex size-8 cursor-pointer items-center justify-center rounded-md border border-navy bg-white text-navy transition-colors hover:bg-navy hover:text-white focus:ring-2 focus:ring-navy/30 focus:outline-none"
                            >
                              <EyeIcon />
                            </button>
                          </td>
                        );
                      }
                      const text = value(employee);
                      return (
                        <td
                          key={label}
                          className={`px-4 py-4 ${
                            wide ? "min-w-48 max-w-72" : "whitespace-nowrap"
                          }`}
                        >
                          {text || <span className="text-slate-300">—</span>}
                        </td>
                      );
                    })}
                  </tr>
                ))}
                {visibleEmployees.length === 0 && (
                  <tr>
                    <td
                      colSpan={columns.length + 1}
                      className="px-4 py-10 text-center"
                    >
                      {employees.length === 0
                        ? `No employees yet for ${organization.name}. Add or import employees to get started.`
                        : `No employees match "${search.trim()}".`}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          {!formTarget && visibleEmployees.length > 0 && (
            <nav
              aria-label="Employee pages"
              className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm text-black"
            >
              <p aria-live="polite">
                Showing {(currentPage - 1) * PAGE_SIZE + 1}–
                {(currentPage - 1) * PAGE_SIZE + pageEmployees.length} of{" "}
                {visibleEmployees.length}
              </p>
              <div className="flex flex-wrap items-center gap-1.5">
                <button
                  type="button"
                  disabled={currentPage === 1}
                  onClick={() => setPage(currentPage - 1)}
                  className={pageButtonClassName}
                >
                  Previous
                </button>
                {pageItems(currentPage, pageCount).map((item, index) =>
                  item === "gap" ? (
                    <span key={`gap-${index}`} aria-hidden="true" className="px-1">
                      …
                    </span>
                  ) : (
                    <button
                      key={item}
                      type="button"
                      aria-label={`Page ${item}`}
                      aria-current={item === currentPage ? "page" : undefined}
                      onClick={() => setPage(item)}
                      className={`${pageButtonClassName} ${
                        item === currentPage
                          ? "border-navy bg-navy text-white hover:bg-navy"
                          : ""
                      }`}
                    >
                      {item}
                    </button>
                  ),
                )}
                <button
                  type="button"
                  disabled={currentPage === pageCount}
                  onClick={() => setPage(currentPage + 1)}
                  className={pageButtonClassName}
                >
                  Next
                </button>
              </div>
            </nav>
          )}
          {form}
        </section>
      )}

      {detailsTarget &&
        (() => {
          const employee = employees.find(({ code }) => code === detailsTarget.code);
          return employee ? (
            <DetailsDialog
              key={`${detailsTarget.code}-${detailsTarget.kind}`}
              employee={employee}
              kind={detailsTarget.kind}
              onClose={() => setDetailsTarget(null)}
            />
          ) : null;
        })()}

      {isImportOpen && (
        <ImportDialog
          onImport={handleImport}
          onClose={() => setIsImportOpen(false)}
        />
      )}

      {toast && (
        <Toast
          key={toast.id}
          message={toast.message}
          onDismiss={dismissToast}
        />
      )}
    </div>
  );
}
