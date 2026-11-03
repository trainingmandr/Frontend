import type { Metadata } from "next";
import EmployeeMaster from "@/app/ui/employee-master/employee-master";

export const metadata: Metadata = {
  title: "Employee Master | Payroll",
};

export default function EmployeeMasterPage() {
  return <EmployeeMaster />;
}
