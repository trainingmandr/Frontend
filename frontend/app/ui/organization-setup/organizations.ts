export type PolicyMode = "FINAL" | "CALCULATE";
export type PayslipTemplate = "Simple" | "Detailed";
export type TemplateView = "payslip" | "email";

export const PAYSLIP_TEMPLATES: PayslipTemplate[] = ["Simple", "Detailed"];

export const TEMPLATE_VIEWS: { value: TemplateView; label: string }[] = [
  { value: "payslip", label: "Pay slip" },
  { value: "email", label: "Email slip" },
];

export interface EmailTemplate {
  fromName: string;
  // The address payslip emails are sent from; starts as the organization's email.
  fromEmail: string;
  subject: string;
  message: string;
}

export interface Organization {
  id: string;
  code: string;
  name: string;
  address: string;
  location: string;
  // The organization's email (org_email in the backend, which also sends
  // payslip emails from it).
  email: string;
  // Entered by hand for now. The backend keeps its own count from the
  // employees' status (org_setup.active_emp_count).
  activeEmployeeCount: number;
  policyMode: PolicyMode;
  payslipTemplate: PayslipTemplate;
  emailTemplate: EmailTemplate;
  // Locked formats can't be edited. Payslips are generated only from a locked
  // payslip format, and mailed only with a locked email format.
  isPayslipLocked: boolean;
  isEmailLocked: boolean;
}

export type OrganizationDetails = Pick<
  Organization,
  | "code"
  | "name"
  | "address"
  | "location"
  | "email"
  | "activeEmployeeCount"
>;

export const emptyOrganizationDetails: OrganizationDetails = {
  code: "",
  name: "",
  address: "",
  location: "",
  email: "",
  activeEmployeeCount: 0,
};

const DEFAULT_MESSAGE = `Hi {{first_name}},

Your payslip for {{pay_period}} is ready. Please find it attached to this email.

Regards,
Payroll Team`;

function defaultEmailTemplate(name: string, email: string): EmailTemplate {
  return {
    fromName: `${name} Payroll`,
    fromEmail: email,
    subject: "Your payslip for {{pay_period}}",
    message: DEFAULT_MESSAGE,
  };
}

export function createOrganization(details: OrganizationDetails): Organization {
  return {
    ...details,
    id: `org-${Date.now()}`,
    policyMode: "CALCULATE",
    payslipTemplate: "Simple",
    emailTemplate: defaultEmailTemplate(details.name, details.email),
    isPayslipLocked: false,
    isEmailLocked: false,
  };
}

// TODO: temporary data. Load organizations from the backend when it is ready.
export const initialOrganizations: Organization[] = [
  {
    id: "org-mra",
    code: "MRA",
    name: "Manian & Rao",
    address: "Madurai, Tamil Nadu",
    location: "Madurai",
    email: "office@company.example",
    activeEmployeeCount: 3,
    policyMode: "FINAL",
    payslipTemplate: "Simple",
    emailTemplate: defaultEmailTemplate("Manian & Rao", "payroll@company.example"),
    isPayslipLocked: false,
    isEmailLocked: false,
  },
  {
    id: "org-etpl",
    code: "ETPL",
    name: "Example Technologies Pvt Ltd",
    address: "Bengaluru, Karnataka",
    location: "Bengaluru",
    email: "office@example.example",
    activeEmployeeCount: 0,
    policyMode: "CALCULATE",
    payslipTemplate: "Detailed",
    emailTemplate: defaultEmailTemplate("Example Technologies", "payroll@example.example"),
    isPayslipLocked: false,
    isEmailLocked: false,
  },
];
