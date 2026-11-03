"use client";

import { useCallback, useState, type SubmitEvent } from "react";
import { useOrganizations } from "@/app/ui/dashboard/organization-context";
import Toast from "@/app/ui/dashboard/toast";
import {
  createOrganization,
  emptyOrganizationDetails,
  TEMPLATE_VIEWS,
  type OrganizationDetails,
  type TemplateView,
} from "@/app/ui/organization-setup/organizations";
import DesignationSetup from "@/app/ui/organization-setup/designation-setup";
import PayslipFormat from "@/app/ui/organization-setup/payslip-format";

const inputClassName =
  "h-[37px] w-full rounded border border-slate-300 bg-white px-2.5 text-sm text-navy outline-none transition-shadow placeholder:text-slate-400 focus:border-navy focus:ring-2 focus:ring-navy/20";
const labelClassName = "mb-1.5 block text-[13px] text-black";
const cardClassName = "rounded-lg border border-slate-200 bg-white p-4 sm:px-5";
const primaryButtonClassName =
  "h-9 cursor-pointer rounded bg-navy px-4 text-xs font-medium text-white transition-opacity hover:opacity-90 focus:ring-2 focus:ring-navy/30 focus:outline-none";
const secondaryButtonClassName =
  "h-9 cursor-pointer rounded border border-slate-300 bg-white px-4 text-xs font-medium text-navy transition-colors hover:bg-slate-100 focus:ring-2 focus:ring-navy/20 focus:outline-none disabled:cursor-default disabled:opacity-60 disabled:hover:bg-white";

const columns = ["Code", "Organization", "Policy Mode", "Payslip Template", "Action"];

interface OrganizationFormProps {
  details: OrganizationDetails;
  isNew: boolean;
  takenCodes: string[];
  onSave: (details: OrganizationDetails) => void;
  onAdd: () => void;
  onCancelAdd: () => void;
}

function OrganizationForm({
  details,
  isNew,
  takenCodes,
  onSave,
  onAdd,
  onCancelAdd,
}: OrganizationFormProps) {
  const [draft, setDraft] = useState(details);
  // Kept as typed so the number input can be cleared while editing.
  const [activeCount, setActiveCount] = useState(String(details.activeEmployeeCount));
  const [error, setError] = useState("");

  const bind = (name: Exclude<keyof OrganizationDetails, "activeEmployeeCount">) => ({
    id: `organization-${name}`,
    name,
    value: draft[name],
    onChange: (event: { target: { value: string } }) => {
      const value =
        name === "code" ? event.target.value.toUpperCase() : event.target.value;
      setDraft((current) => ({ ...current, [name]: value }));
    },
  });

  function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = {
      code: draft.code.trim(),
      name: draft.name.trim(),
      address: draft.address.trim(),
      location: draft.location.trim(),
      email: draft.email.trim(),
      activeEmployeeCount: Number(activeCount) || 0,
    };

    if (takenCodes.includes(trimmed.code)) {
      setError(`Organization code ${trimmed.code} is already in use.`);
      return;
    }

    setError("");
    onSave(trimmed);
  }

  return (
    <form onSubmit={handleSubmit}>
      <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div>
          <label htmlFor="organization-name" className={labelClassName}>
            Organization Name
          </label>
          <input
            required
            placeholder="Enter organization name"
            className={inputClassName}
            {...bind("name")}
          />
        </div>
        <div>
          <label htmlFor="organization-code" className={labelClassName}>
            Organization Code
          </label>
          <input
            required
            placeholder="e.g. MRA"
            pattern="[A-Z0-9]{2,10}"
            title="2 to 10 letters or digits"
            maxLength={10}
            className={inputClassName}
            {...bind("code")}
          />
        </div>
        <div>
          <label htmlFor="organization-address" className={labelClassName}>
            Address
          </label>
          <input
            placeholder="City, State"
            className={inputClassName}
            {...bind("address")}
          />
        </div>
        <div>
          <label htmlFor="organization-location" className={labelClassName}>
            Location
          </label>
          <input
            placeholder="e.g. Madurai"
            maxLength={150}
            className={inputClassName}
            {...bind("location")}
          />
        </div>
        <div>
          <label htmlFor="organization-email" className={labelClassName}>
            Email
          </label>
          <input
            type="email"
            placeholder="office@company.example"
            maxLength={150}
            className={inputClassName}
            {...bind("email")}
          />
        </div>
        <div>
          <label htmlFor="organization-activeEmployeeCount" className={labelClassName}>
            Active Employee Count
          </label>
          <input
            id="organization-activeEmployeeCount"
            name="activeEmployeeCount"
            type="number"
            inputMode="numeric"
            min={0}
            step={1}
            placeholder="0"
            value={activeCount}
            onChange={(event) => setActiveCount(event.target.value)}
            className={inputClassName}
          />
        </div>
      </div>

      <div className="mt-3.5 flex flex-wrap items-center justify-end gap-2">
        {error && (
          <p role="alert" className="mr-auto text-sm font-medium text-red-600">
            {error}
          </p>
        )}
        {isNew && (
          <button
            type="button"
            onClick={onCancelAdd}
            className={secondaryButtonClassName}
          >
            Cancel
          </button>
        )}
        <button type="submit" className={primaryButtonClassName}>
          Save Organization
        </button>
        {!isNew && (
          <button
            type="button"
            onClick={onAdd}
            className={secondaryButtonClassName}
          >
            + Add Organization
          </button>
        )}
      </div>
    </form>
  );
}

