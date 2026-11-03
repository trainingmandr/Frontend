"use client";

import { useRef, useState, type ChangeEvent } from "react";
import { downloadFile } from "@/app/ui/dashboard/download";
import {
  PAYSLIP_TEMPLATES,
  type Organization,
  type PayslipTemplate,
  type TemplateView,
} from "@/app/ui/organization-setup/organizations";
import PayslipPreview from "@/app/ui/payslip-processor/payslip-preview";
import { samplePayslips } from "@/app/ui/payslip-processor/sample-payslips";

const MAX_FORMAT_BYTES = 100 * 1024;

const inputClassName =
  "w-full rounded border border-slate-300 bg-white px-2.5 text-sm text-black outline-none transition-shadow placeholder:text-slate-400 focus:border-navy focus:ring-2 focus:ring-navy/20 read-only:bg-slate-50 read-only:text-slate-500";
const outlineButtonClassName =
  "h-9 cursor-pointer rounded-md border border-slate-300 bg-white px-5 text-base text-navy transition-colors hover:bg-slate-50 focus:ring-2 focus:ring-navy/30 focus:outline-none disabled:cursor-default disabled:opacity-50 disabled:hover:bg-white";
const solidButtonClassName =
  "h-9 cursor-pointer rounded-md bg-navy px-6 text-base font-medium text-white transition-opacity hover:opacity-90 focus:ring-2 focus:ring-navy/30 focus:outline-none disabled:cursor-default disabled:opacity-50";
const toolbarButtonClassName =
  "h-8 cursor-pointer rounded bg-navy px-3 text-sm font-semibold text-white transition-opacity hover:opacity-90 focus:ring-2 focus:ring-navy/30 focus:outline-none disabled:cursor-default disabled:opacity-50";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// The format file holds only the layout and the email from address, subject
// and content. Files without a from address keep the current one.
function parseFormatFile(
  text: string,
):
  | (Pick<Organization, "payslipTemplate"> & {
      fromEmail?: string;
      subject: string;
      message: string;
    })
  | string {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return "The file is not valid JSON.";
  }
  if (typeof data !== "object" || data === null) return "The file has no format.";

  const { payslipTemplate, fromEmail, subject, message } = data as Record<string, unknown>;
  if (!PAYSLIP_TEMPLATES.includes(payslipTemplate as PayslipTemplate)) {
    return `"payslipTemplate" must be ${PAYSLIP_TEMPLATES.join(" or ")}.`;
  }
  if (
    fromEmail !== undefined &&
    (typeof fromEmail !== "string" || !EMAIL_PATTERN.test(fromEmail.trim()))
  ) {
    return '"fromEmail" must be an email address.';
  }
  if (typeof subject !== "string" || !subject.trim() || subject.length > 200) {
    return '"subject" must be text of up to 200 characters.';
  }
  if (typeof message !== "string" || !message.trim() || message.length > 5000) {
    return '"message" must be text of up to 5,000 characters.';
  }
  return {
    payslipTemplate: payslipTemplate as PayslipTemplate,
    fromEmail: typeof fromEmail === "string" ? fromEmail.trim() : undefined,
    subject: subject.trim(),
    message,
  };
}

interface PayslipFormatProps {
  organization: Organization;
  view: TemplateView;
  onChange: (changes: Partial<Organization>) => void;
  onSaved: (message: string) => void;
}

interface LockButtonsProps {
  name: string;
  isLocked: boolean;
  // Why Lock is unavailable while unlocked, for example unsaved edits.
  lockBlockedReason?: string;
  onLockChange: (isLocked: boolean) => void;
}

function LockButtons({
  name,
  isLocked,
  lockBlockedReason,
  onLockChange,
}: LockButtonsProps) {
  return (
    <>
      <button
        type="button"
        aria-label={`Unlock ${name}`}
        disabled={!isLocked}
        onClick={() => onLockChange(false)}
        className={outlineButtonClassName}
      >
        Unlock
      </button>
      <button
        type="button"
        aria-label={`Lock ${name}`}
        disabled={isLocked || Boolean(lockBlockedReason)}
        title={isLocked ? undefined : lockBlockedReason}
        onClick={() => onLockChange(true)}
        className={solidButtonClassName}
      >
        Lock
      </button>
    </>
  );
}

