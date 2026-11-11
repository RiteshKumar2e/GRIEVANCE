import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Link } from "react-router-dom";
import { ConfidenceMeter, SensitiveBadge, SlaIndicator, SourceBadge, StatusBadge, UrgencyBadge } from "../../components/domain";
import { IconSearch } from "../../components/icons";
import { EmptyState, ErrorState, Input, PageHeader, Select, SkeletonRows, StatTile } from "../../components/ui";
import { api } from "../../lib/api";
import { useAuth } from "../../lib/auth";
import { relTime, STATUS_LABEL } from "../../lib/format";
import type { CategoryMeta, GrievanceSummary, Status } from "../../lib/types";

type Scope = "mine" | "department" | "review";

const COPY: Record<Scope, { title: string; subtitle: string }> = {
  mine: { title: "My queue", subtitle: "Grievances assigned to you, ordered by escalation, urgency and SLA deadline." },
  review: { title: "Human review queue", subtitle: "Sensitive, low-confidence or flagged grievances. The AI cannot assign or close these — your decision is required." },
  department: { title: "Department grievances", subtitle: "Every active grievance you are authorised to see." },
};

interface Stats {
  open: number;
  pending_review: number;
  overdue: number;
  escalated: number;
  assigned_to_me: number;
  awaiting_citizen: number;
}

export default function OfficerQueue({ scope }: { scope: Scope }) {
  const { user } = useAuth();
  const effectiveScope = user?.role === "admin" && scope === "mine" ? "department" : scope;
  const [filters, setFilters] = useState({ status: "", urgency: "", category: "", sla_state: "", q: "" });
  const params = new URLSearchParams({ scope: effectiveScope === "department" && user?.role === "admin" ? "all" : effectiveScope });
  Object.entries(filters).forEach(([k, v]) => v && params.set(k, v));
  const q = useQuery({ queryKey: ["officer", "queue", params.toString()], queryFn: () => api<GrievanceSummary[]>(`/officer/queue?${params}`), refetchInterval: 60_000 });
  const stats = useQuery({ queryKey: ["officer", "stats"], queryFn: () => api<Stats>("/officer/stats"), refetchInterval: 60_000 });
  const cats = useQuery({ queryKey: ["meta", "categories"], queryFn: () => api<CategoryMeta[]>("/meta/categories") });
  const set = (k: keyof typeof filters) => (e: { target: { value: string } }) => setFilters((f) => ({ ...f, [k]: e.target.value }));
  const copy = COPY[scope];

  return (
    <div>
      <PageHeader title={user?.role === "admin" && scope === "department" ? "All grievances" : copy.title} subtitle={copy.subtitle} />
      {stats.data && (
        <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
          {user?.role === "officer" && <StatTile label="Assigned to me" value={stats.data.assigned_to_me} />}
          <StatTile label="Open (visible)" value={stats.data.open} />
          <StatTile label="Awaiting review" value={stats.data.pending_review} tone={stats.data.pending_review ? "warning" : undefined} />
          <StatTile label="SLA overdue" value={stats.data.overdue} tone={stats.data.overdue ? "critical" : undefined} />
          <StatTile label="Escalated" value={stats.data.escalated} tone={stats.data.escalated ? "warning" : undefined} />
          <StatTile label="Awaiting citizen" value={stats.data.awaiting_citizen} />
        </div>
      )}

      <div className="mb-4 grid gap-2 rounded-lg border border-line bg-surface p-3 sm:grid-cols-2 lg:grid-cols-[1.4fr_repeat(4,1fr)]">
        <label className="relative">
          <span className="sr-only">Search</span>
          <IconSearch width={16} height={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted" />
          <Input className="pl-9" placeholder="Search ID, title, location" value={filters.q} onChange={set("q")} />
        </label>
        {scope !== "review" && (
          <Select aria-label="Status" value={filters.status} onChange={set("status")}>
            <option value="">All active statuses</option>
            {(Object.keys(STATUS_LABEL) as Status[]).map((s) => (
              <option key={s} value={s}>{STATUS_LABEL[s]}</option>
            ))}
          </Select>
        )}
        <Select aria-label="Urgency" value={filters.urgency} onChange={set("urgency")}>
          <option value="">Any urgency</option>
          {["critical", "high", "medium", "low"].map((u) => <option key={u} value={u}>{u}</option>)}
        </Select>
        <Select aria-label="Category" value={filters.category} onChange={set("category")}>
          <option value="">All categories</option>
          {cats.data?.map((c) => <option key={c.code} value={c.code}>{c.name_en}</option>)}
        </Select>
        <Select aria-label="SLA state" value={filters.sla_state} onChange={set("sla_state")}>
          <option value="">Any SLA state</option>
          <option value="on_track">On track</option>
          <option value="at_risk">At risk</option>
          <option value="breached">Breached</option>
        </Select>
      </div>

      {q.isLoading && <SkeletonRows rows={6} />}
      {q.isError && <ErrorState error={q.error} onRetry={() => q.refetch()} />}
      {q.data?.length === 0 && (
        <EmptyState title={scope === "review" ? "Nothing awaiting review" : "No grievances match"} body={scope === "review" ? "Every flagged grievance has a human decision." : "Try clearing the filters."} />
      )}
      {!!q.data?.length && (
        <div className="overflow-x-auto rounded-lg border border-line bg-surface">
          <table className="w-full min-w-[880px] text-sm">
            <thead className="border-b border-line text-left text-[12px] uppercase tracking-[0.06em] text-ink-muted">
              <tr>
                <th className="px-4 py-2.5 font-semibold">Grievance</th>
                <th className="px-3 py-2.5 font-semibold">Status</th>
                <th className="px-3 py-2.5 font-semibold">Urgency</th>
                <th className="px-3 py-2.5 font-semibold">AI confidence</th>
                <th className="px-3 py-2.5 font-semibold">SLA</th>
                <th className="px-3 py-2.5 font-semibold">Officer</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {q.data.map((g) => (
                <tr key={g.public_id} className="hover:bg-black/[0.02]">
                  <td className="max-w-md px-4 py-3">
                    <Link to={`/officer/grievances/${g.public_id}`} className="group block">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="font-mono text-xs text-ink-muted">{g.public_id}</span>
                        {g.is_sensitive && <SensitiveBadge />}
                        {g.escalation_level > 0 && (
                          <span className="inline-flex items-center gap-0.5 text-xs font-semibold text-orange-800">
                            Escalated L{g.escalation_level}
                          </span>
                        )}
                        {g.duplicate_group && (
                          <span className="inline-flex items-center gap-0.5 text-xs text-brand-700" title={`Linked group ${g.duplicate_group}`}>
                            Linked
                          </span>
                        )}
                        <SourceBadge source={g.data_source} />
                      </div>
                      <p className="mt-0.5 truncate font-medium text-ink group-hover:text-brand-800 group-hover:underline">{g.title}</p>
                      <p className="truncate text-xs text-ink-muted">
                        {g.category?.name_en} · {g.ward ?? "ward unknown"} · {relTime(g.created_at)}
                      </p>
                    </Link>
                  </td>
                  <td className="px-3 py-3"><StatusBadge status={g.status} /></td>
                  <td className="px-3 py-3"><UrgencyBadge urgency={g.urgency} /></td>
                  <td className="px-3 py-3"><ConfidenceMeter value={g.ai_confidence} /></td>
                  <td className="px-3 py-3"><SlaIndicator sla={g.sla} compact closed={g.status === "RESOLVED"} /></td>
                  <td className="px-3 py-3 text-xs text-ink-soft">{g.assigned_officer?.name ?? <span className="text-ink-muted">Unassigned</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
