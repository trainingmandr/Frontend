import { initialOrganizations } from "@/app/ui/organization-setup/organizations";

// Field names follow the backend's emp_details, bank_details and
// education_details tables (see backend/app/models/employee.py).

export interface Education {
  school: string;
  course: string;
  duration: string;
  score: string;
}

export interface BankDetails {
  bankName: string;
  accountNumber: string;
  branchName: string;
  ifscCode: string;
}

export type EmploymentStatus = "ACTIVE" | "INACTIVE" | "RESIGNED" | "TERMINATED";

export interface Employee {
  code: string;
  name: string;
  // A designation code from the organization's designations (Organization
  // Setup); shown by its name.
  designation: string;
  email: string;
  location: string;
  employmentStatus: EmploymentStatus;
  dateOfBirth: string;
  address: string;
  contactNumber: string;
  emergencyContactNumber: string;
  bloodGroup: string;
  dateOfJoining: string;
  panNumber: string;
  aadhaarNumber: string;
  dateOfLeaving: string;
  bank: BankDetails;
  // Monthly gross in rupees, as typed (up to 2 decimal places).
  grossSalary: string;
  education: Education[];
}

export const BLOOD_GROUPS = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];

export const EMPLOYMENT_STATUSES: { value: EmploymentStatus; label: string }[] = [
  { value: "ACTIVE", label: "Active" },
  { value: "INACTIVE", label: "Inactive" },
  { value: "RESIGNED", label: "Resigned" },
  { value: "TERMINATED", label: "Terminated" },
];

export function employmentStatusLabel(status: EmploymentStatus) {
  return EMPLOYMENT_STATUSES.find(({ value }) => value === status)?.label ?? status;
}

export const emptyEducation: Education = {
  school: "",
  course: "",
  duration: "",
  score: "",
};

export const emptyBankDetails: BankDetails = {
  bankName: "",
  accountNumber: "",
  branchName: "",
  ifscCode: "",
};

export const emptyEmployee: Employee = {
  code: "",
  name: "",
  designation: "",
  email: "",
  location: "",
  employmentStatus: "ACTIVE",
  dateOfBirth: "",
  address: "",
  contactNumber: "",
  emergencyContactNumber: "",
  bloodGroup: "",
  dateOfJoining: "",
  panNumber: "",
  aadhaarNumber: "",
  dateOfLeaving: "",
  bank: emptyBankDetails,
  grossSalary: "",
  education: [emptyEducation],
};

// TODO: temporary data. Load employees from the backend when it is ready.
export const initialEmployees: Employee[] = [
  {
    ...emptyEmployee,
    code: "EMP-001",
    name: "Arun Manian",
    designation: "SR_AUDITOR",
    email: "arun.manian@auditpro.com",
    location: "Chennai",
    grossSalary: "45000",
  },
  {
    ...emptyEmployee,
    code: "EMP-002",
    name: "Priya Rao",
    designation: "HR_MANAGER",
    email: "priya.rao@auditpro.com",
    location: "Bengaluru",
    grossSalary: "38500",
  },
  {
    ...emptyEmployee,
    code: "EMP-003",
    name: "Suresh Kumar",
    designation: "JR_AUDITOR",
    email: "suresh.kumar@auditpro.com",
    location: "Hyderabad",
    grossSalary: "32000",
  },
];

// Each organization keeps its own employees; ones not listed here start empty.
export const initialEmployeesByOrganization: Record<string, Employee[]> = {
  [initialOrganizations[0].id]: initialEmployees,
};

// TODO: temporary data. Replace with the backend import API, which should
// parse the uploaded CSV or Excel file.
export const sampleImportedEmployees: Employee[] = [
  {
    ...emptyEmployee,
    name: "Sanjay",
    designation: "INTERN",
    email: "sanjay@gmail.com",
    location: "Hyderabad",
    grossSalary: "32000",
  },
  {
    ...emptyEmployee,
    name: "Kumar",
    designation: "INTERN",
    email: "kumar@gmail.com",
    location: "Hyderabad",
    grossSalary: "32000",
  },
];

export function formatEmployeeCode(number: number) {
  return `EMP-${String(number).padStart(3, "0")}`;
}

export function highestEmployeeNumber(employees: Employee[]) {
  return Math.max(
    0,
    ...employees.map((employee) => Number(employee.code.replace(/\D/g, ""))),
  );
}

// `designationName` is the shown name of the employee's designation code.
export function matchesSearch(
  employee: Employee,
  query: string,
  designationName: string,
) {
  const needle = query.trim().toLowerCase();
  return [
    employee.code,
    employee.name,
    employee.designation,
    designationName,
    employee.email,
    employee.location,
  ].some((value) => value.toLowerCase().includes(needle));
}

export function formatGrossSalary({ grossSalary }: Employee) {
  if (!grossSalary) return "";
  // Display only; the amount itself is kept as the typed text.
  return `₹ ${Number(grossSalary).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
}

// Bank account, PAN and Aadhaar numbers are left out so an exported file is
// safer to pass around; view or edit the employee to see them.
export function exportColumns(
  designationName: (code: string) => string,
): { label: string; value: (employee: Employee) => string }[] {
  return [
    { label: "Employee Code", value: (e) => e.code },
    { label: "Name", value: (e) => e.name },
    { label: "Designation Code", value: (e) => e.designation },
    { label: "Designation", value: (e) => designationName(e.designation) },
    { label: "Email", value: (e) => e.email },
    { label: "Location", value: (e) => e.location },
    { label: "Status", value: (e) => e.employmentStatus },
    { label: "Date of Birth", value: (e) => e.dateOfBirth },
    { label: "Address", value: (e) => e.address },
    { label: "Contact Number", value: (e) => e.contactNumber },
    { label: "Emergency Contact Number", value: (e) => e.emergencyContactNumber },
    { label: "Blood Group", value: (e) => e.bloodGroup },
    { label: "Date of Joining", value: (e) => e.dateOfJoining },
    { label: "Date of Leaving", value: (e) => e.dateOfLeaving },
    { label: "Bank Name", value: (e) => e.bank.bankName },
    { label: "Branch Name", value: (e) => e.bank.branchName },
    { label: "IFSC", value: (e) => e.bank.ifscCode },
    { label: "Monthly Gross Salary", value: (e) => e.grossSalary },
  ];
}
