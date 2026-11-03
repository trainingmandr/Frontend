import type { Metadata } from "next";
import PayslipProcessor from "@/app/ui/payslip-processor/payslip-processor";

export const metadata: Metadata = {
  title: "Payslip Processor | Payroll",
};

export default function PayslipProcessorPage() {
  return <PayslipProcessor />;
}
