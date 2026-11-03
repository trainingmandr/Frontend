"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// Items without an href have no screen yet, so they don't navigate.
export const navItems: { label: string; icon: string; href?: string }[] = [
  {
    label: "Dashboard",
    icon: "M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z",
    href: "/dashboard",
  },
  {
    label: "Organization Setup",
    icon: "M4 4h16v16H4zM9 9h6v6H9z",
    href: "/organization-setup",
  },
  {
    label: "Employee Master",
    icon: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM5 20a7 7 0 0 1 14 0z",
    href: "/employee-master",
  },
  {
    label: "Components",
    icon: "M4 7h16M4 12h16M4 17h16",
    href: "/salary-components",
  },
  {
    label: "Transaction",
    icon: "M12 20V9M7 13l5-6 5 6",
    href: "/transaction",
  },
  {
    label: "Payslip processor",
    icon: "M4 5h16v14H4zM4 10h16M4 15h16",
    href: "/payslip-processor",
  },
];

const itemClassName =
  "flex w-full items-center gap-2 rounded-md px-2 py-2.5 text-left text-[13px] whitespace-nowrap transition-colors";
const inactiveClassName = "text-slate-200 hover:bg-white/10 hover:text-white";

function NavIcon({ path }: { path: string }) {
  return (
    <svg
      aria-hidden="true"
      className="size-4 shrink-0"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2"
      viewBox="0 0 24 24"
    >
      <path d={path} />
    </svg>
  );
}

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="flex w-full shrink-0 flex-col p-2.5 md:sticky md:top-0 md:h-dvh md:w-[214px] print:hidden">
      <div className="rounded-md bg-white px-3 py-3 text-center">
        <p className="font-bold text-navy">Manian &amp; Rao</p>
        <p className="text-xs text-slate-500">Payroll Generator</p>
      </div>

      <nav className="mt-4 flex flex-col gap-1">
        {navItems.map((item) =>
          item.href ? (
            <Link
              key={item.label}
              href={item.href}
              aria-current={pathname === item.href ? "page" : undefined}
              className={`${itemClassName} ${
                pathname === item.href
                  ? "bg-white font-semibold text-navy shadow-sm"
                  : inactiveClassName
              }`}
            >
              <NavIcon path={item.icon} />
              {item.label}
            </Link>
          ) : (
            <button
              key={item.label}
              type="button"
              className={`${itemClassName} cursor-pointer ${inactiveClassName}`}
            >
              <NavIcon path={item.icon} />
              {item.label}
            </button>
          ),
        )}
      </nav>

      <div className="mt-4 flex items-center gap-2 border-t border-white/15 px-2 pt-4 md:mt-auto">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-teal-400 text-sm font-medium text-navy">
          AB
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-white">Admin User</p>
          <p className="truncate text-xs text-slate-300">admin@auditpro</p>
        </div>
        <Link
          href="/"
          aria-label="Log out"
          className="shrink-0 text-slate-200 transition-colors hover:text-white"
        >
          <svg
            aria-hidden="true"
            className="size-4"
            fill="none"
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            viewBox="0 0 24 24"
          >
            <path d="M10 4H4v16h6M14 8l4 4-4 4M18 12H9" />
          </svg>
        </Link>
      </div>
    </aside>
  );
}
