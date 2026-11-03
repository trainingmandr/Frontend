# Connecting the Next.js frontend to the Payroll backend

The prototype keeps its sample data in the browser. This kit replaces that with calls to the FastAPI backend. It contains:

| File | What it is |
|---|---|
| `lib/api/client.ts` | `fetch` wrapper: base URL, JWT header, error handling, file upload and download |
| `lib/api/types.ts` | TypeScript types for every request and response |
| `lib/api/index.ts` | `api.*`, one typed function per endpoint, grouped by page |
| `lib/api/format.ts` | `formatINR`, `formatDate`, `currentMonth`, `monthLabel` |
| `lib/org-context.tsx` | State for the header's "Select Organization" dropdown (`useOrg()`) |
| `lib/use-api.ts` | Small loading/error hook. Skip it if the project already uses SWR or React Query. |

The kit has been type-checked with `strict: true`, and every URL in it has been checked against the backend's routes.

---

## 1. Setup

1. **Start the backend.** Run this from the backend folder:
   ```
   .venv\Scripts\alembic upgrade head
   .venv\Scripts\uvicorn app.main:app --reload --port 8000
   ```
   Swagger UI is at http://localhost:8000/docs and lists every endpoint with its fields.

2. **Copy `lib/` into the Next.js project.** Put it at the project root, or inside `src/` if the project uses one. The files import each other as `@/lib/...`, which is the default Next.js alias. If the project's alias is different, change those imports.

3. **Point the frontend at the backend.** Add this to `.env.local`:
   ```
   NEXT_PUBLIC_API_URL=http://localhost:8000
   ```

4. **Allow the frontend's address in the backend.** In the backend `.env`, `CORS_ORIGINS` must list the address the frontend runs on. The default is `http://localhost:3000,http://127.0.0.1:3000`. If the frontend runs anywhere else, add that address.

5. **Use the API from client components only.** The token is kept in `localStorage`, so any component that calls `api.*` must be a client component (`"use client"`). Server components and route handlers can't see the token.

---

## 2. Login, logout and organisation selection

### Login page

```tsx
"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { api, ApiError } from "@/lib/api";

export default function LoginPage() {
  const router = useRouter();
  const [error, setError] = useState("");

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    try {
      await api.auth.login(String(form.get("email")), String(form.get("password")));
      router.replace("/dashboard");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Login failed");
    }
  }
  // ...render email and password inputs and {error}
}
```

- **Login account:** the admin email and password come from `ADMIN_EMAIL` / `ADMIN_PASSWORD` in the backend `.env`.
- **Expired session:** a token lasts 60 minutes. After that, any call returns 401 and the client sends the user to `/login`. Use `setUnauthorizedHandler()` to change that behaviour.
- **Sidebar name and email:** load them with `api.auth.me()`, which returns `full_name`, `email` and `role`.
- **Logout icon:** call `api.auth.logout()`, then `router.replace("/login")`.
- **Protecting pages:** in the main layout, if `!api.auth.isLoggedIn()`, redirect to `/login`.

### Header "Select Organization" dropdown

Wrap the main layout in `<OrgProvider>`. Each page then gets the current organisation from `useOrg()`.

```tsx
const { orgs, orgCode, current, select, refresh } = useOrg();

<select value={orgCode ?? ""} onChange={(e) => select(e.target.value)}>
  {orgs.map((o) => <option key={o.org_code} value={o.org_code}>{o.org_name}</option>)}
</select>
<button onClick={refresh}>Refresh</button>
```

The selected organisation is remembered between visits. Use `current.org_name` for the name shown at the top of the sidebar.

The prototype's **Reset** button restored the sample data. With real data there is nothing to reset, so remove it or make it call `refresh()`.

---

## 3. Page-by-page: what to replace

Every org-specific call takes `orgCode` from `useOrg()`. Months are always `"YYYY-MM"`; use `currentMonth()` for the default.

### Page 1: Dashboard

| Screen | Call |
|---|---|
| All cards and charts | `api.dashboard.get(orgCode, month)` |

It returns these fields:

- `active_employees`, `total_employees`
- `employees_by_status`, `employees_by_designation`, as `{key, label, count}` lists for charts
- `payroll`: this month's gross, deductions, net and status
- `payroll_trend`: the last 6 months, oldest first
- `emails`: `{pending, sent, failed}`
- `new_joiners`, `leavers`

### Page 2: Organization Setup

