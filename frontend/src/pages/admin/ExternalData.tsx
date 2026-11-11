import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { HBarChart, TrendChart } from "../../components/charts";
import { Alert, Badge, Card, EmptyState, ErrorState, Input, PageHeader, Select, SkeletonRows, StatTile } from "../../components/ui";
import { api } from "../../lib/api";
import { fmtDate } from "../../lib/format";

interface Dataset {
  key: string;
  title: string;
  publisher: string;
  kind: string;
  source_url: string;
  download_url?: string | null;
  licence: string;
  licence_url?: string | null;
  attribution: string;
  file_name?: string | null;
  sha256?: string | null;
  downloaded_at?: string | null;
  imported_at?: string | null;
  rows_in_source?: number;
  rows_imported: number;
  coverage_start?: string | null;
  coverage_end?: string | null;
  columns?: string[];
  unavailable_fields?: string[];
  transformations?: string[];
  quality?: Record<string, unknown>;
  status: string;
  notes: string;
}
interface Named { name: string | number; count: number }
interface Summary {
  dataset: { title: string; licence: string; source_url: string; coverage_start: string | null; coverage_end: string | null };
  total_records: number;
  invalid_dates: number;
  with_staff_remarks: number;
  with_rating: number;
  monthly: { month: string; count: number }[];
  categories: Named[];
  sub_categories: Named[];
  statuses: Named[];
  channels: Named[];
  zones: Named[];
  wards: Named[];
}
interface RecordRow {
  source_record_id: string;
  category: string;
  sub_category: string | null;
  filed_at: string | null;
  date_valid: boolean;
  zone: string | null;
  ward: string | null;
  channel: string | null;
  source_status: string | null;
  staff_remarks: string | null;
  citizen_rating: number | null;
}

const STATUS_TONE: Record<string, "good" | "warning" | "critical" | "neutral" | "outline"> = {
  imported: "good",
  verification_only: "outline",
  needs_credentials: "warning",
  not_fetched: "warning",
  failed: "critical",
};
const KIND_LABEL: Record<string, string> = {
  individual_records: "Individual records",
  aggregate_statistics: "Aggregate statistics",
  directory: "Directory",
};

