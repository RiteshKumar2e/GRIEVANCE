import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { TrendChart } from "../../components/charts";
import { BarList, Metrics, Panel } from "../../components/dashboard";
import { Alert, Button, ErrorState, PageHeader, Select, SkeletonRows } from "../../components/ui";
import { useToast } from "../../components/Toast";
import { api, downloadFile } from "../../lib/api";
import { useAuth } from "../../lib/auth";
import { pct, STATUS_LABEL } from "../../lib/format";
import type { Status } from "../../lib/types";

export interface Report {
  days: number;
  since: string;
  total: number;
  by_status: Record<string, number>;
  by_category: [string, number][];
  by_ward: [string, number][];
  by_officer: { code: string; name: string; total: number; open: number; resolved: number }[];
  trend: { date: string; filed: number; resolved: number }[];
  sla: { met: number; missed: number; compliance: number | null };
  median_resolution_hours: number | null;
}

export function useReport(days: number) {
  return useQuery({ queryKey: ["officer", "reports", days], queryFn: () => api<Report>(`/officer/reports?days=${days}`) });
}

export function PeriodSelect({ value, onChange }: { value: number; onChange: (d: number) => void }) {
  return (
    <label className="flex items-center gap-2 text-[13px] text-ink-muted">
      Period
      <Select className="w-40" value={value} onChange={(e) => onChange(Number(e.target.value))}>
        {[7, 30, 90, 180, 365].map((d) => (
          <option key={d} value={d}>
            Last {d} days
          </option>
        ))}
      </Select>
    </label>
  );
}

/** Reports & analytics for officers and department admins. All figures come from /officer/reports, scoped by the API. */
export default function Reports() {
  const { user } = useAuth();
  const toast = useToast();
  const [days, setDays] = useState(30);
  const [busy, setBusy] = useState(false);
  const r = useReport(days);
  const scopeLabel = user?.role === "dept_admin" ? user.department_name ?? "your department" : "cases you are authorised to see";

  const download = async () => {
    setBusy(true);
    try {
      await downloadFile(`/officer/reports/export?days=${days}`, `grievance-report-${days}d.csv`);
      toast.success("Report downloaded.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Download failed.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <PageHeader
        title="Reports & Analytics"
        subtitle={<>Grievances filed in the selected period within {scopeLabel}. The CSV export contains no citizen names, contact details or descriptions.</>}
        actions={
          <>
            <PeriodSelect value={days} onChange={setDays} />
            <Button variant="secondary" onClick={download} loading={busy} disabled={!r.data?.total}>
              Download CSV
            </Button>
          </>
        }
      />
      {r.isLoading && <SkeletonRows rows={5} />}
      {r.isError && <ErrorState error={r.error} onRetry={() => r.refetch()} />}
      {r.data && r.data.total === 0 && <Alert title="No grievances in this period">Choose a longer period to see trends.</Alert>}
      {r.data && r.data.total > 0 && <ReportBody r={r.data} />}
    </div>
  );
}

export function ReportBody({ r, showOfficers = true }: { r: Report; showOfficers?: boolean }) {
  const open = Object.entries(r.by_status)
    .filter(([s]) => !["RESOLVED", "CLOSED"].includes(s))
    .reduce((n, [, v]) => n + v, 0);
  return (
    <>
      <Metrics
        items={[
          { label: "Filed in period", value: r.total },
          { label: "Still open", value: open },
          { label: "Resolved or closed", value: (r.by_status.RESOLVED ?? 0) + (r.by_status.CLOSED ?? 0) },
          { label: "SLA compliance", value: pct(r.sla.compliance), hint: `${r.sla.met} met · ${r.sla.missed} missed`, tone: r.sla.compliance !== null && r.sla.compliance < 0.8 ? "warning" : undefined },
          { label: "Median resolution", value: r.median_resolution_hours !== null ? `${r.median_resolution_hours} h` : "n/a" },
          { label: "Categories", value: r.by_category.length },
        ]}
      />
      <div className="grid gap-4 xl:grid-cols-[1.6fr_1fr]">
        <Panel title="Filed and resolved per day" description="Count of grievances filed, and of those resolved, on each day.">
          {r.trend.length > 1 ? (
            <TrendChart data={r.trend} series={[{ key: "filed", label: "Filed" }, { key: "resolved", label: "Resolved" }]} />
          ) : (
            <p className="text-sm text-ink-muted">Not enough days with activity to draw a trend.</p>
          )}
        </Panel>
        <Panel title="By status">
          <BarList rows={Object.entries(r.by_status).map(([s, n]) => [STATUS_LABEL[s as Status] ?? s, n] as [string, number])} />
        </Panel>
        <Panel title="By category">
          <BarList rows={r.by_category.slice(0, 10)} />
        </Panel>
        <Panel title="By ward" description="Top 15 wards by grievances filed.">
          <BarList rows={r.by_ward} />
        </Panel>
        {showOfficers && (
          <Panel title="By assigned officer" className="xl:col-span-2">
            {r.by_officer.length ? (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[480px] text-sm">
                  <caption className="sr-only">Grievances by assigned officer</caption>
                  <thead className="text-left text-[12px] uppercase tracking-[0.05em] text-ink-muted">
                    <tr>
                      <th scope="col" className="py-2 pr-4 font-semibold">Officer</th>
                      <th scope="col" className="py-2 pr-4 text-right font-semibold">Assigned</th>
                      <th scope="col" className="py-2 pr-4 text-right font-semibold">Open</th>
                      <th scope="col" className="py-2 text-right font-semibold">Resolved/closed</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {r.by_officer.map((o) => (
                      <tr key={o.code}>
                        <td className="py-2 pr-4">{o.name} <span className="font-mono text-[12px] text-ink-muted">{o.code}</span></td>
                        <td className="py-2 pr-4 text-right tabular-nums">{o.total}</td>
                        <td className="py-2 pr-4 text-right tabular-nums">{o.open}</td>
                        <td className="py-2 text-right tabular-nums">{o.resolved}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-sm text-ink-muted">No grievances were assigned to an officer in this period.</p>
            )}
          </Panel>
        )}
      </div>
    </>
  );
}
