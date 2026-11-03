"use client";

import { useState, type SubmitEvent } from "react";
import {
  COMPONENT_TYPES,
  type ComponentType,
  type PayComponent,
} from "@/app/ui/salary-components/components";

const inputClassName =
  "h-9 w-full rounded border border-slate-300 bg-white px-2.5 text-sm text-navy outline-none transition-shadow placeholder:text-slate-400 focus:border-navy focus:ring-2 focus:ring-navy/20";
const labelClassName = "mb-1 block text-[13px] text-black";
const helperClassName = "mt-1 text-xs text-black";

interface AddComponentFormProps {
  takenCodes: string[];
  onAdd: (component: PayComponent) => void;
}

export default function AddComponentForm({
  takenCodes,
  onAdd,
}: AddComponentFormProps) {
  const [code, setCode] = useState("");
  const [label, setLabel] = useState("");
  const [type, setType] = useState<ComponentType | "">("");
  const [error, setError] = useState("");

  function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!type) return;

    if (takenCodes.includes(code)) {
      setError(`Component code ${code} is already in the library.`);
      return;
    }

    onAdd({ code, label: label.trim(), type });
    setCode("");
    setLabel("");
    setType("");
    setError("");
  }

  const id = (name: string) => `custom-component-${name}`;
  const typeHelp =
    COMPONENT_TYPES.find(({ value }) => value === type)?.help ??
    "Attendance, earning or deduction";

  return (
    <section
      aria-labelledby={id("heading")}
      className="rounded-lg border border-slate-200 bg-white"
    >
      <h2
        id={id("heading")}
        className="border-b border-slate-200 px-5 py-4 text-lg font-bold text-navy"
      >
        Custom Component
      </h2>
      <form
        onSubmit={handleSubmit}
        className="grid items-start gap-4 px-5 py-4 sm:grid-cols-2 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)_minmax(0,1fr)_auto]"
      >
        <div>
          <label htmlFor={id("code")} className={labelClassName}>
            Component Code
          </label>
          <input
            id={id("code")}
            required
            value={code}
            onChange={(event) => setCode(event.target.value.toUpperCase())}
            placeholder="e.g. HRA"
            pattern="[A-Z0-9_]{2,30}"
            title="2 to 30 capital letters, digits or underscores"
            maxLength={30}
            aria-describedby={id("code-help")}
            className={inputClassName}
          />
          <p id={id("code-help")} className={helperClassName}>
            Unique short code
          </p>
        </div>
        <div>
          <label htmlFor={id("label")} className={labelClassName}>
            Component Name
          </label>
          <input
            id={id("label")}
            required
            value={label}
            onChange={(event) => setLabel(event.target.value)}
            placeholder="e.g. House Rent Allowance"
            maxLength={150}
            aria-describedby={id("label-help")}
            className={inputClassName}
          />
          <p id={id("label-help")} className={helperClassName}>
            Shown on the payslip
          </p>
        </div>
        <div>
          <label htmlFor={id("type")} className={labelClassName}>
            Type
          </label>
          <select
            id={id("type")}
            required
            value={type}
            onChange={(event) => setType(event.target.value as ComponentType)}
            aria-describedby={id("type-help")}
            className={inputClassName}
          >
            <option value="">Select type...</option>
            {COMPONENT_TYPES.map(({ value, label: typeLabel }) => (
              <option key={value} value={value}>
                {typeLabel}
              </option>
            ))}
          </select>
          <p id={id("type-help")} aria-live="polite" className={helperClassName}>
            {typeHelp}
          </p>
        </div>
        <button
          type="submit"
          className="h-10 cursor-pointer rounded-md bg-navy px-8 text-base font-medium text-white transition-opacity hover:opacity-90 focus:ring-2 focus:ring-navy/30 focus:outline-none lg:mt-5"
        >
          Add
        </button>
        {error && (
          <p
            role="alert"
            className="text-sm font-medium text-red-600 sm:col-span-2 lg:col-span-4"
          >
            {error}
          </p>
        )}
      </form>
    </section>
  );
}
