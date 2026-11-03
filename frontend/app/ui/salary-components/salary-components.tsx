"use client";

import { useCallback, useState } from "react";
import { useOrganizations } from "@/app/ui/dashboard/organization-context";
import Toast from "@/app/ui/dashboard/toast";
import Toggle from "@/app/ui/dashboard/toggle";
import AddComponentForm from "@/app/ui/salary-components/add-component-form";
import {
  componentTypeLabel,
  initialActivationsByOrganization,
  initialLibrary,
  type Activations,
  type ComponentType,
  type PayComponent,
} from "@/app/ui/salary-components/components";
import ImportComponentsDialog from "@/app/ui/salary-components/import-components-dialog";

const cardClassName =
  "overflow-hidden rounded-lg border border-slate-200 bg-white";
const cardHeadingClassName = "text-lg font-bold text-navy";
const headerCellClassName = "px-5 py-3 text-[13px] font-medium whitespace-nowrap";
const cellClassName = "px-5 py-3.5";
const outlineButtonClassName =
  "h-10 w-[101px] cursor-pointer rounded-md border border-navy bg-white text-sm text-navy transition-colors hover:bg-slate-50 focus:ring-2 focus:ring-navy/30 focus:outline-none";

const typeBadgeClassNames: Record<ComponentType, string> = {
  ATTENDANCE: "border-slate-300 bg-slate-50 text-black",
  EARNING: "border-green-300 bg-green-50 text-green-700",
  SPECIAL_EARNING: "border-emerald-300 bg-emerald-50 text-emerald-800",
  DEDUCTION: "border-blue-300 bg-blue-50 text-blue-700",
  SPECIAL_DEDUCTION: "border-indigo-300 bg-indigo-50 text-indigo-700",
};

function TypeBadge({ type }: { type: ComponentType }) {
  return (
    <span
      className={`rounded border px-1.5 py-0.5 text-xs whitespace-nowrap ${typeBadgeClassNames[type]}`}
    >
      {componentTypeLabel(type)}
    </span>
  );
}

function ComponentName({ component }: { component: PayComponent }) {
  return (
    <>
      <span className="text-[15px] text-black">{component.label}</span>
      <span className="ml-2 text-xs text-black">({component.code})</span>
    </>
  );
}

