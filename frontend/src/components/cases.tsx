import { useQuery } from "@tanstack/react-query";
import { useMemo, useState, type ReactNode } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";
import { fmtDate, relTime, STATUS_LABEL } from "../lib/format";
import type { CategoryMeta, GrievanceSummary, Status } from "../lib/types";
import { DataTable, type Column } from "./DataTable";
import { SensitiveBadge, SlaIndicator, StatusBadge, UrgencyBadge } from "./domain";
import { IconSearch } from "./icons";
import { caseHref } from "./nav";
import { Input, PageHeader, Select } from "./ui";

const URG_RANK: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };

export function CaseRef({ g }: { g: GrievanceSummary }) {
  const { user } = useAuth();
  return (
    <div className="min-w-0">
      <div className="flex flex-wrap items-center gap-1.5">
        <Link to={caseHref(user!.role, g.public_id)} className="rounded-sm font-mono text-[12px] font-semibold text-brand-700 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-500">
          {g.public_id}
        </Link>
        {g.is_sensitive && <SensitiveBadge />}
        {g.escalation_level > 0 && <span className="text-[11px] font-semibold uppercase tracking-[0.04em] text-status-serious">Escalated L{g.escalation_level}</span>}
        {g.duplicate_group && <span className="text-[11px] font-medium text-brand-700" title={`Linked group ${g.duplicate_group}`}>Linked</span>}
      </div>
      <p className="mt-0.5 line-clamp-2 font-medium text-ink">{g.title}</p>
    </div>
  );
}

function citizenLabel(g: GrievanceSummary): ReactNode {
  if (!g.citizen) return <span className="text-ink-muted">Not recorded</span>;
  if (g.citizen.protected) return <span className="text-ink-muted">Identity protected</span>;
  return (
    <span>
      {g.citizen.name}
      {g.citizen.phone && <span className="block text-[12px] text-ink-muted">{g.citizen.phone}</span>}
    </span>
  );
}

export function caseColumns(opts: { showOfficer?: boolean; showCitizen?: boolean; action?: (g: GrievanceSummary) => ReactNode } = {}): Column<GrievanceSummary>[] {
  const cols: Column<GrievanceSummary>[] = [
    { key: "ref", header: "Grievance", render: (g) => <CaseRef g={g} />, sortValue: (g) => g.public_id, className: "w-[30%]" },
    { key: "category", header: "Category", render: (g) => <span className="text-ink-soft">{g.category?.name_en ?? "Unclassified"}<span className="block text-[12px] text-ink-muted">{g.ward ?? "Ward not given"}</span></span>, sortValue: (g) => g.category?.name_en },
    { key: "urgency", header: "Priority", render: (g) => <UrgencyBadge urgency={g.urgency} />, sortValue: (g) => URG_RANK[g.urgency] },
    { key: "filed", header: "Filed", render: (g) => <span className="whitespace-nowrap text-ink-soft" title={fmtDate(g.created_at)}>{fmtDate(g.created_at, false)}</span>, sortValue: (g) => g.created_at },
    { key: "sla", header: "SLA deadline", render: (g) => <SlaIndicator sla={g.sla} compact closed={g.status === "RESOLVED" || g.status === "CLOSED"} />, sortValue: (g) => g.sla?.due_at ?? null },
    { key: "status", header: "Status", render: (g) => <StatusBadge status={g.status} />, sortValue: (g) => g.status },
  ];
  if (opts.showCitizen) cols.push({ key: "citizen", header: "Citizen", render: citizenLabel });
  if (opts.showOfficer) cols.push({ key: "officer", header: "Officer", render: (g) => g.assigned_officer?.name ?? <span className="text-ink-muted">Unassigned</span>, sortValue: (g) => g.assigned_officer?.name });
  cols.push({ key: "action", header: "Action", render: (g) => (opts.action ? opts.action(g) : <OpenCase g={g} />), align: "right" });
  return cols;
}