function EmailFormat({
  organization,
  onChange,
  onSaved,
}: Omit<PayslipFormatProps, "view">) {
  const { emailTemplate, isEmailLocked: isLocked } = organization;
  const [fromEmail, setFromEmail] = useState(emailTemplate.fromEmail);
  const [subject, setSubject] = useState(emailTemplate.subject);
  const [content, setContent] = useState(emailTemplate.message);
  const isDirty =
    fromEmail !== emailTemplate.fromEmail ||
    subject !== emailTemplate.subject ||
    content !== emailTemplate.message;

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        onChange({
          emailTemplate: {
            ...emailTemplate,
            fromEmail: fromEmail.trim(),
            subject: subject.trim(),
            message: content,
          },
        });
        onSaved("Email format saved.");
      }}
      className="px-4 py-4 sm:px-5"
    >
      <label htmlFor="email-from" className="mb-1.5 block text-[13px] text-black">
        From Email
      </label>
      <input
        id="email-from"
        required
        type="email"
        maxLength={150}
        readOnly={isLocked}
        value={fromEmail}
        onChange={(event) => setFromEmail(event.target.value)}
        placeholder="e.g. payroll@company.example"
        className={`${inputClassName} h-9 max-w-2xl`}
      />

      <label
        htmlFor="email-subject"
        className="mt-4 mb-1.5 block text-[13px] text-black"
      >
        Subject
      </label>
      <input
        id="email-subject"
        required
        readOnly={isLocked}
        value={subject}
        onChange={(event) => setSubject(event.target.value)}
        placeholder="e.g. Your payslip for {{pay_period}}"
        className={`${inputClassName} h-9 max-w-2xl`}
      />

      <label
        htmlFor="email-content"
        className="mt-4 mb-1.5 block text-[13px] text-black"
      >
        Content
      </label>
      <textarea
        id="email-content"
        required
        readOnly={isLocked}
        rows={7}
        value={content}
        onChange={(event) => setContent(event.target.value)}
        className={`${inputClassName} resize-y py-2 leading-relaxed`}
      />

      <div className="mt-5 flex flex-wrap items-center justify-end gap-3">
        {isLocked && (
          <p className="mr-auto text-sm text-black">
            The email format is locked. Unlock it to edit.
          </p>
        )}
        <button
          type="button"
          disabled={isLocked || !isDirty}
          onClick={() => {
            setFromEmail(emailTemplate.fromEmail);
            setSubject(emailTemplate.subject);
            setContent(emailTemplate.message);
          }}
          className={outlineButtonClassName}
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={isLocked || !isDirty}
          className={solidButtonClassName}
        >
          Save
        </button>
      </div>
      <div className="mt-3 flex justify-end gap-4 border-t border-slate-200 pt-3">
        <LockButtons
          name="email format"
          isLocked={isLocked}
          lockBlockedReason={isDirty ? "Save or cancel your changes first" : undefined}
          onLockChange={(locked) => {
            onChange({ isEmailLocked: locked });
            onSaved(locked ? "Email format locked." : "Email format unlocked.");
          }}
        />
      </div>
    </form>
  );
}

