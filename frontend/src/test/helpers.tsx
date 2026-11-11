import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render } from "@testing-library/react";
import type { ReactNode } from "react";
import { MemoryRouter } from "react-router-dom";
import { ToastProvider } from "../components/Toast";
import { AuthProvider } from "../lib/auth";
import { I18nProvider } from "../lib/i18n";

type Handler = (url: string, init?: RequestInit) => { status?: number; body?: unknown } | undefined;

/** Install a fetch mock that routes by URL substring. Returns the recorded calls. */
export function mockFetch(routes: Record<string, Handler | { status?: number; body?: unknown }>) {
  const calls: { url: string; init?: RequestInit }[] = [];
  globalThis.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    calls.push({ url, init });
    const key = Object.keys(routes)
      .sort((a, b) => b.length - a.length)
      .find((k) => url.includes(k));
    const r = key ? routes[key] : undefined;
    const res = typeof r === "function" ? r(url, init) : r;
    if (!res) return new Response(JSON.stringify({ detail: "not mocked" }), { status: 404 });
    return new Response(res.body === undefined ? null : JSON.stringify(res.body), { status: res.status ?? 200 });
  }) as typeof fetch;
  return calls;
}

export function renderApp(ui: ReactNode, { route = "/" } = {}) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={[route]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <I18nProvider>
          <AuthProvider>
            <ToastProvider>{ui}</ToastProvider>
          </AuthProvider>
        </I18nProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

export const CITIZEN = { id: 1, email: "c@example.org", full_name: "Test Citizen", role: "citizen", preferred_language: "en" };
export const STATUS = {
  app: "GRIEVANCE",
  llm: { mode: "fallback", chain: ["deterministic-rules"], groq: { configured: false, model: "m" }, gemini: { configured: false, model: "m" } },
  embeddings: { provider: "hashing-ngram-384" },
  speech_to_text: { available: false, model: "small" },
  database: { engine: "sqlite" },
  data_sources: { grievances: { SYNTHETIC: 10 }, category_master: ["SYNTHETIC"] },
  synthetic_data_in_use: true,
  langfuse: { enabled: false },
};
