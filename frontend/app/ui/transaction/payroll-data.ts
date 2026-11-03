import { initialOrganizations } from "@/app/ui/organization-setup/organizations";
import { formatPaise, sumPaise } from "@/app/ui/payslip-processor/money";

export const ATTENDANCE_COLUMNS = [
  { key: "creditDay", label: "Credit Day" },
  { key: "halfDayCredit", label: "Half Day Credit" },
  { key: "halfDayLeave", label: "Half Day Leave" },
  { key: "leave", label: "Leave" },
  { key: "holiday", label: "Holiday" },
  { key: "personalLeave", label: "Personal Leave" },
  { key: "present", label: "Present" },
  { key: "saturday", label: "Saturday" },
  { key: "sickLeave", label: "Sick Leave" },
  { key: "sunday", label: "Sunday" },
] as const;

export type AttendanceKey = (typeof ATTENDANCE_COLUMNS)[number]["key"];
export type Attendance = Record<AttendanceKey, number>;

// Entered amounts in integer paise. Gross, deductions and net are derived.
export const SALARY_INPUT_COLUMNS = [
  { key: "basic", label: "Basic Salary" },
  { key: "conveyance", label: "Conveyance" },
  { key: "lop", label: "LOP" },
  { key: "tds", label: "Income Tax (TDS)" },
] as const;

export type SalaryKey = (typeof SALARY_INPUT_COLUMNS)[number]["key"];
export type SalaryInputs = Record<SalaryKey, number>;

export interface PayrollRow {
  code: string;
  name: string;
  // Where the generated payslip is mailed; empty means it can't be mailed.
  email: string;
  attendance: Attendance;
  salary: SalaryInputs;
  // Entered, not calculated: there is no leave policy engine yet.
  excessLeave: number;
}

export const emptyAttendance = Object.fromEntries(
  ATTENDANCE_COLUMNS.map(({ key }) => [key, 0]),
) as Attendance;

export const emptySalary: SalaryInputs = {
  basic: 0,
  conveyance: 0,
  lop: 0,
  tds: 0,
};

// Only sums, so the formula in the page banner stays exact in paise.
// TODO: real salary rules (LOP from attendance, statutory deductions) need
// tests first and belong on the server.
export function salaryWorking({ basic, conveyance, lop, tds }: SalaryInputs) {
  const gross = sumPaise([basic, conveyance]);
  const deductions = sumPaise([tds, lop]);
  return { gross, deductions, net: gross - deductions };
}

function sampleRow(
  number: number,
  name: string,
  attendance: Partial<Attendance>,
  [basic, conveyance, tds]: [number, number, number],
  excessLeave: number,
): PayrollRow {
  return {
    code: `EMP-${String(number).padStart(2, "0")}`,
    name,
    // Sample addresses on the reserved example domain.
    email: `${name.toLowerCase().replaceAll(" ", ".")}@company.example`,
    attendance: { ...emptyAttendance, ...attendance },
    salary: {
      basic: basic * 100,
      conveyance: conveyance * 100,
      lop: 0,
      tds: tds * 100,
    },
    excessLeave,
  };
}

