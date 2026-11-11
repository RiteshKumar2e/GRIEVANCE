import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useToast } from "../../components/Toast";
import { Alert, Badge, Button, Card, EmptyState, ErrorState, Field, Input, PageHeader, SkeletonRows } from "../../components/ui";
import { api, apiBase } from "../../lib/api";
import { fmtDate } from "../../lib/format";

interface Hooks {
  events: string[];
  items: { id: number; name: string; url: string; events: string[]; is_active: boolean; created_at: string; deliveries: { id: number; event: string; status: string; attempts: number; response_code: number | null; last_error: string | null; created_at: string }[] }[];
}
interface Received {
  count: number;
  items: { received_at: string; event: string | null; signature_valid: boolean; payload: Record<string, unknown> }[];
}

// The backend posts to itself, so the receiver URL must be reachable from the server (port 8000 inside Docker too).
const MOCK_URL = `${apiBase.replace(/\/$/, "")}/mock/webhook-receiver`;

export default function AdminWebhooks() {
  const qc = useQueryClient();
  const toast = useToast();
  const q = useQuery({ queryKey: ["admin", "webhooks"], queryFn: () => api<Hooks>("/admin/webhooks") });
  const rx = useQuery({ queryKey: ["admin", "mock-receiver"], queryFn: () => api<Received>("/mock/webhook-receiver"), refetchInterval: 10_000 });
  const [form, setForm] = useState({ name: "", url: "", events: [] as string[] });
  const inv = () => {
    void qc.invalidateQueries({ queryKey: ["admin", "webhooks"] });
    void qc.invalidateQueries({ queryKey: ["admin", "mock-receiver"] });
  };
  const create = useMutation({
    mutationFn: () => api("/admin/webhooks", { body: form }),
    onSuccess: () => {
      inv();
      toast.success(`Webhook "${form.name}" registered.`);
      setForm({ name: "", url: "", events: [] });
    },
  });
  const toggle = useMutation({ mutationFn: (h: { id: number; is_active: boolean }) => api(`/admin/webhooks/${h.id}?is_active=${!h.is_active}`, { method: "PATCH" }), onSuccess: inv });
  const remove = useMutation({ mutationFn: (id: number) => api(`/admin/webhooks/${id}`, { method: "DELETE" }), onSuccess: () => { inv(); toast.success("Webhook deleted."); } });
  const deliver = useMutation({ mutationFn: () => api("/admin/webhooks/deliver", { method: "POST" }), onSuccess: () => setTimeout(inv, 1500) });
  const test = useMutation({
    mutationFn: (id: number) => api<{ status: string; response_code: number | null; error: string | null }>(`/admin/webhooks/${id}/test`, { method: "POST" }),
    onSuccess: (r) => {
      inv();
      if (r.status === "delivered") toast.success(`Test event delivered (HTTP ${r.response_code}).`);
      else toast.error(`Test event not delivered: ${r.error ?? r.status}.`);
    },
    onError: (e) => toast.error(e.message),
  });

  return (
    <div>
      <PageHeader
        title="Webhooks"
        subtitle="Send grievance events to n8n, Zapier or any HTTPS endpoint. Payloads carry IDs, status and routing, never complaint text or citizen identity, and are signed with HMAC-SHA256 in the X-Grievance-Signature header."
        actions={<Button variant="secondary" onClick={() => deliver.mutate()} loading={deliver.isPending}>Deliver pending now</Button>}
      />
      <div className="grid gap-6 xl:grid-cols-[380px_1fr]">
        <div className="space-y-6">
          <Card title="Register a webhook">
            <div className="space-y-3">
              <Field label="Name" htmlFor="wn"><Input id="wn" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
              <Field label="URL" htmlFor="wu" hint="For n8n use the Webhook node's production URL. For Zapier use a Catch Hook URL.">
                <Input id="wu" inputMode="url" value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })} />
              </Field>
              <button type="button" className="text-[13px] font-medium text-brand-700 hover:underline" onClick={() => setForm({ name: form.name || "Built-in mock receiver", url: MOCK_URL, events: [] })}>
                Use the built-in mock receiver
              </button>
              <fieldset>
                <legend className="mb-1.5 text-sm font-medium">Events (leave empty for all)</legend>
                <div className="space-y-1">
                  {q.data?.events.map((ev) => (
                    <label key={ev} className="flex items-center gap-2 text-sm">
                      <input type="checkbox" className="h-4 w-4 accent-brand-700" checked={form.events.includes(ev)} onChange={(e) => setForm({ ...form, events: e.target.checked ? [...form.events, ev] : form.events.filter((x) => x !== ev) })} />
                      <span className="font-mono text-[12px]">{ev}</span>
                    </label>
                  ))}
                </div>
              </fieldset>
              <Button onClick={() => create.mutate()} loading={create.isPending} disabled={!form.name || !/^https?:\/\//.test(form.url)}>Add webhook</Button>
              {create.error && <Alert tone="critical">{create.error.message}</Alert>}
            </div>
          </Card>
          <Card title="Connecting n8n or Zapier">
            <ol className="list-decimal space-y-2 pl-5 text-[13px] leading-relaxed text-ink-soft">
              <li>Create a workflow that starts with a Webhook (n8n) or Catch Hook (Zapier) trigger and copy its URL here.</li>
              <li>Press <em>Send test event</em>. The workflow receives a signed <code className="font-mono">webhook.test</code> event.</li>
              <li>To verify the sender, compute HMAC-SHA256 of the raw body with WEBHOOK_SIGNING_SECRET and compare it with the X-Grievance-Signature header.</li>
              <li>Route on the <code className="font-mono">event</code> field, for example send an SMS on grievance.escalated.</li>
            </ol>
          </Card>
        </div>

        <div className="space-y-6">
          {q.isLoading && <SkeletonRows />}
          {q.isError && <ErrorState error={q.error} />}
          {q.data?.items.length === 0 && <EmptyState title="No webhooks registered" body="Events are queued only after at least one webhook exists. Add the built-in mock receiver to try it without external services." />}
          {q.data?.items.map((h) => (
            <Card
              key={h.id}
              title={<span className="flex flex-wrap items-center gap-2">{h.name} <Badge tone={h.is_active ? "good" : "neutral"}>{h.is_active ? "active" : "paused"}</Badge></span>}
              subtitle={<span className="break-all font-mono">{h.url}</span>}
              action={
                <div className="flex flex-wrap gap-1">
                  <Button size="sm" variant="secondary" onClick={() => test.mutate(h.id)} loading={test.isPending && test.variables === h.id}>Send test event</Button>
                  <Button size="sm" variant="ghost" onClick={() => toggle.mutate(h)}>{h.is_active ? "Pause" : "Resume"}</Button>
                  <Button size="sm" variant="ghost" onClick={() => remove.mutate(h.id)}>Delete</Button>
                </div>
              }
            >
              <p className="mb-3 text-[12px] text-ink-muted">Events: {h.events.length ? h.events.join(", ") : "all"}</p>
              {h.deliveries.length === 0 ? <p className="text-sm text-ink-muted">No deliveries yet.</p> : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[480px] text-[12px]">
                    <thead className="text-left uppercase tracking-[0.06em] text-ink-muted"><tr><th className="pb-1.5">When</th><th className="pb-1.5">Event</th><th className="pb-1.5">Status</th><th className="pb-1.5 text-right">Attempts</th><th className="pb-1.5">Result</th></tr></thead>
                    <tbody className="divide-y divide-line">
                      {h.deliveries.map((d) => (
                        <tr key={d.id}>
                          <td className="py-1.5">{fmtDate(d.created_at)}</td>
                          <td className="py-1.5 font-mono">{d.event}</td>
                          <td className="py-1.5"><Badge tone={d.status === "delivered" ? "good" : d.status === "failed" ? "critical" : "neutral"}>{d.status}</Badge></td>
                          <td className="py-1.5 text-right tabular-nums">{d.attempts}</td>
                          <td className="py-1.5 text-ink-muted">{d.response_code ?? d.last_error ?? "n/a"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
          ))}

          <Card title="Built-in mock receiver" subtitle={<span className="break-all">Stands in for an n8n or Zapier trigger at <span className="font-mono">{MOCK_URL}</span>. Keeps the last 50 events in memory.</span>}>
            {rx.isError && <ErrorState error={rx.error} />}
            {rx.data?.count === 0 && <p className="text-sm text-ink-muted">Nothing received yet. Register the mock receiver above and send a test event.</p>}
            <ul className="divide-y divide-line">
              {rx.data?.items.slice(0, 10).map((r, i) => (
                <li key={i} className="py-2.5">
                  <div className="flex flex-wrap items-center gap-2 text-[12px]">
                    <span className="font-mono font-semibold text-ink">{r.event ?? "unknown"}</span>
                    <Badge tone={r.signature_valid ? "good" : "critical"}>{r.signature_valid ? "signature valid" : "signature invalid"}</Badge>
                    <span className="text-ink-muted">{fmtDate(r.received_at)}</span>
                  </div>
                  <pre className="mt-1.5 max-h-32 overflow-auto whitespace-pre-wrap break-words rounded-md border border-line bg-canvas p-2 font-mono text-[11px]">{JSON.stringify(r.payload, null, 2)}</pre>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      </div>
    </div>
  );
}
