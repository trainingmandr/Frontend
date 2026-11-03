import type { Metadata } from "next";
import Dashboard from "@/app/ui/dashboard/dashboard";

export const metadata: Metadata = {
  title: "Dashboard | Payroll",
};

export default function DashboardPage() {
  return <Dashboard />;
}
