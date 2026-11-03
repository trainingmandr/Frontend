"use client";

import { createContext, use, useState, type ReactNode } from "react";
import {
  initialDesignations,
  initialDesignationsByOrganization,
  type Designation,
} from "@/app/ui/organization-setup/designations";
import {
  initialOrganizations,
  type Organization,
} from "@/app/ui/organization-setup/organizations";
import { PAY_MONTH } from "@/app/ui/payslip-processor/sample-payslips";

interface OrganizationContextValue {
  organizations: Organization[];
  selectedOrganization: Organization;
  selectOrganization: (id: string) => void;
  // Adds the organization if its id is new, and selects it.
  saveOrganization: (organization: Organization) => void;
  updateOrganization: (id: string, changes: Partial<Organization>) => void;
  // Restores the seed organizations and designations.
  resetOrganizations: () => void;
  // The designation list shared by all organizations, set up in
  // Organization Setup and picked from in Employee Master.
  designations: Designation[];
  // Codes of the designations an organization uses, in the order turned on.
  designationCodesFor: (organizationId: string) => string[];
  addDesignation: (designation: Designation) => void;
  setDesignationUsed: (organizationId: string, code: string, used: boolean) => void;
  // The payroll month picked in the topbar, "YYYY-MM"; pages show this month.
  payrollMonth: string;
  selectPayrollMonth: (month: string) => void;
}

const OrganizationContext = createContext<OrganizationContextValue | null>(
  null,
);

export function useOrganizations() {
  const value = use(OrganizationContext);
  if (!value) {
    throw new Error("useOrganizations must be used inside OrganizationProvider");
  }
  return value;
}

// TODO: organizations live in React state until the backend exists, so
// changes are lost on reload.
export default function OrganizationProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [organizations, setOrganizations] = useState(initialOrganizations);
  const [selectedId, setSelectedId] = useState(initialOrganizations[0].id);
  const [designations, setDesignations] = useState(initialDesignations);
  const [designationCodes, setDesignationCodes] = useState(
    initialDesignationsByOrganization,
  );
  // Starts on the month of the sample payroll run.
  const [payrollMonth, setPayrollMonth] = useState(PAY_MONTH);

  const selectedOrganization =
    organizations.find(({ id }) => id === selectedId) ?? organizations[0];

  function saveOrganization(organization: Organization) {
    setOrganizations((current) =>
      current.some(({ id }) => id === organization.id)
        ? current.map((entry) =>
            entry.id === organization.id ? organization : entry,
          )
        : [...current, organization],
    );
    setSelectedId(organization.id);
  }

  function updateOrganization(id: string, changes: Partial<Organization>) {
    setOrganizations((current) =>
      current.map((entry) => (entry.id === id ? { ...entry, ...changes } : entry)),
    );
  }

  function resetOrganizations() {
    setOrganizations(initialOrganizations);
    setSelectedId(initialOrganizations[0].id);
    setDesignations(initialDesignations);
    setDesignationCodes(initialDesignationsByOrganization);
  }

  function addDesignation(designation: Designation) {
    setDesignations((current) =>
      current.some(({ code }) => code === designation.code)
        ? current
        : [...current, designation],
    );
  }

  function setDesignationUsed(organizationId: string, code: string, used: boolean) {
    setDesignationCodes((current) => {
      const codes = current[organizationId] ?? [];
      const next = used
        ? codes.includes(code)
          ? codes
          : [...codes, code]
        : codes.filter((entry) => entry !== code);
      return { ...current, [organizationId]: next };
    });
  }

  return (
    <OrganizationContext
      value={{
        organizations,
        selectedOrganization,
        selectOrganization: setSelectedId,
        saveOrganization,
        updateOrganization,
        resetOrganizations,
        designations,
        designationCodesFor: (organizationId) => designationCodes[organizationId] ?? [],
        addDesignation,
        setDesignationUsed,
        payrollMonth,
        selectPayrollMonth: setPayrollMonth,
      }}
    >
      {children}
    </OrganizationContext>
  );
}