export function OpenCase({ g, label = "Open" }: { g: GrievanceSummary; label?: string }) {
  const { user } = useAuth();
  return (
    <Link
      to={caseHref(user!.role, g.public_id)}
      className="inline-flex h-8 items-center rounded-md border border-stone-dark px-3 text-[13px] font-semibold text-ink hover:bg-canvas focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-500"
    >
      {label}
      <span className="sr-only"> {g.public_id}</span>
    </Link>
  );
}

export function CaseCard({ g, action }: { g: GrievanceSummary; action?: ReactNode }) {
  return (
    <div>
      <CaseRef g={g} />
      <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 text-[13px]">
        <div><dt className="text-ink-muted">Status</dt><dd className="mt-0.5"><StatusBadge status={g.status} /></dd></div>
        <div><dt className="text-ink-muted">Priority</dt><dd className="mt-0.5"><UrgencyBadge urgency={g.urgency} /></dd></div>
        <div><dt className="text-ink-muted">Category</dt><dd className="text-ink">{g.category?.name_en ?? "Unclassified"}</dd></div>
        <div><dt className="text-ink-muted">Filed</dt><dd className="text-ink">{relTime(g.created_at)}</dd></div>
        <div className="col-span-2"><dt className="text-ink-muted">SLA</dt><dd><SlaIndicator sla={g.sla} compact closed={g.status === "RESOLVED" || g.status === "CLOSED"} /></dd></div>
      </dl>
      <div className="mt-3">{action ?? <OpenCase g={g} label="Open case" />}</div>
    </div>
  );
}

export interface CaseQuery {
  scope: "mine" | "department" | "review" | "all";
  escalated?: boolean;
  sla_state?: string;
  include_closed?: boolean;
}

export function useCases(query: CaseQuery, extra: Record<string, string> = {}) {
  const params = new URLSearchParams({ scope: query.scope, limit: "500" });
  if (query.escalated !== undefined) params.set("escalated", String(query.escalated));
  if (query.sla_state) params.set("sla_state", query.sla_state);
  if (query.include_closed) params.set("include_closed", "true");
  Object.entries(extra).forEach(([k, v]) => v && params.set(k, v));
  return useQuery({
    queryKey: ["officer", "queue", params.toString()],
    queryFn: () => api<GrievanceSummary[]>(`/officer/queue?${params}`),
    refetchInterval: 60_000,
  });
}

/**
 * A complete case list page: search (also fed by the header search via ?q=), status/priority/category/SLA
 * filters, a filed-date range, sortable columns and pagination.
 */
