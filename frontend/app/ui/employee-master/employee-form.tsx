"use client";

import {
  useState,
  type ComponentProps,
  type ReactNode,
  type SubmitEvent,
  type UIEvent,
} from "react";
import {
  BLOOD_GROUPS,
  EMPLOYMENT_STATUSES,
  emptyEducation,
  emptyEmployee,
  type BankDetails,
  type Education,
  type Employee,
  type EmploymentStatus,
} from "@/app/ui/employee-master/employees";
import type { Designation } from "@/app/ui/organization-setup/designations";

const inputClassName =
  "h-[35px] w-full rounded border border-slate-300 bg-white px-2.5 text-sm text-navy outline-none transition-shadow placeholder:text-slate-400 focus:border-navy focus:ring-2 focus:ring-navy/20 read-only:bg-slate-50 read-only:text-slate-500";
const labelClassName = "mb-1 block text-[13px] text-black";
const hintClassName =
  "ml-1.5 rounded bg-emerald-50 px-1.5 py-0.5 text-[11px] font-medium text-emerald-800";
const gridClassName = "mt-3 grid gap-x-5 gap-y-3 sm:grid-cols-2";

type TextField = Exclude<keyof Employee, "education" | "bank" | "employmentStatus">;

interface FieldProps
  extends Omit<ComponentProps<"input">, "id" | "name" | "value" | "onChange"> {
  label: string;
  name: string;
  value: string;
  onChange: (value: string) => void;
  isRupee?: boolean;
}

function Field({ label, name, onChange, isRupee, ...inputProps }: FieldProps) {
  const id = `employee-${name}`;

  return (
    <div>
      <label htmlFor={id} className={labelClassName}>
        {label}
      </label>
      <div className="relative">
        {isRupee && (
          <span
            aria-hidden="true"
            className="absolute top-1/2 left-2.5 -translate-y-1/2 text-sm text-black"
          >
            ₹
          </span>
        )}
        <input
          id={id}
          name={name}
          onChange={(event) => onChange(event.target.value)}
          className={`${inputClassName} ${isRupee ? "pl-6" : ""}`}
          {...inputProps}
        />
      </div>
    </div>
  );
}

interface SelectFieldProps {
  label: ReactNode;
  name: string;
  value: string;
  required?: boolean;
  onChange: (value: string) => void;
  children: ReactNode;
  describedBy?: string;
}

function SelectField({
  label,
  name,
  value,
  required,
  onChange,
  children,
  describedBy,
}: SelectFieldProps) {
  const id = `employee-${name}`;
  return (
    <div>
      <label htmlFor={id} className={labelClassName}>
        {label}
      </label>
      <select
        id={id}
        name={name}
        required={required}
        value={value}
        aria-describedby={describedBy}
        onChange={(event) => onChange(event.target.value)}
        className={inputClassName}
      >
        {children}
      </select>
    </div>
  );
}

function SectionHeading({ children }: { children: string }) {
  return (
    <h4 className="mt-6 border-b border-slate-200 pb-1.5 text-sm font-semibold text-navy first:mt-0">
      {children}
    </h4>
  );
}

interface EmployeeFormProps {
  employee?: Employee;
  // The designations the organization uses (Organization Setup).
  designations: Designation[];
  // Every designation, to name a code the organization no longer uses.
  allDesignations: Designation[];
  takenCodes: string[];
  onSave: (employee: Employee) => void;
  onClose: () => void;
}

