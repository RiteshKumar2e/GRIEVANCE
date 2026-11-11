import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Copy, ExternalLink, Share2 } from "lucide-react";
import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { TraceSteps, type TraceStep } from "../../components/TraceSteps";
import { Alert, Badge, Button, Card, EmptyState, ErrorState, PageHeader, Select, SkeletonRows } from "../../components/ui";
import { api } from "../../lib/api";
import { fmtDate } from "../../lib/format";

interface TraceList { total: number; langfuse_enabled: boolean; items: { trace_id: string; name: string; status: string; grievance_id: string | null; started_at: string; duration_ms: number | null; steps: number; providers: string[]; errors: number; shared: boolean; langfuse_url: string | null }[] }
interface TraceDetail { trace_id: string; name: string; status: string; grievance_id: string | null; started_at: string; ended_at: string | null; duration_ms: number | null; share_token: string | null; langfuse_url: string | null; steps: TraceStep[] }

export default function Observability() {
  const { traceId } = useParams();
  const nav = useNavigate();
  const [name, setName] = useState("");
  const list = useQuery({ queryKey: ["obs", "list", name], queryFn: () => api<TraceList>(`/observability/traces?limit=100${name ? `&name=${name}` : ""}`), refetchInterval: 30_000 });
  const errors = useQuery({ queryKey: ["obs", "errors"], queryFn: () => api<{ trace_id: string; agent: string; error: string; started_at: string }[]>("/observability/errors?limit=10") });

  return (
    <div>
      <PageHeader
        title="Observability"
        subtitle="Every agent execution is traced: provider and model, retrieval references, confidence, policy decisions, backend actions, human reviews, errors and timing. Inputs are PII-redacted and no model reasoning is stored."
        actions={list.data && <Badge tone={list.data.langfuse_enabled ? "good" : "outline"}>Langfuse export {list.data.langfuse_enabled ? "on" : "off (internal tracing only)"}</Badge>}
      />
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
        <Card title="Recent traces" action={
          <Select aria-label="Workflow" className="h-8 w-48" value={name} onChange={(e) => setName(e.target.value)}>
            <option value="">All workflows</option>
            <option value="grievance_pipeline">grievance_pipeline</option>
            <option value="intake_analysis">intake_analysis</option>
            <option value="sla_scan">sla_scan</option>
            <option value="auto_close">auto_close</option>
          </Select>
        }>
          {list.isLoading && <SkeletonRows rows={6} />}
          {list.isError && <ErrorState error={list.error} />}
          {list.data?.items.length === 0 && <EmptyState title="No traces yet" />}
          <ul className="-mx-5 -my-5 max-h-[70vh] divide-y divide-line overflow-y-auto">
            {list.data?.items.map((t) => (
              <li key={t.trace_id}>
                <button onClick={() => nav(`/admin/observability/${t.trace_id}`)} className={`w-full px-5 py-3 text-left hover:bg-canvas ${traceId === t.trace_id ? "bg-brand-50" : ""}`}>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{t.name}</span>
                    {t.grievance_id && <span className="font-mono text-xs text-ink-muted">{t.grievance_id}</span>}
                    {t.errors > 0 && <Badge tone="critical">{t.errors} error</Badge>}
                    {t.shared && <Badge tone="outline">shared</Badge>}
                  </div>
                  <p className="mt-0.5 text-xs text-ink-muted">{fmtDate(t.started_at)} · {t.steps} steps · {t.duration_ms ?? "—"} ms · {t.providers.join(", ")}</p>
                </button>
              </li>
            ))}
          </ul>
        </Card>
        <div className="space-y-5">
          {traceId ? <TracePanel traceId={traceId} /> : <Card><p className="text-sm text-ink-muted">Select a trace to inspect each agent step.</p></Card>}
          <Card title="Recent agent errors">
            {errors.data?.length === 0 && <p className="text-sm text-ink-muted">No agent errors recorded.</p>}
            <ul className="space-y-2 text-sm">
              {errors.data?.map((e, i) => (
                <li key={i}><Link className="font-mono text-xs text-brand-700 hover:underline" to={`/admin/observability/${e.trace_id}`}>{e.agent}</Link> <span className="text-ink-soft">{e.error}</span> <span className="text-xs text-ink-muted">{fmtDate(e.started_at)}</span></li>
              ))}
            </ul>
          </Card>
        </div>
      </div>
    </div>
  );
}

