"use client";

import { useRef, useState, type ChangeEvent, type SubmitEvent } from "react";
import { downloadCsv } from "@/app/ui/dashboard/download";
import type { EmailTemplate, Organization } from "@/app/ui/organization-setup/organizations";
import { formatPayMonth } from "@/app/ui/payslip-processor/sample-payslips";
import { parseCsv, toCsv } from "@/app/ui/transaction/payroll-data";

export interface PayslipRecord {
  id: string;
  name: string;
  email: string;
  // ISO date, for example 2026-10-31.
  date: string;
  // <input type="month"> value, for example 2026-10.
  month: string;
  status: "Generated" | "Sent" | "Failed";
  error: string;
}

// Someone added by hand or from an imported file, to receive the archive mail.
interface Recipient {
  name: string;
  email: string;
}

const cardClassName = "rounded-lg border border-slate-200 bg-white";
const inputClassName =
  "h-9 w-full rounded border border-slate-300 bg-white px-2.5 text-sm text-navy outline-none transition-shadow placeholder:text-slate-400 focus:border-navy focus:ring-2 focus:ring-navy/20";
const labelClassName = "mb-1 block text-[13px] text-black";
const helperClassName = "mt-1 text-xs text-black";
const solidButtonClassName =
  "cursor-pointer rounded-md bg-navy font-medium text-white transition-opacity hover:opacity-90 focus:ring-2 focus:ring-navy/30 focus:outline-none disabled:cursor-default disabled:opacity-50";
const outlineButtonClassName =
  "cursor-pointer rounded-md border border-navy bg-white font-medium text-navy transition-colors hover:bg-slate-50 focus:ring-2 focus:ring-navy/30 focus:outline-none disabled:cursor-default disabled:opacity-50";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_IMPORT_BYTES = 200 * 1024;

// "2026-10-31" -> "31-10-2026"
function formatDate(date: string) {
  return date.split("-").reverse().join("-");
}

function exportRecords(records: PayslipRecord[], fileName: string) {
  downloadCsv(
    fileName,
    toCsv([
      ["Emp name", "Emp mail", "Date", "Payroll month", "Status", "Error message"],
      ...records.map((record) => [
        record.name,
        record.email,
        formatDate(record.date),
        formatPayMonth(record.month),
        record.status,
        record.error,
      ]),
    ]),
  );
}

// Reads "name,email" rows (a header row is optional), or one email per line.
function parseRecipients(text: string): Recipient[] | string {
  const rows = parseCsv(text.replace(/^﻿/, "")).filter((row) => row.some((cell) => cell.trim()));
  if (rows.length === 0) return "The file is empty.";

  const header = rows[0].map((cell) => cell.trim().toLowerCase());
  const emailIndex = header.findIndex((cell) => cell.includes("mail"));
  const nameIndex = header.findIndex((cell) => cell.includes("name"));
  const hasHeader = emailIndex !== -1;
  const body = hasHeader ? rows.slice(1) : rows;

  const recipients: Recipient[] = [];
  for (const [index, row] of body.entries()) {
    const line = index + (hasHeader ? 2 : 1);
    const cells = row.map((cell) => cell.trim());
    const email = hasHeader ? (cells[emailIndex] ?? "") : (cells.find((cell) => cell.includes("@")) ?? "");
    const name = hasHeader && nameIndex !== -1 ? (cells[nameIndex] ?? "") : cells.find((cell) => cell && cell !== email) ?? "";
    if (!EMAIL_PATTERN.test(email)) return `Row ${line}: "${email || cells.join(", ")}" is not an email address.`;
    recipients.push({ name, email });
  }
  return recipients;
}

function RecordStatus({ status }: { status: PayslipRecord["status"] }) {
  return (
    <span
      className={
        status === "Failed"
          ? "font-medium text-red-600"
          : status === "Sent"
            ? "font-medium text-navy"
            : "text-emerald-700"
      }
    >
      {status}
    </span>
  );
}