export default function SalaryComponents() {
  const { organizations, selectedOrganization: organization } =
    useOrganizations();
  const [library, setLibrary] = useState(initialLibrary);
  const [activationsByOrganization, setActivationsByOrganization] = useState(
    initialActivationsByOrganization,
  );
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [toast, setToast] = useState<{ id: number; message: string } | null>(
    null,
  );
  const [shownOrganizationId, setShownOrganizationId] = useState(
    organization.id,
  );

  if (shownOrganizationId !== organization.id) {
    setShownOrganizationId(organization.id);
    setIsImportOpen(false);
    setToast(null);
  }

  const dismissToast = useCallback(() => setToast(null), []);
  const activations = activationsByOrganization[organization.id] ?? [];

  function setActivations(update: (current: Activations) => Activations) {
    setActivationsByOrganization((current) => ({
      ...current,
      [organization.id]: update(current[organization.id] ?? []),
    }));
  }

  function activate(component: PayComponent) {
    setActivations((current) =>
      current.includes(component.code) ? current : [...current, component.code],
    );
  }

  function deactivate(code: string) {
    setActivations((current) => current.filter((entry) => entry !== code));
  }

  function handleAdd(component: PayComponent) {
    setLibrary((current) => [...current, component]);
    activate(component);
    setToast({
      id: Date.now(),
      message: `${component.label} added to the library and to ${organization.name}.`,
    });
  }

  function handleImport(sourceId: string) {
    const source = activationsByOrganization[sourceId] ?? [];
    // Adds the source's components; ones already in use stay as they are.
    setActivations((current) => [...new Set([...current, ...source])]);
    setIsImportOpen(false);
    setToast({ id: Date.now(), message: "Components imported successfully." });
  }

  const usedComponents = library.filter(({ code }) => activations.includes(code));

  return (
    <div className="flex flex-col gap-4">
      <header>
        <h1 className="text-xl font-bold text-navy">Components</h1>
      </header>

      <AddComponentForm
        takenCodes={library.map(({ code }) => code)}
        onAdd={handleAdd}
      />

      <section aria-labelledby="used-components" className={cardClassName}>
        <h2 id="used-components" className={`${cardHeadingClassName} px-5 py-4`}>
          Components used by {organization.name}
        </h2>
        {usedComponents.length === 0 ? (
          <p className="border-t border-slate-200 px-5 py-8 text-center text-sm text-black">
            {organization.name} does not use any components yet. Turn them on
            in All components below.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] border-collapse text-left">
              <thead className="bg-slate-50 text-black">
                <tr>
                  <th scope="col" className={headerCellClassName}>
                    Component
                  </th>
                  <th scope="col" className={headerCellClassName}>
                    Type
                  </th>
                  <th scope="col" className={headerCellClassName}>
                    Action
                  </th>
                </tr>
              </thead>
              <tbody>
                {usedComponents.map((component) => (
                  <tr key={component.code} className="border-t border-slate-200">
                    <th scope="row" className={`${cellClassName} font-normal`}>
                      <ComponentName component={component} />
                    </th>
                    <td className={cellClassName}>
                      <TypeBadge type={component.type} />
                    </td>
                    <td className={cellClassName}>
                      <button
                        type="button"
                        aria-label={`Remove ${component.label} from ${organization.name}`}
                        onClick={() => deactivate(component.code)}
                        className={outlineButtonClassName}
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

      <section aria-labelledby="all-components" className={cardClassName}>
        <div className="flex flex-wrap items-center justify-between gap-2 px-5 py-3">
          <h2 id="all-components" className={cardHeadingClassName}>
            All components
          </h2>
          <button
            type="button"
            onClick={() => setIsImportOpen(true)}
            className="h-8 cursor-pointer rounded bg-navy px-3 text-sm font-semibold text-white transition-opacity hover:opacity-90 focus:ring-2 focus:ring-navy/30 focus:outline-none"
          >
            Import
          </button>
        </div>
        <p className="border-y border-slate-200 bg-slate-50 px-5 py-2.5 text-[15px] text-navy">
          The library is common to all companies. Turning a component on for
          one company does not change another company.
        </p>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] border-collapse text-left">
            <caption className="sr-only">Component library</caption>
            <thead className="text-black">
              <tr>
                <th scope="col" className={headerCellClassName}>
                  Component
                </th>
                <th scope="col" className={headerCellClassName}>
                  Type
                </th>
                <th scope="col" className={headerCellClassName}>
                  Use in {organization.name}
                </th>
              </tr>
            </thead>
            <tbody>
              {library.map((component) => (
                <tr key={component.code} className="border-t border-slate-200">
                  <th scope="row" className={`${cellClassName} font-normal`}>
                    <ComponentName component={component} />
                  </th>
                  <td className={cellClassName}>
                    <TypeBadge type={component.type} />
                  </td>
                  <td className={cellClassName}>
                    <Toggle
                      label={`Use ${component.label} in ${organization.name}`}
                      checked={activations.includes(component.code)}
                      onChange={(checked) =>
                        checked
                          ? activate(component)
                          : deactivate(component.code)
                      }
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {isImportOpen && (
        <ImportComponentsDialog
          sources={organizations
            .filter(({ id }) => id !== organization.id)
            .map((source) => ({
              organization: source,
              count: (activationsByOrganization[source.id] ?? []).length,
            }))}
          targetName={organization.name}
          onImport={handleImport}
          onClose={() => setIsImportOpen(false)}
        />
      )}

      {toast && (
        <Toast key={toast.id} message={toast.message} onDismiss={dismissToast} />
      )}
    </div>
  );
}
