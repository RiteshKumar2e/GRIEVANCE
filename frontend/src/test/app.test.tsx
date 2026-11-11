import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Route, Routes } from "react-router-dom";
import App from "../App";
import { SlaIndicator, StatusBadge } from "../components/domain";
import { api, ApiError, tokenStore } from "../lib/api";
import { hoursLabel } from "../lib/format";
import NewGrievance from "../pages/citizen/NewGrievance";
import { CITIZEN, mockFetch, renderApp, STATUS } from "./helpers";

beforeEach(() => {
  sessionStorage.clear();
  localStorage.clear();
});

describe("format helpers", () => {
  it("labels remaining and overdue time", () => {
    expect(hoursLabel(5)).toBe("5 h left");
    expect(hoursLabel(-3)).toBe("3 h overdue");
    expect(hoursLabel(72)).toBe("3 d left");
  });
});

describe("api client", () => {
  it("maps validation errors to a readable message", async () => {
    mockFetch({ "/auth/register": { status: 422, body: { error: "validation_error", detail: "Invalid input", fields: [{ field: "email", message: "bad" }] } } });
    await expect(api("/auth/register", { body: {} })).rejects.toMatchObject({ status: 422, code: "validation_error", message: "Invalid input" });
  });
  it("sends the bearer token", async () => {
    tokenStore.set("abc");
    const calls = mockFetch({ "/auth/me": { body: CITIZEN } });
    await api("/auth/me");
    expect((calls[0].init?.headers as Record<string, string>).Authorization).toBe("Bearer abc");
  });
  it("reports an unreachable server", async () => {
    globalThis.fetch = vi.fn(async () => {
      throw new TypeError("network");
    }) as typeof fetch;
    await expect(api("/x")).rejects.toBeInstanceOf(ApiError);
  });
});

describe("domain components", () => {
  it("shows a breached SLA with text, not colour alone", () => {
    renderApp(<SlaIndicator sla={{ due_at: new Date(Date.now() - 3_600_000).toISOString(), sla_hours: 24, state: "on_track", hours_remaining: -1, predicted_resolution_hours: null, breach_probability: null, estimate_label: null }} compact />);
    expect(screen.getByText(/Breached/)).toBeInTheDocument();
  });
  it("renders human-readable statuses", () => {
    renderApp(<StatusBadge status="PENDING_REVIEW" />);
    expect(screen.getByText("Under review")).toBeInTheDocument();
  });
});

describe("routing & role guards", () => {
  it("redirects anonymous users from protected pages to sign-in", async () => {
    mockFetch({ "/meta/status": { body: STATUS } });
    renderApp(<App />, { route: "/admin" });
    expect(await screen.findByRole("heading", { name: "Sign in" })).toBeInTheDocument();
  });
  it("sends a citizen away from admin pages", async () => {
    tokenStore.set("t");
    mockFetch({ "/auth/me": { body: CITIZEN }, "/meta/status": { body: STATUS }, "/citizen/grievances": { body: [] }, "/notifications": { body: { unread: 0, items: [] } } });
    renderApp(<App />, { route: "/admin/audit" });
    expect(await screen.findByText("You have not filed any grievances yet.")).toBeInTheDocument();
  });
});

const DRAFT = {
  draft_token: "tok123",
  expires_at: new Date(Date.now() + 86_400_000).toISOString(),
  trace_id: "t1",
  raw_text: "No water supply in Kasba Peth for 3 days.",
  extraction: {
    language: "en", category_code: "WATER_SUPPLY", category_confidence: 0.82, alternatives: [], urgency: "medium",
    title: "No or irregular water supply", summary: "Water supply disrupted in Kasba Peth.", location_text: "Kasba Peth, Ward 2", ward: "Ward 2",
    key_facts: [], injection_suspected: false, sensitive_signals: [], provider: "deterministic-rules", model: "rules-v1", method: "rules",
    provider_attempts: [{ provider: "groq", status: "skipped" }],
    category: { code: "WATER_SUPPLY", name_en: "No or irregular water supply", is_sensitive: false, hide_identity: false, sla_hours: 48 },
    department: { code: "WATER", name: "Water Supply Department" }, latitude: 18.5, longitude: 73.8,
    policy_preview: { requires_human_review: false, review_reasons: [], is_sensitive: false, hide_identity: false, sla_hours: 48 },
  },
};