interface RecordsTableProps {
  caption: string;
  records: PayslipRecord[];
  selectedIds: string[];
  onSelectedIdsChange: (ids: string[]) => void;
}

function RecordsTable({ caption, records, selectedIds, onSelectedIdsChange }: RecordsTableProps) {
  const isAllSelected = records.length > 0 && records.every(({ id }) => selectedIds.includes(id));

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[760px] border-collapse text-left text-sm">
        <caption className="sr-only">{caption}</caption>
        <thead className="bg-slate-50 text-xs text-black">
          <tr>
            <th scope="col" className="w-10 py-3 pl-5 print:hidden">
              <input
                type="checkbox"
                aria-label={`Select all: ${caption}`}
                checked={isAllSelected}
                onChange={() => onSelectedIdsChange(isAllSelected ? [] : records.map(({ id }) => id))}
                className="size-4 accent-navy"
              />
            </th>
            {["Emp name", "Emp mail", "Date", "Payroll month", "Status", "Error message"].map((column) => (
              <th key={column} scope="col" className="px-3 py-3 font-semibold">
                {column}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="text-black">
          {records.map((record) => (
            <tr key={record.id} className="border-t border-slate-200">
              <td className="py-3 pl-5 print:hidden">
                <input
                  type="checkbox"
                  aria-label={`Select ${record.name}, ${formatPayMonth(record.month)}`}
                  checked={selectedIds.includes(record.id)}
                  onChange={() =>
                    onSelectedIdsChange(
                      selectedIds.includes(record.id)
                        ? selectedIds.filter((id) => id !== record.id)
                        : [...selectedIds, record.id],
                    )
                  }
                  className="size-4 accent-navy"
                />
              </td>
              <th scope="row" className="px-3 py-3 font-normal">
                {record.name}
              </th>
              <td className="px-3 py-3">{record.email || "–"}</td>
              <td className="px-3 py-3 tabular-nums">{formatDate(record.date)}</td>
              <td className="px-3 py-3">{formatPayMonth(record.month)}</td>
              <td className="px-3 py-3">
                <RecordStatus status={record.status} />
              </td>
              <td className="px-3 py-3 text-red-600">{record.error}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

interface PayslipSummaryProps {
  organization: Organization;
  // The month of the current Transaction run, "YYYY-MM".
  currentMonth: string;
  records: PayslipRecord[];
  // `extraCount` is how many added or imported people were included;
  // `template` says whether the locked or a one-off email was used.
  onSendMail: (ids: string[], extraCount: number, template: "locked" | "custom") => void;
}

export default function PayslipSummary({
  organization,
  currentMonth,
  records,
  onSendMail,
}: PayslipSummaryProps) {
  const importInputRef = useRef<HTMLInputElement>(null);

  // ---- Archive: search any month and send with a one-off email ----
  const [nameFilter, setNameFilter] = useState("");
  const [monthFilter, setMonthFilter] = useState("");
  const [archiveSelectedIds, setArchiveSelectedIds] = useState<string[]>([]);
  // Typed here for this send only; never saved.
  const [template, setTemplate] = useState<EmailTemplate>(organization.emailTemplate);
  const [isTemplateOpen, setIsTemplateOpen] = useState(false);
  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [archiveError, setArchiveError] = useState("");

  const archiveRecords = records.filter(
    (record) =>
      record.name.toLowerCase().includes(nameFilter.trim().toLowerCase()) &&
      (!monthFilter || record.month === monthFilter),
  );
  const archiveSelected = archiveRecords.filter(({ id }) => archiveSelectedIds.includes(id));
  const archiveMailIds = archiveSelected.filter(({ email }) => email).map(({ id }) => id);
  const isTemplateComplete =
    EMAIL_PATTERN.test(template.fromEmail.trim()) && template.subject.trim() !== "" && template.message.trim() !== "";
  const archiveRecipientCount = archiveMailIds.length + recipients.length;

  // ---- Current run: send with the locked email format ----
  const [currentSelectedIds, setCurrentSelectedIds] = useState<string[]>([]);
  const currentRecords = records.filter(({ month }) => month === currentMonth);
  const currentSelected = currentRecords.filter(({ id }) => currentSelectedIds.includes(id));
  // Ticked records, or every record of the run when nothing is ticked.
  const currentMailIds = (currentSelected.length ? currentSelected : currentRecords)
    .filter(({ email }) => email)
    .map(({ id }) => id);

  function addRecipients(added: Recipient[]) {
    setRecipients((current) => {
      const known = new Set(current.map(({ email }) => email.toLowerCase()));
      const fresh = added.filter(({ email }) => {
        const key = email.toLowerCase();
        if (known.has(key)) return false;
        known.add(key);
        return true;
      });
      return [...current, ...fresh];
    });
  }

  function handleAddPerson(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    addRecipients([{ name: newName.trim(), email: newEmail.trim() }]);
    setNewName("");
    setNewEmail("");
  }

  // Read in the browser only; nothing is uploaded or stored.
  async function handleImport(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (file.size > MAX_IMPORT_BYTES) {
      setArchiveError("Not imported. The file is larger than 200 KB.");
      return;
    }
    const result = parseRecipients(await file.text());
    if (typeof result === "string") {
      setArchiveError(`Not imported. ${result}`);
      return;
    }
    setArchiveError("");
    addRecipients(result);
  }

  function handleArchiveSend() {
    if (!isTemplateComplete) {
      setIsTemplateOpen(true);
      setArchiveError("Fill in the email template's From email, Subject and Message first.");
      return;
    }
    setArchiveError("");
    onSendMail(archiveMailIds, recipients.length, "custom");
    setArchiveSelectedIds([]);
    setRecipients([]);
  }

  return (
    <div className="flex flex-col gap-4">
      <section aria-labelledby="payslip-archive" className={`${cardClassName} print:hidden`}>
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 pt-4 sm:px-5">
          <h2 id="payslip-archive" className="text-lg font-bold text-navy">
            Payslip Archive
          </h2>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={archiveRecords.length === 0}
              onClick={() => exportRecords(archiveRecords, `${organization.code}-payslip-archive.csv`)}
              className={`${outlineButtonClassName} h-9 px-4 text-sm`}
            >
              Export
            </button>
            <input
              ref={importInputRef}
              type="file"
              accept=".csv,text/csv,text/plain"
              onChange={handleImport}
              className="hidden"
              aria-hidden="true"
              tabIndex={-1}
            />
            <button
              type="button"
              title="Add people from a CSV file with name and email columns"
              onClick={() => importInputRef.current?.click()}
              className={`${outlineButtonClassName} h-9 px-4 text-sm`}
            >
              Import
            </button>
            <button
              type="button"
              aria-expanded={isAddOpen}
              aria-controls="archive-add-people"
              onClick={() => setIsAddOpen((open) => !open)}
              className={`${outlineButtonClassName} h-9 px-4 text-sm`}
            >
              Add people
            </button>
            <button
              type="button"
              aria-expanded={isTemplateOpen}
              aria-controls="archive-template"
              onClick={() => setIsTemplateOpen((open) => !open)}
              className={`${outlineButtonClassName} h-9 px-4 text-sm`}
            >
              Email Template
            </button>
            <button
              type="button"
              disabled={archiveRecipientCount === 0}
              title={archiveRecipientCount === 0 ? "Tick payslips below or add people first" : undefined}
              onClick={handleArchiveSend}
              className={`${solidButtonClassName} h-9 px-4 text-sm`}
            >
              {archiveRecipientCount ? `Send email (${archiveRecipientCount})` : "Send email"}
            </button>
          </div>
        </div>

        <div className="mt-3 grid items-start gap-4 border-t border-slate-200 px-4 py-4 sm:grid-cols-2 sm:px-5">
          <div>
            <label htmlFor="archive-name" className={labelClassName}>
              Name
            </label>
            <input
              id="archive-name"
              type="search"
              value={nameFilter}
              onChange={(event) => setNameFilter(event.target.value)}
              placeholder="e.g. Arun Kumar"
              className={inputClassName}
            />
          </div>
          <div>
            <label htmlFor="archive-month" className={labelClassName}>
              Payslip month
            </label>
            <input
              id="archive-month"
              type="month"
              value={monthFilter}
              onChange={(event) => setMonthFilter(event.target.value)}
              aria-describedby="archive-month-help"
              className={inputClassName}
            />
            <p id="archive-month-help" className={helperClassName}>
              Leave empty for all months
            </p>
          </div>
        </div>

        {archiveError && (
          <p role="alert" className="mx-4 mb-4 rounded border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-700 sm:mx-5">
            {archiveError}
          </p>
        )}

        {isTemplateOpen && (
          <div id="archive-template" className="border-t border-slate-200 px-4 py-4 sm:px-5">
            <h3 className="text-sm font-semibold text-navy">Email for this send</h3>
            <p className={helperClassName}>
              Starts from {organization.name}&rsquo;s email. Changes here are used for this send only and
              aren&rsquo;t saved.
            </p>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <div>
                <label htmlFor="archive-template-from" className={labelClassName}>
                  From Email
                </label>
                <input
                  id="archive-template-from"
                  type="email"
                  required
                  value={template.fromEmail}
                  onChange={(event) => setTemplate((current) => ({ ...current, fromEmail: event.target.value }))}
                  className={inputClassName}
                />
              </div>
              <div>
                <label htmlFor="archive-template-subject" className={labelClassName}>
                  Subject
                </label>
                <input
                  id="archive-template-subject"
                  required
                  maxLength={200}
                  value={template.subject}
                  onChange={(event) => setTemplate((current) => ({ ...current, subject: event.target.value }))}
                  className={inputClassName}
                />
              </div>
            </div>
            <label htmlFor="archive-template-message" className={`${labelClassName} mt-3`}>
              Message
            </label>
            <textarea
              id="archive-template-message"
              required
              rows={6}
              maxLength={5000}
              value={template.message}
              onChange={(event) => setTemplate((current) => ({ ...current, message: event.target.value }))}
              className={`${inputClassName} h-auto resize-y py-2 leading-relaxed`}
            />
            <button
              type="button"
              onClick={() => setTemplate(organization.emailTemplate)}
              className="mt-2 cursor-pointer text-[13px] font-medium text-navy underline underline-offset-2 hover:no-underline"
            >
              Reset to {organization.name}&rsquo;s email
            </button>
          </div>
        )}

        {isAddOpen && (
          <form
            id="archive-add-people"
            onSubmit={handleAddPerson}
            className="grid items-end gap-3 border-t border-slate-200 px-4 py-4 sm:grid-cols-[1fr_1fr_auto] sm:px-5"
          >
            <div>
              <label htmlFor="archive-person-name" className={labelClassName}>
                Name
              </label>
              <input
                id="archive-person-name"
                value={newName}
                onChange={(event) => setNewName(event.target.value)}
                placeholder="e.g. Auditor's office"
                maxLength={150}
                className={inputClassName}
              />
            </div>
            <div>
              <label htmlFor="archive-person-email" className={labelClassName}>
                Email
              </label>
              <input
                id="archive-person-email"
                type="email"
                required
                value={newEmail}
                onChange={(event) => setNewEmail(event.target.value)}
                placeholder="name@company.example"
                maxLength={150}
                className={inputClassName}
              />
            </div>
            <button type="submit" className={`${solidButtonClassName} h-9 px-5 text-sm`}>
              Add
            </button>
          </form>
        )}

        {recipients.length > 0 && (
          <div className="border-t border-slate-200 px-4 py-3 sm:px-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-[13px] font-medium text-black">
                Also sending to {recipients.length} {recipients.length === 1 ? "person" : "people"}
              </p>
              <button
                type="button"
                onClick={() => setRecipients([])}
                className="cursor-pointer text-[13px] font-medium text-red-600 hover:underline"
              >
                Remove all
              </button>
            </div>
            <ul aria-label="Added people" className="mt-2 flex flex-wrap gap-2">
              {recipients.map(({ name, email }) => (
                <li
                  key={email}
                  className="flex items-center gap-1.5 rounded-full bg-slate-100 py-1 pr-1.5 pl-3 text-xs text-black"
                >
                  {name ? `${name} · ${email}` : email}
                  <button
                    type="button"
                    aria-label={`Remove ${email}`}
                    onClick={() => setRecipients((current) => current.filter((entry) => entry.email !== email))}
                    className="flex size-5 cursor-pointer items-center justify-center rounded-full text-black hover:bg-slate-200"
                  >
                    <span aria-hidden="true">×</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        {archiveRecords.length === 0 ? (
          <p className="border-t border-slate-200 px-5 py-10 text-center text-sm text-black">
            {records.length === 0 ? "No payslips yet." : "No payslips match the search."}
          </p>
        ) : (
          <div className="border-t border-slate-200">
            <RecordsTable
              caption="Payslip archive"
              records={archiveRecords}
              selectedIds={archiveSelectedIds}
              onSelectedIdsChange={setArchiveSelectedIds}
            />
          </div>
        )}
      </section>

      <section aria-labelledby="payslip-records" className={cardClassName}>
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-5">
          <div>
            <h2 id="payslip-records" className="text-lg font-bold text-navy">
              Payslip records
            </h2>
            <p className={helperClassName}>Current run · {formatPayMonth(currentMonth)}</p>
          </div>
          <div className="flex flex-wrap gap-2 print:hidden">
            <button
              type="button"
              disabled={currentRecords.length === 0}
              onClick={() => window.print()}
              className={`${outlineButtonClassName} h-9 px-4 text-sm`}
            >
              Print
            </button>
            <button
              type="button"
              disabled={currentRecords.length === 0}
              onClick={() =>
                exportRecords(
                  currentSelected.length ? currentSelected : currentRecords,
                  `${organization.code}-payslip-records.csv`,
                )
              }
              className={`${outlineButtonClassName} h-9 px-4 text-sm`}
            >
              {currentSelected.length ? `Export ${currentSelected.length} selected` : "Export"}
            </button>
            <button
              type="button"
              disabled={!organization.isEmailLocked || currentMailIds.length === 0}
              title={
                organization.isEmailLocked
                  ? "Sends with the locked email format. Emails are not actually sent in this prototype."
                  : "Lock the email format in Organization Setup first"
              }
              onClick={() => {
                onSendMail(currentMailIds, 0, "locked");
                setCurrentSelectedIds([]);
              }}
              className={`${solidButtonClassName} h-9 px-4 text-sm`}
            >
              {currentSelected.length ? `Send email to ${currentMailIds.length} selected` : "Send email"}
            </button>
          </div>
        </div>
        {!organization.isEmailLocked && currentRecords.length > 0 && (
          <p className="mx-4 mb-3 text-sm text-black sm:mx-5 print:hidden">
            Lock the email format in Organization Setup to send these with it.
          </p>
        )}

        {currentRecords.length === 0 ? (
          <p className="border-t border-slate-200 px-5 py-10 text-center text-sm text-black">
            No payslips for this run yet. Validate and generate them on the Transaction page.
          </p>
        ) : (
          <RecordsTable
            caption={`Payslip records, ${formatPayMonth(currentMonth)}`}
            records={currentRecords}
            selectedIds={currentSelectedIds}
            onSelectedIdsChange={setCurrentSelectedIds}
          />
        )}
      </section>
    </div>
  );
}