export default function EmployeeForm({
  employee,
  designations,
  allDesignations,
  takenCodes,
  onSave,
  onClose,
}: EmployeeFormProps) {
  const [draft, setDraft] = useState(employee ?? emptyEmployee);
  const [error, setError] = useState("");
  const [isScrolledToEnd, setIsScrolledToEnd] = useState(false);

  // Keep an employee's current designation selectable even if the
  // organization has since turned it off, so editing never clears it.
  const retiredDesignation =
    draft.designation && !designations.some(({ code }) => code === draft.designation)
      ? (allDesignations.find(({ code }) => code === draft.designation) ?? {
          code: draft.designation,
          name: draft.designation,
        })
      : null;

  const bind = (name: TextField) => ({
    name,
    value: draft[name],
    onChange: (value: string) =>
      setDraft((current) => ({ ...current, [name]: value })),
  });

  const bindBank = (name: keyof BankDetails, transform?: (value: string) => string) => ({
    name: `bank-${name}`,
    value: draft.bank[name],
    onChange: (value: string) =>
      setDraft((current) => ({
        ...current,
        bank: { ...current.bank, [name]: transform ? transform(value) : value },
      })),
  });

  function updateEducation(index: number, changes: Partial<Education>) {
    setDraft((current) => ({
      ...current,
      education: current.education.map((entry, entryIndex) =>
        entryIndex === index ? { ...entry, ...changes } : entry,
      ),
    }));
  }

  function addEducation() {
    setDraft((current) => ({
      ...current,
      education: [...current.education, emptyEducation],
    }));
  }

  function removeEducation(index: number) {
    setDraft((current) => ({
      ...current,
      education: current.education.filter(
        (_, entryIndex) => entryIndex !== index,
      ),
    }));
  }

  function handleScroll(event: UIEvent<HTMLDivElement>) {
    const { scrollTop, clientHeight, scrollHeight } = event.currentTarget;
    setIsScrolledToEnd(scrollTop + clientHeight >= scrollHeight - 8);
  }

  function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();

    if (takenCodes.includes(draft.code)) {
      setError(`Employee code ${draft.code} is already in use.`);
      return;
    }
    // ISO dates compare correctly as text.
    if (draft.dateOfJoining && draft.dateOfLeaving && draft.dateOfLeaving < draft.dateOfJoining) {
      setError("Date of leaving cannot be before date of joining.");
      return;
    }

    setError("");
    onSave(draft);
  }

  return (
    <section className="overflow-hidden rounded-lg border border-slate-200 bg-white">
      <div className="flex items-start justify-between border-b border-slate-200 px-4 py-3.5 sm:px-7">
        <div>
          <h3 className="text-lg font-bold text-navy">Employee Details</h3>
          <p className="text-[13px] text-black">
            {employee
              ? `Edit Employee · ${employee.code} · ${employee.name}`
              : "Add Employee"}
          </p>
        </div>
        <button
          type="button"
          aria-label="Close employee details"
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

      <form onSubmit={handleSubmit}>
        <div
          onScroll={handleScroll}
          className={`overflow-y-auto px-4 py-5 sm:px-7 ${
            employee
              ? "max-h-[max(20rem,calc(100dvh-30rem))]"
              : "max-h-[max(20rem,calc(100dvh-22rem))]"
          }`}
        >
          <SectionHeading>Employee Basic Details</SectionHeading>
          <div className={gridClassName}>
            <Field
              label="Employee Code"
              placeholder="Enter employee code"
              required
              maxLength={30}
              readOnly={!!employee}
              title={employee ? "The employee code can't be changed" : undefined}
              {...bind("code")}
            />
            <Field
              label="Name"
              placeholder="Enter employee name"
              required
              maxLength={150}
              {...bind("name")}
            />
            <div>
              <SelectField
                label="Designation"
                name="designation"
                required
                value={draft.designation}
                onChange={(designation) =>
                  setDraft((current) => ({ ...current, designation }))
                }
                describedBy={designations.length === 0 ? "designation-help" : undefined}
              >
                <option value="">Select designation</option>
                {designations.map(({ code, name }) => (
                  <option key={code} value={code}>
                    {name}
                  </option>
                ))}
                {retiredDesignation && (
                  <option value={retiredDesignation.code}>
                    {retiredDesignation.name} (no longer used)
                  </option>
                )}
              </SelectField>
              {designations.length === 0 && (
                <p id="designation-help" className="mt-1 text-xs text-black">
                  Turn on designations for this organization in Organization
                  Setup first.
                </p>
              )}
            </div>
            <Field
              label="Email"
              type="email"
              placeholder="Enter email"
              required
              maxLength={150}
              {...bind("email")}
            />
            <Field
              label="Location"
              placeholder="Enter work location"
              required
              maxLength={150}
              {...bind("location")}
            />
            <SelectField
              label={
                <>
                  Employment Status
                  <span className={hintClassName}>Recommended</span>
                </>
              }
              name="employmentStatus"
              value={draft.employmentStatus}
              onChange={(value) =>
                setDraft((current) => ({
                  ...current,
                  employmentStatus: value as EmploymentStatus,
                }))
              }
            >
              {EMPLOYMENT_STATUSES.map(({ value, label }) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </SelectField>
          </div>

          <SectionHeading>Personal Details</SectionHeading>
          <div className={gridClassName}>
            <Field
              label="Date of Birth"
              type="date"
              {...bind("dateOfBirth")}
            />
            <Field
              label="Address"
              placeholder="Enter residential address"
              {...bind("address")}
            />
            <Field
              label="Contact Number"
              type="tel"
              placeholder="Enter contact number"
              maxLength={20}
              {...bind("contactNumber")}
            />
            <Field
              label="Emergency Contact Number"
              type="tel"
              placeholder="Enter emergency contact number"
              maxLength={20}
              {...bind("emergencyContactNumber")}
            />
            <SelectField
              label="Blood Group"
              name="bloodGroup"
              value={draft.bloodGroup}
              onChange={(bloodGroup) =>
                setDraft((current) => ({ ...current, bloodGroup }))
              }
            >
              <option value="">Select blood group</option>
              {BLOOD_GROUPS.map((bloodGroup) => (
                <option key={bloodGroup}>{bloodGroup}</option>
              ))}
            </SelectField>
            <Field
              label="Date of Joining"
              type="date"
              {...bind("dateOfJoining")}
            />
            <Field
              label="PAN Number"
              placeholder="Enter PAN number"
              pattern="[A-Z]{5}[0-9]{4}[A-Z]"
              title="10 characters, for example ABCDE1234F"
              maxLength={10}
              {...bind("panNumber")}
            />
            <Field
              label="Aadhaar Number"
              placeholder="Enter Aadhaar number"
              inputMode="numeric"
              pattern="[0-9]{12}"
              title="12 digits"
              maxLength={12}
              {...bind("aadhaarNumber")}
            />
            <Field
              label="Date of Leaving"
              type="date"
              {...bind("dateOfLeaving")}
            />
          </div>

          <SectionHeading>Bank Details</SectionHeading>
          <div className={gridClassName}>
            <Field
              label="Bank Name"
              placeholder="e.g. State Bank of India"
              maxLength={150}
              {...bindBank("bankName")}
            />
            <Field
              label="Account Number"
              placeholder="Enter account number"
              inputMode="numeric"
              pattern="[A-Za-z0-9]{4,50}"
              title="4 to 50 letters or digits, no spaces"
              maxLength={50}
              autoComplete="off"
              {...bindBank("accountNumber")}
            />
            <Field
              label="Branch Name"
              placeholder="e.g. Madurai Main"
              maxLength={150}
              {...bindBank("branchName")}
            />
            <Field
              label="IFSC Code"
              placeholder="e.g. SBIN0001234"
              pattern="[A-Z]{4}0[A-Z0-9]{6}"
              title="11 characters, for example SBIN0001234"
              maxLength={11}
              {...bindBank("ifscCode", (value) => value.toUpperCase())}
            />
          </div>

          <SectionHeading>Salary</SectionHeading>
          <div className={gridClassName}>
            <Field
              label="Gross Salary (monthly)"
              placeholder="Enter monthly gross salary"
              inputMode="decimal"
              pattern="[0-9]+(\.[0-9]{1,2})?"
              title="Rupees, up to 2 decimal places"
              isRupee
              {...bind("grossSalary")}
            />
          </div>

          <SectionHeading>Education Qualification</SectionHeading>
          {draft.education.map((entry, index) => (
            <div
              key={index}
              className={index > 0 ? "mt-4 border-t border-dashed border-slate-200 pt-3" : "mt-3"}
            >
              {draft.education.length > 1 && (
                <p className="text-[13px] font-medium text-black">
                  Education {index + 1}
                </p>
              )}
              <div className={gridClassName}>
                <Field
                  label="Name of School / College"
                  name={`school-${index}`}
                  placeholder="Enter school or college name"
                  maxLength={200}
                  value={entry.school}
                  onChange={(school) => updateEducation(index, { school })}
                />
                <Field
                  label="Course Name"
                  name={`course-${index}`}
                  placeholder="Enter course name"
                  maxLength={150}
                  value={entry.course}
                  onChange={(course) => updateEducation(index, { course })}
                />
                <Field
                  label="Duration"
                  name={`duration-${index}`}
                  placeholder="e.g. 2016 – 2019"
                  maxLength={50}
                  value={entry.duration}
                  onChange={(duration) => updateEducation(index, { duration })}
                />
                <Field
                  label="CGPA / Percentage"
                  name={`score-${index}`}
                  placeholder="Enter CGPA or percentage"
                  maxLength={30}
                  value={entry.score}
                  onChange={(score) => updateEducation(index, { score })}
                />
              </div>
              {draft.education.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeEducation(index)}
                  className="mt-2 cursor-pointer text-[13px] font-medium text-red-600 hover:underline"
                >
                  Remove Education {index + 1}
                </button>
              )}
            </div>
          ))}
          <button
            type="button"
            onClick={addEducation}
            className="mt-3 flex h-8 cursor-pointer items-center gap-2 rounded border border-slate-300 px-3 text-sm text-navy transition-colors hover:bg-slate-100"
          >
            <span aria-hidden="true">+</span>
            Add Education
          </button>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 px-4 py-4 sm:px-7">
          <p className="text-[13px] text-black">
            {!isScrolledToEnd && "⌄ Scroll for more details"}
          </p>
          <div className="flex items-center gap-2.5">
            {error && (
              <p role="alert" className="text-sm font-medium text-red-600">
                {error}
              </p>
            )}
            <button
              type="button"
              onClick={onClose}
              className="h-9 cursor-pointer rounded border border-slate-300 bg-white px-5 text-sm font-semibold text-navy transition-colors hover:bg-slate-100"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="h-9 cursor-pointer rounded bg-navy px-7 text-sm font-semibold text-white transition-opacity hover:opacity-90"
            >
              Save
            </button>
          </div>
        </div>
      </form>
    </section>
  );
}
