"use client";

import { useEffect, useRef } from "react";
import type { Employee } from "@/app/ui/employee-master/employees";

export type DetailsKind = "bank" | "education";

interface DetailsDialogProps {
  employee: Employee;
  kind: DetailsKind;
  onClose: () => void;
}

function Rows({ rows }: { rows: [string, string][] }) {
  return (
    <dl className="grid gap-x-5 gap-y-3 sm:grid-cols-2">
      {rows.map(([label, value]) => (
        <div key={label}>
          <dt className="text-[13px] text-black">{label}</dt>
          <dd className="mt-0.5 text-sm break-words text-navy">{value || "—"}</dd>
        </div>
      ))}
    </dl>
  );
}

// Pop-up card for one employee's bank or education details, opened from the
// eye icon in the Employee Master table.
export default function DetailsDialog({ employee, kind, onClose }: DetailsDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    dialogRef.current?.showModal();
  }, []);

  const title = kind === "bank" ? "Bank Details" : "Education Details";
  const education = employee.education.filter((entry) =>
    Object.values(entry).some(Boolean),
  );

  return (
    <dialog
      ref={dialogRef}
      onClose={onClose}
      aria-labelledby="details-dialog-title"
      className="m-auto w-[calc(100%-2rem)] max-w-[520px] rounded-2xl bg-white p-6 backdrop:bg-black/40"
    >
      <div className="flex items-start justify-between gap-3 border-b border-slate-200 pb-4">
        <div>
          <h2 id="details-dialog-title" className="text-xl font-bold text-navy">
            {title}
          </h2>
          <p className="text-sm text-black">
            {employee.code} · {employee.name}
          </p>
        </div>
        <button
          type="button"
          aria-label={`Close ${title.toLowerCase()}`}
          onClick={() => dialogRef.current?.close()}
          className="cursor-pointer p-1 text-black transition-colors hover:text-navy focus:ring-2 focus:ring-navy/30 focus:outline-none"
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

      <div className="max-h-[60vh] overflow-y-auto py-5">
        {kind === "bank" ? (
          <Rows
            rows={[
              ["Bank Name", employee.bank.bankName],
              ["Account Number", employee.bank.accountNumber],
              ["Branch Name", employee.bank.branchName],
              ["IFSC Code", employee.bank.ifscCode],
            ]}
          />
        ) : education.length === 0 ? (
          <p className="text-sm text-black">No education details entered.</p>
        ) : (
          <div className="flex flex-col gap-5">
            {education.map((entry, index) => (
              <section
                key={index}
                aria-label={`Education ${index + 1}`}
                className={index > 0 ? "border-t border-dashed border-slate-200 pt-4" : ""}
              >
                {education.length > 1 && (
                  <h3 className="mb-2 text-sm font-semibold text-navy">
                    Education {index + 1}
                  </h3>
                )}
                <Rows
                  rows={[
                    ["Name of School / College", entry.school],
                    ["Course Name", entry.course],
                    ["Duration", entry.duration],
                    ["CGPA / Percentage", entry.score],
                  ]}
                />
              </section>
            ))}
          </div>
        )}
      </div>

      <div className="flex justify-end border-t border-slate-200 pt-4">
        <button
          type="button"
          onClick={() => dialogRef.current?.close()}
          className="h-9 cursor-pointer rounded bg-navy px-6 text-sm font-semibold text-white transition-opacity hover:opacity-90 focus:ring-2 focus:ring-navy/30 focus:outline-none"
        >
          Close
        </button>
      </div>
    </dialog>
  );
}
