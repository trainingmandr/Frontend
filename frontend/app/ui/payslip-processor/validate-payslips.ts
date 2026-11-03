import {
  DAYS_IN_PERIOD,
  payslipTotals,
  type SamplePayslip,
} from "@/app/ui/payslip-processor/sample-payslips";

export interface PayslipIssue {
  employee: string;
  message: string;
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Consistency checks only; they don't recalculate any salary.
// TODO: repeat these checks on the server before payslips are sent.
export function validatePayslips(payslips: SamplePayslip[]): PayslipIssue[] {
  return payslips.flatMap((payslip) => {
    const issues: string[] = [];
    const { netPay } = payslipTotals(payslip);

    if (!EMAIL_PATTERN.test(payslip.email)) {
      issues.push("Email address is missing or invalid.");
    }
    if (payslip.paidDays + payslip.lopDays !== DAYS_IN_PERIOD) {
      issues.push(
        `Paid days and LOP add up to ${payslip.paidDays + payslip.lopDays}, not ${DAYS_IN_PERIOD}.`,
      );
    }
    if (!/^\d{4}$/.test(payslip.accountLastFour)) {
      issues.push("Bank account number is missing.");
    }
    if (payslip.earnings.length === 0) {
      issues.push("There are no earnings.");
    }
    if ([...payslip.earnings, ...payslip.deductions].some(({ amount }) => amount < 0)) {
      issues.push("An earning or deduction is negative.");
    }
    if (netPay <= 0) {
      issues.push("Net pay is zero or negative.");
    }

    return issues.map((message) => ({ employee: payslip.name, message }));
  });
}
