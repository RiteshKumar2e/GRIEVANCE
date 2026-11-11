import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { SourceBadge } from "../../components/domain";
import { Alert, Badge, Button, ErrorState, Field, Input, Modal, PageHeader, Select, SkeletonRows } from "../../components/ui";
import { api } from "../../lib/api";

interface Cat {
  code: string; name_en: string; name_hi: string | null; name_mr: string | null; description: string; department_code: string | null;
  sla_hours: number; is_sensitive: boolean; hide_identity: boolean; confidence_threshold: number; auto_close_allowed: boolean;
  default_urgency: string; keywords: Record<string, string[]>; is_active: boolean; data_source: string;
}

export default function AdminCategories() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["admin", "categories"], queryFn: () => api<Cat[]>("/admin/categories") });
  const depts = useQuery({ queryKey: ["meta", "departments"], queryFn: () => api<{ code: string; name: string }[]>("/meta/departments") });
  const [edit, setEdit] = useState<Cat | null>(null);
  const save = useMutation({
    mutationFn: (c: Cat) =>
      api(`/admin/categories/${c.code}`, {
        method: "PATCH",
        body: { sla_hours: c.sla_hours, confidence_threshold: c.confidence_threshold, is_sensitive: c.is_sensitive, hide_identity: c.hide_identity, auto_close_allowed: c.auto_close_allowed, is_active: c.is_active, department_code: c.department_code },
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["admin", "categories"] });
      void qc.invalidateQueries({ queryKey: ["meta"] });
      setEdit(null);
    },
  });

  return (
    <div>
      <PageHeader title="Category Master" subtitle="Controls department mapping, SLA, sensitivity, identity hiding and the confidence threshold used by the policy gate. Changes take effect for new grievances immediately and are audited." />
      {q.isLoading && <SkeletonRows rows={8} />}
      {q.isError && <ErrorState error={q.error} onRetry={() => q.refetch()} />}
      {q.data && (
        <div className="overflow-x-auto rounded-lg border border-line bg-white">
          <table className="w-full min-w-[900px] text-sm">
            <thead className="border-b border-line bg-canvas text-left text-xs uppercase tracking-wide text-ink-muted">
              <tr>
                <th className="px-4 py-2.5">Category</th><th className="px-3 py-2.5">Department</th><th className="px-3 py-2.5 text-right">SLA h</th>
                <th className="px-3 py-2.5 text-right">Threshold</th><th className="px-3 py-2.5">Flags</th><th className="px-3 py-2.5">Source</th><th className="px-3 py-2.5" />
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {q.data.map((c) => (
                <tr key={c.code} className={c.is_active ? "" : "opacity-50"}>
                  <td className="px-4 py-2.5">
                    <p className="font-medium">{c.name_en}</p>
                    <p className="text-xs text-ink-muted"><span className="font-mono">{c.code}</span> · {c.name_hi} · {c.name_mr}</p>
                  </td>
                  <td className="px-3 py-2.5">{c.department_code}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{c.sla_hours}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{Math.round(c.confidence_threshold * 100)}%</td>
                  <td className="space-x-1 px-3 py-2.5">
                    {c.is_sensitive && <Badge tone="critical">Sensitive</Badge>}
                    {c.hide_identity && <Badge tone="outline">ID hidden</Badge>}
                    {!c.auto_close_allowed && <Badge tone="neutral">No auto-close</Badge>}
                    {!c.is_active && <Badge tone="neutral">Inactive</Badge>}
                  </td>
                  <td className="px-3 py-2.5"><SourceBadge source={c.data_source} /></td>
                  <td className="px-3 py-2.5 text-right"><Button size="sm" variant="secondary" onClick={() => setEdit({ ...c })}>Edit</Button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {edit && (
        <Modal
          open
          title={`Edit ${edit.name_en}`}
          onClose={() => setEdit(null)}
          footer={<><Button variant="secondary" onClick={() => setEdit(null)}>Cancel</Button><Button onClick={() => save.mutate(edit)} loading={save.isPending}>Save</Button></>}
        >
          <div className="grid grid-cols-2 gap-4">
            <Field label="SLA (hours)" htmlFor="sla"><Input id="sla" type="number" min={1} value={edit.sla_hours} onChange={(e) => setEdit({ ...edit, sla_hours: Number(e.target.value) })} /></Field>
            <Field label="Confidence threshold" htmlFor="thr" hint="Between 0 and 1. Cases below this go to human review.">
              <Input id="thr" type="number" step={0.05} min={0} max={1} value={edit.confidence_threshold} onChange={(e) => setEdit({ ...edit, confidence_threshold: Number(e.target.value) })} />
            </Field>
            <div className="col-span-2">
              <Field label="Department" htmlFor="dep">
                <Select id="dep" value={edit.department_code ?? ""} onChange={(e) => setEdit({ ...edit, department_code: e.target.value })}>
                  {depts.data?.map((d) => <option key={d.code} value={d.code}>{d.name}</option>)}
                </Select>
              </Field>
            </div>
          </div>
          <div className="space-y-2 text-sm">
            {([["is_sensitive", "Sensitive (mandatory human review, never auto-closed)"], ["hide_identity", "Hide complainant identity"], ["auto_close_allowed", "Allow auto-close after the confirmation window"], ["is_active", "Active"]] as const).map(([k, label]) => (
              <label key={k} className="flex items-center gap-2">
                <input
                  type="checkbox"
                  className="h-4 w-4 accent-brand-800"
                  checked={edit[k]}
                  disabled={edit.is_sensitive && (k === "hide_identity" || k === "auto_close_allowed")}
                  onChange={(e) => setEdit({ ...edit, [k]: e.target.checked })}
                />
                {label}
              </label>
            ))}
          </div>
          {edit.is_sensitive && <Alert tone="info">Sensitive categories always hide identity and can never be auto-closed.</Alert>}
          {save.error && <Alert tone="critical">{save.error.message}</Alert>}
        </Modal>
      )}
    </div>
  );
}