export default function ExternalData() {
  const ds = useQuery({ queryKey: ["external", "datasets"], queryFn: () => api<{ items: Dataset[]; ogd: { configured: boolean; requirement?: string }; cpgrams_individual_records: string }>("/external/datasets") });
  const sum = useQuery({ queryKey: ["external", "bbmp", "summary"], queryFn: () => api<Summary>("/external/bbmp/summary"), retry: false });
  const [filters, setFilters] = useState({ q: "", category: "", status: "", page: 1 });
  const params = new URLSearchParams({ page: String(filters.page), size: "20" });
  if (filters.q.trim()) params.set("q", filters.q.trim());
  if (filters.category) params.set("category", filters.category);
  if (filters.status) params.set("status", filters.status);
  const recs = useQuery({ queryKey: ["external", "bbmp", "records", params.toString()], queryFn: () => api<{ total: number; total_capped?: boolean; items: RecordRow[] }>(`/external/bbmp/records?${params}`), enabled: !!sum.data });
  const s = sum.data;

  return (
    <div>
      <PageHeader
        title="Public data"
        eyebrow={<Badge tone="brand">Public data, separate from HackFusion datasets</Badge>}
        subtitle="Real grievance data published by government bodies, shown with its source and licence. It is kept apart from the Category Master, grievance history and department directory that the agents use, and it is never used to train predictions."
      />

      {/* Provenance */}
      <section aria-labelledby="prov" className="mb-10">
        <h2 id="prov" className="mb-3 text-[15px] font-bold text-navy">Sources and provenance</h2>
        {ds.isLoading && <SkeletonRows rows={3} />}
        {ds.isError && <ErrorState error={ds.error} />}
        <div className="grid gap-4 lg:grid-cols-2">
          {ds.data?.items.map((d) => (
            <Card key={d.key} title={d.title} subtitle={d.publisher} action={<Badge tone={STATUS_TONE[d.status] ?? "neutral"}>{d.status.replace(/_/g, " ")}</Badge>}>
              <dl className="grid grid-cols-[8.5rem_1fr] gap-x-3 gap-y-1.5 text-[13px]">
                <dt className="text-ink-muted">Type</dt>
                <dd>{KIND_LABEL[d.kind] ?? d.kind}</dd>
                <dt className="text-ink-muted">Licence</dt>
                <dd>{d.licence_url ? <a className="text-brand-700 hover:underline" href={d.licence_url} target="_blank" rel="noreferrer">{d.licence}</a> : d.licence}</dd>
                <dt className="text-ink-muted">Source</dt>
                <dd className="break-all"><a className="text-brand-700 hover:underline" href={d.source_url} target="_blank" rel="noreferrer">{d.source_url}</a></dd>
                {d.downloaded_at && (<><dt className="text-ink-muted">Downloaded</dt><dd>{fmtDate(d.downloaded_at)}</dd></>)}
                {d.sha256 && (<><dt className="text-ink-muted">SHA-256</dt><dd className="break-all font-mono text-[11px]">{d.sha256}</dd></>)}
                {d.rows_in_source ? (<><dt className="text-ink-muted">Rows</dt><dd className="tabular-nums">{d.rows_imported.toLocaleString("en-IN")} imported of {d.rows_in_source.toLocaleString("en-IN")}</dd></>) : null}
                {d.coverage_start && (<><dt className="text-ink-muted">Coverage</dt><dd>{fmtDate(d.coverage_start, false)} to {fmtDate(d.coverage_end, false)}</dd></>)}
              </dl>
              {d.notes && <p className="mt-3 text-[13px] text-ink-soft">{d.notes}</p>}
              {!!d.unavailable_fields?.length && (
                <details className="mt-3 text-[13px]">
                  <summary className="cursor-pointer font-semibold text-navy">Not available in this dataset</summary>
                  <ul className="mt-2 list-disc space-y-1 pl-5 text-ink-soft">{d.unavailable_fields.map((u) => <li key={u}>{u}</li>)}</ul>
                </details>
              )}
              {!!d.transformations?.length && (
                <details className="mt-2 text-[13px]">
                  <summary className="cursor-pointer font-semibold text-navy">Transformations applied</summary>
                  <ul className="mt-2 list-disc space-y-1 pl-5 text-ink-soft">{d.transformations.map((u) => <li key={u}>{u}</li>)}</ul>
                </details>
              )}
              <p className="mt-3 text-[12px] text-ink-muted">{d.attribution}</p>
            </Card>
          ))}
        </div>
        {ds.data && (
          <div className="mt-4 space-y-3">
            {!ds.data.ogd.configured && <Alert tone="info" title="data.gov.in statistics and nodal officer directory">{ds.data.ogd.requirement}</Alert>}
            <Alert tone="info" title="CPGRAMS individual grievances">{ds.data.cpgrams_individual_records}</Alert>
          </div>
        )}
      </section>

      {/* BBMP statistics */}
      <section aria-labelledby="bbmp" className="mb-10">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <h2 id="bbmp" className="text-[15px] font-bold text-navy">BBMP Sahaaya 2.0 grievances, Bengaluru</h2>
          <Badge tone="brand">Real public records</Badge>
          <Badge tone="outline">ODbL v1.0</Badge>
        </div>
        {sum.isLoading && <SkeletonRows rows={4} />}
        {sum.isError && (
          <EmptyState title="BBMP data has not been imported on this server" body="Run: python -m app.cli external fetch, then python -m app.cli external import (about 6 minutes for 1.2 million rows)." />
        )}
        {s && (
          <>
            <div className="mb-6 grid grid-cols-2 gap-6 md:grid-cols-4">
              <StatTile label="Records" value={s.total_records.toLocaleString("en-IN")} hint={`${fmtDate(s.dataset.coverage_start, false)} to ${fmtDate(s.dataset.coverage_end, false)}`} />
              <StatTile label="Date unavailable" value={s.invalid_dates.toLocaleString("en-IN")} hint="implausible dates in source" />
              <StatTile label="With staff remarks" value={s.with_staff_remarks.toLocaleString("en-IN")} hint="PII-redacted" />
              <StatTile label="With citizen rating" value={s.with_rating.toLocaleString("en-IN")} />
            </div>
            <div className="grid gap-5 xl:grid-cols-2">
              <Card title="Grievances filed per month" subtitle="Single series. Filing date as published.">
                <TrendChart data={s.monthly.map((m) => ({ period: `${m.month}-01`, count: m.count }))} series={[{ key: "count", label: "Grievances filed" }]} />
              </Card>
              <Card title="Top categories" subtitle="BBMP's own categories, not mapped to the GRIEVANCE Category Master.">
                <HBarChart name="Grievances" labelKey="name" valueKey="count" data={s.categories.slice(0, 10) as unknown as Record<string, string | number>[]} />
              </Card>
              <Card title="Status in source" subtitle="As recorded by BBMP, including statuses GRIEVANCE itself never uses, such as Rejected.">
                <HBarChart name="Grievances" labelKey="name" valueKey="count" data={s.statuses as unknown as Record<string, string | number>[]} />
              </Card>
              <Card title="Intake channels">
                <HBarChart name="Grievances" labelKey="name" valueKey="count" data={s.channels as unknown as Record<string, string | number>[]} />
              </Card>
            </div>
            <div className="mt-5 grid gap-5 lg:grid-cols-2">
              <Card title="Most frequent sub-categories">
                <ol className="divide-y divide-line text-[14px]">
                  {s.sub_categories.map((c) => (
                    <li key={String(c.name)} className="flex justify-between gap-4 py-1.5"><span className="min-w-0 truncate">{c.name}</span><span className="tabular-nums text-ink-muted">{c.count.toLocaleString("en-IN")}</span></li>
                  ))}
                </ol>
              </Card>
              <Card title="Wards with the most grievances">
                <ol className="divide-y divide-line text-[14px]">
                  {s.wards.map((c) => (
                    <li key={String(c.name)} className="flex justify-between gap-4 py-1.5"><span className="min-w-0 truncate">{c.name}</span><span className="tabular-nums text-ink-muted">{c.count.toLocaleString("en-IN")}</span></li>
                  ))}
                </ol>
              </Card>
            </div>
          </>
        )}
      </section>

      {/* Record explorer */}
      {s && (
        <section aria-labelledby="explorer">
          <h2 id="explorer" className="mb-3 text-[15px] font-bold text-navy">Record explorer</h2>
          <p className="mb-3 max-w-prose text-[13px] text-ink-muted">
            Staff names are not imported. Phone numbers, e-mail addresses, long ID numbers and named individuals in remarks are redacted. The source contains no complaint text written by citizens.
          </p>
          <div className="mb-3 grid gap-2 sm:grid-cols-[1.5fr_1fr_1fr]">
            <Input aria-label="Search records" placeholder="Search sub-category, ward, remarks or ID" value={filters.q} onChange={(e) => setFilters({ ...filters, q: e.target.value, page: 1 })} />
            <Select aria-label="Category" value={filters.category} onChange={(e) => setFilters({ ...filters, category: e.target.value, page: 1 })}>
              <option value="">All categories</option>
              {s.categories.map((c) => <option key={String(c.name)} value={String(c.name)}>{c.name}</option>)}
            </Select>
            <Select aria-label="Status" value={filters.status} onChange={(e) => setFilters({ ...filters, status: e.target.value, page: 1 })}>
              <option value="">All statuses</option>
              {s.statuses.map((c) => <option key={String(c.name)} value={String(c.name)}>{c.name}</option>)}
            </Select>
          </div>
          {recs.isLoading && <SkeletonRows rows={5} />}
          {recs.isError && <ErrorState error={recs.error} />}
          {recs.data && recs.data.items.length === 0 && <EmptyState title="No records match" />}
          {!!recs.data?.items.length && (
            <>
              <div className="overflow-x-auto rounded-lg border border-line bg-surface">
                <table className="w-full min-w-[860px] text-[13px]">
                  <thead className="border-b border-line text-left text-[11px] uppercase tracking-[0.06em] text-ink-muted">
                    <tr><th className="px-3 py-2">ID</th><th className="px-3 py-2">Filed</th><th className="px-3 py-2">Category</th><th className="px-3 py-2">Ward</th><th className="px-3 py-2">Channel</th><th className="px-3 py-2">Status</th><th className="px-3 py-2">Staff remarks (redacted)</th></tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {recs.data.items.map((r) => (
                      <tr key={r.source_record_id} className="align-top">
                        <td className="px-3 py-2 font-mono">{r.source_record_id}</td>
                        <td className="whitespace-nowrap px-3 py-2">{r.filed_at ? fmtDate(r.filed_at) : <span className="text-ink-muted">unavailable</span>}</td>
                        <td className="px-3 py-2"><p className="font-semibold">{r.category}</p><p className="text-ink-muted">{r.sub_category ?? "n/a"}</p></td>
                        <td className="px-3 py-2">{r.ward ?? "n/a"}<p className="text-ink-muted">{r.zone ?? ""}</p></td>
                        <td className="px-3 py-2">{r.channel ?? "n/a"}</td>
                        <td className="px-3 py-2">{r.source_status ?? "n/a"}</td>
                        <td className="max-w-xs px-3 py-2 text-ink-soft">{r.staff_remarks ?? <span className="text-ink-muted">none</span>}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="mt-3 flex items-center justify-between text-[13px] text-ink-muted">
                <span>{recs.data.total_capped ? "More than 1,000" : recs.data.total.toLocaleString("en-IN")} matching records</span>
                <div className="flex gap-2">
                  <button className="rounded-md border border-stone-dark px-3 py-1.5 font-semibold text-navy disabled:opacity-40" disabled={filters.page === 1} onClick={() => setFilters({ ...filters, page: filters.page - 1 })}>Previous</button>
                  <button className="rounded-md border border-stone-dark px-3 py-1.5 font-semibold text-navy disabled:opacity-40" disabled={filters.page * 20 >= recs.data.total} onClick={() => setFilters({ ...filters, page: filters.page + 1 })}>Next</button>
                </div>
              </div>
            </>
          )}
        </section>
      )}
    </div>
  );
}
