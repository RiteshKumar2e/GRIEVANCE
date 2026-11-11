import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { SourceBadge } from "../../components/domain";
import { Alert, Badge, Button, Card, ErrorState, Field, Input, Modal, PageHeader, Select, SkeletonRows } from "../../components/ui";
import { useToast } from "../../components/Toast";
import { api } from "../../lib/api";

interface Dept { code: string; name: string; name_hi: string | null; email: string | null; phone: string | null; is_active: boolean; officers: number; open_grievances: number; categories: string[]; data_source: string }
interface Off { code: string; name: string; designation: string; department_code: string; email: string | null; wards: string[]; max_active_cases: number; open_cases: number; handles_sensitive: boolean; is_active: boolean; has_login: boolean; data_source: string }

const EMPTY = { email: "", full_name: "", password: "", officer_code: "", department_code: "", designation: "Officer", max_active_cases: 25, handles_sensitive: false };

export default function AdminDepartments() {
  const qc = useQueryClient();
  const [dept, setDept] = useState("");
  const depts = useQuery({ queryKey: ["admin", "departments"], queryFn: () => api<Dept[]>("/admin/departments") });
  const offs = useQuery({ queryKey: ["admin", "officers", dept], queryFn: () => api<Off[]>(`/admin/officers${dept ? `?department=${dept}` : ""}`) });
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const create = useMutation({
    mutationFn: () => api("/admin/officers", { body: { ...form, officer_code: form.officer_code.toUpperCase() } }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["admin"] });
      setCreating(false);
      setForm(EMPTY);
    },
  });
  const toast = useToast();
  const [editing, setEditing] = useState<Dept | null>(null);
  const toggle = useMutation({
    mutationFn: (o: Off) => api(`/admin/officers/${o.code}`, { method: "PATCH", body: { is_active: !o.is_active } }),
    onSuccess: (_, o) => {
      toast.success(`${o.name} ${o.is_active ? "deactivated" : "activated"}.`);
      void qc.invalidateQueries({ queryKey: ["admin", "officers"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Update failed."),
  });

  return (
    <div>
      <PageHeader title="Departments" subtitle="Department records and the officers associated with each one. Select a department to filter its officers. Bulk updates can be imported from System Settings → Datasets." actions={<Button onClick={() => setCreating(true)}>Add officer</Button>} />
      {depts.isError && <ErrorState error={depts.error} />}
      {depts.isLoading && <SkeletonRows />}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {depts.data?.map((d) => (
          <div key={d.code} className={`rounded-lg border bg-surface p-4 transition-colors ${dept === d.code ? "border-brand-500 ring-2 ring-brand-100" : "border-line"}`}>
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="font-semibold">{d.name}</p>
                <p className="text-xs text-ink-muted"><span className="font-mono">{d.code}</span> · {d.email ?? "no e-mail"}</p>
              </div>
              <span className="flex shrink-0 gap-1">{!d.is_active && <Badge tone="outline">Inactive</Badge>}<SourceBadge source={d.data_source} /></span>
            </div>
            <p className="mt-3 text-sm text-ink-soft"><span className="font-semibold tabular-nums text-ink">{d.open_grievances}</span> open · <span className="tabular-nums">{d.officers}</span> officers · {d.categories.length} categories</p>
            <div className="mt-3 flex gap-2">
              <Button size="sm" variant={dept === d.code ? "primary" : "secondary"} aria-pressed={dept === d.code} onClick={() => setDept(dept === d.code ? "" : d.code)}>
                {dept === d.code ? "Showing officers" : "Show officers"}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setEditing(d)}>Edit details<span className="sr-only"> for {d.name}</span></Button>
            </div>
          </div>
        ))}
      </div>

      <Card className="mt-6" title={dept ? `Officers · ${dept}` : "All officers"} action={dept && <Button size="sm" variant="ghost" onClick={() => setDept("")}>Show all</Button>}>
        {offs.isLoading && <SkeletonRows />}
        {offs.data && (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-sm">
              <thead className="text-left text-xs uppercase tracking-wide text-ink-muted">
                <tr><th className="pb-2">Officer</th><th className="pb-2">Dept</th><th className="pb-2">Wards</th><th className="pb-2 text-right">Load</th><th className="pb-2">Flags</th><th className="pb-2" /></tr>
              </thead>
              <tbody className="divide-y divide-line">
                {offs.data.map((o) => (
                  <tr key={o.code} className={o.is_active ? "" : "opacity-50"}>
                    <td className="py-2"><p className="font-medium">{o.name}</p><p className="text-xs text-ink-muted"><span className="font-mono">{o.code}</span> · {o.designation} · {o.email ?? "no login"}</p></td>
                    <td className="py-2">{o.department_code}</td>
                    <td className="py-2 text-xs text-ink-soft">{o.wards.length ? o.wards.join(", ") : "All wards"}</td>
                    <td className="py-2 text-right tabular-nums">{o.open_cases}/{o.max_active_cases}</td>
                    <td className="space-x-1 py-2">{o.handles_sensitive && <Badge tone="critical">Sensitive cases</Badge>}<SourceBadge source={o.data_source} /></td>
                    <td className="py-2 text-right"><Button size="sm" variant="ghost" onClick={() => toggle.mutate(o)}>{o.is_active ? "Deactivate" : "Activate"}</Button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {editing && <EditDepartment d={editing} onClose={() => setEditing(null)} />}
      <Modal open={creating} title="Add officer" onClose={() => setCreating(false)} footer={<><Button variant="secondary" onClick={() => setCreating(false)}>Cancel</Button><Button onClick={() => create.mutate()} loading={create.isPending} disabled={!form.email || !form.full_name || form.password.length < 8 || !form.officer_code || !form.department_code}>Create</Button></>}>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Full name" htmlFor="n"><Input id="n" value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} /></Field>
          <Field label="Officer code" htmlFor="c" hint="e.g. OFF-WATER-04"><Input id="c" value={form.officer_code} onChange={(e) => setForm({ ...form, officer_code: e.target.value })} /></Field>
          <Field label="E-mail (login)" htmlFor="e"><Input id="e" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></Field>
          <Field label="Initial password" htmlFor="p"><Input id="p" type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} /></Field>
          <Field label="Department" htmlFor="d">
            <Select id="d" value={form.department_code} onChange={(e) => setForm({ ...form, department_code: e.target.value })}>
              <option value="">Select…</option>
              {depts.data?.map((d) => <option key={d.code} value={d.code}>{d.name}</option>)}
            </Select>
          </Field>
          <Field label="Max active cases" htmlFor="m"><Input id="m" type="number" min={1} value={form.max_active_cases} onChange={(e) => setForm({ ...form, max_active_cases: Number(e.target.value) })} /></Field>
        </div>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="h-4 w-4 accent-brand-800" checked={form.handles_sensitive} onChange={(e) => setForm({ ...form, handles_sensitive: e.target.checked })} /> Authorised for sensitive cases</label>
        {create.error && <Alert tone="critical">{create.error.message}</Alert>}
      </Modal>
    </div>
  );
}

function EditDepartment({ d, onClose }: { d: Dept; onClose: () => void }) {
  const qc = useQueryClient();
  const toast = useToast();
  const [f, setF] = useState({ name: d.name, email: d.email ?? "", phone: d.phone ?? "", is_active: d.is_active });
  const [error, setError] = useState<string | null>(null);
  const m = useMutation({
    mutationFn: () => {
      const body: Record<string, unknown> = {};
      if (f.name.trim() !== d.name) body.name = f.name.trim();
      if (f.email.trim() && f.email.trim() !== (d.email ?? "")) body.email = f.email.trim();
      if (f.phone.trim() && f.phone.trim() !== (d.phone ?? "")) body.phone = f.phone.trim();
      if (f.is_active !== d.is_active) body.is_active = f.is_active;
      if (!Object.keys(body).length) return Promise.reject(new Error("Nothing has changed."));
      return api(`/admin/departments/${d.code}`, { method: "PATCH", body });
    },
    onSuccess: () => {
      toast.success(`${d.code} updated.`);
      void qc.invalidateQueries({ queryKey: ["admin", "departments"] });
      void qc.invalidateQueries({ queryKey: ["meta"] });
      onClose();
    },
    onError: (e) => setError(e instanceof Error ? e.message : "Update failed."),
  });
  return (
    <Modal open title={`Edit ${d.name}`} onClose={onClose} footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button onClick={() => m.mutate()} loading={m.isPending} disabled={f.name.trim().length < 2}>Save changes</Button></>}>
      {error && <Alert tone="critical">{error}</Alert>}
      <Field label="Name" htmlFor="dn"><Input id="dn" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
      <Field label="Contact e-mail" htmlFor="de"><Input id="de" type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></Field>
      <Field label="Contact phone" htmlFor="dp"><Input id="dp" type="tel" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} /></Field>
      <label className="flex items-start gap-2 text-sm">
        <input type="checkbox" className="mt-0.5 h-4 w-4 accent-brand-700" checked={f.is_active} onChange={(e) => setF({ ...f, is_active: e.target.checked })} />
        <span>Active<span className="block text-[13px] text-ink-muted">A department can be deactivated only after its open grievances and active categories have been moved.</span></span>
      </label>
    </Modal>
  );
}
