// Low-level HTTP client for the Payroll backend: base URL, JWT header, errors, uploads, downloads.
// Use from client components ("use client") - the token lives in localStorage.

export const API_URL = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000").replace(/\/$/, "") + "/api/v1";

const TOKEN_KEY = "payroll_token";

export const tokenStore = {
  get(): string | null {
    if (typeof window === "undefined") return null;
    try {
      return window.localStorage.getItem(TOKEN_KEY);
    } catch {
      return null;
    }
  },
  set(token: string) {
    try {
      window.localStorage.setItem(TOKEN_KEY, token);
    } catch {
      /* private mode: token only lasts for this page */
    }
  },
  clear() {
    try {
      window.localStorage.removeItem(TOKEN_KEY);
    } catch {
      /* ignore */
    }
  },
};

/** Called on 401 (expired / missing token). Replace with your router push if you prefer. */
let onUnauthorized: () => void = () => {
  if (typeof window !== "undefined" && !window.location.pathname.startsWith("/admin/login")) {
    window.location.href = "/admin/login";
  }
};
export function setUnauthorizedHandler(handler: () => void) {
  onUnauthorized = handler;
}

/**
 * Error thrown for any non-2xx response. `messages` is always a flat list of human-readable strings,
 * whatever shape FastAPI's `detail` had:
 *   - "Employee 'EMP-001' already exists"                     (409 / 404 / 403)
 *   - [{loc: ["body","pan_no"], msg: "String should match…"}]  (422 field validation)
 *   - [{emp_code, comp_code, message}]                         (422 transaction entry errors)
 *   - ["EMP-001: deductions exceed earnings"]                  (422 payroll processing)
 */
export class ApiError extends Error {
  constructor(
    public status: number,
    public detail: unknown,
    public messages: string[],
  ) {
    super(messages.join("\n") || `Request failed (${status})`);
  }

  /** Field-level errors keyed by field name ("pan_no", "bank.ifsc_code") for showing under form inputs. */
  get fieldErrors(): Record<string, string> {
    const result: Record<string, string> = {};
    if (Array.isArray(this.detail)) {
      for (const item of this.detail) {
        if (item && typeof item === "object" && Array.isArray((item as { loc?: unknown }).loc)) {
          const loc = ((item as { loc: (string | number)[] }).loc).filter((p) => p !== "body" && p !== "query");
          result[loc.join(".") || "_"] = String((item as { msg?: unknown }).msg ?? "");
        }
      }
    }
    return result;
  }
}

function toMessages(detail: unknown): string[] {
  if (detail == null) return [];
  if (typeof detail === "string") return [detail];
  if (Array.isArray(detail)) {
    return detail.map((item) => {
      if (typeof item === "string") return item;
      if (item && typeof item === "object") {
        const o = item as Record<string, unknown>;
        if (Array.isArray(o.loc)) {
          const field = o.loc.filter((p) => p !== "body" && p !== "query").join(".");
          return field ? `${field}: ${o.msg}` : String(o.msg);
        }
        if (typeof o.message === "string") {
          const where = [o.emp_code, o.comp_code].filter(Boolean).join(" / ");
          return where ? `${where}: ${o.message}` : o.message;
        }
      }
      return JSON.stringify(item);
    });
  }
  return [JSON.stringify(detail)];
}

export type Query = Record<string, string | number | boolean | string[] | null | undefined>;

export function buildUrl(path: string, query?: Query): string {
  const url = new URL(API_URL + path);
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value === undefined || value === null || value === "") continue;
    // Arrays become repeated keys: emp_codes=A&emp_codes=B
    if (Array.isArray(value)) value.forEach((v) => url.searchParams.append(key, v));
    else url.searchParams.set(key, String(value));
  }
  return url.toString();
}

async function send(method: string, path: string, init: { query?: Query; json?: unknown; form?: FormData } = {}) {
  const headers: Record<string, string> = {};
  const token = tokenStore.get();
  if (token) headers.Authorization = `Bearer ${token}`;
  let body: BodyInit | undefined;
  if (init.json !== undefined) {
    headers["Content-Type"] = "application/json";
    body = JSON.stringify(init.json);
  } else if (init.form) {
    body = init.form; // browser sets the multipart boundary
  }

  let response: Response;
  try {
    response = await fetch(buildUrl(path, init.query), { method, headers, body });
  } catch {
    throw new ApiError(0, null, ["Cannot reach the server. Is the backend running?"]);
  }

  if (!response.ok) {
    let detail: unknown = null;
    try {
      detail = (await response.json()).detail;
    } catch {
      /* non-JSON error */
    }
    if (response.status === 401) {
      tokenStore.clear();
      onUnauthorized();
    }
    throw new ApiError(response.status, detail, toMessages(detail));
  }
  return response;
}

export async function request<T>(method: string, path: string, init: { query?: Query; json?: unknown } = {}): Promise<T> {
  const response = await send(method, path, init);
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

export const http = {
  get: <T>(path: string, query?: Query) => request<T>("GET", path, { query }),
  post: <T>(path: string, json?: unknown, query?: Query) => request<T>("POST", path, { json, query }),
  put: <T>(path: string, json?: unknown) => request<T>("PUT", path, { json }),
  patch: <T>(path: string, json?: unknown) => request<T>("PATCH", path, { json }),
  delete: <T = void>(path: string) => request<T>("DELETE", path),
};

/** Multipart upload of a single file in the `file` field (Excel / CSV imports). */
export async function upload<T>(path: string, file: File | Blob, query?: Query, filename?: string): Promise<T> {
  const form = new FormData();
  form.append("file", file, filename ?? (file instanceof File ? file.name : "upload.xlsx"));
  const response = await send("POST", path, { form, query });
  return (await response.json()) as T;
}

function filenameFrom(response: Response, fallback: string): string {
  const header = response.headers.get("Content-Disposition") ?? "";
  const match = /filename\*?=(?:UTF-8'')?"?([^";]+)"?/i.exec(header);
  return match ? decodeURIComponent(match[1]) : fallback;
}

/**
 * Download a file from an authenticated endpoint and save it in the browser.
 * (A plain <a href> cannot send the Authorization header.)
 */
export async function download(path: string, query?: Query, fallbackName = "download"): Promise<void> {
  const response = await send("GET", path, { query });
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filenameFrom(response, fallbackName);
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Fetch an authenticated endpoint as text (e.g. payslip HTML for an <iframe srcDoc>). */
export async function fetchText(path: string, query?: Query): Promise<string> {
  const response = await send("GET", path, { query });
  return response.text();
}
