import type { Metadata } from "next";
import Transaction from "@/app/ui/transaction/transaction";

export const metadata: Metadata = {
  title: "Transaction | Payroll",
};

export default function TransactionPage() {
  return <Transaction />;
}
