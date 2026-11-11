import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Link } from "react-router-dom";
import { HBarChart, TrendChart } from "../../components/charts";
import { Card, ErrorState, PageHeader, SkeletonRows, StatTile, Tabs } from "../../components/ui";
import { useSystemStatus } from "../../components/AppShell";
import { api } from "../../lib/api";
import { ROLE_LABEL } from "../../lib/auth";
import { pct, STATUS_LABEL } from "../../lib/format";
import type { Status } from "../../lib/types";

interface Overview {
  total: number;
  by_status: Record<string, number>;
  by_data_source: Record<string, number>;
  open: number;
  resolved: number;
  pending_review: number;
  sensitive_open: number;
  overdue_open: number;
  escalated_open: number;
  median_resolution_hours: number | null;
  sla_compliance: number | null;
  reopened_total: number;
  estimate_label: string;
}
interface DeptRow { code: string; name: string; total: number; open: number; resolved: number; overdue: number; sla_compliance: number | null; median_resolution_hours: number | null }
interface Agents { traces: number; agents: { agent: string; runs: number; errors: number; avg_ms: number; avg_confidence: number | null }[]; intake_providers: Record<string, number>; ai_actions: Record<string, number>; human_review_decisions: number }

export default function AdminOverview() {
  const [scope, setScope] = useState<"all" | "live">("all");
  const inc = scope === "all";
  const ov = useQuery({ queryKey: ["an", "ov", inc], queryFn: () => api<Overview>(`/analytics/overview?include_history=${inc}`) });
  const trends = useQuery({ queryKey: ["an", "trends", inc], queryFn: () => api<{ series: Record<string, string | number>[] }>(`/analytics/trends?days=180&include_history=${inc}`) });
  const depts = useQuery({ queryKey: ["an", "depts", inc], queryFn: () => api<DeptRow[]>(`/analytics/departments?include_history=${inc}`) });
  const cats = useQuery({ queryKey: ["an", "cats", inc], queryFn: () => api<{ code: string; name: string; count: number }[]>(`/analytics/categories?include_history=${inc}`) });
  const agents = useQuery({ queryKey: ["an", "agents"], queryFn: () => api<Agents>("/analytics/agents?days=30") });
  const o = ov.data;
  const users = useQuery({ queryKey: ["admin", "users", "summary"], queryFn: () => api<{ total: number; by_role: Record<string, { active: number; inactive: number }> }>("/admin/users/summary") });
  const status = useSystemStatus();
  const errors = useQuery({ queryKey: ["obs", "errors", 20], queryFn: () => api<{ trace_id: string; agent: string; started_at: string }[]>("/observability/errors?limit=20") });

  return (
    <div>
      <PageHeader
        title="Platform Overview"
        subtitle="Users, grievances and system health across every department. Every figure is computed live from the database."
        actions={<Tabs value={scope} onChange={setScope} items={[{ value: "all", label: "Including history" }, { value: "live", label: "Current grievances only" }]} />}
      />
      <div className="mb-6 grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <Card title="Users" action={<Link to="/admin/users" className="text-[13px] font-medium text-brand-700 hover:underline">Manage users</Link>}>
          {users.isLoading && <SkeletonRows rows={1} />}
          {users.isError && <ErrorState error={users.error} onRetry={() => users.refetch()} />}
          {users.data && (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
              <StatTile label="Total" value={users.data.total} />
              {(["citizen", "officer", "dept_admin", "admin"] as const).map((r) => (
                <StatTile key={r} label={ROLE_LABEL[r]} value={users.data.by_role[r]?.active ?? 0} hint={users.data.by_role[r]?.inactive ? `${users.data.by_role[r].inactive} inactive` : undefined} />
              ))}
            </div>
          )}
        </Card>
        <Card title="System health" action={<Link to="/admin/integrations" className="text-[13px] font-medium text-brand-700 hover:underline">Integrations</Link>}>
          {status.isError ? (
            <p className="text-sm font-medium text-status-critical">The API status endpoint is not responding.</p>
          ) : !status.data ? (
            <SkeletonRows rows={1} />
          ) : (
            <dl className="divide-y divide-line text-sm">
              <div className="flex justify-between gap-3 py-1.5"><dt className="text-ink-muted">API</dt><dd className="font-medium text-status-good">Responding</dd></div>
              <div className="flex justify-between gap-3 py-1.5"><dt className="text-ink-muted">Language model</dt><dd className="font-medium">{status.data.llm.mode === "llm" ? status.data.llm.chain.join(" → ") : "Rule-based fallback"}</dd></div>
              <div className="flex justify-between gap-3 py-1.5"><dt className="text-ink-muted">Database</dt><dd className="font-medium">{status.data.database.engine}</dd></div>
              <div className="flex justify-between gap-3 py-1.5"><dt className="text-ink-muted">Agent errors (latest 20)</dt><dd className={errors.data?.length ? "font-medium text-status-critical" : "font-medium"}>{errors.data ? errors.data.length : "…"}{errors.data?.length ? <Link to="/admin/observability" className="ml-2 text-brand-700 underline">View</Link> : null}</dd></div>
            </dl>
          )}
        </Card>
      </div>
      {ov.isError && <ErrorState error={ov.error} onRetry={() => ov.refetch()} />}
      {ov.isLoading && <SkeletonRows rows={2} />}
      {o && (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-9">
            <StatTile label="Total" value={o.total.toLocaleString("en-IN")} />
            <StatTile label="Open" value={o.open} />
            <StatTile label="Resolved / closed" value={o.resolved.toLocaleString("en-IN")} />
            <StatTile label="Awaiting review" value={o.pending_review} tone={o.pending_review ? "warning" : undefined} />
            <StatTile label="Sensitive open" value={o.sensitive_open} />
            <StatTile label="Overdue open" value={o.overdue_open} tone={o.overdue_open ? "critical" : undefined} />
            <StatTile label="Pending escalations" value={o.escalated_open} tone={o.escalated_open ? "warning" : undefined} />
            <StatTile label="SLA compliance" value={pct(o.sla_compliance)} hint="of resolved cases" />
            <StatTile label="Median resolution" value={o.median_resolution_hours != null ? `${o.median_resolution_hours} h` : "n/a"} />
          </div>
          <p className="mt-2 text-xs text-ink-muted">
            Data sources: {Object.entries(o.by_data_source).map(([k, v]) => `${k} ${v}`).join(" · ")}. {o.estimate_label}
          </p>
        </>
      )}

      <div className="mt-6 grid gap-5 xl:grid-cols-2">
        <Card title="Filed vs resolved" subtitle="Weekly, last 180 days">
          {trends.isLoading ? <SkeletonRows rows={3} /> : trends.isError ? <ErrorState error={trends.error} /> : (
            <TrendChart data={trends.data!.series} series={[{ key: "created", label: "Filed" }, { key: "resolved", label: "Resolved" }]} />
          )}
        </Card>
        <Card title="Status distribution">
          {o && (
            <HBarChart
              name="Grievances"
              labelKey="label"
              valueKey="count"
              data={(Object.keys(STATUS_LABEL) as Status[]).map((s) => ({ label: STATUS_LABEL[s], count: o.by_status[s] ?? 0 }))}
            />
          )}
        </Card>
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-[1.3fr_1fr]">
        <Card title="Department workload & SLA performance" action={<Link to="/admin/sla" className="text-sm font-medium text-brand-700 hover:underline">Bottlenecks →</Link>}>
          {depts.isLoading && <SkeletonRows />}
          {depts.data && (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px] text-sm">
                <thead className="text-left text-xs uppercase tracking-wide text-ink-muted">
                  <tr><th className="pb-2">Department</th><th className="pb-2 text-right">Open</th><th className="pb-2 text-right">Overdue</th><th className="pb-2 text-right">Resolved</th><th className="pb-2 text-right">SLA met</th><th className="pb-2 text-right">Median h</th></tr>
                </thead>
                <tbody className="divide-y divide-line tabular-nums">
                  {depts.data.map((d) => (
                    <tr key={d.code}>
                      <td className="py-2 font-medium">{d.name}</td>
                      <td className="py-2 text-right">{d.open}</td>
                      <td className={`py-2 text-right ${d.overdue ? "font-semibold text-red-700" : ""}`}>{d.overdue}</td>
                      <td className="py-2 text-right">{d.resolved}</td>
                      <td className="py-2 text-right">{pct(d.sla_compliance)}</td>
                      <td className="py-2 text-right">{d.median_resolution_hours ?? "n/a"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
        <Card title="Grievances by category">
          {cats.data && <HBarChart name="Grievances" labelKey="name" valueKey="count" data={cats.data.slice(0, 10)} color="#2a78d6" />}
        </Card>
      </div>

      <Card className="mt-5" title="Agent activity (30 days)" action={<Link to="/admin/observability" className="text-sm font-medium text-brand-700 hover:underline">Traces →</Link>}>
        {agents.data && (
          <div className="grid gap-5 lg:grid-cols-[1.5fr_1fr]">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[480px] text-sm">
                <thead className="text-left text-xs uppercase tracking-wide text-ink-muted">
                  <tr><th className="pb-2">Agent</th><th className="pb-2 text-right">Runs</th><th className="pb-2 text-right">Errors</th><th className="pb-2 text-right">Avg ms</th><th className="pb-2 text-right">Avg confidence</th></tr>
                </thead>
                <tbody className="divide-y divide-line tabular-nums">
                  {agents.data.agents.map((a) => (
                    <tr key={a.agent}>
                      <td className="py-2 font-medium">{a.agent}</td>
                      <td className="py-2 text-right">{a.runs}</td>
                      <td className={`py-2 text-right ${a.errors ? "text-red-700" : ""}`}>{a.errors}</td>
                      <td className="py-2 text-right">{a.avg_ms}</td>
                      <td className="py-2 text-right">{pct(a.avg_confidence)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="space-y-3 text-sm">
              <p><span className="text-ink-muted">Traces:</span> <span className="font-semibold tabular-nums">{agents.data.traces}</span></p>
              <p><span className="text-ink-muted">Human review decisions:</span> <span className="font-semibold tabular-nums">{agents.data.human_review_decisions}</span></p>
              <div>
                <p className="text-ink-muted">Intake provider usage</p>
                <ul className="mt-1 space-y-0.5">
                  {Object.entries(agents.data.intake_providers).map(([k, v]) => <li key={k} className="flex justify-between"><span>{k}</span><span className="tabular-nums">{v}</span></li>)}
                </ul>
              </div>
              <div>
                <p className="text-ink-muted">AI_SYSTEM actions</p>
                <ul className="mt-1 space-y-0.5">
                  {Object.entries(agents.data.ai_actions).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([k, v]) => <li key={k} className="flex justify-between"><span className="font-mono text-xs">{k}</span><span className="tabular-nums">{v}</span></li>)}
                </ul>
              </div>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
