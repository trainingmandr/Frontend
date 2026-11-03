import {
  ATTENDANCE_COLUMNS,
  SALARY_INPUT_COLUMNS,
  salaryWorking,
  type PayrollRow,
} from "@/app/ui/transaction/payroll-data";

export interface RowIssue {
  code: string;
  name: string;
  message: string;
}

// Consistency checks on the entered figures only; they don't recalculate any
// salary. TODO: repeat these checks on the server before payslips are
// generated.
export function validateRows(rows: PayrollRow[]): RowIssue[] {
  const codeCounts = new Map<string, number>();
  for (const { code } of rows) {
    codeCounts.set(code, (codeCounts.get(code) ?? 0) + 1);
  }

  return rows.flatMap((row) => {
    const messages: string[] = [];
    const { net } = salaryWorking(row.salary);

    if ((codeCounts.get(row.code) ?? 0) > 1) {
      messages.push(`Employee code ${row.code} appears more than once.`);
    }
    if (row.salary.basic === 0) {
      messages.push("Basic Salary is missing.");
    }
    if (ATTENDANCE_COLUMNS.every(({ key }) => row.attendance[key] === 0)) {
      messages.push("No attendance is entered.");
    }
    const negative = [
      ...SALARY_INPUT_COLUMNS.filter(({ key }) => row.salary[key] < 0),
      ...ATTENDANCE_COLUMNS.filter(({ key }) => row.attendance[key] < 0),
    ].map(({ label }) => label);
    if (negative.length > 0 || row.excessLeave < 0) {
      messages.push(
        `Negative value in ${[...negative, ...(row.excessLeave < 0 ? ["Excess Leave Taken"] : [])].join(", ")}.`,
      );
    }
    if (row.salary.basic > 0 && net <= 0) {
      messages.push("Net pay is zero or negative; deductions are more than gross.");
    }

    return messages.map((message) => ({ code: row.code, name: row.name, message }));
  });
}
