import { useQuery } from "@tanstack/react-query";
import clsx from "clsx";
import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";
import { relTime, STATUS_LABEL } from "../lib/format";
import type { Status } from "../lib/types";
import { caseHref } from "./nav";
import { ErrorState, SkeletonRows } from "./ui";

export interface StaffStats {
  by_status: Record<string, number>;
  total: number;
  open: number;
  resolved: number;
  pending_review: number;
  overdue: number;
  escalated: number;
  at_risk: number;
  breached: number;
  assigned_to_me: number;
  my_capacity: number | null;
  awaiting_citizen: number;
}

export function useStaffStats() {
  return useQuery({ queryKey: ["officer", "stats"], queryFn: () => api<StaffStats>("/officer/stats"), refetchInterval: 60_000 });
}

/** A titled region of a dashboard. Plain section with a rule, not a decorative card. */
export function Panel({ title, description, action, children, className }: { title: string; description?: ReactNode; action?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={clsx("min-w-0 rounded-lg border border-line bg-surface", className)} aria-label={title}>
      <header className="flex flex-wrap items-start justify-between gap-2 border-b border-line px-5 py-3.5">
        <div className="min-w-0">
          <h2 className="text-[15px] font-semibold text-ink">{title}</h2>
          {description && <p className="mt-0.5 text-[13px] text-ink-muted">{description}</p>}
        </div>
        {action}
      </header>
      <div className="px-5 py-4">{children}</div>
    </section>
  );
}

/** Metric strip: numbers with labels, separated by rules (no card per metric). */
export function Metrics({ items }: { items: { label: string; value: ReactNode; hint?: ReactNode; tone?: "critical" | "warning" | "good"; to?: string }[] }) {
  return (
    <dl className="mb-6 grid grid-cols-2 overflow-hidden rounded-lg border border-line bg-surface sm:grid-cols-3 xl:grid-cols-6">
      {items.map((m) => {
        const body = (
          <>
            <dt className="text-[12px] font-medium text-ink-muted">{m.label}</dt>
            <dd
              className={clsx("mt-1 text-[26px] font-semibold leading-none tabular-nums", {
                "text-ink": !m.tone,
                "text-status-critical": m.tone === "critical",
                "text-status-warning": m.tone === "warning",
                "text-status-good": m.tone === "good",
              })}
            >
              {m.value}
            </dd>
            {m.hint && <dd className="mt-1 text-[12px] text-ink-muted">{m.hint}</dd>}
          </>
        );
        return (
          <div key={m.label} className="-mb-px -mr-px border-b border-r border-line">
            {m.to ? (
              <Link to={m.to} className="block h-full px-4 py-4 transition-colors duration-150 hover:bg-canvas focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-brand-500">
                {body}
              </Link>
            ) : (
              <div className="px-4 py-4">{body}</div>
            )}
          </div>
        );
      })}
    </dl>
  );
}

/** Open cases against capacity. The numbers are always written out, not shown by colour alone. */
export function WorkloadBar({ label, open, capacity, sub }: { label: ReactNode; open: number; capacity: number | null | undefined; sub?: ReactNode }) {
  const ratio = capacity ? open / capacity : 0;
  const tone = ratio >= 1 ? "bg-status-critical" : ratio >= 0.8 ? "bg-status-warning" : "bg-brand-600";
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3 text-[13px]">
        <span className="min-w-0 truncate font-medium text-ink">{label}</span>
        <span className="shrink-0 tabular-nums text-ink-soft">
          {open}
          {capacity ? ` of ${capacity}` : ""} open
          {capacity && ratio >= 1 ? " · at capacity" : ""}
        </span>
      </div>
      {capacity ? (
        <div className="mt-1.5 h-1.5 w-full rounded-full bg-black/[0.07]" aria-hidden>
          <div className={clsx("h-full rounded-full", tone)} style={{ width: `${Math.min(100, ratio * 100)}%` }} />
        </div>
      ) : null}
      {sub && <p className="mt-1 text-[12px] text-ink-muted">{sub}</p>}
    </div>
  );
}

interface ActivityItem {
  public_id: string;
  title: string;
  from_status: Status | null;
  to_status: Status;
  actor_type: string;
  actor_label: string;
  created_at: string;
}

export function ActivityFeed({ limit = 10 }: { limit?: number }) {
  const { user } = useAuth();
  const q = useQuery({ queryKey: ["officer", "activity", limit], queryFn: () => api<ActivityItem[]>(`/officer/activity?limit=${limit}`), refetchInterval: 60_000 });
  if (q.isLoading) return <SkeletonRows rows={4} />;
  if (q.isError) return <ErrorState error={q.error} onRetry={() => q.refetch()} />;
  if (!q.data?.length) return <p className="py-4 text-sm text-ink-muted">No status changes yet in your scope.</p>;
  return (
    <ol className="divide-y divide-line">
      {q.data.map((a, i) => (
        <li key={i} className="flex gap-3 py-2.5 text-[13px]">
          <span className={clsx("mt-1.5 h-2 w-2 shrink-0 rounded-full", a.actor_type === "AI_SYSTEM" ? "bg-amber" : "bg-brand-600")} aria-hidden />
          <div className="min-w-0 flex-1">
            <p className="text-ink">
              <Link to={caseHref(user!.role, a.public_id)} className="font-mono text-[12px] font-semibold text-brand-700 hover:underline">
                {a.public_id}
              </Link>{" "}
              {a.from_status ? <>moved from {STATUS_LABEL[a.from_status]} to <strong className="font-semibold">{STATUS_LABEL[a.to_status]}</strong></> : <>was <strong className="font-semibold">{STATUS_LABEL[a.to_status].toLowerCase()}</strong></>}
            </p>
            <p className="truncate text-ink-muted">
              {a.actor_label} · {relTime(a.created_at)}
            </p>
          </div>
        </li>
      ))}
    </ol>
  );
}

/** Horizontal bars for a breakdown (real counts; label and number always shown). */
export function BarList({ rows, empty = "No data in this period." }: { rows: [string, number][]; empty?: string }) {
  if (!rows.length) return <p className="py-2 text-sm text-ink-muted">{empty}</p>;
  const max = Math.max(...rows.map((r) => r[1]), 1);
  return (
    <ul className="space-y-2.5">
      {rows.map(([label, n]) => (
        <li key={label}>
          <div className="flex justify-between gap-3 text-[13px]">
            <span className="min-w-0 truncate text-ink">{label}</span>
            <span className="tabular-nums font-medium text-ink">{n}</span>
          </div>
          <div className="mt-1 h-1.5 rounded-full bg-black/[0.06]" aria-hidden>
            <div className="h-full rounded-full bg-brand-600" style={{ width: `${(n / max) * 100}%` }} />
          </div>
        </li>
      ))}
    </ul>
  );
}
