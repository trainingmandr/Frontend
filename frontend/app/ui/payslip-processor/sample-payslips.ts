import { sumPaise } from "@/app/ui/payslip-processor/money";

export interface PayslipLine {
  label: string;
  // Integer paise.
  amount: number;
}

export interface SamplePayslip {
  // Appended to the organization code, for example MRA001.
  employeeNumber: string;
  firstName: string;
  name: string;
  email: string;
  designation: string;
  department: string;
  location: string;
  dateOfJoining: string;
  paidDays: number;
  lopDays: number;
  bankName: string;
  accountLastFour: string;
  paymentMode: string;
  earnings: PayslipLine[];
  deductions: PayslipLine[];
}

// TODO: temporary data. Generate payslips from the payroll run when the
// Transaction module and backend exist. Never ship real bank details here.
export const PAY_PERIOD = "October 2026";
// The same period as an <input type="month"> value.
export const PAY_MONTH = "2026-10";
export const DAYS_IN_PERIOD = 31;

// "2026-10" -> "Oct-2026"
export function formatPayMonth(month: string) {
  const [year, monthNumber] = month.split("-").map(Number);
  const name = new Date(year, monthNumber - 1).toLocaleString("en-IN", {
    month: "short",
  });
  return `${name}-${year}`;
}

export const samplePayslips: SamplePayslip[] = [
  {
    employeeNumber: "001",
    firstName: "Arun",
    name: "Arun Kumar",
    email: "arun.kumar@company.example",
    designation: "Audit Associate",
    department: "Audit & Assurance",
    location: "Madurai",
    dateOfJoining: "12 Jun 2023",
    paidDays: 31,
    lopDays: 0,
    bankName: "HDFC Bank",
    accountLastFour: "4821",
    paymentMode: "Bank Transfer",
    earnings: [
      { label: "Basic Salary", amount: 30_000_00 },
      { label: "House Rent Allowance", amount: 12_000_00 },
      { label: "Conveyance Allowance", amount: 2_000_00 },
      { label: "Special Allowance", amount: 6_000_00 },
    ],
    deductions: [
      { label: "Provident Fund", amount: 1_800_00 },
      { label: "Professional Tax", amount: 200_00 },
      { label: "Income Tax (TDS)", amount: 2_000_00 },
      { label: "Loss of Pay", amount: 0 },
    ],
  },
  {
    employeeNumber: "002",
    firstName: "Divya",
    name: "Divya Raman",
    email: "divya.raman@company.example",
    designation: "Tax Consultant",
    department: "Direct Tax",
    location: "Madurai",
    dateOfJoining: "03 Jan 2022",
    paidDays: 31,
    lopDays: 0,
    bankName: "ICICI Bank",
    accountLastFour: "1907",
    paymentMode: "Bank Transfer",
    earnings: [
      { label: "Basic Salary", amount: 36_000_00 },
      { label: "House Rent Allowance", amount: 14_400_00 },
      { label: "Conveyance Allowance", amount: 2_000_00 },
      { label: "Special Allowance", amount: 7_600_00 },
    ],
    deductions: [
      { label: "Provident Fund", amount: 1_800_00 },
      { label: "Professional Tax", amount: 200_00 },
      { label: "Income Tax (TDS)", amount: 3_150_00 },
      { label: "Loss of Pay", amount: 0 },
    ],
  },
  {
    employeeNumber: "003",
    firstName: "Karthik",
    name: "Karthik Subramanian",
    email: "karthik.s@company.example",
    designation: "Article Assistant",
    department: "Audit & Assurance",
    location: "Chennai",
    dateOfJoining: "20 Aug 2025",
    paidDays: 29,
    lopDays: 2,
    bankName: "State Bank of India",
    accountLastFour: "6630",
    paymentMode: "Bank Transfer",
    earnings: [
      { label: "Basic Salary", amount: 15_000_00 },
      { label: "House Rent Allowance", amount: 6_000_00 },
      { label: "Conveyance Allowance", amount: 1_600_00 },
      { label: "Special Allowance", amount: 2_400_00 },
    ],
    deductions: [
      { label: "Provident Fund", amount: 1_800_00 },
      { label: "Professional Tax", amount: 200_00 },
      { label: "Income Tax (TDS)", amount: 0 },
      { label: "Loss of Pay", amount: 1_612_90 },
    ],
  },
];

export function payslipTotals({ earnings, deductions }: SamplePayslip) {
  const totalEarnings = sumPaise(earnings.map(({ amount }) => amount));
  const totalDeductions = sumPaise(deductions.map(({ amount }) => amount));
  return {
    totalEarnings,
    totalDeductions,
    netPay: totalEarnings - totalDeductions,
  };
}
