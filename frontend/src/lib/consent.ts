/** Consent + privacy-preserving first-party analytics.
 *
 * Essential storage only (session token in sessionStorage, language in localStorage) needs no consent.
 * Page-view analytics are OFF until the visitor accepts. When on, the app sends only a normalised route
 * pattern (IDs stripped) to our own backend — no cookies, no third parties, no user or device identifiers. */
import { apiBase } from "./api";

const KEY = "grievance.consent.v1";
export type Consent = "accepted" | "declined" | null;

export function getConsent(): Consent {
  try {
    const v = localStorage.getItem(KEY);
    return v === "accepted" || v === "declined" ? v : null;
  } catch {
    return null;
  }
}

export function setConsent(v: Exclude<Consent, null>) {
  try {
    localStorage.setItem(KEY, v);
  } catch {
    /* storage blocked: banner will reappear next visit */
  }
  window.dispatchEvent(new CustomEvent("grievance:consent", { detail: v }));
}

/** /officer/grievances/GRV-2026-123456 -> /officer/grievances/:id */
export function normalisePath(path: string): string {
  return (
    path
      .split("?")[0]
      .replace(/\/(GRV|SYN|HIS)-[A-Z0-9-]+/gi, "/:id")
      .replace(/\/share\/trace\/[^/]+/, "/share/trace/:token")
      .replace(/\/observability\/[0-9a-f]{16,}/i, "/observability/:trace")
      .replace(/\/\d+(?=\/|$)/g, "/:n") || "/"
  );
}

let last = "";
export function trackPageView(pathname: string) {
  if (getConsent() !== "accepted") return;
  const path = normalisePath(pathname);
  if (path === last) return;
  last = path;
  const body = JSON.stringify({ path });
  try {
    if (navigator.sendBeacon) {
      navigator.sendBeacon(`${apiBase}/meta/pageview`, new Blob([body], { type: "application/json" }));
      return;
    }
  } catch {
    /* fall through */
  }
  void fetch(`${apiBase}/meta/pageview`, { method: "POST", headers: { "Content-Type": "application/json" }, body, keepalive: true }).catch(() => undefined);
}
