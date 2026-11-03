import { initialOrganizations } from "@/app/ui/organization-setup/organizations";

export interface Designation {
  // Unique across the whole library, for example SR_AUDITOR.
  code: string;
  name: string;
}

// TODO: temporary data. Load the shared designation list from the backend
// (`api.designations`).
export const initialDesignations: Designation[] = [
  { code: "SR_AUDITOR", name: "Senior Auditor" },
  { code: "JR_AUDITOR", name: "Junior Auditor" },
  { code: "AUDIT_ASSOC", name: "Audit Associate" },
  { code: "TAX_CONSULT", name: "Tax Consultant" },
  { code: "ARTICLE_ASST", name: "Article Assistant" },
  { code: "HR_MANAGER", name: "HR Manager" },
  { code: "INTERN", name: "Intern" },
  { code: "SW_ENGINEER", name: "Software Engineer" },
  { code: "ACCOUNTANT", name: "Accountant" },
];

// The designation codes each organization uses. Organizations not listed
// here start with none.
export const initialDesignationsByOrganization: Record<string, string[]> = {
  [initialOrganizations[0].id]: [
    "SR_AUDITOR",
    "JR_AUDITOR",
    "AUDIT_ASSOC",
    "TAX_CONSULT",
    "ARTICLE_ASST",
    "HR_MANAGER",
    "INTERN",
  ],
  [initialOrganizations[1].id]: ["SW_ENGINEER", "ACCOUNTANT", "HR_MANAGER", "INTERN"],
};
