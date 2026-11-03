"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type SubmitEvent } from "react";
import {
  LoadingScreen,
  LOADING_ANIMATION_MS,
} from "@/app/ui/login/loading-screen";
import { api, ApiError } from "@/lib/api";

const inputClassName =
  "h-[60px] w-full rounded-lg border border-slate-300 bg-white px-4 text-black outline-none transition-shadow placeholder:text-slate-400 focus:border-navy focus:ring-2 focus:ring-navy/20";

export default function AdminLoginForm() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const formRef = useRef<HTMLFormElement>(null);

  // Next keeps this page mounted while hidden, so clear it on the way out or
  // the loader and typed password come back with it.
  useEffect(() => {
    const form = formRef.current;
    return () => {
      form?.reset();
      setIsLoading(false);
      setError("");
    };
  }, []);

  async function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);

    // The backend checks the password and returns a session token, which
    // the API client keeps for later calls.
    try {
      await api.auth.login(String(formData.get("email")), String(formData.get("password")));
    } catch (caught) {
      setError(
        caught instanceof ApiError && (caught.status === 401 || caught.status === 422)
          ? "Invalid email or password."
          : caught instanceof ApiError && caught.status !== 0
            ? caught.message
            : "Cannot reach the payroll server. Is the backend running?",
      );
      return;
    }

    setError("");
    setIsLoading(true);
    await new Promise((resolve) => setTimeout(resolve, LOADING_ANIMATION_MS));
    router.replace("/dashboard");
  }

  return (
    <form ref={formRef} onSubmit={handleSubmit} className="mt-8">
      {isLoading && <LoadingScreen />}

      <label htmlFor="email" className="mb-2 block font-medium text-black">
        Email
      </label>
      <input
        id="email"
        name="email"
        type="email"
        autoComplete="email"
        placeholder="Enter your email"
        required
        autoFocus
        className={inputClassName}
      />

      <label
        htmlFor="password"
        className="mt-5 mb-2 block font-medium text-black"
      >
        Password
      </label>
      <input
        id="password"
        name="password"
        type="password"
        autoComplete="current-password"
        placeholder="Enter your password"
        required
        className={inputClassName}
      />

      {error && (
        <p role="alert" className="mt-3 text-sm font-medium text-red-600">
          {error}
        </p>
      )}

      <button
        type="submit"
        className="mt-5 h-[55px] w-full cursor-pointer rounded-lg bg-navy font-semibold text-white transition-opacity hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-navy"
      >
        Continue
      </button>
    </form>
  );
}
