import { formatPaise, rupeesInWords } from "@/app/ui/payslip-processor/money";
import {
  PAY_PERIOD,
  payslipTotals,
  type PayslipLine,
  type SamplePayslip,
} from "@/app/ui/payslip-processor/sample-payslips";
import type { Organization } from "@/app/ui/organization-setup/organizations";

function DetailList({ rows }: { rows: [string, string][] }) {
  return (
    <dl className="grid grid-cols-[minmax(7rem,auto)_1fr] gap-x-4 gap-y-1.5">
      {rows.map(([label, value]) => (
        <div key={label} className="contents">
          <dt className="text-black">{label}</dt>
          <dd className="text-navy">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

function LinesTable({
  title,
  lines,
  totalLabel,
  total,
}: {
  title: string;
  lines: PayslipLine[];
  totalLabel: string;
  total: number;
}) {
  return (
    <table className="w-full border-collapse text-left">
      <thead className="bg-slate-50 text-black">
        <tr>
          <th scope="col" className="px-2.5 py-2.5 font-medium">
            {title}
          </th>
          <th scope="col" className="px-2.5 py-2.5 text-right font-medium">
            Amount (₹)
          </th>
        </tr>
      </thead>
      <tbody className="border-x border-slate-200 text-navy">
        {lines.map(({ label, amount }) => (
          <tr key={label} className="border-b border-slate-200">
            <th scope="row" className="px-2.5 py-2 font-normal">
              {label}
            </th>
            <td className="px-2.5 py-2 text-right tabular-nums">
              {formatPaise(amount)}
            </td>
          </tr>
        ))}
      </tbody>
      <tfoot className="bg-slate-50 text-navy">
        <tr>
          <th scope="row" className="px-2.5 py-2.5 font-medium">
            {totalLabel}
          </th>
          <td className="px-2.5 py-2.5 text-right font-medium tabular-nums">
            {formatPaise(total)}
          </td>
        </tr>
      </tfoot>
    </table>
  );
}

interface PayslipPreviewProps {
  organization: Organization;
  payslip: SamplePayslip;
}

export default function PayslipPreview({
  organization,
  payslip,
}: PayslipPreviewProps) {
  const { totalEarnings, totalDeductions, netPay } = payslipTotals(payslip);
  const isDetailed = organization.payslipTemplate === "Detailed";

  return (
    <article
      aria-label={`Payslip for ${payslip.name}, ${PAY_PERIOD}`}
      className="min-w-[680px] bg-white px-6 py-6 text-[11px] shadow-sm ring-1 ring-slate-200 print:min-w-0 print:shadow-none print:ring-0"
    >
      <header className="flex items-start justify-between gap-4 border-b-2 border-navy pb-3.5">
        <div>
          <p className="text-xl font-bold text-navy">{organization.name}</p>
          {organization.address && (
            <p className="mt-1 text-black">{organization.address}</p>
          )}
          <p className="mt-0.5 text-[10px] text-black">
            Organization Code: {organization.code}
          </p>
        </div>
        <div className="text-right">
          <p className="text-sm font-bold tracking-wide text-navy">PAYSLIP</p>
          <p className="mt-1 text-navy">{PAY_PERIOD}</p>
        </div>
      </header>

      <div className="mt-4 grid grid-cols-2 gap-6">
        <DetailList
          rows={[
            ["Employee Name", payslip.name],
            ["Employee ID", `${organization.code}${payslip.employeeNumber}`],
            ["Designation", payslip.designation],
            ["Department", payslip.department],
            ...(isDetailed
              ? ([
                  ["Work Location", payslip.location],
                  ["Date of Joining", payslip.dateOfJoining],
                ] as [string, string][])
              : []),
          ]}
        />
        <DetailList
          rows={[
            ["Paid Days / LOP", `${payslip.paidDays} / ${payslip.lopDays}`],
            ["Bank Name", payslip.bankName],
            ["Account Number", `•••• •••• ${payslip.accountLastFour}`],
            ["Payment Mode", payslip.paymentMode],
            ...(isDetailed
              ? ([
                  ["Pay Period", PAY_PERIOD],
                  ["Email", payslip.email],
                ] as [string, string][])
              : []),
          ]}
        />
      </div>

      <div className="mt-5 grid grid-cols-2 gap-3">
        <LinesTable
          title="Earnings"
          lines={payslip.earnings}
          totalLabel="Total Earnings"
          total={totalEarnings}
        />
        <LinesTable
          title="Deductions"
          lines={payslip.deductions}
          totalLabel="Total Deductions"
          total={totalDeductions}
        />
      </div>

      {isDetailed && (
        <div className="mt-3 grid grid-cols-3 gap-3 text-navy">
          {(
            [
              ["Gross Earnings", totalEarnings],
              ["Total Deductions", totalDeductions],
              ["Net Pay", netPay],
            ] as const
          ).map(([label, amount]) => (
            <div
              key={label}
              className="rounded border border-slate-200 px-2.5 py-2"
            >
              <p className="text-black">{label}</p>
              <p className="mt-0.5 font-medium tabular-nums">
                ₹ {formatPaise(amount)}
              </p>
            </div>
          ))}
        </div>
      )}

      <div className="mt-3 flex items-center justify-between gap-4 bg-[#eaf0f7] px-3 py-3">
        <div>
          <p className="text-xs text-navy">Net Pay</p>
          <p className="mt-0.5 text-[10px] text-navy">{rupeesInWords(netPay)}</p>
        </div>
        <p className="text-xl font-bold text-navy tabular-nums">
          ₹ {formatPaise(netPay)}
        </p>
      </div>

      <p className="mt-5 text-center text-[9px] text-black">
        This is a computer-generated payslip and does not require a signature.
      </p>
    </article>
  );
}
