import type { Status, Urgency } from "./types";

export function fmtDate(iso: string | null | undefined, withTime = true): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleString("en-IN", withTime ? { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" } : { day: "2-digit", month: "short", year: "numeric" });
}

export function relTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  const abs = Math.abs(diff);
  const units: [number, string][] = [[86400, "day"], [3600, "hour"], [60, "minute"]];
  for (const [s, name] of units) {
    if (abs >= s) {
      const n = Math.round(abs / s);
      return diff >= 0 ? `${n} ${name}${n > 1 ? "s" : ""} ago` : `in ${n} ${name}${n > 1 ? "s" : ""}`;
    }
  }
  return "just now";
}

export function hoursLabel(h: number | null | undefined): string {
  if (h === null || h === undefined) return "—";
  const abs = Math.abs(h);
  const txt = abs >= 48 ? `${Math.round(abs / 24)} d` : abs >= 1 ? `${Math.round(abs)} h` : `${Math.round(abs * 60)} min`;
  return h < 0 ? `${txt} overdue` : `${txt} left`;
}

export const pct = (v: number | null | undefined, digits = 0) => (v === null || v === undefined ? "—" : `${(v * 100).toFixed(digits)}%`);

export const STATUS_LABEL: Record<Status, string> = {
  SUBMITTED: "Submitted",
  PENDING_REVIEW: "Under review",
  ASSIGNED: "Assigned",
  IN_PROGRESS: "In progress",
  RESOLVED: "Resolved",
  CLOSED: "Closed",
  REOPENED: "Reopened",
};

export const URGENCY_ORDER: Urgency[] = ["low", "medium", "high", "critical"];

export function titleCase(s: string): string {
  return s.replace(/[_.]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}