export function CaseListPage({
  title,
  subtitle,
  query,
  showOfficer = true,
  showCitizen = true,
  allowStatusFilter = true,
  allowClosedToggle = true,
  action,
  empty,
  headerActions,
  intro,
}: {
  title: string;
  subtitle: ReactNode;
  query: CaseQuery;
  showOfficer?: boolean;
  showCitizen?: boolean;
  allowStatusFilter?: boolean;
  allowClosedToggle?: boolean;
  action?: (g: GrievanceSummary) => ReactNode;
  empty: { title: string; body?: string };
  headerActions?: ReactNode;
  intro?: ReactNode;
}) {
  const [search, setSearch] = useSearchParams();
  const [filters, setFilters] = useState({ status: "", urgency: "", category: "", sla_state: "", from: "", to: "", closed: false });
  const q = search.get("q") ?? "";
  const server: Record<string, string> = { q, status: filters.status, urgency: filters.urgency, category: filters.category };
  if (filters.sla_state) server.sla_state = filters.sla_state;
  const cases = useCases({ ...query, include_closed: query.include_closed || filters.closed }, server);
  const cats = useQuery({ queryKey: ["meta", "categories"], queryFn: () => api<CategoryMeta[]>("/meta/categories", { auth: false }) });

  const rows = useMemo(() => {
    const from = filters.from ? new Date(filters.from + "T00:00:00").getTime() : null;
    const to = filters.to ? new Date(filters.to + "T23:59:59").getTime() : null;
    return cases.data?.filter((g) => {
      const t = new Date(g.created_at).getTime();
      return (from === null || t >= from) && (to === null || t <= to);
    });
  }, [cases.data, filters.from, filters.to]);

  const set = (k: keyof typeof filters) => (e: { target: { value: string } }) => setFilters((f) => ({ ...f, [k]: e.target.value }));
  const setQ = (v: string) => {
    const next = new URLSearchParams(search);
    if (v) next.set("q", v);
    else next.delete("q");
    setSearch(next, { replace: true });
  };
  const active = !!(q || filters.status || filters.urgency || filters.category || filters.sla_state || filters.from || filters.to || filters.closed);

  return (
    <div>
      <PageHeader title={title} subtitle={subtitle} actions={headerActions} />
      {intro}
      <div className="mb-4 rounded-lg border border-line bg-surface p-3">
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-[1.5fr_repeat(4,1fr)]">
          <label className="relative sm:col-span-2 lg:col-span-4 xl:col-span-1">
            <span className="sr-only">Search by ID, title or location</span>
            <IconSearch width={16} height={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted" />
            <Input className="pl-9" placeholder="Search ID, title, location" value={q} onChange={(e) => setQ(e.target.value)} />
          </label>
          {allowStatusFilter && (
            <Select aria-label="Status" value={filters.status} onChange={set("status")}>
              <option value="">All active statuses</option>
              {(Object.keys(STATUS_LABEL) as Status[]).map((s) => (
                <option key={s} value={s}>{STATUS_LABEL[s]}</option>
              ))}
            </Select>
          )}
          <Select aria-label="Priority" value={filters.urgency} onChange={set("urgency")}>
            <option value="">Any priority</option>
            {["critical", "high", "medium", "low"].map((u) => <option key={u} value={u}>{u[0].toUpperCase() + u.slice(1)}</option>)}
          </Select>
          <Select aria-label="Category" value={filters.category} onChange={set("category")}>
            <option value="">All categories</option>
            {cats.data?.map((c) => <option key={c.code} value={c.code}>{c.name_en}</option>)}
          </Select>
          {!query.sla_state && (
            <Select aria-label="SLA state" value={filters.sla_state} onChange={set("sla_state")}>
              <option value="">Any SLA state</option>
              <option value="on_track">On track</option>
              <option value="at_risk">At risk</option>
              <option value="breached">Breached</option>
            </Select>
          )}
        </div>
        <div className="mt-2 flex flex-wrap items-end gap-3">
          <label className="text-[13px] text-ink-muted">
            Filed from
            <Input type="date" className="mt-1 w-40" value={filters.from} onChange={set("from")} max={filters.to || undefined} />
          </label>
          <label className="text-[13px] text-ink-muted">
            Filed to
            <Input type="date" className="mt-1 w-40" value={filters.to} onChange={set("to")} min={filters.from || undefined} />
          </label>
          {allowClosedToggle && !filters.status && (
            <label className="flex h-10 items-center gap-2 text-[13px] text-ink">
              <input type="checkbox" className="h-4 w-4 accent-brand-700" checked={filters.closed} onChange={(e) => setFilters((f) => ({ ...f, closed: e.target.checked }))} />
              Include closed
            </label>
          )}
          {active && (
            <button
              onClick={() => {
                setFilters({ status: "", urgency: "", category: "", sla_state: "", from: "", to: "", closed: false });
                setQ("");
              }}
              className="h-10 rounded-md px-2 text-[13px] font-medium text-brand-700 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-500"
            >
              Clear filters
            </button>
          )}
        </div>
      </div>

      <DataTable
        caption={title}
        rows={rows}
        loading={cases.isLoading}
        error={cases.error}
        onRetry={() => cases.refetch()}
        rowKey={(g) => g.public_id}
        columns={caseColumns({ showOfficer, showCitizen, action })}
        mobileCard={(g) => <CaseCard g={g} action={action?.(g)} />}
        empty={active ? { title: "No grievances match these filters", body: "Clear or change the filters to see more." } : empty}
      />
    </div>
  );
}