| Screen | Call |
|---|---|
| Available Organizations table | `api.orgs.list()`, or `orgs` from `useOrg()` |
| Open (fill the form) | `api.orgs.get(code)` |
| Save Organization | `api.orgs.update(code, { org_name, org_address, org_location, org_email, policy_mode, payslip_template })`, then `refresh()` |
| + Add Organization | `api.orgs.create({ org_code, org_name, ... })`, then `refresh()` and `select(newCode)` |
| Custom designation card | `api.designations.assign(orgCode, { designation_code, designation_name })` |
| "Designation for {org}" list | `api.designations.listForOrg(orgCode)` |
| Remove button | `api.designations.remove(orgCode, code)` |
| All designations with toggle | `api.designations.available(orgCode)`; toggle with `api.designations.toggle(orgCode, code, isActive)` |
| Template select + View | `api.templates.get(orgCode, "PAYSLIP" \| "EMAIL")` |
| Lock button | `api.templates.lock(orgCode, type)`. Unlocking is admin-only: `api.templates.unlock(orgCode, type)`. |

How the fields map to the screen:

- **Organisation form:** Address is `org_address`, Location is `org_location`, and Sender Email is `org_email`. `active_emp_count` is read-only.
- **Policy Mode:** `FINAL` or `CALCULATE`.
- **Payslip Template:** `SIMPLE` or `DETAILED`. Show these as "Simple" / "Detailed".
- **Remove:** returns 409 if employees still have the designation. Show the error message; the user can switch the toggle off instead.
- **Templates:** the body is HTML (payslip) or plain text (email) containing placeholders like `{{emp_name}}` and `{{net_pay}}`. Editing a locked template returns 409.

### Page 3: Employee Master

| Screen | Call |
|---|---|
| Table + search bar | `api.employees.list(orgCode, { search, skip, limit })`, which returns `{ items, total }` |
| Pencil / Edit, View | `api.employees.get(orgCode, empCode)` |
| Add Employee → Save | `api.employees.create(orgCode, body)` |
| Edit → Save | `api.employees.update(orgCode, empCode, body)` |
| Import | `api.employees.import(orgCode, file, { dryRun })`. Send the `File` from `<input type="file">` directly; there's no need to parse Excel in the browser any more. |
| Export | `api.employees.export(orgCode, { emp_codes: checkedCodes })`. Leave out `emp_codes` to export everything matching the search. |
| Import template download | `api.employees.downloadImportTemplate(orgCode)` |

Table columns and form fields:

- **Employee ID** is `emp_code`.
- **Designation** is `designation_name`. The dropdown's options come from `api.designations.listForOrg(orgCode, true)`, and the form sends `designation_code`.
- **Monthly components** is `gross_salary`. Display it with `formatINR(e.gross_salary)`.
- **Bank Details** is the nested `bank: { bank_name, bank_ac_no, branch_name, ifsc_code }`. If the form keeps the single "Bank name, account number & IFSC" box, split it into these fields before saving.
- **Education fields** are the nested `education: {...}`.
- **Blood Group** options: `A+ A- B+ B- AB+ AB- O+ O-`.

**Form values can be sent as they are.** Empty strings are saved as empty values, and dates may be `DD/MM/YYYY`.

The `emp_code` can't be changed after creation, so make that input read-only in edit mode.

**Showing validation errors under inputs:**
```ts
try {
  await api.employees.update(orgCode, empCode, form);
} catch (err) {
  if (err instanceof ApiError) {
    setFieldErrors(err.fieldErrors); // { pan_no: "String should match pattern ...", "bank.ifsc_code": ... }
    toast(err.message);
  }
}
```

**Import flow (recommended):**
1. Call with `{ dryRun: true }` and show `result.errors`, where each item is `{ row, emp_code, errors[] }`.
2. If there are no errors, call again without `dryRun`. If any row fails, nothing is saved (`result.saved === false`).

**Salary structure:** the "component-wise salary amounts" use `api.employees.salary.get(orgCode, empCode)` and `.replace(orgCode, empCode, [{ comp_code, monthly_amount }])`. Saving the structure also updates `gross_salary`.

### Page 4: Salary Components

| Screen | Call |
|---|---|
| List | `api.components.list()`. Each item has `transaction_count` and `employee_count`, so you can disable Delete when they aren't 0. |
| Add | `api.components.create({ comp_code, comp_name, comp_type })` |
| Edit | `api.components.update(code, { comp_name, comp_type })` |
| Delete | `api.components.remove(code)`. Returns 409 if the component is in use. |

`comp_type` is one of `ATTENDANCE`, `EARNING`, `DEDUCTION`, `SPECIAL_EARNING` or `SPECIAL_DEDUCTION`. Components are shared by all organisations.

### Page 5: Transaction

