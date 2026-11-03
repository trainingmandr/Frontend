"use client";

import { useEffect, useRef, useState, type SubmitEvent } from "react";

interface ImportSheetDialogProps {
  sheetName: string;
  onImport: (text: string) => string | null;
  onClose: () => void;
}

const MAX_FILE_BYTES = 1024 * 1024;

export default function ImportSheetDialog({
  sheetName,
  onImport,
  onClose,
}: ImportSheetDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    dialogRef.current?.showModal();
  }, []);

  // The file is read in the browser only; nothing is uploaded yet.
  async function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!file) return;
    if (file.size > MAX_FILE_BYTES) {
      setError("The file is larger than 1 MB.");
      return;
    }
    setError(onImport(await file.text()) ?? "");
  }

  return (
    <dialog
      ref={dialogRef}
      onClose={onClose}
      aria-labelledby="import-sheet-title"
      className="m-auto w-[calc(100%-2rem)] max-w-[480px] rounded-2xl bg-white p-6 backdrop:bg-black/40"
    >
      <form onSubmit={handleSubmit}>
        <div className="border-b border-slate-200 pb-5">
          <h2 id="import-sheet-title" className="text-xl font-bold text-navy">
            Import {sheetName}
          </h2>
          <p className="text-sm text-black">
            Upload a CSV in the same layout as Export. Rows are matched by Emp
            Code; new codes are added.
          </p>
        </div>

        <div className="border-b border-slate-200 py-5">
          <label
            htmlFor="import-sheet-file"
            className="mb-1.5 block text-sm font-medium text-black"
          >
            CSV file
          </label>
          <input
            id="import-sheet-file"
            type="file"
            accept=".csv,text/csv"
            required
            onChange={(event) => {
              setFile(event.target.files?.[0] ?? null);
              setError("");
            }}
            className="block w-full text-sm text-black file:mr-3 file:cursor-pointer file:rounded file:border-0 file:bg-slate-100 file:px-3 file:py-2 file:text-sm file:font-medium file:text-navy hover:file:bg-slate-200"
          />
          {error && (
            <p role="alert" className="mt-3 text-sm font-medium text-red-600">
              {error}
            </p>
          )}
        </div>

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
            disabled={!file}
            className="h-9 cursor-pointer rounded bg-navy px-5 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:cursor-default disabled:opacity-50"
          >
            Import
          </button>
        </div>
      </form>
    </dialog>
  );
}
