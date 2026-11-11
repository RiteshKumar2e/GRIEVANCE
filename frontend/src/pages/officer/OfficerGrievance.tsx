import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, type Dispatch, type ReactNode, type SetStateAction } from "react";
import { Link, useParams } from "react-router-dom";
import { useToast } from "../../components/Toast";
import { ConfidenceMeter, ReasoningList, SensitiveBadge, SlaIndicator, SourceBadge, StatusBadge, Timeline, UrgencyBadge } from "../../components/domain";
import { Alert, Badge, Button, Card, ErrorState, Field, Input, Modal, PageHeader, Select, Spinner, Textarea } from "../../components/ui";
import { api } from "../../lib/api";
import { useAuth } from "../../lib/auth";
import { fmtDate, pct, titleCase } from "../../lib/format";
import type { CategoryMeta, GrievanceDetail } from "../../lib/types";

type FormState = { note: string; category_code: string; officer_code: string; resolution: string };
type Action = null | "review" | "progress" | "resolve" | "close" | "reassign" | "escalate";

export default function OfficerGrievance() {
  const { id = "" } = useParams();
  const { user } = useAuth();
  const qc = useQueryClient();
  const key = ["officer", "grievance", id];
  const q = useQuery({ queryKey: key, queryFn: () => api<GrievanceDetail>(`/officer/grievances/${id}`) });
  const cats = useQuery({ queryKey: ["meta", "categories"], queryFn: () => api<CategoryMeta[]>("/meta/categories") });
  const [action, setAction] = useState<Action>(null);
  const [form, setForm] = useState<FormState>({ note: "", category_code: "", officer_code: "", resolution: "" });
  const [noteBody, setNoteBody] = useState("");
  const [showAudit, setShowAudit] = useState(false);

  const toast = useToast();
  const done = (g: GrievanceDetail) => {
    toast.success(`${g.public_id} updated: ${g.status.replace("_", " ").toLowerCase()}.`);
    qc.setQueryData(key, g);
    void qc.invalidateQueries({ queryKey: ["officer"] });
    setAction(null);
    setForm({ note: "", category_code: "", officer_code: "", resolution: "" });
  };
  const run = useMutation({
    mutationFn: async (a: Exclude<Action, null>) => {
      const base = `/officer/grievances/${id}`;
      switch (a) {
        case "review":
          return api<GrievanceDetail>(`${base}/review`, { body: { note: form.note, category_code: form.category_code || undefined, officer_code: form.officer_code || undefined } });
        case "progress":
          return api<GrievanceDetail>(`${base}/status`, { body: { status: "IN_PROGRESS", note: form.note } });
        case "resolve":
          return api<GrievanceDetail>(`${base}/status`, { body: { status: "RESOLVED", note: form.note, resolution_summary: form.resolution } });
        case "close":
          return api<GrievanceDetail>(`${base}/status`, { body: { status: "CLOSED", note: form.note } });
        case "reassign":
          return api<GrievanceDetail>(`${base}/reassign`, { body: { officer_code: form.officer_code, note: form.note } });
        case "escalate":
          return api<GrievanceDetail>(`${base}/escalate`, { body: { reason: form.note } });
      }
    },
    onSuccess: done,
  });
  const addNote = useMutation({
    mutationFn: () => api<GrievanceDetail>(`/officer/grievances/${id}/notes`, { body: { body: noteBody } }),
    onSuccess: (g) => {
      qc.setQueryData(key, g);
      toast.success("Note added.");
      setNoteBody("");
    },
  });
  const unlink = useMutation({
    mutationFn: (other: string) => api<GrievanceDetail>(`/officer/grievances/${id}/duplicates/${other}/unlink`, { body: { note: "Not the same issue (officer review)" } }),
    onSuccess: (g) => qc.setQueryData(key, g),
  });

  if (q.isLoading) return <Spinner />;
  if (q.isError) return <ErrorState error={q.error} onRetry={() => q.refetch()} />;
  const g = q.data!;
  const pol = g.policy_explanation;
  const open = !["RESOLVED", "CLOSED"].includes(g.status);
  const sensitiveBlocked = g.is_sensitive && user?.role === "officer" && !g.eligible_officers?.some((o) => o.handles_sensitive && o.code === user.officer_code);

  const actionCfg: Record<Exclude<Action, null>, { title: string; submit: string; valid: boolean; body: ReactNode }> = {
    review: {
      title: "Human review decision",
      submit: "Approve & assign",
      valid: form.note.trim().length >= 3,
      body: (
        <>
          <Field label="Category" htmlFor="rc" hint="Change only if the AI classification is wrong. SLA and routing will follow the Category Master.">
            <Select id="rc" value={form.category_code || g.category?.code} onChange={(e) => setForm((f) => ({ ...f, category_code: e.target.value }))}>
              {cats.data?.map((c) => <option key={c.code} value={c.code}>{c.name_en}{c.is_sensitive ? " (sensitive)" : ""}</option>)}
            </Select>
          </Field>
          <Field label="Assign to officer" htmlFor="ro" hint="Leave on automatic to pick the least-loaded eligible officer.">
            <Select id="ro" value={form.officer_code} onChange={(e) => setForm((f) => ({ ...f, officer_code: e.target.value }))}>
              <option value="">Automatic (least loaded)</option>
              {g.eligible_officers?.filter((o) => !g.is_sensitive || o.handles_sensitive).map((o) => <option key={o.code} value={o.code}>{o.name} · {o.code}</option>)}
            </Select>
          </Field>
          <Field label="Review note (recorded in the audit log)" htmlFor="rn">
            <Textarea id="rn" rows={3} value={form.note} onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))} />
          </Field>
        </>
      ),
    },
    progress: { title: "Start work", submit: "Mark in progress", valid: true, body: <NoteField form={form} setForm={setForm} label="Note to citizen (optional)" /> },
    resolve: {
      title: "Resolve grievance",
      submit: "Mark resolved",
      valid: form.resolution.trim().length >= 10,
      body: (
        <>
          <Field label="Resolution summary (shown to the citizen)" htmlFor="res" hint="Describe the action taken. The citizen will be asked to confirm or dispute.">
            <Textarea id="res" rows={4} value={form.resolution} onChange={(e) => setForm((f) => ({ ...f, resolution: e.target.value }))} />
          </Field>
        </>
      ),
    },
    close: { title: "Close grievance", submit: "Close", valid: form.note.trim().length >= 3, body: <NoteField form={form} setForm={setForm} label="Reason for closing without citizen confirmation" /> },
    reassign: {
      title: "Reassign",
      submit: "Reassign",
      valid: !!form.officer_code && form.note.trim().length >= 3,
      body: (
        <>
          <Field label="Officer" htmlFor="ra">
            <Select id="ra" value={form.officer_code} onChange={(e) => setForm((f) => ({ ...f, officer_code: e.target.value }))}>
              <option value="">Select…</option>
              {g.eligible_officers?.filter((o) => (!g.is_sensitive || o.handles_sensitive) && o.code !== g.assigned_officer?.code).map((o) => <option key={o.code} value={o.code}>{o.name} · {o.code}</option>)}
            </Select>
          </Field>
          <NoteField form={form} setForm={setForm} label="Reason" />
        </>
      ),
    },
    escalate: { title: "Escalate to senior officers", submit: "Escalate", valid: form.note.trim().length >= 5, body: <NoteField form={form} setForm={setForm} label="Reason for escalation" /> },
  };

  return (
    <div>
      <PageHeader
        eyebrow={<Link to={g.status === "PENDING_REVIEW" ? "/officer/review" : "/officer"} className="text-sm text-brand-700 hover:underline">← Back to queue</Link>}
        title={g.title}
        subtitle={
          <span className="flex flex-wrap items-center gap-2">
            <span className="font-mono">{g.public_id}</span>
            <StatusBadge status={g.status} />
            <UrgencyBadge urgency={g.urgency} />
            {g.is_sensitive && <SensitiveBadge hidden={g.identity_hidden} />}
            {g.escalation_level > 0 && <Badge tone="serious">Escalation L{g.escalation_level}</Badge>}
            <SourceBadge source={g.data_source} />
          </span>
        }
        actions={
          <>
            {g.status === "PENDING_REVIEW" && (
              <Button onClick={() => setAction("review")} disabled={sensitiveBlocked}>
                Review and assign
              </Button>
            )}
            {["ASSIGNED", "REOPENED"].includes(g.status) && <Button onClick={() => setAction("progress")}>Start work</Button>}
            {["ASSIGNED", "IN_PROGRESS", "REOPENED"].includes(g.status) && <Button variant="accent" onClick={() => setAction("resolve")}>Resolve</Button>}
            {g.status === "RESOLVED" && <Button variant="secondary" onClick={() => setAction("close")}>Close</Button>}
            {["ASSIGNED", "IN_PROGRESS", "REOPENED"].includes(g.status) && <Button variant="secondary" onClick={() => setAction("reassign")}>Reassign</Button>}
            {open && <Button variant="secondary" onClick={() => setAction("escalate")}>Escalate</Button>}
          </>
        }
      />
      {sensitiveBlocked && <div className="mb-4"><Alert tone="warning">Only officers authorised for sensitive cases can review this grievance.</Alert></div>}

      <div className="grid gap-5 xl:grid-cols-[1fr_380px]">
        <div className="space-y-5">
          <Card title="AI summary" subtitle={g.ai_provider ? `Intake by ${g.ai_provider}` : undefined}>
            <p className="text-sm text-ink">{g.ai_summary || "—"}</p>
            <details className="mt-3">
              <summary className="cursor-pointer text-sm font-medium text-brand-700">Original complaint ({g.language.toUpperCase()}, {g.input_mode})</summary>
              <p className="mt-2 whitespace-pre-wrap rounded-md bg-canvas p-3 text-sm" lang={g.language}>{g.description}</p>
            </details>
          </Card>

          {pol && (
            <Card title="Policy decision" subtitle="Deterministic policy gate. LLM output is advisory only.">
              <div className="grid gap-4 sm:grid-cols-3">
                <div>
                  <p className="text-xs text-ink-muted">Confidence vs threshold</p>
                  <div className="mt-1"><ConfidenceMeter value={pol.confidence} threshold={pol.threshold} /></div>
                </div>
                <div>
                  <p className="text-xs text-ink-muted">Human review</p>
                  <p className="mt-0.5 text-sm font-medium">{pol.requires_human_review ? "Required" : "Not required"}</p>
                </div>
                <div>
                  <p className="text-xs text-ink-muted">SLA from Category Master</p>
                  <p className="mt-0.5 text-sm font-medium">{pol.sla_hours} h</p>
                </div>
              </div>
              {!!g.review_reasons?.length && (
                <ul className="mt-4 list-disc space-y-1 pl-5 text-sm text-amber-900">
                  {g.review_reasons.map((r) => <li key={r}>{r}</li>)}
                </ul>
              )}
              <div className="mt-4 space-y-1.5">
                {pol.policy_refs.map((ref) => (
                  <p key={ref} className="text-xs text-ink-soft">
                    <span className="mr-2 font-mono font-semibold text-ink">{ref}</span>
                    {pol.policy_text?.[ref]}
                  </p>
                ))}
              </div>
              {(pol.intake_reasoning?.length || pol.reasoning?.length) ? (
                <details className="mt-4 border-t border-line pt-3" open>
                  <summary className="cursor-pointer text-[13px] font-semibold text-ink">Why the AI decided this</summary>
                  <div className="mt-3 grid gap-5 lg:grid-cols-2">
                    <div>
                      <p className="mb-2 text-[12px] font-medium uppercase tracking-[0.06em] text-ink-muted">Intake agent</p>
                      <ReasoningList lines={pol.intake_reasoning ?? []} compact />
                    </div>
                    <div>
                      <p className="mb-2 text-[12px] font-medium uppercase tracking-[0.06em] text-ink-muted">Policy gate</p>
                      <ReasoningList lines={pol.reasoning ?? []} compact />
                    </div>
                  </div>
                </details>
              ) : null}
              <p className="mt-3 text-xs text-ink-muted">
                AI may: {pol.allowed_ai_actions.map(titleCase).join(", ")}. AI may never: {pol.forbidden_ai_actions.map(titleCase).join(", ")}.
              </p>
            </Card>
          )}

          <Card title="Case memory: similar resolved grievances" subtitle="Retrieved by multilingual semantic search. Supporting evidence only, never a decision.">
            {!g.precedents?.length && <p className="text-sm text-ink-muted">No comparable resolved grievances found.</p>}
            <ul className="space-y-3">
              {g.precedents?.map((p) => (
                <li key={p.public_id} className="rounded-md border border-line p-3">
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <span className="font-mono font-semibold">{p.public_id}</span>
                    <Badge tone="outline">{p.scope} match</Badge>
                    <span className="tabular-nums text-ink-muted">similarity {pct(p.similarity)}</span>
                    <SourceBadge source={p.data_source} />
                  </div>
                  <p className="mt-1.5 text-sm text-ink-soft">{p.summary}</p>
                </li>
              ))}
            </ul>
          </Card>

          <Card title="Linked reports" subtitle="Duplicate grouping links reports; each keeps its own ID, status and notifications.">
            {!g.duplicates?.length && <p className="text-sm text-ink-muted">No linked reports.</p>}
            <ul className="divide-y divide-line">
              {g.duplicates?.map((d) => (
                <li key={d.public_id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                  <div className="min-w-0">
                    <Link to={`/officer/grievances/${d.public_id}`} className="font-mono text-sm font-semibold text-brand-700 hover:underline">{d.public_id}</Link>
                    <p className="truncate text-sm text-ink-soft">{d.title} · {d.ward}</p>
                    <p className="text-xs text-ink-muted">
                      score {pct(d.score)} · semantic {pct(d.signals.semantic ?? null)} · geo {pct(d.signals.geo ?? null)} · time {pct(d.signals.time ?? null)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <StatusBadge status={d.status} />
                    <Button size="sm" variant="ghost" onClick={() => unlink.mutate(d.public_id)} loading={unlink.isPending && unlink.variables === d.public_id} title="Remove this link">
                      Unlink
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          </Card>

          <Card title="Officer notes" subtitle="Internal — never shown to the citizen.">
            <ul className="mb-4 space-y-3">
              {g.notes?.map((n) => (
                <li key={n.id} className="rounded-md bg-canvas p-3 text-sm">
                  <p className="whitespace-pre-wrap">{n.body}</p>
                  <p className="mt-1 text-xs text-ink-muted">{n.author} · {fmtDate(n.created_at)}</p>
                </li>
              ))}
              {!g.notes?.length && <li className="text-sm text-ink-muted">No notes yet.</li>}
            </ul>
            <div className="flex gap-2">
              <Input aria-label="New note" placeholder="Add an internal note…" value={noteBody} onChange={(e) => setNoteBody(e.target.value)} />
              <Button variant="secondary" onClick={() => addNote.mutate()} disabled={noteBody.trim().length < 2} loading={addNote.isPending}>Add</Button>
            </div>
          </Card>
        </div>

        <aside className="space-y-5">
          <Card title="SLA">
            <SlaIndicator sla={g.sla} closed={!open} />
            {g.sla?.predicted_resolution_hours != null && (
              <dl className="mt-3 grid grid-cols-2 gap-3 text-sm">
                <div><dt className="text-xs text-ink-muted">Predicted resolution</dt><dd className="font-medium tabular-nums">{g.sla.predicted_resolution_hours} h</dd></div>
                <div><dt className="text-xs text-ink-muted">Breach probability</dt><dd className="font-medium tabular-nums">{pct(g.sla.breach_probability)}</dd></div>
                {g.sla.basis?.department_load && (
                  <div className="col-span-2"><dt className="text-xs text-ink-muted">Department load</dt><dd className="font-medium tabular-nums">{g.sla.basis.department_load.open} open / {g.sla.basis.department_load.capacity} capacity</dd></div>
                )}
              </dl>
            )}
            {g.sla?.estimate_label && <p className="mt-3 text-xs text-saffron-700">{g.sla.estimate_label}</p>}
          </Card>
          <Card title="Routing">
            <dl className="space-y-2.5 text-sm">
              <div><dt className="text-xs text-ink-muted">Category</dt><dd className="font-medium">{g.category?.name_en}</dd></div>
              <div><dt className="text-xs text-ink-muted">Department</dt><dd className="font-medium">{g.department?.name ?? "—"}</dd></div>
              <div><dt className="text-xs text-ink-muted">Assigned officer</dt><dd className="font-medium">{g.assigned_officer ? `${g.assigned_officer.name} (${g.assigned_officer.code})` : "Unassigned"}</dd></div>
              <div><dt className="text-xs text-ink-muted">Location</dt><dd className="font-medium">{g.location_text || "—"}{g.ward ? ` · ${g.ward}` : ""}</dd></div>
              <div>
                <dt className="text-xs text-ink-muted">Complainant</dt>
                <dd className="font-medium">{g.citizen ? (g.citizen.protected ? <span className="text-red-800">Identity protected</span> : `${g.citizen.name}${g.citizen.phone ? ` · ${g.citizen.phone}` : ""}`) : "—"}</dd>
              </div>
            </dl>
          </Card>
          <Card title="Status history"><Timeline items={g.status_history} /></Card>
          <Card title="Audit trail" action={<Button size="sm" variant="ghost" onClick={() => setShowAudit((s) => !s)}>{showAudit ? "Hide" : `Show ${g.audit?.length ?? 0}`}</Button>}>
            {showAudit ? (
              <ul className="space-y-3 text-xs">
                {g.audit?.map((a, i) => (
                  <li key={i} className="border-l-2 border-line pl-3">
                    <p className="font-semibold text-ink">{a.action}</p>
                    <p className="text-ink-muted">{a.actor === "AI_SYSTEM" ? `AI_SYSTEM · ${a.provider} · ${a.model}` : a.actor_type} · {fmtDate(a.created_at)}</p>
                    {a.confidence !== null && <p className="text-ink-muted">confidence {pct(a.confidence)}</p>}
                    {!!a.policy_refs.length && <p className="font-mono text-ink-muted">{a.policy_refs.join(" ")}</p>}
                    {a.trace_id && user?.role === "admin" && <Link className="text-brand-700 hover:underline" to={`/admin/observability/${a.trace_id}`}>trace</Link>}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-ink-muted">Every AI and human action on this grievance is recorded.</p>
            )}
          </Card>
        </aside>
      </div>

      {action && (
        <Modal
          open
          title={actionCfg[action].title}
          onClose={() => setAction(null)}
          footer={
            <>
              <Button variant="secondary" onClick={() => setAction(null)}>Cancel</Button>
              <Button onClick={() => run.mutate(action)} disabled={!actionCfg[action].valid} loading={run.isPending} variant={action === "escalate" ? "danger" : "primary"}>
                {actionCfg[action].submit}
              </Button>
            </>
          }
        >
          {actionCfg[action].body}
          {run.error && <Alert tone="critical">{run.error.message}</Alert>}
        </Modal>
      )}
    </div>
  );
}

function NoteField({ form, setForm, label }: { form: FormState; setForm: Dispatch<SetStateAction<FormState>>; label: string }) {
  return (
    <Field label={label} htmlFor="note">
      <Textarea id="note" rows={3} value={form.note} onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))} />
    </Field>
  );
}