function TracePanel({ traceId }: { traceId: string }) {
  const qc = useQueryClient();
  const [copied, setCopied] = useState(false);
  const q = useQuery({ queryKey: ["obs", "trace", traceId], queryFn: () => api<TraceDetail>(`/observability/traces/${traceId}`) });
  const share = useMutation({ mutationFn: () => api<{ share_token: string }>(`/observability/traces/${traceId}/share`, { method: "POST" }), onSuccess: () => qc.invalidateQueries({ queryKey: ["obs"] }) });
  const unshare = useMutation({ mutationFn: () => api(`/observability/traces/${traceId}/share`, { method: "DELETE" }), onSuccess: () => qc.invalidateQueries({ queryKey: ["obs"] }) });
  if (q.isLoading) return <Card><SkeletonRows /></Card>;
  if (q.isError) return <ErrorState error={q.error} />;
  const t = q.data!;
  const shareUrl = t.share_token ? `${window.location.origin}/share/trace/${t.share_token}` : null;

  return (
    <Card
      title={<span className="flex items-center gap-2">{t.name} <Badge tone={t.status === "ok" ? "good" : "critical"}>{t.status}</Badge></span>}
      subtitle={<span className="font-mono">{t.trace_id}</span>}
      action={
        t.share_token ? (
          <Button size="sm" variant="ghost" onClick={() => unshare.mutate()} loading={unshare.isPending}>Revoke link</Button>
        ) : (
          <Button size="sm" variant="secondary" onClick={() => share.mutate()} loading={share.isPending}><Share2 className="h-3.5 w-3.5" aria-hidden /> Create public link</Button>
        )
      }
    >
      <dl className="mb-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
        <div><dt className="text-xs text-ink-muted">Grievance</dt><dd>{t.grievance_id ? <Link className="font-mono text-brand-700 hover:underline" to={`/officer/grievances/${t.grievance_id}`}>{t.grievance_id}</Link> : "—"}</dd></div>
        <div><dt className="text-xs text-ink-muted">Started</dt><dd>{fmtDate(t.started_at)}</dd></div>
        <div><dt className="text-xs text-ink-muted">Duration</dt><dd className="tabular-nums">{t.duration_ms ?? "—"} ms</dd></div>
        <div><dt className="text-xs text-ink-muted">Steps</dt><dd className="tabular-nums">{t.steps.length}</dd></div>
      </dl>
      {shareUrl && (
        <div className="mb-4">
          <Alert tone="info" title="Public, redacted link">
            <div className="mt-1 flex items-center gap-2">
              <code className="min-w-0 flex-1 truncate rounded bg-white px-2 py-1 text-xs">{shareUrl}</code>
              <Button size="sm" variant="secondary" onClick={() => { void navigator.clipboard?.writeText(shareUrl); setCopied(true); setTimeout(() => setCopied(false), 1500); }}>
                {copied ? <Check className="h-3.5 w-3.5" aria-hidden /> : <Copy className="h-3.5 w-3.5" aria-hidden />} {copied ? "Copied" : "Copy"}
              </Button>
              <a href={shareUrl} target="_blank" rel="noreferrer" className="text-brand-700" aria-label="Open public trace"><ExternalLink className="h-4 w-4" /></a>
            </div>
            <p className="mt-1 text-xs">Shows decisions, models, confidence and references only — no complaint text or identities.</p>
          </Alert>
        </div>
      )}
      {t.langfuse_url && <p className="mb-3 text-sm"><a className="font-medium text-brand-700 hover:underline" href={t.langfuse_url} target="_blank" rel="noreferrer">Open in Langfuse</a></p>}
      <TraceSteps steps={t.steps} />
    </Card>
  );
}
