/** Regressions found during browser-based visual QA (docs/ui/VISUAL_QA_REPORT.md). */
import { render, screen, within } from "@testing-library/react";
import { HBarChart, TrendChart } from "../components/charts";
import { tokenStore } from "../lib/api";
import Profile from "../pages/Profile";
import { CITIZEN, mockFetch, renderApp, STATUS } from "./helpers";

beforeEach(() => {
  sessionStorage.clear();
  localStorage.clear();
});

describe("charts expose their numbers to assistive technology", () => {
  it("renders a screen-reader table for a bar chart", () => {
    render(<HBarChart data={[{ c: "Potholes", n: 12 }, { c: "Garbage", n: 7 }]} labelKey="c" valueKey="n" name="Open grievances" />);
    const table = screen.getByRole("table", { name: "Open grievances" });
    expect(within(table).getByRole("rowheader", { name: "Potholes" })).toBeInTheDocument();
    expect(within(table).getByText("12")).toBeInTheDocument();
  });

  it("renders a screen-reader table for a trend chart", () => {
    render(<TrendChart data={[{ period: "2026-11-02", filed: 5, resolved: 3 }]} series={[{ key: "filed", label: "Filed" }, { key: "resolved", label: "Resolved" }]} />);
    const table = screen.getByRole("table", { name: "Filed and Resolved by week" });
    expect(within(table).getAllByRole("columnheader").map((h) => h.textContent)).toEqual(["Week", "Filed", "Resolved"]);
  });
});

describe("profile ward picker", () => {
  it("lists wards from /meta/wards by name and locality (was blank options)", async () => {
    tokenStore.set("t");
    mockFetch({
      "/auth/me": { body: { ...CITIZEN, editable_fields: ["full_name", "phone", "preferred_language", "address", "ward", "notification_prefs"],
                            notification_prefs: {}, permissions: [], ward: null } },
      "/meta/status": { body: STATUS },
      "/meta/wards": { body: [{ ward: "Ward 2", locality: "Kasba Peth" }, { ward: "Ward 9", locality: "Indira Nagar" }] },
    });
    renderApp(<Profile />, { route: "/profile" });
    const option = await screen.findByRole("option", { name: "Ward 2 · Kasba Peth" });
    expect(option).toHaveValue("Ward 2");
    expect(screen.getByRole("option", { name: "Ward 9 · Indira Nagar" })).toBeInTheDocument();
  });
});
