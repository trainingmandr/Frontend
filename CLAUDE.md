# Manian & Rao Payroll

Payroll management app for Manian & Rao. Early prototype. The backend is FastAPI + PostgreSQL in `backend/`; login and the Dashboard use it, while the other pages still keep sample data in browser state.

@frontend/AGENTS.md

## Commands

Run from `frontend/`:

- `npm run dev`: dev server at http://localhost:3000
- `npm run build`: production build
- `npm run lint`: ESLint
- `npx tsc --noEmit --incremental false`: type check

There is no test framework yet. Run lint, the type check, and the build after changes.

Run from `backend/` (settings in `backend/.env`; restart after editing it):

- `.venv\Scripts\alembic upgrade head`: create or update the database tables
- `.venv\Scripts\python -m app.seed_demo`: load demo organizations, employees and six months of payroll (skips if MRA exists)
- `.venv\Scripts\uvicorn app.main:app --reload --port 8000`: API at http://localhost:8000, docs at `/docs`

The frontend reaches it through `frontend/lib/api` (`NEXT_PUBLIC_API_URL` in `frontend/.env.local`); see `backend/frontend-integration/INTEGRATION.md`.

## Stack

Next.js 16.4.3 (App Router, Turbopack, `cacheComponents`, `partialPrefetching`), React 19.3, strict TypeScript, Tailwind CSS 4. Fonts are Geist via `next/font/google`, so builds need network access.

This Next.js version differs from older ones. Read the relevant guide in `frontend/node_modules/next/dist/docs/` before using a Next.js API. For example, route protection uses `proxy`.

## Layout

```
frontend/app/
  layout.tsx                 root layout, fonts, metadata
  globals.css                theme tokens, sphere utilities, loader keyframes
  (auth)/                    navy welcome layout
    page.tsx                 / landing page
    admin/login/page.tsx     /admin/login
  (dashboard)/               sidebar + topbar layout
    dashboard/page.tsx       /dashboard payroll overview
    employee-master/page.tsx /employee-master
    organization-setup/page.tsx /organization-setup
    payslip-processor/page.tsx  /payslip-processor
    payslip-templates/page.tsx  redirects to /payslip-processor; delete when unused
    salary-components/page.tsx  /salary-components
    transaction/page.tsx        /transaction
  ui/
    login/                   login form, loading screen
    dashboard/               sidebar, topbar, toast, organization context, file download
    employee-master/         table with selection, add/edit form, multi-employee view, CSV export, import dialog, mock data
    organization-setup/      organization form and table, designations, payslip/email format, mock organizations
    payslip-processor/       preview, validation, summary; money helpers, sample payslips
    salary-components/       shared component library, per-organization activations, import dialog
    transaction/             consolidated attendance and salary view, CSV import and export
```

## Conventions

