import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertOctagon, CheckCircle2, Clock, Flame, TimerOff } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";
import { Alert, Badge, Button, Card, ErrorState, PageHeader, Select, SkeletonRows, StatTile } from "../../components/ui";
import { api } from "../../lib/api";
import { fmtDate, pct } from "../../lib/format";

interface SlaData {
  states: Record<string, number>;
  estimate_label: string;
  watchlist: { public_id: string; title: string; department: string; state: string; due_at: string; breach_probability: number | null; predicted_resolution_hours: number | null; escalation_level: number; is_sensitive: boolean }[];
}
interface Recurrence { window_days: number; estimate_label: string; items: { category_code: string; category_name: string; ward: string; count: number; previous_count: number; growth: number | null; is_hotspot: boolean }[] }
interface Bottlenecks {
  departments: { department_code: string; department_name: string; open: number; overdue: number; avg_open_age_days: number; median_resolution_hours: number | null; capacity: number; load_ratio: number; bottleneck_score: number; is_bottleneck: boolean }[];
  officers: { officer_code: string; name: string; department_code: string; open_cases: number; capacity: number; utilisation: number }[];
}

export default function AdminSla() {
  const qc = useQueryClient();
  const [days, setDays] = useState(30);
  const sla = useQuery({ queryKey: ["an", "sla"], queryFn: () => api<SlaData>("/analytics/sla") });
  const rec = useQuery({ queryKey: ["an", "rec", days], queryFn: () => api<Recurrence>(`/analytics/recurrence?days=${days}`) });
  const bot = useQuery({ queryKey: ["an", "bot"], queryFn: () => api<Bottlenecks>("/analytics/bottlenecks") });
  const scan = useMutation({
    mutationFn: () => api<{ scanned: number; at_risk: number; breached: number; escalated: number }>("/admin/jobs/sla-scan", { method: "POST" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["an"] }),
  });
  const close = useMutation({
    mutationFn: () => api<{ closed: string[]; skipped_by_policy: string[] }>("/admin/jobs/auto-close", { method: "POST" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["an"] }),
  });
  const s = sla.data?.states ?? {};

  return (
    <div>
      <PageHeader
        title="SLA, recurrence & bottlenecks"
        subtitle="Predictive SLA agent output. The monitor runs automatically; you can also trigger it now."
        actions={
          <>
            <Button variant="secondary" onClick={() => close.mutate()} loading={close.isPending} title="Close RESOLVED grievances past the confirmation window (never sensitive ones)">
              Run auto-close
            </Button>
            <Button onClick={() => scan.mutate()} loading={scan.isPending}>Run SLA scan now</Button>
          </>
        }
      />
      {scan.data && <div className="mb-4"><Alert tone="good">Scanned {scan.data.scanned} open grievances: {scan.data.at_risk} newly at risk, {scan.data.breached} newly breached, {scan.data.escalated} escalated.</Alert></div>}
      {close.data && <div className="mb-4"><Alert tone="info">Auto-closed {close.data.closed.length}. Skipped by policy (sensitive / not permitted): {close.data.skipped_by_policy.length}.</Alert></div>}
      {(scan.error || close.error) && <div className="mb-4"><Alert tone="critical">{(scan.error || close.error)!.message}</Alert></div>}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <StatTile label="On track" value={<span className="inline-flex items-center gap-1.5"><Clock className="h-5 w-5 text-ink-muted" aria-hidden />{s.on_track ?? 0}</span>} />
        <StatTile label="At risk" tone="warning" value={<span className="inline-flex items-center gap-1.5"><AlertOctagon className="h-5 w-5" aria-hidden />{s.at_risk ?? 0}</span>} />
        <StatTile label="Breached" tone="critical" value={<span className="inline-flex items-center gap-1.5"><TimerOff className="h-5 w-5" aria-hidden />{s.breached ?? 0}</span>} />
        <StatTile label="Met" tone="good" value={<span className="inline-flex items-center gap-1.5"><CheckCircle2 className="h-5 w-5" aria-hidden />{s.met ?? 0}</span>} />
        <StatTile label="Resolved late" value={s.missed ?? 0} />
      </div>
      {sla.data && <p className="mt-2 text-xs text-saffron-700">{sla.data.estimate_label}</p>}

      <Card className="mt-5" title="SLA watchlist" subtitle="Open grievances at risk of breach or already breached">
        {sla.isLoading && <SkeletonRows />}
        {sla.isError && <ErrorState error={sla.error} />}
        {sla.data && sla.data.watchlist.length === 0 && <p className="text-sm text-ink-muted">No open grievance is at risk.</p>}
        {!!sla.data?.watchlist.length && (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead className="text-left text-xs uppercase tracking-wide text-ink-muted">
                <tr><th className="pb-2">Grievance</th><th className="pb-2">Dept</th><th className="pb-2">State</th><th className="pb-2">Due</th><th className="pb-2 text-right">Breach prob.</th><th className="pb-2 text-right">Predicted h</th><th className="pb-2 text-right">Escalation</th></tr>
              </thead>
              <tbody className="divide-y divide-line">
                {sla.data.watchlist.map((w) => (
                  <tr key={w.public_id}>
                    <td className="py-2"><Link className="font-mono text-xs font-semibold text-brand-700 hover:underline" to={`/officer/grievances/${w.public_id}`}>{w.public_id}</Link><p className="max-w-xs truncate">{w.title}</p></td>
                    <td className="py-2">{w.department}</td>
                    <td className="py-2">{w.state === "breached" ? <Badge tone="critical"><TimerOff className="h-3 w-3" aria-hidden /> Breached</Badge> : <Badge tone="warning"><AlertOctagon className="h-3 w-3" aria-hidden /> At risk</Badge>}</td>
                    <td className="py-2 tabular-nums">{fmtDate(w.due_at)}</td>
                    <td className="py-2 text-right tabular-nums">{pct(w.breach_probability)}</td>
                    <td className="py-2 text-right tabular-nums">{w.predicted_resolution_hours ?? "—"}</td>
                    <td className="py-2 text-right tabular-nums">{w.escalation_level ? `L${w.escalation_level}` : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <div className="mt-5 grid gap-5 xl:grid-cols-2">
        <Card
          title="Recurring grievances"
          subtitle="Category × ward clusters, compared with the previous window"
          action={
            <Select aria-label="Window" className="h-8 w-28" value={days} onChange={(e) => setDays(Number(e.target.value))}>
              {[14, 30, 60, 90].map((d) => <option key={d} value={d}>{d} days</option>)}
            </Select>
          }
        >
          {rec.isLoading && <SkeletonRows />}
          {rec.data && rec.data.items.length === 0 && <p className="text-sm text-ink-muted">No recurring clusters in this window.</p>}
          {!!rec.data?.items.length && (
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase tracking-wide text-ink-muted">
                <tr><th className="pb-2">Category</th><th className="pb-2">Ward</th><th className="pb-2 text-right">Count</th><th className="pb-2 text-right">Previous</th><th className="pb-2 text-right">Change</th></tr>
              </thead>
              <tbody className="divide-y divide-line tabular-nums">
                {rec.data.items.slice(0, 15).map((r) => (
                  <tr key={`${r.category_code}-${r.ward}`}>
                    <td className="py-2">{r.is_hotspot && <Flame className="mr-1 inline h-3.5 w-3.5 text-orange-700" aria-label="hotspot" />}{r.category_name}</td>
                    <td className="py-2">{r.ward}</td>
                    <td className="py-2 text-right font-semibold">{r.count}</td>
                    <td className="py-2 text-right">{r.previous_count}</td>
                    <td className="py-2 text-right">{r.growth == null ? "new" : `${r.growth > 0 ? "+" : ""}${Math.round(r.growth * 100)}%`}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>

        <Card title="Department bottlenecks" subtitle="Score = 50% load vs capacity + 50% share of open cases overdue">
          {bot.isLoading && <SkeletonRows />}
          {bot.data && (
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase tracking-wide text-ink-muted">
                <tr><th className="pb-2">Department</th><th className="pb-2 text-right">Open</th><th className="pb-2 text-right">Overdue</th><th className="pb-2 text-right">Avg age d</th><th className="pb-2 text-right">Score</th></tr>
              </thead>
              <tbody className="divide-y divide-line tabular-nums">
                {bot.data.departments.map((d) => (
                  <tr key={d.department_code}>
                    <td className="py-2">{d.department_name}{d.is_bottleneck && <Badge tone="serious" className="ml-2">bottleneck</Badge>}</td>
                    <td className="py-2 text-right">{d.open}</td>
                    <td className="py-2 text-right">{d.overdue}</td>
                    <td className="py-2 text-right">{d.avg_open_age_days}</td>
                    <td className="py-2 text-right font-semibold">{d.bottleneck_score.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
      </div>

      <Card className="mt-5" title="Officer workload">
        {bot.data && (
          <div className="grid gap-x-8 gap-y-2 sm:grid-cols-2 lg:grid-cols-3">
            {bot.data.officers.map((o) => (
              <div key={o.officer_code} className="flex items-center gap-3 text-sm">
                <div className="w-40 min-w-0">
                  <p className="truncate font-medium">{o.name}</p>
                  <p className="text-xs text-ink-muted">{o.officer_code}</p>
                </div>
                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100" aria-hidden>
                  <div className="h-full rounded-full bg-[#2a78d6]" style={{ width: `${Math.min(100, o.utilisation * 100)}%` }} />
                </div>
                <span className="w-14 text-right text-xs tabular-nums">{o.open_cases}/{o.capacity}</span>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
