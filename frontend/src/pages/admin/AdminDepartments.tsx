import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { SourceBadge } from "../../components/domain";
import { Alert, Badge, Button, Card, ErrorState, Field, Input, Modal, PageHeader, Select, SkeletonRows } from "../../components/ui";
import { api } from "../../lib/api";

interface Dept { code: string; name: string; name_hi: string | null; email: string | null; officers: number; open_grievances: number; categories: string[]; data_source: string }
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
  const toggle = useMutation({
    mutationFn: (o: Off) => api(`/admin/officers/${o.code}`, { method: "PATCH", body: { is_active: !o.is_active } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin", "officers"] }),
  });

  return (
    <div>
      <PageHeader title="Department directory" subtitle="Departments and officers used for assignment. Import the official directory from Datasets." actions={<Button onClick={() => setCreating(true)}>Add officer</Button>} />
      {depts.isError && <ErrorState error={depts.error} />}
      {depts.isLoading && <SkeletonRows />}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {depts.data?.map((d) => (
          <button key={d.code} onClick={() => setDept(dept === d.code ? "" : d.code)} className={`rounded-lg border bg-white p-4 text-left shadow-card transition-colors ${dept === d.code ? "border-brand-500 ring-2 ring-brand-100" : "border-line hover:border-brand-300"}`}>
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="font-semibold">{d.name}</p>
                <p className="text-xs text-ink-muted"><span className="font-mono">{d.code}</span> · {d.name_hi}</p>
              </div>
              <SourceBadge source={d.data_source} />
            </div>
            <p className="mt-3 text-sm text-ink-soft"><span className="font-semibold tabular-nums text-ink">{d.open_grievances}</span> open · <span className="tabular-nums">{d.officers}</span> officers · {d.categories.length} categories</p>
          </button>
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
