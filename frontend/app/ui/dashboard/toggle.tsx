"use client";

interface ToggleProps {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}

export default function Toggle({ label, checked, onChange }: ToggleProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className="group flex cursor-pointer items-center gap-2.5 rounded-full focus:outline-none"
    >
      <span
        aria-hidden="true"
        className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors group-focus-visible:ring-2 group-focus-visible:ring-navy/30 group-focus-visible:ring-offset-2 ${
          checked ? "bg-navy" : "bg-slate-300"
        }`}
      >
        <span
          className={`size-5 rounded-full bg-white shadow transition-transform ${
            checked ? "translate-x-[22px]" : "translate-x-0.5"
          }`}
        />
      </span>
      <span
        aria-hidden="true"
        className={`w-7 text-left text-sm ${checked ? "text-navy" : "text-black"}`}
      >
        {checked ? "On" : "Off"}
      </span>
    </button>
  );
}
