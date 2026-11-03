// Typed calls for every backend endpoint, grouped by page.
//   import { api } from "@/lib/api";
//   const { items } = await api.employees.list(orgCode, { search });

import { download, fetchText, http, tokenStore, upload } from "./client";
import type {
  AuditEntry,
  CalculateResult,
  ComponentInput,
  ComponentType,
  ComponentWithUsage,
  Component,
  Dashboard,
  Designation,
  DesignationAvailability,
  EmailStatus,
  Employee,
  EmployeeCreate,
  EmployeeExportParams,
  EmployeeImportResult,
  EmployeeInput,
  EmployeeListParams,
  FileFormat,
  MonthYear,
  Org,
  OrgCreate,
  OrgDesignation,
  OrgDesignationAssign,
  OrgInput,
  Paginated,
  PayrollProcessResult,
  PayrollSummary,
  Payslip,
  PayslipEmail,
  SalaryStructure,
  SendPayslipsResult,
  Template,
  TemplateType,
  TokenResponse,
  TransactionEntry,
  TransactionGrid,
  TransactionImportResult,
  User,
  UserInput,
} from "./types";

export * from "./types";
export { ApiError, API_URL, setUnauthorizedHandler, tokenStore } from "./client";

const org = (orgCode: string) => `/orgs/${encodeURIComponent(orgCode)}`;
const enc = encodeURIComponent;

