// Types mirroring the backend's Pydantic schemas (app/schemas/*.py).
// Field names are snake_case exactly as the API sends them.
// Dates are ISO strings ("2026-10-31"), timestamps are ISO datetimes, money is a JSON number.

export type Role = "admin" | "manager" | "user";
export type PolicyMode = "FINAL" | "CALCULATE";
export type PayslipLayout = "SIMPLE" | "DETAILED";
export type TemplateType = "PAYSLIP" | "EMAIL";
export type EmploymentStatus = "ACTIVE" | "INACTIVE" | "RESIGNED" | "TERMINATED";
export type BloodGroup = "A+" | "A-" | "B+" | "B-" | "AB+" | "AB-" | "O+" | "O-";
export type ComponentType = "ATTENDANCE" | "EARNING" | "DEDUCTION" | "SPECIAL_EARNING" | "SPECIAL_DEDUCTION";
export type PayrollStatus = "DRAFT" | "PROCESSED" | "LOCKED";
export type EmailStatus = "PENDING" | "SENT" | "FAILED";
export type FileFormat = "xlsx" | "csv";
/** "YYYY-MM", e.g. "2026-10" */
export type MonthYear = string;

export interface Paginated<T> {
  items: T[];
  total: number;
  skip: number;
  limit: number;
}

// ---------- Auth / users ----------