describe("citizen conversational intake", () => {
  it("asks follow-ups, then requires explicit confirmation before submitting", async () => {
    tokenStore.set("t");
    let confirmBody: Record<string, unknown> | null = null;
    let turns = 0;
    mockFetch({
      "/auth/me": { body: CITIZEN },
      "/meta/status": { body: STATUS },
      "/meta/categories": { body: [{ code: "WATER_SUPPLY", name_en: "No or irregular water supply", description: "", department_code: "WATER", sla_hours: 48, is_sensitive: false, hide_identity: false, data_source: "SYNTHETIC" }] },
      "/meta/wards": { body: [{ ward: "Ward 2", locality: "Kasba Peth" }] },
      "/citizen/intake/converse": (_u, init) => {
        turns += 1;
        const body = JSON.parse(String(init?.body));
        if (turns === 1) return { body: { reply: "Where exactly is this?", ready: false, language: "en", missing: ["location"], draft: null } };
        expect(body.messages.map((m: { role: string }) => m.role)).toEqual(["user", "assistant", "user"]);
        return { body: { reply: "Thank you. I have prepared a draft.", ready: true, language: "en", missing: [], draft: DRAFT } };
      },
      "/citizen/intake/tok123/confirm": (_u, init) => {
        confirmBody = JSON.parse(String(init?.body));
        return { status: 201, body: { public_id: "GRV-2026-123456" } };
      },
    });
    const user = userEvent.setup();
    renderApp(
      <Routes>
        <Route path="/citizen/new" element={<NewGrievance />} />
        <Route path="/citizen/grievances/:id" element={<p>tracking page</p>} />
      </Routes>,
      { route: "/citizen/new" },
    );
    const box = await screen.findByLabelText("Describe the problem");
    await user.type(box, "No water supply for 3 days.");
    await user.click(screen.getByRole("button", { name: /Send/ }));
    expect(await screen.findByText("Where exactly is this?")).toBeInTheDocument();

    await user.type(screen.getByLabelText("Describe the problem"), "Kasba Peth");
    await user.click(screen.getByRole("button", { name: /Send/ }));
    expect(await screen.findByText("Draft prepared by the assistant")).toBeInTheDocument();
    expect(screen.getByText("Rule-based analysis (no LLM)")).toBeInTheDocument();

    const submit = screen.getByRole("button", { name: /Confirm and submit/ });
    expect(submit).toBeDisabled();
    expect(confirmBody).toBeNull();
    await user.click(screen.getByRole("checkbox"));
    expect(submit).toBeEnabled();
    await user.click(submit);
    await waitFor(() => expect(screen.getByText("tracking page")).toBeInTheDocument());
    expect(confirmBody).toMatchObject({ confirmed: true, category_code: "WATER_SUPPLY", ward: "Ward 2" });
  });
});

describe("password field", () => {
  it("toggles visibility with an accessible button", async () => {
    mockFetch({ "/meta/status": { body: STATUS } });
    const user = userEvent.setup();
    renderApp(<App />, { route: "/login" });
    const pw = await screen.findByLabelText("Password");
    expect(pw).toHaveAttribute("type", "password");
    await user.click(screen.getByRole("button", { name: "Show password" }));
    expect(pw).toHaveAttribute("type", "text");
    await user.click(screen.getByRole("button", { name: "Hide password" }));
    expect(pw).toHaveAttribute("type", "password");
  });
});
