import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Alert, Badge, Button, Card, EmptyState, ErrorState, Field, Input, PageHeader, SkeletonRows } from "../../components/ui";
import { api } from "../../lib/api";
import { fmtDate } from "../../lib/format";

interface Hooks {
  events: string[];
  items: { id: number; name: string; url: string; events: string[]; is_active: boolean; created_at: string; deliveries: { id: number; event: string; status: string; attempts: number; response_code: number | null; last_error: string | null; created_at: string }[] }[];
}

export default function AdminWebhooks() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["admin", "webhooks"], queryFn: () => api<Hooks>("/admin/webhooks") });
  const [form, setForm] = useState({ name: "", url: "", events: [] as string[] });
  const inv = () => qc.invalidateQueries({ queryKey: ["admin", "webhooks"] });
  const create = useMutation({ mutationFn: () => api("/admin/webhooks", { body: form }), onSuccess: () => { void inv(); setForm({ name: "", url: "", events: [] }); } });
  const toggle = useMutation({ mutationFn: (h: { id: number; is_active: boolean }) => api(`/admin/webhooks/${h.id}?is_active=${!h.is_active}`, { method: "PATCH" }), onSuccess: inv });
  const remove = useMutation({ mutationFn: (id: number) => api(`/admin/webhooks/${id}`, { method: "DELETE" }), onSuccess: inv });
  const deliver = useMutation({ mutationFn: () => api("/admin/webhooks/deliver", { method: "POST" }), onSuccess: () => setTimeout(() => void inv(), 1500) });

  return (
    <div>
      <PageHeader
        title="Webhooks"
        subtitle="Push grievance events to external systems (e.g. a state CPGRAMS bridge or SMS gateway). Payloads contain IDs, status and routing — never complaint text or citizen identity — and are signed with HMAC-SHA256 (X-Grievance-Signature)."
        actions={<Button variant="secondary" onClick={() => deliver.mutate()} loading={deliver.isPending}>Deliver pending now</Button>}
      />
      <div className="grid gap-5 xl:grid-cols-[380px_1fr]">
        <Card title="Register a webhook">
          <div className="space-y-3">
            <Field label="Name" htmlFor="wn"><Input id="wn" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
            <Field label="URL" htmlFor="wu"><Input id="wu" placeholder="https://example.org/hooks/grievance" value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })} /></Field>
            <fieldset>
              <legend className="mb-1.5 text-sm font-medium">Events (none = all)</legend>
              <div className="space-y-1">
                {q.data?.events.map((ev) => (
                  <label key={ev} className="flex items-center gap-2 text-sm">
                    <input type="checkbox" className="h-4 w-4 accent-brand-800" checked={form.events.includes(ev)} onChange={(e) => setForm({ ...form, events: e.target.checked ? [...form.events, ev] : form.events.filter((x) => x !== ev) })} />
                    <span className="font-mono text-xs">{ev}</span>
                  </label>
                ))}
              </div>
            </fieldset>
            <Button onClick={() => create.mutate()} loading={create.isPending} disabled={!form.name || !/^https?:\/\//.test(form.url)}>Add webhook</Button>
            {create.error && <Alert tone="critical">{create.error.message}</Alert>}
          </div>
        </Card>
        <div className="space-y-4">
          {q.isLoading && <SkeletonRows />}
          {q.isError && <ErrorState error={q.error} />}
          {q.data?.items.length === 0 && <EmptyState title="No webhooks registered" body="Events are only queued once at least one webhook exists." />}
          {q.data?.items.map((h) => (
            <Card
              key={h.id}
              title={<span className="flex items-center gap-2">{h.name} <Badge tone={h.is_active ? "good" : "neutral"}>{h.is_active ? "active" : "paused"}</Badge></span>}
              subtitle={<span className="font-mono">{h.url}</span>}
              action={<div className="flex gap-1"><Button size="sm" variant="ghost" onClick={() => toggle.mutate(h)}>{h.is_active ? "Pause" : "Resume"}</Button><Button size="sm" variant="ghost" onClick={() => remove.mutate(h.id)}>Delete</Button></div>}
            >
              <p className="mb-3 text-xs text-ink-muted">Events: {h.events.length ? h.events.join(", ") : "all"}</p>
              {h.deliveries.length === 0 ? <p className="text-sm text-ink-muted">No deliveries yet.</p> : (
                <table className="w-full text-xs">
                  <thead className="text-left uppercase tracking-wide text-ink-muted"><tr><th className="pb-1.5">When</th><th className="pb-1.5">Event</th><th className="pb-1.5">Status</th><th className="pb-1.5 text-right">Attempts</th><th className="pb-1.5">Result</th></tr></thead>
                  <tbody className="divide-y divide-line">
                    {h.deliveries.map((d) => (
                      <tr key={d.id}>
                        <td className="py-1.5">{fmtDate(d.created_at)}</td>
                        <td className="py-1.5 font-mono">{d.event}</td>
                        <td className="py-1.5"><Badge tone={d.status === "delivered" ? "good" : d.status === "failed" ? "critical" : "neutral"}>{d.status}</Badge></td>
                        <td className="py-1.5 text-right tabular-nums">{d.attempts}</td>
                        <td className="py-1.5 text-ink-muted">{d.response_code ?? d.last_error ?? "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