export interface User {
  id: number;
  email: string;
  full_name: string | null;
  role: Role;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface TokenResponse {
  access_token: string;
  token_type: "bearer";
  /** seconds */
  expires_in: number;
  user: User;
}

export interface UserInput {
  email: string;
  full_name?: string | null;
  password?: string;
  role?: Role;
  is_active?: boolean;
}

// ---------- Page 2: Organization Setup ----------

export interface Org {
  org_code: string;
  org_name: string;
  org_address: string | null;
  org_location: string | null;
  org_email: string | null;
  policy_mode: PolicyMode;
  payslip_template: PayslipLayout;
  /** Maintained by the database; read-only */
  active_emp_count: number;
  created_at: string;
  updated_at: string;
}

export interface OrgInput {
  org_name: string;
  org_address?: string | null;
  org_location?: string | null;
  org_email?: string | null;
  policy_mode?: PolicyMode;
  payslip_template?: PayslipLayout;
}

export interface OrgCreate extends OrgInput {
  org_code: string;
}

export interface Designation {
  designation_code: string;
  designation_name: string;
  created_at: string;
}

/** "Designation for {org}" list */
export interface OrgDesignation {
  designation_code: string;
  designation_name: string;
  is_active: boolean;
  effective_from: string | null;
  effective_to: string | null;
  employee_count: number;
}

/** "All designations" list with toggle */
export interface DesignationAvailability {
  designation_code: string;
  designation_name: string;
  /** Mapped to the org at all */
  assigned: boolean;
  /** Toggle state */
  is_active: boolean;
}

export interface OrgDesignationAssign {
  designation_code: string;
  /** Required when the code is new (custom designation card) */
  designation_name?: string | null;
  effective_from?: string | null;
  effective_to?: string | null;
}

export interface Template {
  org_code: string;
  template_type: TemplateType;
  subject: string | null;
  /** HTML (PAYSLIP) or plain text (EMAIL) with {{placeholders}} */
  body: string;
  is_locked: boolean;
  locked_at: string | null;
  locked_by: number | null;
  updated_at: string;
}

// ---------- Page 3: Employee Master ----------

export interface BankDetails {
  bank_name: string | null;
  bank_ac_no: string | null;
  branch_name: string | null;
  ifsc_code: string | null;
}

export interface EducationDetails {
  qualification: string | null;
  school_college_name: string | null;
  course_name: string | null;
  duration: string | null;
  cgpa_percentage: string | null;
}

export interface Employee {
  org_code: string;
  emp_code: string;
  emp_name: string;
  email: string | null;
  designation_code: string | null;
  designation_name: string | null;
  location: string | null;
  dob: string | null;
  address: string | null;
  contact: string | null;
  emergency_contact: string | null;
  blood_group: BloodGroup | null;
  date_of_joining: string | null;
  /** Masked (XXXXXX234F) for the "user" role */
  pan_no: string | null;
  aadhar_no: string | null;
  date_of_leaving: string | null;
  /** "Monthly components" column */
  gross_salary: number;
  employment_status: EmploymentStatus;
  bank: BankDetails | null;
  education: EducationDetails | null;
  created_at: string;
  updated_at: string;
}

/**
 * Body for create / edit. Blank strings are treated as null by the backend, so form values can be sent as-is.
 * Dates may be "YYYY-MM-DD" or "DD/MM/YYYY". On edit, fields left out keep their current value.
 */
export interface EmployeeInput {
  emp_name: string;
  email?: string | null;
  designation_code?: string | null;
  location?: string | null;
  dob?: string | null;
  address?: string | null;
  contact?: string | null;
  emergency_contact?: string | null;
  blood_group?: string | null;
  date_of_joining?: string | null;
  pan_no?: string | null;
  aadhar_no?: string | null;
  date_of_leaving?: string | null;
  gross_salary?: number | string | null;
  employment_status?: EmploymentStatus | null;
  bank?: Partial<BankDetails> | null;
  education?: Partial<EducationDetails> | null;
}

export interface EmployeeCreate extends EmployeeInput {
  emp_code: string;
}

export interface EmployeeListParams {
  search?: string;
  employment_status?: EmploymentStatus;
  designation_code?: string;
  sort_by?: "emp_code" | "emp_name" | "designation_code" | "location" | "gross_salary" | "date_of_joining";
  sort_dir?: "asc" | "desc";
  skip?: number;
  limit?: number;
}

export interface EmployeeExportParams {
  format?: FileFormat;
  /** Checkbox-selected rows; omit to export everything matching the filters */
  emp_codes?: string[];
  search?: string;
  employment_status?: EmploymentStatus;
  designation_code?: string;
}

export interface ImportRowError {
  row: number;
  emp_code: string | null;
  errors: string[];
}

export interface EmployeeImportResult {
  /** false when dry_run or when any row failed (all-or-nothing) */
  saved: boolean;
  dry_run: boolean;
  total_rows: number;
  created: number;
  updated: number;
  errors: ImportRowError[];
}

// ---------- Employee salary structure ----------

export interface SalaryItem {
  comp_code: string;
  comp_name: string;
  comp_type: ComponentType;
  monthly_amount: number;
}

export interface SalaryStructure {
  org_code: string;
  emp_code: string;
  items: SalaryItem[];
  monthly_earnings: number;
  monthly_deductions: number;
  monthly_net: number;
}

// ---------- Page 4: Salary Components ----------

export interface Component {
  comp_code: string;
  comp_name: string;
  comp_type: ComponentType;
  created_at: string;
}

export interface ComponentWithUsage extends Component {
  transaction_count: number;
  employee_count: number;
}

export interface ComponentInput {
  comp_code: string;
  comp_name: string;
  comp_type: ComponentType;
}

// ---------- Page 5: Transactions ----------

export interface GridRow {
  emp_code: string;
  emp_name: string;
  designation_name: string | null;
  employment_status: EmploymentStatus;
  /** comp_code -> amount; missing key = empty cell */
  values: Record<string, number>;
  gross_earnings: number;
  total_deductions: number;
  net_pay: number;
}

export interface TransactionGrid {
  org_code: string;
  month_year: MonthYear;
  policy_mode: PolicyMode;
  payroll_status: PayrollStatus;
  /** false when the month is LOCKED */
  editable: boolean;
  /** Column order: attendance, earnings, special earnings, deductions, special deductions */
  components: Component[];
  rows: GridRow[];
  totals: {
    values: Record<string, number>;
    gross_earnings: number;
    total_deductions: number;
    net_pay: number;
  };
}

export interface TransactionEntry {
  emp_code: string;
  comp_code: string;
  /** null clears the cell */
  amount: number | string | null;
}

export interface EntryError {
  emp_code: string | null;
  comp_code: string | null;
  row: number | null;
  message: string;
}

export interface TransactionImportResult {
  saved: boolean;
  dry_run: boolean;
  total_rows: number;
  values_set: number;
  errors: EntryError[];
}

export interface CalculateResult {
  month_year: MonthYear;
  days_in_month: number;
  employees_calculated: number;
  transactions_written: number;
  warnings: string[];
}

// ---------- Payroll ----------

export interface PayrollSummary {
  id: string;
  org_code: string;
  month_year: MonthYear;
  gross_payroll: number;
  total_deductions: number;
  net_payroll: number;
  status: PayrollStatus;
  created_at: string;
  updated_at: string;
}

export interface PayrollProcessResult {
  summary: PayrollSummary;
  employee_count: number;
  warnings: string[];
}

// ---------- Page 6: Payslips ----------

export interface PayslipLine {
  comp_code: string;
  comp_name: string;
  amount: number;
}

export interface Payslip {
  org_code: string;
  org_name: string;
  month_year: MonthYear;
  /** "October 2026" */
  month_label: string;
  payroll_status: PayrollStatus;
  emp_code: string;
  emp_name: string;
  email: string | null;
  designation_name: string | null;
  location: string | null;
  date_of_joining: string | null;
  pan_no: string | null;
  bank_name: string | null;
  bank_ac_no: string | null;
  ifsc_code: string | null;
  attendance: PayslipLine[];
  earnings: PayslipLine[];
  deductions: PayslipLine[];
  gross_earnings: number;
  total_deductions: number;
  net_pay: number;
  /** "Rupees Forty Five Thousand Only" */
  net_pay_words: string;
  email_status: EmailStatus | null;
  email_sent_date: string | null;
}

export interface PayslipEmail {
  org_code: string;
  emp_code: string;
  month_year: MonthYear;
  /** Recipient address */
  email_name: string;
  sent_date: string | null;
  status: EmailStatus;
  error_message: string | null;
  created_at: string;
}

export interface SendPayslipsResult {
  queued: number;
  skipped: EntryError[];
}

// ---------- Page 1: Dashboard ----------

export interface CountItem {
  key: string;
  label: string;
  count: number;
}

export interface MonthTrend {
  month_year: MonthYear;
  gross_payroll: number;
  total_deductions: number;
  net_payroll: number;
  /** null = nothing entered/processed for that month */
  status: PayrollStatus | null;
}

export interface Dashboard {
  org_code: string;
  org_name: string;
  month_year: MonthYear;
  active_employees: number;
  total_employees: number;
  employees_by_status: CountItem[];
  employees_by_designation: CountItem[];
  payroll: MonthTrend;
  /** Last 6 months, oldest first */
  payroll_trend: MonthTrend[];
  emails: { pending: number; sent: number; failed: number };
  new_joiners: number;
  leavers: number;
}

// ---------- Audit ----------

export interface AuditEntry {
  uuid: string;
  org_code: string | null;
  table_name: string;
  record_key: Record<string, unknown>;
  action: "INSERT" | "UPDATE" | "DELETE";
  before_image: Record<string, unknown> | null;
  after_image: Record<string, unknown> | null;
  changed_by: number | null;
  created_at: string;
}
