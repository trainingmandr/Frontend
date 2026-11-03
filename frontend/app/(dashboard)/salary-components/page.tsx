import type { Metadata } from "next";
import SalaryComponents from "@/app/ui/salary-components/salary-components";

export const metadata: Metadata = {
  title: "Components | Payroll",
};

export default function SalaryComponentsPage() {
  return <SalaryComponents />;
}
