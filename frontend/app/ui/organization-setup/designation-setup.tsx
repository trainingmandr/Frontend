"use client";

import { useState, type SubmitEvent } from "react";
import { useOrganizations } from "@/app/ui/dashboard/organization-context";
import Toggle from "@/app/ui/dashboard/toggle";
import type { Designation } from "@/app/ui/organization-setup/designations";
import type { Organization } from "@/app/ui/organization-setup/organizations";

const inputClassName =
  "h-[37px] w-full rounded border border-slate-300 bg-white px-2.5 text-sm text-navy outline-none transition-shadow placeholder:text-slate-400 focus:border-navy focus:ring-2 focus:ring-navy/20";
const labelClassName = "mb-1.5 block text-[13px] text-black";
const cardClassName = "rounded-lg border border-slate-200 bg-white p-4 sm:px-5";
const headerCellClassName = "px-2.5 py-3.5 font-medium whitespace-nowrap";
const cellClassName = "px-2.5 py-2";
const primaryButtonClassName =
  "h-[37px] cursor-pointer rounded bg-navy px-6 text-xs font-medium text-white transition-opacity hover:opacity-90 focus:ring-2 focus:ring-navy/30 focus:outline-none";
const secondaryButtonClassName =
  "h-8 cursor-pointer rounded border border-slate-300 bg-white px-3 text-xs font-medium text-navy transition-colors hover:bg-slate-100 focus:ring-2 focus:ring-navy/20 focus:outline-none";

interface CustomDesignationFormProps {
  takenCodes: string[];
  onAdd: (designation: Designation) => void;
}

function CustomDesignationForm({ takenCodes, onAdd }: CustomDesignationFormProps) {
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState("");

  function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    if (takenCodes.includes(code)) {
      setError(`Designation code ${code} is already in the list.`);
      return;
    }

    onAdd({ code, name: name.trim() });
    setCode("");
    setName("");
    setError("");
  }

  return (
    <section aria-labelledby="custom-designation" className={cardClassName}>
      <h2 id="custom-designation" className="text-lg font-bold text-navy">
        Custom Designation
      </h2>
      <form
        onSubmit={handleSubmit}
        className="mt-3 grid items-end gap-3 sm:grid-cols-[1fr_2fr_auto]"
      >
        <div>
          <label htmlFor="designation-code" className={labelClassName}>
            Designation Code
          </label>
          <input
            id="designation-code"
            required
            value={code}
            onChange={(event) => setCode(event.target.value.toUpperCase())}
            placeholder="e.g. SR_AUDITOR"
            pattern="[A-Z0-9_]{2,30}"
            title="2 to 30 capital letters, digits or underscores"
            maxLength={30}
            className={inputClassName}
          />
        </div>
        <div>
          <label htmlFor="designation-name" className={labelClassName}>
            Designation Name
          </label>
          <input
            id="designation-name"
            required
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="e.g. Senior Auditor"
            maxLength={100}
            className={inputClassName}
          />
        </div>
        <button type="submit" className={primaryButtonClassName}>
          Add
        </button>
        {error && (
          <p role="alert" className="text-sm font-medium text-red-600 sm:col-span-3">
            {error}
          </p>
        )}
      </form>
    </section>
  );
}

function DesignationName({ designation }: { designation: Designation }) {
  return (
    <>
      {designation.name}
      <span className="ml-2 text-black">({designation.code})</span>
    </>
  );
}

interface DesignationSetupProps {
  organization: Organization;
  onMessage: (message: string) => void;
}

export default function DesignationSetup({
  organization,
  onMessage,
}: DesignationSetupProps) {
  // Shared with Employee Master, which offers these in its Designation list.
  const {
    designations: library,
    designationCodesFor,
    addDesignation,
    setDesignationUsed,
  } = useOrganizations();
  const usedCodes = designationCodesFor(organization.id);

  function turnOn(code: string) {
    setDesignationUsed(organization.id, code, true);
  }

  function turnOff(code: string) {
    setDesignationUsed(organization.id, code, false);
  }

  function handleAdd(designation: Designation) {
    addDesignation(designation);
    turnOn(designation.code);
    onMessage(`${designation.name} added to the list and to ${organization.name}.`);
  }

  const usedDesignations = library.filter(({ code }) => usedCodes.includes(code));

  return (
    <>
      <CustomDesignationForm
        takenCodes={library.map(({ code }) => code)}
        onAdd={handleAdd}
      />

      <section aria-labelledby="used-designations" className={cardClassName}>
        <h2 id="used-designations" className="text-lg font-bold text-navy">
          Designations used by {organization.name}
        </h2>
        {usedDesignations.length === 0 ? (
          <p className="mt-3 rounded border border-slate-200 px-2.5 py-8 text-center text-sm text-black">
            {organization.name} does not use any designations yet. Turn them on
            in All designations below.
          </p>
        ) : (
          <div className="mt-3 overflow-x-auto rounded border border-slate-200">
            <table className="w-full min-w-[480px] border-collapse text-left text-xs">
              <thead className="bg-slate-50 text-black">
                <tr>
                  <th scope="col" className={headerCellClassName}>
                    Designation
                  </th>
                  <th scope="col" className={headerCellClassName}>
                    Action
                  </th>
                </tr>
              </thead>
              <tbody className="text-navy">
                {usedDesignations.map((designation) => (
                  <tr key={designation.code} className="border-t border-slate-200">
                    <th scope="row" className={`${cellClassName} font-normal`}>
                      <DesignationName designation={designation} />
                    </th>
                    <td className={cellClassName}>
                      <button
                        type="button"
                        aria-label={`Remove ${designation.name} from ${organization.name}`}
                        onClick={() => turnOff(designation.code)}
                        className={secondaryButtonClassName}
                      >
                        Remove
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section aria-labelledby="all-designations" className={cardClassName}>
        <h2 id="all-designations" className="text-lg font-bold text-navy">
          All designations
        </h2>
        <p className="mt-1 text-xs text-black">
          The list is common to all organizations. Turning a designation on for
          one organization does not change another.
        </p>
        <div className="mt-3 overflow-x-auto rounded border border-slate-200">
          <table className="w-full min-w-[480px] border-collapse text-left text-xs">
            <caption className="sr-only">Designation list</caption>
            <thead className="bg-slate-50 text-black">
              <tr>
                <th scope="col" className={headerCellClassName}>
                  Designation
                </th>
                <th scope="col" className={headerCellClassName}>
                  Use in {organization.name}
                </th>
              </tr>
            </thead>
            <tbody className="text-navy">
              {library.map((designation) => (
                <tr key={designation.code} className="border-t border-slate-200">
                  <th scope="row" className={`${cellClassName} font-normal`}>
                    <DesignationName designation={designation} />
                  </th>
                  <td className={cellClassName}>
                    <Toggle
                      label={`Use ${designation.name} in ${organization.name}`}
                      checked={usedCodes.includes(designation.code)}
                      onChange={(checked) =>
                        checked ? turnOn(designation.code) : turnOff(designation.code)
                      }
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
