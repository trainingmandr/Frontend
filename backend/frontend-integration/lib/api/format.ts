// Small helpers for showing API values the way the screens do.

/** 45000 -> "₹ 45,000" ; 1234567.5 -> "₹ 12,34,567.50" (Indian grouping) */
export function formatINR(value: number | null | undefined, decimals: 0 | 2 = 0): string {
  if (value == null) return "";
  return (
    "₹ " +
    value.toLocaleString("en-IN", { minimumFractionDigits: decimals, maximumFractionDigits: decimals === 0 ? 2 : decimals })
  );
}

/** "1990-08-15" -> "15/08/1990" */
export function formatDate(iso: string | null | undefined): string {
  if (!iso) return "";
  const [y, m, d] = iso.slice(0, 10).split("-");
  return `${d}/${m}/${y}`;
}

/** Current month as "YYYY-MM" (the format every month_year parameter uses) */
export function currentMonth(date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

/** "2026-10" -> "October 2026" */
export function monthLabel(monthYear: string): string {
  const [y, m] = monthYear.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleString("en-IN", { month: "long", year: "numeric" });
}
