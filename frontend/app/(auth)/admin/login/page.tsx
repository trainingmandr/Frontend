import type { Metadata } from "next";
import Link from "next/link";
import AdminLoginForm from "@/app/ui/login/admin-login-form";

export const metadata: Metadata = {
  title: "Admin Access | Payroll",
};

export default function AdminLoginPage() {
  return (
    <section className="w-full max-w-[480px] rounded-3xl bg-white p-6 shadow-2xl shadow-black/25 sm:p-[50px]">
      <div className="flex size-[60px] items-center justify-center rounded-full bg-slate-100 text-navy">
        <svg
          aria-hidden="true"
          className="size-6"
          fill="none"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="2"
          viewBox="0 0 24 24"
        >
          <rect x="4" y="11" width="16" height="10" rx="2" />
          <path d="M8 11V7a4 4 0 0 1 8 0v4" />
        </svg>
      </div>

      <h2 className="mt-7 text-2xl font-bold text-black">Admin Access</h2>
      <p className="mt-1 text-black">
        Enter your email and password to continue.
      </p>

      <AdminLoginForm />

      <Link
        href="/"
        className="mt-6 inline-flex items-center gap-2 font-medium text-black transition-colors hover:text-navy"
      >
        <svg
          aria-hidden="true"
          className="size-5"
          fill="none"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="2"
          viewBox="0 0 24 24"
        >
          <path d="M19 12H5M11 6l-6 6 6 6" />
        </svg>
        Back to workspace selection
      </Link>
    </section>
  );
}
