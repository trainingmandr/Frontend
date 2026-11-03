import {
  employmentStatusLabel,
  formatGrossSalary,
  type Employee,
} from "@/app/ui/employee-master/employees";

const pagerButtonClassName =
  "h-9 cursor-pointer rounded border border-navy bg-white px-4 text-sm font-semibold text-navy transition-colors hover:bg-navy hover:text-white focus:ring-2 focus:ring-navy/30 focus:outline-none disabled:cursor-default disabled:border-slate-300 disabled:text-slate-400 disabled:hover:bg-white";

function Details({ title, rows }: { title: string; rows: [string, string][] }) {
  return (
    <>
      <h4 className="mt-6 border-b border-slate-200 pb-1.5 text-sm font-semibold text-navy first:mt-0">
        {title}
      </h4>
      <dl className="mt-3 grid gap-x-5 gap-y-3 sm:grid-cols-2">
        {rows.map(([label, value]) => (
          <div key={label}>
            <dt className="text-[13px] text-black">{label}</dt>
            <dd className="mt-0.5 text-sm break-words text-navy">
              {value || "—"}
            </dd>
          </div>
        ))}
      </dl>
    </>
  );
}

interface EmployeeViewProps {
  employees: Employee[];
  index: number;
  designationName: (code: string) => string;
  onIndexChange: (index: number) => void;
  onEdit: (code: string) => void;
  onClose: () => void;
}

export default function EmployeeView({
  employees,
  index,
  designationName,
  onIndexChange,
  onEdit,
  onClose,
}: EmployeeViewProps) {
  const employee = employees[index];
  const education = employee.education.filter((entry) =>
    Object.values(entry).some(Boolean),
  );

  return (
    <section
      aria-labelledby="employee-view-heading"
      className="overflow-hidden rounded-lg border border-slate-200 bg-white"
    >
      <div className="flex items-start justify-between border-b border-slate-200 px-4 py-3.5 sm:px-7">
        <div>
          <h3 id="employee-view-heading" className="text-lg font-bold text-navy">
            Employee Details
          </h3>
          <p className="text-[13px] text-black">
            View Employee · {employee.code} · {employee.name}
          </p>
        </div>
        <button
          type="button"
          aria-label="Close employee view"
          onClick={onClose}
          className="cursor-pointer p-1 text-black transition-colors hover:text-navy"
        >
          <svg
            aria-hidden="true"
            className="size-5"
            fill="none"
            stroke="currentColor"
            strokeLinecap="round"
            strokeWidth="2"
            viewBox="0 0 24 24"
          >
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
      </div>

      <div className="max-h-[max(20rem,calc(100dvh-22rem))] overflow-y-auto px-4 py-5 sm:px-7">
        <Details
          title="Employee Basic Details"
          rows={[
            ["Employee Code", employee.code],
            ["Name", employee.name],
            ["Designation", designationName(employee.designation)],
            ["Email", employee.email],
            ["Location", employee.location],
            ["Employment Status", employmentStatusLabel(employee.employmentStatus)],
          ]}
        />
        <Details
          title="Personal Details"
          rows={[
            ["Date of Birth", employee.dateOfBirth],
            ["Address", employee.address],
            ["Contact Number", employee.contactNumber],
            ["Emergency Contact Number", employee.emergencyContactNumber],
            ["Blood Group", employee.bloodGroup],
            ["Date of Joining", employee.dateOfJoining],
            ["PAN Number", employee.panNumber],
            ["Aadhaar Number", employee.aadhaarNumber],
            ["Date of Leaving", employee.dateOfLeaving],
          ]}
        />
        <Details
          title="Bank Details"
          rows={[
            ["Bank Name", employee.bank.bankName],
            ["Account Number", employee.bank.accountNumber],
            ["Branch Name", employee.bank.branchName],
            ["IFSC Code", employee.bank.ifscCode],
          ]}
        />
        <Details
          title="Salary"
          rows={[["Gross Salary (monthly)", formatGrossSalary(employee)]]}
        />
        {education.length === 0 ? (
          <Details title="Education Qualification" rows={[["Education", ""]]} />
        ) : (
          education.map((entry, entryIndex) => (
            <Details
              key={entryIndex}
              title={
                education.length > 1
                  ? `Education Qualification ${entryIndex + 1}`
                  : "Education Qualification"
              }
              rows={[
                ["Name of School / College", entry.school],
                ["Course Name", entry.course],
                ["Duration", entry.duration],
                ["CGPA / Percentage", entry.score],
              ]}
            />
          ))
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 px-4 py-4 sm:px-7">
        <div className="flex items-center gap-3">
          <button
            type="button"
            disabled={index === 0}
            onClick={() => onIndexChange(index - 1)}
            className={pagerButtonClassName}
          >
            <span aria-hidden="true">‹ </span>Previous
          </button>
          <p aria-live="polite" className="min-w-16 text-center text-sm text-black">
            {index + 1} of {employees.length}
          </p>
          <button
            type="button"
            disabled={index === employees.length - 1}
            onClick={() => onIndexChange(index + 1)}
            className={pagerButtonClassName}
          >
            Next<span aria-hidden="true"> ›</span>
          </button>
        </div>
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={onClose}
            className="h-9 cursor-pointer rounded border border-slate-300 bg-white px-5 text-sm font-semibold text-navy transition-colors hover:bg-slate-100"
          >
            Close
          </button>
          <button
            type="button"
            onClick={() => onEdit(employee.code)}
            className="h-9 cursor-pointer rounded bg-navy px-7 text-sm font-semibold text-white transition-opacity hover:opacity-90"
          >
            Edit
          </button>
        </div>
      </div>
    </section>
  );
}
