import { redirect } from "next/navigation";

// Replaced by the Payslip processor. Delete this route once no links use it.
export default function PayslipTemplatesPage() {
  redirect("/payslip-processor");
}
