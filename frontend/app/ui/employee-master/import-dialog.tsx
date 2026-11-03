"use client";

import { useEffect, useRef, type SubmitEvent } from "react";

interface ImportDialogProps {
  onImport: () => void;
  onClose: () => void;
}

export default function ImportDialog({ onImport, onClose }: ImportDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    dialogRef.current?.showModal();
  }, []);

  // TODO: upload the selected file to the backend import API.
  function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    onImport();
  }

  return (
    <dialog
      ref={dialogRef}
      onClose={onClose}
      aria-labelledby="import-dialog-title"
      className="m-auto w-[calc(100%-2rem)] max-w-[480px] rounded-2xl bg-white p-6 backdrop:bg-black/40"
    >
      <form onSubmit={handleSubmit}>
        <div className="border-b border-slate-200 pb-5">
          <h2 id="import-dialog-title" className="text-xl font-bold text-navy">
            Import employee
          </h2>
          <p className="text-sm text-black">
            Select import format with correct parameters.
          </p>
        </div>

        <fieldset className="border-b border-slate-200 py-5">
          <legend className="sr-only">Import Format</legend>
          <p
            aria-hidden="true"
            className="mb-1.5 text-sm font-medium text-black"
          >
            Import Format
          </p>
          <div className="flex gap-5 text-sm text-black">
            <label className="flex cursor-pointer items-center gap-2">
              <input
                type="radio"
                name="format"
                value="csv"
                defaultChecked
                className="size-4 accent-navy"
              />
              CSV File
            </label>
            <label className="flex cursor-pointer items-center gap-2">
              <input
                type="radio"
                name="format"
                value="xlsx"
                className="size-4 accent-navy"
              />
              Excel (.xlsx)
            </label>
          </div>
        </fieldset>

        <div className="mt-16 flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="h-9 cursor-pointer rounded border border-slate-200 bg-slate-50 px-4 text-sm font-semibold text-navy transition-colors hover:bg-slate-100"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="h-9 cursor-pointer rounded bg-navy px-5 text-sm font-semibold text-white transition-opacity hover:opacity-90"
          >
            Import
          </button>
        </div>
      </form>
    </dialog>
  );
}