| Screen | Call |
|---|---|
| Month grid | `api.transactions.grid(orgCode, month)` |
| Save edited cells | `api.transactions.save(orgCode, month, entries)`. It returns the refreshed grid. |
| Calculate (CALCULATE policy only) | `api.transactions.calculate(orgCode, month)`, then reload the grid |
| Excel export / import | `api.transactions.export(orgCode, month)` / `api.transactions.import(orgCode, month, file, dryRun)` |
| Process payroll | `api.payroll.process(orgCode, month)`. Show `warnings`. |
| Lock / Unlock | `api.payroll.lock(orgCode, month)` / `api.payroll.unlock(orgCode, month)` (unlock is admin-only) |

What the grid returns:

- **Columns:** `grid.components`, already in order: attendance, earnings, special earnings, deductions, special deductions.
- **Rows:** each row has `values` (comp_code → amount; a missing key means an empty cell), plus `gross_earnings`, `total_deductions` and `net_pay`.
- **Footer:** `grid.totals`.
- **Read-only state:** when `grid.editable` is false, the month is LOCKED; disable the inputs.

**Saving only the changed cells:**
```ts
const entries = Object.entries(dirtyCells).map(([key, value]) => {
  const [emp_code, comp_code] = key.split("|");
  return { emp_code, comp_code, amount: value === "" ? null : value }; // null clears the cell
});
const fresh = await api.transactions.save(orgCode, month, entries);
```

How the payroll status changes:

- Status is shown in `grid.payroll_status`.
- **DRAFT → PROCESSED:** when Process is run.
- **PROCESSED → DRAFT:** if any cell is edited after processing, so Process must be run again.
- **PROCESSED → LOCKED:** Lock. While locked, edits are refused with 409.

### Page 6: Payslip Templates & Email

| Screen | Call |
|---|---|
| Payslip list for the month | `api.payslips.list(orgCode, month)`. Each item includes `email_status`. |
| View payslip | `const html = await api.payslips.html(orgCode, month, empCode)`, then `<iframe srcDoc={html} />`. Print from the iframe to save as PDF. |
| Download payslip | `api.payslips.downloadHtml(orgCode, month, empCode)` |
| Send email (selected or all) | `api.payslips.send(orgCode, month, { empCodes: checked })`. It returns `{ queued, skipped[] }`, e.g. skipped because there's no email address. |
| Delivery status | `api.payslips.emails(orgCode, month)`. Check this every few seconds after sending until nothing is `PENDING`. |
| Resend | `api.payslips.send(orgCode, month, { empCodes, resend: true })` |

- **Send requires a processed payroll.** It returns 409 while the month is still DRAFT.
- **Draft payslips:** they can be viewed at any time, but show a "DRAFT" banner until the month is processed.

---

## 4. Conventions

- **Field names are snake_case**, exactly as listed in `types.ts`. If the prototype's components use other names (`empCode`, `name`, …), either rename them, or convert once where the data arrives:
  ```ts
  const rows = items.map((e) => ({ id: e.emp_code, name: e.emp_name, designation: e.designation_name ?? "", email: e.email ?? "", salary: e.gross_salary, location: e.location ?? "" }));
  ```
- **Codes** (org, employee, designation, component) are stored in capitals. Lowercase input is accepted and converted.
- **Money** arrives as a JSON number. Use `formatINR()` to display it. You can send a number or a string like `"45,000"`.
- **Dates** arrive as `"YYYY-MM-DD"`; use `formatDate()` for `DD/MM/YYYY`. Either format is accepted when saving.
- **Errors:** every failed call throws `ApiError`, with `status`, `message` (readable text), `messages[]` and `fieldErrors`.
  - 409: a conflict (already exists, locked, in use).
  - 422: validation failed.
  - 403: the user's role isn't allowed.
- **Roles:**
  - `admin` can do everything.
  - `manager` can edit everything, but can't unlock payroll or templates, or read the audit log.
  - `user` can only read, and sees PAN, Aadhaar and bank account numbers masked.
- **Downloads:** always use the kit's `export` / `download*` functions. A plain `<a href>` can't send the login token, so it would get a 401.
- **Remove the browser sample data** and any `localStorage` copies of employees, orgs or transactions. The backend is now the source of truth.

---

## 5. Check it works

1. Log in, and the sidebar shows the admin user.
2. Organization Setup: add an org, and it appears in the header dropdown.
3. Add a designation for it, then add an employee with that designation.
4. Export the employees to Excel, change a value, and import with a dry run. There should be no errors.
5. Transaction: open the current month, enter amounts, then Save. Totals update.
6. Process, then open a payslip. The DRAFT banner is gone.
7. Send payslips. Status goes PENDING → SENT. Until SMTP is configured on the backend, emails are written to the backend's `outbox/` folder instead of being sent.
8. Lock the month. The grid becomes read-only.