// TODO: temporary data. Load the payroll run from the backend.
export const initialRowsByOrganization: Record<string, PayrollRow[]> = {
  [initialOrganizations[0].id]: [
    sampleRow(1, "Arjun Sharma", { creditDay: 1, leave: 1, holiday: 1, present: 9, saturday: 10, sickLeave: 3 }, [28000, 3000, 2400], 1),
    sampleRow(2, "Priya Nair", { creditDay: 1, holiday: 1, present: 15, sickLeave: 2 }, [24500, 2500, 1900], 4),
    sampleRow(3, "Ravi Kumar", { halfDayLeave: 1, holiday: 1, personalLeave: 1, present: 24, sickLeave: 4 }, [26000, 3000, 2100], 1),
    sampleRow(4, "Sunita Menon", { holiday: 1, present: 13, saturday: 4 }, [22000, 2000, 1700], 0),
    sampleRow(5, "Deepak Iyer", { holiday: 1, present: 23, saturday: 2 }, [27500, 3000, 2300], 1),
    sampleRow(6, "Kavitha Rao", { creditDay: 1, leave: 2, holiday: 1, personalLeave: 5, present: 13, saturday: 5, sickLeave: 2, sunday: 1 }, [25000, 2500, 2000], 2),
    sampleRow(7, "Mohan Das", { holiday: 1, present: 12, sickLeave: 1 }, [21000, 2000, 1600], 6),
    sampleRow(8, "Ananya Pillai", { halfDayLeave: 7, holiday: 1, present: 26 }, [29000, 3000, 2500], 8),
    sampleRow(9, "Suresh Babu", { creditDay: 5, leave: 1, holiday: 4, present: 21, sickLeave: 3 }, [23500, 2500, 1900], 6),
    sampleRow(10, "Meena Krishnan", { creditDay: 1, halfDayLeave: 1, holiday: 3, present: 19, saturday: 4 }, [26000, 3000, 2200], 6),
    sampleRow(11, "Rahul Gupta", { halfDayCredit: 1, halfDayLeave: 3, holiday: 1, personalLeave: 3, present: 11, saturday: 5, sickLeave: 1 }, [20500, 2000, 1500], 9),
    sampleRow(12, "Lalitha Bose", { creditDay: 1, halfDayLeave: 3, holiday: 1, present: 19, saturday: 3 }, [24000, 2500, 1900], 2),
  ],
};

// Whole rupees print without decimals, as payroll sheets usually show them.
export function formatAmount(paise: number) {
  return paise % 100 === 0
    ? (paise / 100).toLocaleString("en-IN")
    : formatPaise(paise);
}

// Accepts "28000", "28,000" or "28000.50" and returns paise without ever
// going through a floating-point rupee value.
export function parseRupees(text: string): number | null {
  const match = /^(\d{1,9})(?:\.(\d{1,2}))?$/.exec(text.replaceAll(",", "").trim());
  if (!match) return null;
  return Number(match[1]) * 100 + Number((match[2] ?? "0").padEnd(2, "0"));
}

// Whole or half days.
export function parseDays(text: string): number | null {
  const trimmed = text.trim();
  if (trimmed === "") return 0;
  return /^\d{1,3}(\.5|\.0)?$/.test(trimmed) ? Number(trimmed) : null;
}

export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let isQuoted = false;

  for (let index = 0; index < text.length; index++) {
    const char = text[index];
    if (isQuoted) {
      if (char === '"' && text[index + 1] === '"') {
        field += '"';
        index++;
      } else if (char === '"') {
        isQuoted = false;
      } else {
        field += char;
      }
    } else if (char === '"') {
      isQuoted = true;
    } else if (char === ",") {
      row.push(field);
      field = "";
    } else if (char === "\n" || char === "\r") {
      if (char === "\r" && text[index + 1] === "\n") index++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += char;
    }
  }
  row.push(field);
  rows.push(row);

  return rows.filter((cells) => cells.some((cell) => cell.trim()));
}

export const CODE_HEADER = "Emp Code";
export const NAME_HEADER = "Employee Name";
export const EMAIL_HEADER = "Email";
export const EXCESS_LEAVE_HEADER = "Excess Leave Taken";

function findColumns<K extends string>(
  list: readonly { key: K; label: string }[],
  headers: string[],
) {
  return list
    .map(({ key, label }) => ({ key, label, index: headers.indexOf(label.toLowerCase()) }))
    .filter(({ index }) => index !== -1);
}

