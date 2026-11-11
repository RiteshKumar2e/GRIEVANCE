import { useQuery } from "@tanstack/react-query";
import { Fragment, useState } from "react";
import { Link } from "react-router-dom";
import { Badge, Button, EmptyState, ErrorState, Input, PageHeader, Select, SkeletonRows } from "../../components/ui";
import { api } from "../../lib/api";
import { fmtDate, pct } from "../../lib/format";
import type { AuditItem } from "../../lib/types";

type Row = AuditItem & { id: number; grievance_id: string | null };
const PAGE = 50;

export default function AdminAudit() {
  const [f, setF] = useState({ actor_type: "", action: "", grievance: "" });
  const [page, setPage] = useState(0);
  const [open, setOpen] = useState<number | null>(null);
  const params = new URLSearchParams({ limit: String(PAGE), offset: String(page * PAGE) });
  Object.entries(f).forEach(([k, v]) => v && params.set(k, v.trim()));
  const q = useQuery({ queryKey: ["admin", "audit", params.toString()], queryFn: () => api<{ total: number; items: Row[] }>(`/admin/audit?${params}`) });
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => {
    setPage(0);
    setF((s) => ({ ...s, [k]: e.target.value }));
  };

  return (
    <div>
      <PageHeader title="Audit log" subtitle="Append-only record of every AI and human action. AI actions carry actor AI_SYSTEM with model, provider, confidence, structured explanation and policy references." />
      <div className="mb-4 grid gap-2 rounded-lg border border-line bg-surface p-3 sm:grid-cols-3">
        <Select aria-label="Actor type" value={f.actor_type} onChange={set("actor_type")}>
          <option value="">All actors</option>
          {["AI_SYSTEM", "OFFICER", "ADMIN", "CITIZEN", "SYSTEM"].map((a) => <option key={a} value={a}>{a}</option>)}
        </Select>
        <Input aria-label="Action prefix" placeholder="Action prefix (e.g. policy, status, escalation)" value={f.action} onChange={set("action")} />
        <Input aria-label="Grievance ID" placeholder="Grievance ID" value={f.grievance} onChange={set("grievance")} />
      </div>
      {q.isLoading && <SkeletonRows rows={8} />}
      {q.isError && <ErrorState error={q.error} onRetry={() => q.refetch()} />}
      {q.data?.items.length === 0 && <EmptyState title="No audit events match" />}
      {!!q.data?.items.length && (
        <>
          <div className="overflow-x-auto rounded-lg border border-line bg-surface">
            <table className="w-full min-w-[900px] text-sm">
              <thead className="border-b border-line bg-canvas text-left text-xs uppercase tracking-wide text-ink-muted">
                <tr><th className="px-4 py-2.5">Time</th><th className="px-3 py-2.5">Actor</th><th className="px-3 py-2.5">Action</th><th className="px-3 py-2.5">Grievance</th><th className="px-3 py-2.5">Model</th><th className="px-3 py-2.5 text-right">Conf.</th><th className="px-3 py-2.5">Policy refs</th></tr>
              </thead>
              <tbody className="divide-y divide-line">
                {q.data.items.map((a) => (
                  <Fragment key={a.id}>
                    <tr className="cursor-pointer hover:bg-canvas" onClick={() => setOpen(open === a.id ? null : a.id)}>
                      <td className="whitespace-nowrap px-4 py-2 text-xs">{fmtDate(a.created_at)}</td>
                      <td className="px-3 py-2"><Badge tone={a.actor_type === "AI_SYSTEM" ? "brand" : "neutral"}>{a.actor_type}</Badge></td>
                      <td className="px-3 py-2 font-mono text-xs">{a.action}</td>
                      <td className="px-3 py-2">{a.grievance_id ? <Link onClick={(e) => e.stopPropagation()} className="font-mono text-xs text-brand-700 hover:underline" to={`/admin/grievances/${a.grievance_id}`}>{a.grievance_id}</Link> : "n/a"}</td>
                      <td className="px-3 py-2 text-xs text-ink-soft">{a.provider ? `${a.provider} · ${a.model}` : "n/a"}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{a.confidence !== null ? pct(a.confidence) : "n/a"}</td>
                      <td className="px-3 py-2 font-mono text-[11px] text-ink-muted">{a.policy_refs.join(" ")}</td>
                    </tr>
                    {open === a.id && (
                      <tr>
                        <td colSpan={7} className="bg-canvas px-4 py-3">
                          <pre className="overflow-x-auto whitespace-pre-wrap text-[11px]">{JSON.stringify(a.explanation, null, 2)}</pre>
                          {a.trace_id && <Link className="mt-1 inline-block text-xs font-medium text-brand-700 hover:underline" to={`/admin/observability/${a.trace_id}`}>Open trace {a.trace_id.slice(0, 8)}…</Link>}
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-3 flex items-center justify-between text-sm text-ink-muted">
            <span>{q.data.total.toLocaleString("en-IN")} events</span>
            <div className="flex gap-2">
              <Button size="sm" variant="secondary" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>Previous</Button>
              <Button size="sm" variant="secondary" disabled={(page + 1) * PAGE >= q.data.total} onClick={() => setPage((p) => p + 1)}>Next</Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
