"use client";

import { useEffect, useRef, useState, type SubmitEvent } from "react";
import type { Organization } from "@/app/ui/organization-setup/organizations";

interface ImportComponentsDialogProps {
  // Other organizations, each with how many components it uses.
  sources: { organization: Organization; count: number }[];
  targetName: string;
  onImport: (organizationId: string) => void;
  onClose: () => void;
}

export default function ImportComponentsDialog({
  sources,
  targetName,
  onImport,
  onClose,
}: ImportComponentsDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [sourceId, setSourceId] = useState(
    sources.find(({ count }) => count > 0)?.organization.id ?? "",
  );

  useEffect(() => {
    dialogRef.current?.showModal();
  }, []);

  function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    if (sourceId) onImport(sourceId);
  }

  return (
    <dialog
      ref={dialogRef}
      onClose={onClose}
      aria-labelledby="import-components-title"
      className="m-auto w-[calc(100%-2rem)] max-w-[480px] rounded-2xl bg-white p-6 backdrop:bg-black/40"
    >
      <form onSubmit={handleSubmit}>
        <div className="border-b border-slate-200 pb-5">
          <h2
            id="import-components-title"
            className="text-xl font-bold text-navy"
          >
            Import components
          </h2>
          <p className="text-sm text-black">
            Copy the components another organization uses into {targetName}.
            Components {targetName} already uses stay turned on.
          </p>
        </div>

        <fieldset className="border-b border-slate-200 py-5">
          <legend className="mb-1.5 text-sm font-medium text-black">
            Copy from
          </legend>
          {sources.length === 0 ? (
            <p className="text-sm text-black">
              There are no other organizations yet.
            </p>
          ) : (
            <div className="flex flex-col gap-2 text-sm text-black">
              {sources.map(({ organization, count }) => (
                <label
                  key={organization.id}
                  className={`flex items-center gap-2 ${
                    count ? "cursor-pointer" : "text-slate-400"
                  }`}
                >
                  <input
                    type="radio"
                    name="source"
                    value={organization.id}
                    checked={sourceId === organization.id}
                    disabled={!count}
                    onChange={() => setSourceId(organization.id)}
                    className="size-4 accent-navy"
                  />
                  {organization.name}
                  <span className="text-xs">
                    ({count} {count === 1 ? "component" : "components"})
                  </span>
                </label>
              ))}
            </div>
          )}
        </fieldset>

        <div className="mt-8 flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="h-9 cursor-pointer rounded border border-slate-200 bg-slate-50 px-4 text-sm font-semibold text-navy transition-colors hover:bg-slate-100"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={!sourceId}
            className="h-9 cursor-pointer rounded bg-navy px-5 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:cursor-default disabled:opacity-50"
          >
            Import
          </button>
        </div>
      </form>
    </dialog>
  );
}