// Reads a CSV in the same layout Export writes, and merges it into the rows
// by employee code. Any attendance or salary column is read. Columns it
// doesn't know, such as Gross or Net, are ignored because they are derived.
// Missing columns keep their current values; new employees start at zero.
export function importCsv(
  rows: PayrollRow[],
  text: string,
): { rows: PayrollRow[]; count: number } | { error: string } {
  const [header, ...records] = parseCsv(text.replace(/^﻿/, ""));
  if (!header) return { error: "The file is empty." };

  const headers = header.map((cell) => cell.trim().toLowerCase());
  const indexOf = (label: string) => headers.indexOf(label.toLowerCase());
  const codeIndex = indexOf(CODE_HEADER);
  const nameIndex = indexOf(NAME_HEADER);
  if (codeIndex === -1 || nameIndex === -1) {
    return {
      error: `The first row must include "${CODE_HEADER}" and "${NAME_HEADER}" columns.`,
    };
  }

  // Optional; rows keep their current email when the column is missing.
  const emailIndex = indexOf(EMAIL_HEADER);
  const attendanceColumns = findColumns(ATTENDANCE_COLUMNS, headers);
  const salaryColumns = findColumns(SALARY_INPUT_COLUMNS, headers);
  const excessLeaveIndex = indexOf(EXCESS_LEAVE_HEADER);
  if (
    attendanceColumns.length === 0 &&
    salaryColumns.length === 0 &&
    excessLeaveIndex === -1
  ) {
    return { error: "No attendance or salary columns were found. Export the sheet to see the expected layout." };
  }

  const dayError = (line: number, label: string, cell: string) => ({
    error: `Row ${line}, ${label}: "${cell}" is not a whole or half day count.`,
  });

  const next = [...rows];
  const seen = new Set<string>();

  for (const [recordIndex, record] of records.entries()) {
    const line = recordIndex + 2;
    const code = record[codeIndex]?.trim().toUpperCase() ?? "";
    const name = record[nameIndex]?.trim() ?? "";
    if (!code || !name) {
      return { error: `Row ${line}: employee code and name are required.` };
    }
    if (seen.has(code)) return { error: `Row ${line}: ${code} appears twice.` };
    seen.add(code);

    const email = emailIndex === -1 ? null : (record[emailIndex]?.trim() ?? "");
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return { error: `Row ${line}, ${EMAIL_HEADER}: "${email}" is not an email address.` };
    }

    const attendance: Partial<Attendance> = {};
    for (const { key, label, index } of attendanceColumns) {
      const cell = record[index] ?? "";
      const value = parseDays(cell);
      if (value === null) return dayError(line, label, cell);
      attendance[key] = value;
    }

    const salary: Partial<SalaryInputs> = {};
    for (const { key, label, index } of salaryColumns) {
      const cell = record[index] ?? "";
      const value = parseRupees(cell.trim() || "0");
      if (value === null) {
        return { error: `Row ${line}, ${label}: "${cell}" is not a rupee amount.` };
      }
      salary[key] = value;
    }

    let excessLeave: number | null = null;
    if (excessLeaveIndex !== -1) {
      const cell = record[excessLeaveIndex] ?? "";
      excessLeave = parseDays(cell);
      if (excessLeave === null) return dayError(line, EXCESS_LEAVE_HEADER, cell);
    }

    const existingIndex = next.findIndex((row) => row.code === code);
    const existing = next[existingIndex] ?? {
      code,
      name,
      email: "",
      attendance: emptyAttendance,
      salary: emptySalary,
      excessLeave: 0,
    };
    const updated: PayrollRow = {
      ...existing,
      name,
      email: email ?? existing.email,
      attendance: { ...existing.attendance, ...attendance },
      salary: { ...existing.salary, ...salary },
      excessLeave: excessLeave ?? existing.excessLeave,
    };

    if (existingIndex === -1) next.push(updated);
    else next[existingIndex] = updated;
  }

  if (seen.size === 0) return { error: "The file has no employee rows." };
  return { rows: next, count: seen.size };
}

// Quotes where needed, and defuses cells a spreadsheet would run as a formula.
function csvCell(value: string) {
  const isFormula = /^[=+\-@]/.test(value) && !/^-\d[\d.]*$/.test(value);
  const safe = isFormula ? `'${value}` : value;
  return /[",\n\r]/.test(safe) ? `"${safe.replaceAll('"', '""')}"` : safe;
}

export function toCsv(rows: string[][]) {
  return rows.map((cells) => cells.map(csvCell).join(",")).join("\r\n");
}
