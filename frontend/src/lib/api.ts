/** Thin typed fetch wrapper around the GRIEVANCE REST API. */
const BASE = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/$/, "") || "http://localhost:8000/api/v1";
const TOKEN_KEY = "grievance.token";

export class ApiError extends Error {
  status: number;
  code?: string;
  fields?: { field: string; message: string }[];
  constructor(status: number, message: string, code?: string, fields?: { field: string; message: string }[]) {
    super(message);
    this.status = status;
    this.code = code;
    this.fields = fields;
  }
}

export const tokenStore = {
  get(): string | null {
    try {
      return sessionStorage.getItem(TOKEN_KEY);
    } catch {
      return null;
    }
  },
  set(token: string | null) {
    try {
      if (token) sessionStorage.setItem(TOKEN_KEY, token);
      else sessionStorage.removeItem(TOKEN_KEY);
    } catch {
      /* storage unavailable: session-only auth */
    }
  },
};

let onUnauthorized: (() => void) | null = null;
export function setUnauthorizedHandler(fn: () => void) {
  onUnauthorized = fn;
}

type Options = { method?: string; body?: unknown; form?: FormData; auth?: boolean; signal?: AbortSignal };

export async function api<T = unknown>(path: string, opts: Options = {}): Promise<T> {
  const headers: Record<string, string> = {};
  const token = tokenStore.get();
  if (token && opts.auth !== false) headers.Authorization = `Bearer ${token}`;
  let body: BodyInit | undefined;
  if (opts.form) body = opts.form;
  else if (opts.body !== undefined) {
    headers["Content-Type"] = "application/json";
    body = JSON.stringify(opts.body);
  }
  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, { method: opts.method ?? (body ? "POST" : "GET"), headers, body, signal: opts.signal });
  } catch {
    throw new ApiError(0, "Cannot reach the GRIEVANCE server. Check that the backend is running.");
  }
  if (res.status === 204) return undefined as T;
  let data: unknown = null;
  const text = await res.text();
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = { detail: text };
    }
  }
  if (!res.ok) {
    const d = (data ?? {}) as { detail?: unknown; error?: string; fields?: { field: string; message: string }[] };
    if (res.status === 401 && token) onUnauthorized?.();
    const message =
      typeof d.detail === "string"
        ? d.detail
        : Array.isArray(d.fields) && d.fields.length
          ? d.fields.map((f) => `${f.field}: ${f.message}`).join("; ")
          : `Request failed (${res.status})`;
    throw new ApiError(res.status, message, d.error, d.fields);
  }
  return data as T;
}

export const apiBase = BASE;