export default function PayslipFormat({
  organization,
  view,
  onChange,
  onSaved,
}: PayslipFormatProps) {
  const formatInputRef = useRef<HTMLInputElement>(null);
  const [formatError, setFormatError] = useState("");
  const { isPayslipLocked, isEmailLocked } = organization;
  const isViewLocked = view === "payslip" ? isPayslipLocked : isEmailLocked;
  // An imported file replaces both the layout and the email.
  const isImportBlocked = isPayslipLocked || isEmailLocked;

  function handleExport() {
    const format = {
      payslipTemplate: organization.payslipTemplate,
      fromEmail: organization.emailTemplate.fromEmail,
      subject: organization.emailTemplate.subject,
      message: organization.emailTemplate.message,
    };
    downloadFile(
      `${organization.code}-payslip-format.json`,
      JSON.stringify(format, null, 2),
      "application/json",
    );
  }

  async function handleImport(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (file.size > MAX_FORMAT_BYTES) {
      setFormatError("Format not imported. The file is larger than 100 KB.");
      return;
    }

    const result = parseFormatFile(await file.text());
    if (typeof result === "string") {
      setFormatError(`Format not imported. ${result}`);
      return;
    }
    setFormatError("");
    onChange({
      payslipTemplate: result.payslipTemplate,
      emailTemplate: {
        ...organization.emailTemplate,
        fromEmail: result.fromEmail ?? organization.emailTemplate.fromEmail,
        subject: result.subject,
        message: result.message,
      },
    });
    onSaved("Payslip format imported.");
  }

  return (
    <section
      aria-labelledby="selected-format"
      className="overflow-hidden rounded-lg border border-slate-200 bg-white"
    >
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-200 px-4 py-3.5 sm:px-5">
        <div>
          <h2 id="selected-format" className="text-lg font-bold text-navy">
            {view === "payslip" ? "Payslip format" : "Email format"}
          </h2>
          <p className="mt-1 text-[15px] text-black">
            {view === "payslip"
              ? `The layout every ${organization.name} employee receives. Lock it before generating payslips.`
              : `The email every ${organization.name} employee receives. Lock it before sending payslips.`}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={`mr-1 rounded px-2 py-1 text-[11px] font-medium tracking-wide ${
              isViewLocked
                ? "bg-navy text-white"
                : "bg-amber-50 text-amber-800 ring-1 ring-amber-200"
            }`}
          >
            {isViewLocked ? "LOCKED" : "UNLOCKED"}
          </span>
          <input
            ref={formatInputRef}
            type="file"
            accept="application/json,.json"
            onChange={handleImport}
            className="hidden"
            aria-hidden="true"
            tabIndex={-1}
          />
          <button
            type="button"
            disabled={isImportBlocked}
            title={
              isImportBlocked
                ? "Unlock both the payslip and email formats to import one"
                : "Import a format exported from this or another organization"
            }
            onClick={() => formatInputRef.current?.click()}
            className={toolbarButtonClassName}
          >
            Import
          </button>
          <button
            type="button"
            onClick={handleExport}
            className={toolbarButtonClassName}
          >
            Export
          </button>
        </div>
      </div>

      {formatError && (
        <p
          role="alert"
          className="mx-4 mt-4 rounded border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-700 sm:mx-5"
        >
          {formatError}
        </p>
      )}

      {view === "payslip" ? (
        <>
          <div className="flex flex-wrap items-center gap-2 px-4 pt-4 text-sm text-black sm:px-5">
            <label htmlFor="payslip-layout">Layout</label>
            <select
              id="payslip-layout"
              disabled={isPayslipLocked}
              value={organization.payslipTemplate}
              onChange={(event) =>
                onChange({
                  payslipTemplate: event.target.value as PayslipTemplate,
                })
              }
              className="h-8 rounded border border-slate-300 bg-white px-2 text-sm text-navy outline-none focus:border-navy focus:ring-2 focus:ring-navy/20 disabled:bg-slate-50 disabled:text-slate-500"
            >
              {PAYSLIP_TEMPLATES.map((template) => (
                <option key={template}>{template}</option>
              ))}
            </select>
            <span className="text-xs text-black">
              Shown with sample data for {samplePayslips[0].name}
            </span>
          </div>
          <div className="overflow-x-auto px-4 py-4 sm:px-5">
            <PayslipPreview
              organization={organization}
              payslip={samplePayslips[0]}
            />
          </div>
          <div className="flex justify-end gap-4 border-t border-slate-200 px-4 py-3 sm:px-5">
            <LockButtons
              name="payslip format"
              isLocked={isPayslipLocked}
              onLockChange={(locked) => {
                onChange({ isPayslipLocked: locked });
                onSaved(locked ? "Payslip format locked." : "Payslip format unlocked.");
              }}
            />
          </div>
        </>
      ) : (
        <EmailFormat
          key={`${organization.id}-${organization.emailTemplate.fromEmail}-${organization.emailTemplate.subject}-${organization.emailTemplate.message}`}
          organization={organization}
          onChange={onChange}
          onSaved={onSaved}
        />
      )}
    </section>
  );
}
