import type { Metadata } from "next";
import OrganizationSetup from "@/app/ui/organization-setup/organization-setup";

export const metadata: Metadata = {
  title: "Organization Setup | Payroll",
};

export default function OrganizationSetupPage() {
  return <OrganizationSetup />;
}