export const api = {
  auth: {
    /** Stores the token; returns the logged-in user. */
    async login(email: string, password: string): Promise<User> {
      const result = await http.post<TokenResponse>("/auth/login", { email, password });
      tokenStore.set(result.access_token);
      return result.user;
    },
    logout() {
      tokenStore.clear();
    },
    me: () => http.get<User>("/auth/me"),
    isLoggedIn: () => tokenStore.get() !== null,
  },

  users: {
    list: (skip = 0, limit = 50) => http.get<Paginated<User>>("/users", { skip, limit }),
    create: (body: UserInput & { email: string; password: string }) => http.post<User>("/users", body),
    update: (id: number, body: Partial<UserInput>) => http.patch<User>(`/users/${id}`, body),
    remove: (id: number) => http.delete(`/users/${id}`),
  },

  // ---------- Page 1: Dashboard ----------
  dashboard: {
    get: (orgCode: string, monthYear?: MonthYear) =>
      http.get<Dashboard>(`${org(orgCode)}/dashboard`, { month_year: monthYear }),
  },

  // ---------- Page 2: Organization Setup ----------
  orgs: {
    list: () => http.get<Org[]>("/orgs"),
    get: (orgCode: string) => http.get<Org>(org(orgCode)),
    create: (body: OrgCreate) => http.post<Org>("/orgs", body),
    /** Save Organization; only the fields sent change */
    update: (orgCode: string, body: Partial<OrgInput>) => http.put<Org>(org(orgCode), body),
  },

  designations: {
    /** Global master */
    listAll: () => http.get<Designation[]>("/designations"),
    createMaster: (designation_code: string, designation_name: string) =>
      http.post<Designation>("/designations", { designation_code, designation_name }),
    /** "Designation for {org}" */
    listForOrg: (orgCode: string, activeOnly = false) =>
      http.get<OrgDesignation[]>(`${org(orgCode)}/designations`, { active_only: activeOnly }),
    /** All designations with toggle state for the org */
    available: (orgCode: string) => http.get<DesignationAvailability[]>(`${org(orgCode)}/designations/available`),
    /** Custom designation card: creates it if the code is new, then assigns to the org */
    assign: (orgCode: string, body: OrgDesignationAssign) =>
      http.post<OrgDesignation>(`${org(orgCode)}/designations`, body),
    /** Toggle on/off (turning on an unassigned one assigns it) */
    toggle: (orgCode: string, designationCode: string, isActive: boolean) =>
      http.patch<OrgDesignation>(`${org(orgCode)}/designations/${enc(designationCode)}`, { is_active: isActive }),
    /** Remove; fails with 409 if employees use it */
    remove: (orgCode: string, designationCode: string) =>
      http.delete(`${org(orgCode)}/designations/${enc(designationCode)}`),
  },

  templates: {
    list: (orgCode: string) => http.get<Template[]>(`${org(orgCode)}/templates`),
    /** View button */
    get: (orgCode: string, type: TemplateType) => http.get<Template>(`${org(orgCode)}/templates/${type}`),
    /** Fails with 409 while locked */
    update: (orgCode: string, type: TemplateType, body: { subject?: string | null; body?: string }) =>
      http.put<Template>(`${org(orgCode)}/templates/${type}`, body),
    lock: (orgCode: string, type: TemplateType) => http.post<Template>(`${org(orgCode)}/templates/${type}/lock`),
    /** Admin only */
    unlock: (orgCode: string, type: TemplateType) => http.post<Template>(`${org(orgCode)}/templates/${type}/unlock`),
  },

  // ---------- Page 3: Employee Master ----------
  employees: {
    list: (orgCode: string, params: EmployeeListParams = {}) =>
      http.get<Paginated<Employee>>(`${org(orgCode)}/employees`, { ...params }),
    get: (orgCode: string, empCode: string) => http.get<Employee>(`${org(orgCode)}/employees/${enc(empCode)}`),
    create: (orgCode: string, body: EmployeeCreate) => http.post<Employee>(`${org(orgCode)}/employees`, body),
    /** Edit form; emp_code cannot change */
    update: (orgCode: string, empCode: string, body: EmployeeInput) =>
      http.put<Employee>(`${org(orgCode)}/employees/${enc(empCode)}`, body),
    /** Import button. Check `result.saved` and show `result.errors` per row. */
    import: (orgCode: string, file: File, options: { dryRun?: boolean; updateExisting?: boolean } = {}) =>
      upload<EmployeeImportResult>(`${org(orgCode)}/employees/import`, file, {
        dry_run: options.dryRun ?? false,
        update_existing: options.updateExisting ?? true,
      }),
    /** Export button (pass the checked rows in emp_codes) */
    export: (orgCode: string, params: EmployeeExportParams = {}) =>
      download(`${org(orgCode)}/employees/export`, { ...params }, `employees.${params.format ?? "xlsx"}`),
    downloadImportTemplate: (orgCode: string) =>
      download(`${org(orgCode)}/employees/import-template`, undefined, "employee_import_template.xlsx"),

    salary: {
      get: (orgCode: string, empCode: string) =>
        http.get<SalaryStructure>(`${org(orgCode)}/employees/${enc(empCode)}/salary-components`),
      /** Replaces the whole structure; EARNING and DEDUCTION components only. Updates gross_salary. */
      replace: (orgCode: string, empCode: string, items: { comp_code: string; monthly_amount: number | string }[]) =>
        http.put<SalaryStructure>(`${org(orgCode)}/employees/${enc(empCode)}/salary-components`, { items }),
      clear: (orgCode: string, empCode: string) =>
        http.delete(`${org(orgCode)}/employees/${enc(empCode)}/salary-components`),
    },
  },

  // ---------- Page 4: Salary Components ----------
  components: {
    list: (compType?: ComponentType) => http.get<ComponentWithUsage[]>("/components", { comp_type: compType }),
    create: (body: ComponentInput) => http.post<Component>("/components", body),
    /** Type cannot change once the component is used */
    update: (compCode: string, body: { comp_name?: string; comp_type?: ComponentType }) =>
      http.put<ComponentWithUsage>(`/components/${enc(compCode)}`, body),
    /** Fails with 409 if used */
    remove: (compCode: string) => http.delete(`/components/${enc(compCode)}`),
  },

  // ---------- Page 5: Transactions ----------
  transactions: {
    grid: (orgCode: string, monthYear: MonthYear, search?: string) =>
      http.get<TransactionGrid>(`${org(orgCode)}/transactions/${monthYear}`, { search }),
    /** Save edited cells (all-or-nothing). Returns the refreshed grid. */
    save: (orgCode: string, monthYear: MonthYear, entries: TransactionEntry[]) =>
      http.put<TransactionGrid>(`${org(orgCode)}/transactions/${monthYear}`, { entries }),
    /** CALCULATE policy orgs only */
    calculate: (orgCode: string, monthYear: MonthYear) =>
      http.post<CalculateResult>(`${org(orgCode)}/transactions/${monthYear}/calculate`),
    export: (orgCode: string, monthYear: MonthYear, format: FileFormat = "xlsx") =>
      download(`${org(orgCode)}/transactions/${monthYear}/export`, { format }, `transactions_${monthYear}.${format}`),
    import: (orgCode: string, monthYear: MonthYear, file: File, dryRun = false) =>
      upload<TransactionImportResult>(`${org(orgCode)}/transactions/${monthYear}/import`, file, { dry_run: dryRun }),
  },

  payroll: {
    history: (orgCode: string) => http.get<PayrollSummary[]>(`${org(orgCode)}/payroll`),
    /** 404 until the month has been processed */
    get: (orgCode: string, monthYear: MonthYear) => http.get<PayrollSummary>(`${org(orgCode)}/payroll/${monthYear}`),
    process: (orgCode: string, monthYear: MonthYear) =>
      http.post<PayrollProcessResult>(`${org(orgCode)}/payroll/${monthYear}/process`),
    lock: (orgCode: string, monthYear: MonthYear) => http.post<PayrollSummary>(`${org(orgCode)}/payroll/${monthYear}/lock`),
    /** Admin only */
    unlock: (orgCode: string, monthYear: MonthYear) =>
      http.post<PayrollSummary>(`${org(orgCode)}/payroll/${monthYear}/unlock`),
  },

  // ---------- Page 6: Payslip Processor ----------
  payslips: {
    list: (orgCode: string, monthYear: MonthYear, empCodes?: string[]) =>
      http.get<Payslip[]>(`${org(orgCode)}/payslips/${monthYear}`, { emp_codes: empCodes }),
    get: (orgCode: string, monthYear: MonthYear, empCode: string) =>
      http.get<Payslip>(`${org(orgCode)}/payslips/${monthYear}/${enc(empCode)}`),
    /** Rendered payslip HTML; show with <iframe srcDoc={html} /> */
    html: (orgCode: string, monthYear: MonthYear, empCode: string) =>
      fetchText(`${org(orgCode)}/payslips/${monthYear}/${enc(empCode)}/html`),
    downloadHtml: (orgCode: string, monthYear: MonthYear, empCode: string) =>
      download(`${org(orgCode)}/payslips/${monthYear}/${enc(empCode)}/html`, { download: true }, `Payslip_${empCode}_${monthYear}.html`),
    /**
     * Queues emails (payroll must be processed). Poll `emails()` for delivery status.
     * `fromEmail`, `subject` and `body` are the email typed on screen (subject and body with
     * {{placeholders}}); they are not stored. Leave them out to use the organisation's email
     * and the backend's default text.
     */
    send: (
      orgCode: string,
      monthYear: MonthYear,
      options: { empCodes?: string[]; resend?: boolean; fromEmail?: string; subject?: string; body?: string } = {},
    ) =>
      http.post<SendPayslipsResult>(`${org(orgCode)}/payslips/${monthYear}/send`, {
        emp_codes: options.empCodes?.length ? options.empCodes : null,
        resend: options.resend ?? false,
        from_email: options.fromEmail || null,
        subject: options.subject || null,
        body: options.body || null,
      }),
    emails: (orgCode: string, monthYear: MonthYear, status?: EmailStatus) =>
      http.get<PayslipEmail[]>(`${org(orgCode)}/payslips/${monthYear}/emails`, { status }),
  },

  audit: {
    list: (
      orgCode: string,
      params: { table_name?: string; action?: string; include_global?: boolean; skip?: number; limit?: number } = {},
    ) => http.get<Paginated<AuditEntry>>(`${org(orgCode)}/audit-log`, { ...params }),
  },
};

export type Api = typeof api;
