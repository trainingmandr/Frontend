// Payroll months are "YYYY-MM" strings, the format the backend uses.

export const MONTH_NAMES = Array.from({ length: 12 }, (_, index) =>
  new Date(2000, index).toLocaleString("en-IN", { month: "long" }),
);

// The year picker offers every year from FIRST_PAYROLL_YEAR to this year,
// newest first.
const FIRST_PAYROLL_YEAR = 2000;
const THIS_YEAR = new Date().getFullYear();
export const PAYROLL_YEARS = Array.from(
  { length: THIS_YEAR - FIRST_PAYROLL_YEAR + 1 },
  (_, index) => THIS_YEAR - index,
);

export function toPayrollMonth(year: number, monthNumber: number) {
  return `${year}-${String(monthNumber).padStart(2, "0")}`;
}

export function splitPayrollMonth(month: string) {
  const [year, monthNumber] = month.split("-").map(Number);
  return { year, monthNumber };
}

// "2026-10" -> "October 2026"
export function longMonth(month: string) {
  const { year, monthNumber } = splitPayrollMonth(month);
  return `${MONTH_NAMES[monthNumber - 1]} ${year}`;
}

// "2026-08" -> "Aug", or "Aug 25" with the year.
export function shortMonth(month: string, withYear = false) {
  const { year, monthNumber } = splitPayrollMonth(month);
  return new Date(year, monthNumber - 1).toLocaleString("en-IN", {
    month: "short",
    ...(withYear ? { year: "2-digit" } : {}),
  });
}