- Routes live in `app/`; shared components live in `app/ui/<area>/`, in kebab-case files.
- Import with the `@/` alias, for example `@/app/ui/login/admin-login-form`.
- Default to server components. Add `"use client"` only for hooks or browser events.
- Style with Tailwind classes. Brand colors are `navy` (#1f3a5f) and `teal` (#0f9d8a), defined in `globals.css`.
- Icons are inline SVGs with `aria-hidden="true"`; no icon library is installed.
- Keep labels, `role`, and `aria-*` attributes on interactive elements, and visible focus styles.
- Next keeps hidden pages mounted, so clear sensitive form state on unmount (see `admin-login-form.tsx`).

## Temporary code

Do not treat these as working features:

- Login calls the backend (`api.auth.login`); the admin account comes from `ADMIN_EMAIL` / `ADMIN_PASSWORD` in `backend/.env`. The token is kept in `localStorage`. A 401 from any API call sends the user to `/admin/login`.
- Pages have no route protection, and the logout button is only a link to `/`; it does not clear the token.
- The sidebar user (`Admin User`, `admin@auditpro`, `AB`) is placeholder data.
- Organizations live in `OrganizationProvider` (`app/ui/dashboard/organization-context.tsx`), seeded from `app/ui/organization-setup/organizations.ts`. Changes are lost on reload, and the topbar Reset button restores the seed data. Employee Master keeps a separate employee list per organization (only Manian & Rao has seed employees); Reset does not restore employees.
- The shared designation list and each organization's designations live in `OrganizationProvider`, seeded from `app/ui/organization-setup/designations.ts`; Organization Setup edits them and Employee Master's Designation dropdown offers the selected organization's ones. Changes are lost on reload; Reset restores the seed data.
- Employee fields follow the backend tables (`emp_details`, `bank_details`, `education_details`): one gross salary, four bank fields, employment status, and several education entries per employee. `education_details` allows several rows per employee from migration `0005`.
- The backend does not store the email template; the subject and message are sent with each `api.payslips.send` call. The frontend still edits the email in the organization's page state.
- Policy mode (`FINAL` / `CALCULATE`) is display-only; new organizations default to `CALCULATE`.
- Components (`/salary-components`) keeps the shared library and each organization's chosen components in page state (`app/ui/salary-components/components.ts`). A component has the backend's fields only: code, name and one of the five `comp_type` values. The backend has no per-organization component table yet. The payslip preview does not read them yet. Import copies another organization's components; it takes no file.
- Transaction uses sample workings from `app/ui/transaction/payroll-data.ts` (Manian & Rao only), kept in page state. Its columns are fixed and do not follow the activated Salary Components. LOP, TDS and Excess Leave are entered values, not calculated; only Gross, Deductions, Net and totals are summed. CSV import is parsed in the browser and nothing is uploaded. "Generate payslips" is enabled only after "Validate" passes (`app/ui/transaction/validate-rows.ts`, browser only; importing clears the validation), and it only marks the run as generated; the payslip preview still shows sample data.
- The payslip and email formats are edited in Organization Setup under Template → View, and each has its own Lock / Unlock. Transaction's "Generate payslips" needs the payslip format locked, and Send mail needs the email format locked. Import replaces both, so it needs both unlocked.
- Payslips are generated on the Transaction page, which saves one record per row (with the row's email) in `PayslipRunProvider` (`app/ui/dashboard/payslip-run-context.tsx`); no PDFs are created and records are lost on reload.
- Payslip processor is preview only. Its preview shows `samplePayslips` from `app/ui/payslip-processor/sample-payslips.ts`, not the Transaction workings; amounts there are hardcoded. Its summary tab has two parts. Payslip Archive searches every generated record and sends to ticked records plus people added by hand or imported from a CSV, using an email template typed for that send (nothing is stored or uploaded). Payslip records shows the current run (`PAY_MONTH`) and sends with the locked email format. Both only mark records as Sent; no emails are sent, and added people get nothing. Preview Export uses the browser print dialog. `validate-payslips.ts` is not used by any page now.
- The topbar's Month and Year pickers set `payrollMonth` in `OrganizationProvider` ("YYYY-MM"; helpers in `app/ui/dashboard/months.ts`). Only the Dashboard reads it so far.
- The Dashboard loads from the backend for the selected organization's `code` and the topbar month (`api.dashboard.get`, `api.transactions.grid`, `api.payslips.list`). Organizations created only in the browser are not in the database, so it shows "not in the payroll database". Edits on the other pages do not reach it until those pages use the backend.
- Sidebar items without an `href` have no screen yet.
- Employee Master uses mock data in `app/ui/employee-master/employees.ts`. Changes live in React state and are lost on reload.
- The import dialog takes no file; it adds the sample employees from `employees.ts`.

## Planned work

1. Connect the remaining pages to the backend in dependency order: Organization Setup, Employee Master, Components, Transaction, Payslip Processor, so every page reads and writes the selected organization and month.
2. Finish authentication: `proxy` route protection, real logout, and a safer token store than `localStorage`.
3. Add tests before writing salary calculations.

## Payroll rules

- Calculate money with exact decimals, never floating point.
- Enforce authorization and validation on the server, not only in the UI.
- Treat employee personal, salary, and bank data as sensitive: never log it or expose it in client bundles.
- Scope every data access to the selected organization.
- Keep an audit trail for changes to salaries and payroll runs.