export default function OrganizationSetup() {
  const {
    organizations,
    selectedOrganization,
    selectOrganization,
    saveOrganization,
    updateOrganization,
  } = useOrganizations();
  // The organization that was selected when Add was pressed. Selecting a
  // different organization in the topbar leaves add mode.
  const [addingFrom, setAddingFrom] = useState<string | null>(null);
  // Empty until a template is chosen in the selector.
  const [pendingView, setPendingView] = useState<TemplateView | "">("");
  // The template shown below the selector; nothing is shown until View.
  const [appliedView, setAppliedView] = useState<TemplateView | null>(null);
  const [toast, setToast] = useState<{ id: number; message: string } | null>(
    null,
  );

  const dismissToast = useCallback(() => setToast(null), []);
  const isAdding = addingFrom === selectedOrganization.id;

  function handleSave(details: OrganizationDetails) {
    if (isAdding) {
      saveOrganization(createOrganization(details));
      setToast({ id: Date.now(), message: `${details.name} added.` });
    } else {
      saveOrganization({ ...selectedOrganization, ...details });
      setToast({ id: Date.now(), message: "Organization saved." });
    }
    setAddingFrom(null);
  }

  function showToast(message: string) {
    setToast({ id: Date.now(), message });
  }

  return (
    <div className="flex flex-col gap-3">
      <header>
        <h1 className="text-xl font-bold text-navy">Organization Setup</h1>
        <p className="text-xs text-black">
          Create a new firm or edit its own settings. Other organizations remain
          separate.
        </p>
      </header>

      <section aria-labelledby="organization-master" className={cardClassName}>
        <h2 id="organization-master" className="text-lg font-bold text-navy">
          {isAdding ? "New Organization" : "Organization Master"}
        </h2>
        <OrganizationForm
          key={isAdding ? "new" : selectedOrganization.id}
          details={isAdding ? emptyOrganizationDetails : selectedOrganization}
          isNew={isAdding}
          takenCodes={organizations
            .filter(({ id }) => isAdding || id !== selectedOrganization.id)
            .map(({ code }) => code)}
          onSave={handleSave}
          onAdd={() => setAddingFrom(selectedOrganization.id)}
          onCancelAdd={() => setAddingFrom(null)}
        />
      </section>

      <section
        aria-labelledby="available-organizations"
        className={cardClassName}
      >
        <h2 id="available-organizations" className="text-lg font-bold text-navy">
          Available Organizations
        </h2>
        <div className="mt-3 overflow-x-auto rounded border border-slate-200">
          <table className="w-full min-w-[640px] border-collapse text-left text-xs">
            <thead className="bg-slate-50 text-black">
              <tr>
                {columns.map((column) => (
                  <th
                    key={column}
                    scope="col"
                    className="px-2.5 py-3.5 font-medium whitespace-nowrap"
                  >
                    {column}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="text-navy">
              {organizations.map((organization) => {
                const isSelected = organization.id === selectedOrganization.id;
                return (
                  <tr
                    key={organization.id}
                    aria-current={isSelected ? "true" : undefined}
                    className={`border-t border-slate-200 ${
                      isSelected ? "bg-slate-50/70" : ""
                    }`}
                  >
                    <td className="px-2.5 py-2">{organization.code}</td>
                    <td className="px-2.5 py-2">{organization.name}</td>
                    <td className="px-2.5 py-2">
                      <span className="rounded bg-slate-100 px-1.5 py-1 text-[10px] font-medium tracking-wide">
                        {organization.policyMode}
                      </span>
                    </td>
                    <td className="px-2.5 py-2">
                      {organization.payslipTemplate}
                    </td>
                    <td className="px-2.5 py-2">
                      <button
                        type="button"
                        aria-label={`Open ${organization.name}`}
                        disabled={isSelected && !isAdding}
                        onClick={() => {
                          setAddingFrom(null);
                          selectOrganization(organization.id);
                        }}
                        className={`${secondaryButtonClassName} h-8 px-3`}
                      >
                        {isSelected && !isAdding ? "Opened" : "Open"}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {!isAdding && (
        <DesignationSetup organization={selectedOrganization} onMessage={showToast} />
      )}

      <section aria-labelledby="template-view-label">
        <label
          id="template-view-label"
          htmlFor="template-view"
          className={labelClassName}
        >
          Template
        </label>
        <div className="flex flex-wrap gap-2">
          <select
            id="template-view"
            value={pendingView}
            onChange={(event) =>
              setPendingView(event.target.value as TemplateView)
            }
            className={`${inputClassName} min-w-0 flex-1`}
          >
            <option value="" disabled>
              Select
            </option>
            {TEMPLATE_VIEWS.map(({ value, label }) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
          <button
            type="button"
            disabled={!pendingView}
            onClick={() => pendingView && setAppliedView(pendingView)}
            className={`${primaryButtonClassName} h-[37px] px-14 disabled:cursor-default disabled:opacity-50`}
          >
            View
          </button>
        </div>
      </section>

      {appliedView && (
        <PayslipFormat
          key={selectedOrganization.id}
          organization={selectedOrganization}
          view={appliedView}
          onChange={(changes) =>
            updateOrganization(selectedOrganization.id, changes)
          }
          onSaved={showToast}
        />
      )}

      <p className="text-[11px] text-black">
        Interactive prototype · Sample data lives only in this browser tab and
        resets on reload. No emails are sent and there is no backend storage
        yet.
      </p>

      {toast && (
        <Toast
          key={toast.id}
          message={toast.message}
          onDismiss={dismissToast}
        />
      )}
    </div>
  );
}
