import { initialOrganizations } from "@/app/ui/organization-setup/organizations";

// Matches the backend `components` table: comp_code, comp_name, comp_type.
export type ComponentType =
  | "ATTENDANCE"
  | "EARNING"
  | "DEDUCTION"
  | "SPECIAL_EARNING"
  | "SPECIAL_DEDUCTION";

// In the backend's display order. EARNING and DEDUCTION can be part of an
// employee's fixed monthly salary; the SPECIAL types are entered per month.
export const COMPONENT_TYPES: { value: ComponentType; label: string; help: string }[] = [
  { value: "ATTENDANCE", label: "Attendance", help: "Days, for example present or leave" },
  { value: "EARNING", label: "Earning", help: "Fixed monthly amount that adds to pay" },
  { value: "SPECIAL_EARNING", label: "Special Earning", help: "Entered each month, adds to pay" },
  { value: "DEDUCTION", label: "Deduction", help: "Fixed monthly amount taken from pay" },
  { value: "SPECIAL_DEDUCTION", label: "Special Deduction", help: "Entered each month, taken from pay" },
];

export function componentTypeLabel(type: ComponentType) {
  return COMPONENT_TYPES.find(({ value }) => value === type)?.label ?? type;
}

export interface PayComponent {
  // comp_code: unique across the whole library, for example HRA.
  code: string;
  // comp_name: shown on the payslip.
  label: string;
  type: ComponentType;
}

// Codes of the components one organization uses.
// TODO: the backend has no per-organization table for this yet.
export type Activations = string[];

// TODO: temporary data. Load the shared library from the backend.
export const initialLibrary: PayComponent[] = [
  { code: "SALARY", label: "Salary", type: "EARNING" },
  { code: "CONVEYANCE", label: "Conveyance", type: "EARNING" },
  { code: "BASIC", label: "Basic Salary", type: "EARNING" },
  { code: "HRA", label: "House Rent Allowance", type: "EARNING" },
  { code: "SPECIAL", label: "Special Allowance", type: "EARNING" },
  { code: "BONUS", label: "Bonus / Incentive", type: "SPECIAL_EARNING" },
  { code: "PF", label: "Provident Fund", type: "DEDUCTION" },
  { code: "ESI", label: "ESI", type: "DEDUCTION" },
  { code: "TDS", label: "Income Tax (TDS)", type: "SPECIAL_DEDUCTION" },
  { code: "PRESENT", label: "Present", type: "ATTENDANCE" },
  { code: "LEAVE", label: "Leave", type: "ATTENDANCE" },
  { code: "AUDIT", label: "Audit", type: "ATTENDANCE" },
  { code: "WAH", label: "Work at Home", type: "ATTENDANCE" },
  { code: "CFD", label: "Credit Full Day", type: "ATTENDANCE" },
  { code: "SAT", label: "Saturday", type: "ATTENDANCE" },
  { code: "SUN", label: "Sunday", type: "ATTENDANCE" },
  { code: "CHD", label: "Credit Half Day", type: "ATTENDANCE" },
];

// TODO: temporary data. Organizations not listed here start with none.
export const initialActivationsByOrganization: Record<string, Activations> = {
  [initialOrganizations[0].id]: [
    "SALARY",
    "CONVEYANCE",
    "TDS",
    "PRESENT",
    "LEAVE",
    "AUDIT",
    "WAH",
    "CFD",
  ],
  [initialOrganizations[1].id]: ["BASIC", "HRA", "SPECIAL", "PF", "TDS", "PRESENT", "LEAVE"],
};
