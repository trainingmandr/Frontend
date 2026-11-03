"use client";

import { useEffect } from "react";

const TOAST_DURATION_MS = 4000;

interface ToastProps {
  message: string;
  onDismiss: () => void;
}

export default function Toast({ message, onDismiss }: ToastProps) {
  useEffect(() => {
    const timeout = setTimeout(onDismiss, TOAST_DURATION_MS);
    return () => clearTimeout(timeout);
  }, [onDismiss]);

  return (
    <div
      role="status"
      className="fixed right-4 bottom-10 z-40 print:hidden w-[min(320px,calc(100%-2rem))] rounded-lg border border-emerald-500 bg-emerald-50 p-4 shadow-lg"
    >
      <div className="flex gap-3 border-l-4 border-emerald-700 pl-3">
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-emerald-700">Success</p>
          <p className="mt-1 text-sm text-black">{message}</p>
        </div>
        <button
          type="button"
          aria-label="Dismiss notification"
          onClick={onDismiss}
          className="size-5 shrink-0 cursor-pointer text-black hover:text-navy"
        >
          ×
        </button>
      </div>
    </div>
  );
}
