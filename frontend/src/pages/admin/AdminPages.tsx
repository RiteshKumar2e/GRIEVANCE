import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { useSystemStatus } from "../../components/AppShell";
import { CaseListPage } from "../../components/cases";
import { Panel } from "../../components/dashboard";
import { DataTable, Pagination } from "../../components/DataTable";
import { IconSearch } from "../../components/icons";
import { PasswordInput } from "../../components/PasswordInput";
import { useToast } from "../../components/Toast";
import { Alert, Badge, Button, EmptyState, ErrorState, Field, Input, Modal, PageHeader, Select, SkeletonRows } from "../../components/ui";
import { api } from "../../lib/api";
import { ROLE_LABEL, useAuth } from "../../lib/auth";
import { fmtDate, pct, relTime } from "../../lib/format";
import type { Role } from "../../lib/types";

/* ------------------------------------------------------------------ grievance management */

export function GrievanceManagement() {
  return (
    <CaseListPage
      title="Grievance Management"
      subtitle="Every live grievance across all departments. Open a case to review, reassign, escalate or update it; every action is audited."
      query={{ scope: "all" }}
      headerActions={
        <Link to="/admin/review" className="inline-flex h-10 items-center rounded-md border border-stone-dark bg-surface px-4 text-sm font-semibold text-ink hover:bg-canvas">
          Open review queue
        </Link>
      }
      empty={{ title: "No active grievances" }}
    />
  );
}

/* ------------------------------------------------------------------ user management */

interface UserRow {
  id: number;
  email: string;
  full_name: string;
  phone: string | null;
  role: Role;
  is_active: boolean;
  department_code: string | null;
  department_name: string | null;
  officer_code: string | null;
  open_cases: number | null;
  data_source: string;
  created_at: string;
  last_login_at: string | null;
}
const PAGE = 20;

/** A staff sign-up that has never been approved (inactive, never signed in). */
const isPending = (u: UserRow) => !u.is_active && !u.last_login_at && u.role !== "citizen";

function UserStatus({ u }: { u: UserRow }) {
  if (u.is_active) return <Badge tone="good">Active</Badge>;
  if (isPending(u)) return <Badge tone="warning">Pending approval</Badge>;
  return <Badge tone="outline">Inactive</Badge>;
}

export function UserManagement() {
  const { user: me } = useAuth();
  const qc = useQueryClient();
  const toast = useToast();
  const [role, setRole] = useState("");
  const [active, setActive] = useState("");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(0);
  const [creating, setCreating] = useState(false);
  const [confirm, setConfirm] = useState<UserRow | null>(null);
  const [moveDept, setMoveDept] = useState<UserRow | null>(null);
  const params = new URLSearchParams({ limit: String(PAGE), offset: String(page * PAGE) });
  if (role) params.set("role", role);
  if (active) params.set("active", active);
  if (q.trim()) params.set("q", q.trim());
  const list = useQuery({ queryKey: ["admin", "users", params.toString()], queryFn: () => api<{ total: number; items: UserRow[] }>(`/admin/users?${params}`) });
  const summary = useQuery({ queryKey: ["admin", "users", "summary"], queryFn: () => api<{ total: number; by_role: Record<string, { active: number; inactive: number }> }>("/admin/users/summary") });

  const toggle = useMutation({
    mutationFn: (u: UserRow) => api(`/admin/users/${u.id}`, { method: "PATCH", body: { is_active: !u.is_active } }),
    onSuccess: (_, u) => {
      toast.success(`${u.full_name} ${u.is_active ? "deactivated" : "activated"}.`);
      void qc.invalidateQueries({ queryKey: ["admin", "users"] });
      setConfirm(null);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Update failed."),
  });

  return (
    <div>
      <PageHeader
        title="User Management"
        subtitle="Citizen, officer, department-admin and system-admin accounts. Deactivated users cannot sign in. Every change is audited."
        actions={<Button onClick={() => setCreating(true)}>Create account</Button>}
      />
      {summary.data && (
        <dl className="mb-5 flex flex-wrap gap-x-8 gap-y-2 text-sm">
          {(["citizen", "officer", "dept_admin", "admin"] as Role[]).map((r) => (
            <div key={r}>
              <dt className="text-[12px] text-ink-muted">{ROLE_LABEL[r]}s</dt>
              <dd className="font-semibold tabular-nums text-ink">
                {summary.data.by_role[r]?.active ?? 0}
                {summary.data.by_role[r]?.inactive ? <span className="ml-1 text-[12px] font-normal text-ink-muted">+{summary.data.by_role[r].inactive} inactive</span> : null}
              </dd>
            </div>
          ))}
        </dl>
      )}
      <div className="mb-4 grid gap-2 rounded-lg border border-line bg-surface p-3 sm:grid-cols-[1.6fr_1fr_1fr]">
        <label className="relative">
          <span className="sr-only">Search name or e-mail</span>
          <IconSearch width={16} height={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted" />
          <Input className="pl-9" placeholder="Search name or e-mail" value={q} onChange={(e) => { setQ(e.target.value); setPage(0); }} />
        </label>
        <Select aria-label="Role" value={role} onChange={(e) => { setRole(e.target.value); setPage(0); }}>
          <option value="">All roles</option>
          {(Object.keys(ROLE_LABEL) as Role[]).map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
        </Select>
        <Select aria-label="Account status" value={active} onChange={(e) => { setActive(e.target.value); setPage(0); }}>
          <option value="">Active and inactive</option>
          <option value="true">Active only</option>
          <option value="false">Inactive or pending</option>
        </Select>
      </div>

      <DataTable
        caption="User accounts"
        rows={list.data?.items}
        loading={list.isLoading}
        error={list.error}
        onRetry={() => list.refetch()}
        rowKey={(u) => u.id}
        paginate={false}
        empty={{ title: "No accounts match these filters" }}
        columns={[
          { key: "name", header: "User", render: (u) => <span><span className="font-medium text-ink">{u.full_name}</span>{u.id === me?.id && <Badge tone="brand" className="ml-2">You</Badge>}<span className="block text-[12px] text-ink-muted">{u.email}</span></span> },
          { key: "role", header: "Role", render: (u) => <span className="text-ink-soft">{ROLE_LABEL[u.role]}{u.officer_code && <span className="block font-mono text-[12px] text-ink-muted">{u.officer_code}</span>}</span> },
          { key: "dept", header: "Department", render: (u) => <span className="text-ink-soft">{u.department_name ?? "—"}</span> },
          { key: "status", header: "Status", render: (u) => <UserStatus u={u} /> },
          { key: "login", header: "Last sign-in", render: (u) => <span className="text-[13px] text-ink-soft">{u.last_login_at ? relTime(u.last_login_at) : "Never"}</span> },
          { key: "created", header: "Created", render: (u) => <span className="whitespace-nowrap text-[13px] text-ink-soft">{fmtDate(u.created_at, false)}</span> },
          {
            key: "action",
            header: "Actions",
            align: "right",
            render: (u) => (
              <div className="flex justify-end gap-2">
                {u.role === "dept_admin" && <Button size="sm" variant="ghost" onClick={() => setMoveDept(u)}>Department</Button>}
                <Button size="sm" variant={u.is_active ? "secondary" : "primary"} disabled={u.id === me?.id} onClick={() => setConfirm(u)} title={u.id === me?.id ? "You cannot deactivate your own account" : undefined}>
                  {u.is_active ? "Deactivate" : isPending(u) ? "Approve" : "Activate"}
                  <span className="sr-only"> {u.full_name}</span>
                </Button>
              </div>
            ),
          },
        ]}
        mobileCard={(u) => (
          <div>
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="font-medium text-ink">{u.full_name}</p>
                <p className="truncate text-[13px] text-ink-muted">{u.email}</p>
                <p className="text-[13px] text-ink-soft">{ROLE_LABEL[u.role]}{u.department_name ? ` · ${u.department_name}` : ""}</p>
              </div>
              {<UserStatus u={u} />}
            </div>
            <Button size="sm" variant="secondary" className="mt-3" disabled={u.id === me?.id} onClick={() => setConfirm(u)}>
              {u.is_active ? "Deactivate" : "Activate"}
            </Button>
          </div>
        )}
      />
      {list.data && list.data.total > 0 && (
        <Pagination page={page} pages={Math.ceil(list.data.total / PAGE)} total={list.data.total} pageSize={PAGE} onPage={setPage} />
      )}

      {confirm && (
        <Modal
          open
          title={`${confirm.is_active ? "Deactivate" : isPending(confirm) ? "Approve access for" : "Activate"} ${confirm.full_name}?`}
          onClose={() => setConfirm(null)}
          footer={
            <>
              <Button variant="secondary" onClick={() => setConfirm(null)}>Cancel</Button>
              <Button variant={confirm.is_active ? "danger" : "primary"} loading={toggle.isPending} onClick={() => toggle.mutate(confirm)}>
                {confirm.is_active ? "Deactivate account" : "Activate account"}
              </Button>
            </>
          }
        >
          <p className="text-sm text-ink-soft">
            {confirm.is_active
              ? "The user will be signed out at their next request and cannot sign in again until reactivated. Officers holding open cases must have them reassigned first."
              : isPending(confirm)
                ? `${confirm.full_name} asked for ${ROLE_LABEL[confirm.role]} access${confirm.department_name ? ` to ${confirm.department_name}` : ""}. Approving lets them sign in with that role. Check their identity before approving.`
                : "The user will be able to sign in again with their existing password."}
          </p>
        </Modal>
      )}
      {creating && <CreateUser onClose={() => setCreating(false)} />}
      {moveDept && <MoveDepartment u={moveDept} onClose={() => setMoveDept(null)} />}
    </div>
  );
}

function useDepartments() {
  return useQuery({ queryKey: ["meta", "departments"], queryFn: () => api<{ code: string; name: string }[]>("/meta/departments", { auth: false }) });
}

function CreateUser({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const toast = useToast();
  const depts = useDepartments();
  const [f, setF] = useState({ role: "citizen", full_name: "", email: "", password: "", department_code: "", officer_code: "", designation: "Officer", handles_sensitive: false });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF((x) => ({ ...x, [k]: e.target.value }));
  const needsDept = f.role === "dept_admin" || f.role === "officer";
  const pwOk = f.password.length >= 8 && /[A-Za-z]/.test(f.password) && /[0-9]/.test(f.password);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (f.full_name.trim().length < 2 || !/^\S+@\S+\.\S+$/.test(f.email) || !pwOk || (needsDept && !f.department_code) || (f.role === "officer" && !/^[A-Z0-9-]{3,40}$/.test(f.officer_code))) {
      return setError("Complete every field. Passwords need 8+ characters with letters and numbers; officer codes use capital letters, digits and hyphens.");
    }
    setBusy(true);
    setError(null);
    try {
      if (f.role === "officer") {
        await api("/admin/officers", { body: { email: f.email, full_name: f.full_name.trim(), password: f.password, officer_code: f.officer_code, department_code: f.department_code, designation: f.designation || "Officer", handles_sensitive: f.handles_sensitive } });
      } else {
        await api("/admin/users", { body: { email: f.email, full_name: f.full_name.trim(), password: f.password, role: f.role, department_code: f.role === "dept_admin" ? f.department_code : undefined } });
      }
      toast.success(`Account created for ${f.full_name.trim()}.`);
      void qc.invalidateQueries({ queryKey: ["admin", "users"] });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Account could not be created.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal open title="Create account" onClose={onClose}>
      <form onSubmit={submit} noValidate className="space-y-4">
        {error && <Alert tone="critical">{error}</Alert>}
        <Field label="Role" htmlFor="cu-role">
          <Select id="cu-role" value={f.role} onChange={set("role")}>
            <option value="citizen">Citizen</option>
            <option value="officer">Grievance Officer</option>
            <option value="dept_admin">Department Admin</option>
            <option value="admin">System Admin</option>
          </Select>
        </Field>
        <Field label="Full name" htmlFor="cu-name"><Input id="cu-name" value={f.full_name} onChange={set("full_name")} /></Field>
        <Field label="E-mail" htmlFor="cu-email"><Input id="cu-email" type="email" value={f.email} onChange={set("email")} /></Field>
        <Field label="Initial password" htmlFor="cu-pw" hint="At least 8 characters with letters and numbers. Ask the user to change it after first sign-in.">
          <PasswordInput id="cu-pw" autoComplete="new-password" value={f.password} onChange={set("password")} />
        </Field>
        {needsDept && (
          <Field label="Department" htmlFor="cu-dept">
            <Select id="cu-dept" value={f.department_code} onChange={set("department_code")}>
              <option value="">Choose a department</option>
              {depts.data?.map((d) => <option key={d.code} value={d.code}>{d.name}</option>)}
            </Select>
          </Field>
        )}
        {f.role === "officer" && (
          <>
            <Field label="Officer code" htmlFor="cu-code" hint="For example OFF-WATER-09.">
              <Input id="cu-code" value={f.officer_code} onChange={(e) => setF((x) => ({ ...x, officer_code: e.target.value.toUpperCase() }))} className="font-mono" />
            </Field>
            <Field label="Designation" htmlFor="cu-desig"><Input id="cu-desig" value={f.designation} onChange={set("designation")} /></Field>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" className="h-4 w-4 accent-brand-700" checked={f.handles_sensitive} onChange={(e) => setF((x) => ({ ...x, handles_sensitive: e.target.checked }))} />
              Cleared to handle sensitive grievances
            </label>
          </>
        )}
        <div className="flex justify-end gap-2 border-t border-line pt-4">
          <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" loading={busy}>Create account</Button>
        </div>
      </form>
    </Modal>
  );
}

function MoveDepartment({ u, onClose }: { u: UserRow; onClose: () => void }) {
  const qc = useQueryClient();
  const toast = useToast();
  const depts = useDepartments();
  const [code, setCode] = useState(u.department_code ?? "");
  const m = useMutation({
    mutationFn: () => api(`/admin/users/${u.id}`, { method: "PATCH", body: { department_code: code } }),
    onSuccess: () => {
      toast.success(`${u.full_name} now manages ${depts.data?.find((d) => d.code === code)?.name ?? code}.`);
      void qc.invalidateQueries({ queryKey: ["admin", "users"] });
      onClose();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Update failed."),
  });
  return (
    <Modal open title={`Department for ${u.full_name}`} onClose={onClose} footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button onClick={() => m.mutate()} loading={m.isPending} disabled={!code || code === u.department_code}>Save</Button></>}>
      <Field label="Managed department" htmlFor="md-dept">
        <Select id="md-dept" value={code} onChange={(e) => setCode(e.target.value)}>
          {depts.data?.map((d) => <option key={d.code} value={d.code}>{d.name}</option>)}
        </Select>
      </Field>
    </Modal>
  );
}

/* ------------------------------------------------------------------ categories (policy + SLA) */

interface Cat {
  code: string;
  name_en: string;
  department_code: string | null;
  sla_hours: number;
  is_sensitive: boolean;
  hide_identity: boolean;
  confidence_threshold: number;
  auto_close_allowed: boolean;
  is_active: boolean;
  updated_at: string | null;
}
const useCats = () => useQuery({ queryKey: ["admin", "categories"], queryFn: () => api<Cat[]>("/admin/categories") });

interface Settings {
  environment: string;
  policy_rules: Record<string, string>;
  policy: Record<string, number>;
  jobs: { sla_scan_interval_seconds: number };
  limits: Record<string, number>;
  security: { enforce_https: boolean; cors_origins: string[]; jwt_secret_is_default: boolean; webhook_secret_is_default: boolean };
  providers: { groq_configured: boolean; gemini_configured: boolean; langfuse_configured: boolean; data_gov_in_key_configured: boolean; embedding_provider: string; stt_provider: string };
}
const useSettings = () => useQuery({ queryKey: ["admin", "settings"], queryFn: () => api<Settings>("/admin/settings") });

function Toggle({ label, checked, disabled, onChange }: { label: string; checked: boolean; disabled?: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors duration-150 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 disabled:cursor-not-allowed disabled:opacity-50 ${checked ? "bg-brand-700" : "bg-stone-dark"}`}
    >
      <span className={`inline-block h-5 w-5 rounded-full bg-white shadow transition-transform duration-150 ${checked ? "translate-x-[22px]" : "translate-x-0.5"}`} />
    </button>
  );
}

function useCategoryPatch() {
  const qc = useQueryClient();
  const toast = useToast();
  return useMutation({
    mutationFn: ({ code, body }: { code: string; body: Record<string, unknown> }) => api(`/admin/categories/${code}`, { method: "PATCH", body }),
    onSuccess: (_, v) => {
      toast.success(`${v.code} updated.`);
      void qc.invalidateQueries({ queryKey: ["admin", "categories"] });
      void qc.invalidateQueries({ queryKey: ["admin", "audit"] });
      void qc.invalidateQueries({ queryKey: ["meta"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Update failed."),
  });
}

export function PolicyRules() {
  const cats = useCats();
  const settings = useSettings();
  const patch = useCategoryPatch();
  return (
    <div>
      <PageHeader
        title="Policy & Rules"
        subtitle="Which categories are sensitive, which hide the complainant's identity, when a human must review, and which may be closed automatically. Policy is enforced by the backend's rule-based gate, not by the AI."
      />
      <Alert tone="info" title="Fixed safeguards">
        Sensitive grievances always go to human review, always hide the complainant's identity, and are never closed automatically. Marking a category sensitive applies these rules; they cannot be switched off for a sensitive category.
      </Alert>
      <div className="mt-6 grid gap-4 xl:grid-cols-[1.7fr_1fr]">
        <Panel title="Category policies" description="Changes apply to new grievances immediately and are written to the audit log.">
          {cats.isLoading && <SkeletonRows rows={6} />}
          {cats.isError && <ErrorState error={cats.error} onRetry={() => cats.refetch()} />}
          {cats.data && (
            <div className="-mx-5 overflow-x-auto">
              <table className="w-full min-w-[720px] text-sm">
                <caption className="sr-only">Category policies</caption>
                <thead className="border-b border-line text-left text-[12px] uppercase tracking-[0.05em] text-ink-muted">
                  <tr>
                    <th scope="col" className="px-5 py-2 font-semibold">Category</th>
                    <th scope="col" className="px-3 py-2 font-semibold">Sensitive</th>
                    <th scope="col" className="px-3 py-2 font-semibold">Hide identity</th>
                    <th scope="col" className="px-3 py-2 font-semibold">Auto-close</th>
                    <th scope="col" className="px-5 py-2 font-semibold">Review below confidence</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {cats.data.map((c) => (
                    <tr key={c.code}>
                      <td className="px-5 py-2.5"><span className="font-medium text-ink">{c.name_en}</span><span className="block font-mono text-[12px] text-ink-muted">{c.code}</span></td>
                      <td className="px-3 py-2.5"><Toggle label={`${c.name_en}: sensitive`} checked={c.is_sensitive} onChange={(v) => patch.mutate({ code: c.code, body: { is_sensitive: v } })} /></td>
                      <td className="px-3 py-2.5"><Toggle label={`${c.name_en}: hide identity`} checked={c.hide_identity} disabled={c.is_sensitive} onChange={(v) => patch.mutate({ code: c.code, body: { hide_identity: v } })} /></td>
                      <td className="px-3 py-2.5">
                        <Toggle label={`${c.name_en}: auto-close allowed`} checked={c.auto_close_allowed} disabled={c.is_sensitive} onChange={(v) => patch.mutate({ code: c.code, body: { auto_close_allowed: v } })} />
                        {c.is_sensitive && <span className="ml-2 text-[12px] text-ink-muted">Never</span>}
                      </td>
                      <td className="px-5 py-2.5"><ThresholdEditor c={c} onSave={(v) => patch.mutate({ code: c.code, body: { confidence_threshold: v } })} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>
        <div className="space-y-4">
          <Panel title="Policy rules in force" description="Referenced by every routing decision and shown to officers.">
            {settings.isLoading && <SkeletonRows rows={4} />}
            {settings.isError && <ErrorState error={settings.error} onRetry={() => settings.refetch()} />}
            <dl className="space-y-3 text-sm">
              {settings.data &&
                Object.entries(settings.data.policy_rules).map(([ref, text]) => (
                  <div key={ref}>
                    <dt className="font-mono text-[12px] font-semibold text-brand-700">{ref}</dt>
                    <dd className="text-ink-soft">{text}</dd>
                  </div>
                ))}
            </dl>
          </Panel>
          {settings.data && (
            <Panel title="Global thresholds" description="Set through server configuration.">
              <dl className="divide-y divide-line text-sm">
                {[
                  ["Default confidence threshold", pct(settings.data.policy.default_confidence_threshold)],
                  ["Duplicate match threshold", pct(settings.data.policy.duplicate_threshold)],
                  ["Duplicate window", `${settings.data.policy.duplicate_window_days} days`],
                  ["Duplicate radius", `${settings.data.policy.duplicate_radius_km} km`],
                  ["SLA warning at", `${pct(settings.data.policy.sla_warning_fraction)} of time used`],
                  ["Auto-close after citizen silence", `${settings.data.policy.auto_close_after_days} days (non-sensitive only)`],
                ].map(([k, v]) => (
                  <div key={k} className="flex justify-between gap-4 py-2"><dt className="text-ink-muted">{k}</dt><dd className="text-right font-medium text-ink">{v}</dd></div>
                ))}
              </dl>
            </Panel>
          )}
        </div>
      </div>
    </div>
  );
}

function ThresholdEditor({ c, onSave }: { c: Cat; onSave: (v: number) => void }) {
  const [v, setV] = useState(String(Math.round(c.confidence_threshold * 100)));
  const n = Number(v);
  const invalid = !Number.isFinite(n) || n < 0 || n > 100;
  const dirty = !invalid && Math.round(c.confidence_threshold * 100) !== n;
  return (
    <div className="flex items-center gap-2">
      <label className="sr-only" htmlFor={`thr-${c.code}`}>{c.name_en} confidence threshold in percent</label>
      <Input id={`thr-${c.code}`} type="number" min={0} max={100} className="h-8 w-20" value={v} onChange={(e) => setV(e.target.value)} aria-invalid={invalid} />
      <span className="text-[13px] text-ink-muted">%</span>
      {dirty && <Button size="sm" onClick={() => onSave(n / 100)}>Save</Button>}
    </div>
  );
}

interface AuditRow { id: number; actor: string; actor_type: string; action: string; explanation: Record<string, unknown>; created_at: string }

export function SlaConfiguration() {
  const cats = useCats();
  const patch = useCategoryPatch();
  const history = useQuery({ queryKey: ["admin", "audit", "category.updated"], queryFn: () => api<{ items: AuditRow[] }>("/admin/audit?action=category.updated&limit=100") });
  const slaChanges = (history.data?.items ?? []).filter((a) => (a.explanation?.after as Record<string, unknown> | undefined)?.sla_hours !== undefined);
  return (
    <div>
      <PageHeader
        title="SLA Configuration"
        subtitle="Resolution deadlines per category, in hours. Every grievance's deadline is calculated from these values when it is filed or reclassified. Changes do not alter deadlines already set."
        actions={<Link to="/admin/sla" className="inline-flex h-10 items-center rounded-md border border-stone-dark bg-surface px-4 text-sm font-semibold text-ink hover:bg-canvas">SLA analytics</Link>}
      />
      <div className="grid gap-4 xl:grid-cols-[1.5fr_1fr]">
        <Panel title="Category deadlines" description="Allowed range: 1 to 1440 hours (60 days).">
          {cats.isLoading && <SkeletonRows rows={6} />}
          {cats.isError && <ErrorState error={cats.error} onRetry={() => cats.refetch()} />}
          <ul className="divide-y divide-line">
            {cats.data?.map((c) => <SlaRow key={c.code} c={c} onSave={(h) => patch.mutate({ code: c.code, body: { sla_hours: h } })} saving={patch.isPending && patch.variables?.code === c.code} />)}
          </ul>
        </Panel>
        <Panel title="Change history" description="From the audit log.">
          {history.isLoading && <SkeletonRows rows={3} />}
          {history.isError && <ErrorState error={history.error} onRetry={() => history.refetch()} />}
          {history.data && slaChanges.length === 0 && <p className="text-sm text-ink-muted">No SLA changes have been recorded.</p>}
          <ol className="divide-y divide-line">
            {slaChanges.map((a) => {
              const before = (a.explanation.before as Record<string, unknown> | undefined)?.sla_hours;
              const after = (a.explanation.after as Record<string, unknown>).sla_hours;
              return (
                <li key={a.id} className="py-2.5 text-[13px]">
                  <p className="text-ink"><span className="font-mono font-semibold">{String(a.explanation.category)}</span>: {before !== undefined ? `${String(before)} h → ` : ""}{String(after)} h</p>
                  <p className="text-ink-muted">{a.actor} · {fmtDate(a.created_at)}</p>
                </li>
              );
            })}
          </ol>
        </Panel>
      </div>
    </div>
  );
}

function SlaRow({ c, onSave, saving }: { c: Cat; onSave: (h: number) => void; saving: boolean }) {
  const [v, setV] = useState(String(c.sla_hours));
  const n = Number(v);
  const invalid = !Number.isInteger(n) || n < 1 || n > 1440;
  const dirty = !invalid && n !== c.sla_hours;
  return (
    <li className="flex flex-wrap items-center justify-between gap-3 py-2.5">
      <div className="min-w-0">
        <p className="text-sm font-medium text-ink">{c.name_en}{!c.is_active && <Badge tone="outline" className="ml-2">Inactive</Badge>}</p>
        <p className="text-[12px] text-ink-muted"><span className="font-mono">{c.code}</span> · {c.department_code ?? "No department"}</p>
      </div>
      <div className="flex items-center gap-2">
        <label className="sr-only" htmlFor={`sla-${c.code}`}>{c.name_en} SLA in hours</label>
        <Input id={`sla-${c.code}`} type="number" min={1} max={1440} className="h-9 w-24" value={v} onChange={(e) => setV(e.target.value)} aria-invalid={invalid} />
        <span className="text-[13px] text-ink-muted">hours</span>
        <Button size="sm" onClick={() => onSave(n)} disabled={!dirty} loading={saving}>Save</Button>
      </div>
      {invalid && <p className="w-full text-[12px] font-medium text-status-critical" role="alert">Enter a whole number of hours from 1 to 1440.</p>}
    </li>
  );
}

/* ------------------------------------------------------------------ integrations */

function StatusRow({ name, detail, state }: { name: string; detail: ReactNode; state: "ok" | "off" | "error" | "warn" }) {
  const badge = { ok: <Badge tone="good">Connected</Badge>, off: <Badge tone="outline">Not configured</Badge>, error: <Badge tone="critical">Error</Badge>, warn: <Badge tone="warning">Attention</Badge> }[state];
  return (
    <li className="flex flex-wrap items-start justify-between gap-3 py-3">
      <div className="min-w-0">
        <p className="text-sm font-medium text-ink">{name}</p>
        <div className="text-[13px] text-ink-muted">{detail}</div>
      </div>
      {badge}
    </li>
  );
}

interface Hook { id: number; name: string; url: string; events: string[]; is_active: boolean; deliveries: { status: string; created_at: string; response_code: number | null }[] }
interface ExtDataset { key: string; title: string; status: string; rows_imported: number; imported_at?: string | null }

export function Integrations() {
  const status = useSystemStatus();
  const settings = useSettings();
  const hooks = useQuery({ queryKey: ["admin", "webhooks"], queryFn: () => api<{ items: Hook[] }>("/admin/webhooks") });
  const ext = useQuery({ queryKey: ["external", "datasets"], queryFn: () => api<{ items: ExtDataset[] }>("/external/datasets") });
  const [lf, setLf] = useState<{ enabled: boolean; ok: boolean; detail?: string; host?: string } | null>(null);
  const [checking, setChecking] = useState(false);
  const s = status.data;
  const p = settings.data?.providers;
  const checkLangfuse = async () => {
    setChecking(true);
    try {
      setLf(await api("/observability/langfuse"));
    } catch (e) {
      setLf({ enabled: true, ok: false, detail: e instanceof Error ? e.message : "Check failed" });
    } finally {
      setChecking(false);
    }
  };
  return (
    <div>
      <PageHeader title="Integrations & Webhooks" subtitle="Status of each external service, read from the live server configuration. Nothing here is shown as connected unless the server reports it." actions={<Link to="/admin/webhooks" className="inline-flex h-10 items-center rounded-md bg-brand-700 px-4 text-sm font-semibold text-white hover:bg-brand-800">Manage webhooks</Link>} />
      {(status.isError || settings.isError) && <ErrorState error={status.error ?? settings.error} />}
      <div className="grid gap-4 xl:grid-cols-2">
        <Panel title="AI and language services">
          {!s || !p ? <SkeletonRows rows={3} /> : (
            <ul className="divide-y divide-line">
              <StatusRow name="Groq (primary language model)" state={p.groq_configured ? "ok" : "off"} detail={p.groq_configured ? `Model ${s.llm.groq.model}` : "No API key set; the next provider in the chain is used."} />
              <StatusRow name="Gemini (fallback language model)" state={p.gemini_configured ? "ok" : "off"} detail={p.gemini_configured ? `Model ${s.llm.gemini.model}` : "No API key set."} />
              <StatusRow name="Rule-based fallback" state="ok" detail={s.llm.mode === "llm" ? `Chain: ${s.llm.chain.join(" → ")}` : "Active: no model keys configured, deterministic rules handle intake."} />
              <StatusRow name="Embeddings (RAG and duplicates)" state="ok" detail={s.embeddings.provider} />
              <StatusRow name="Speech to text" state={s.speech_to_text.available ? "ok" : "off"} detail={s.speech_to_text.available ? `Whisper ${s.speech_to_text.model}` : `Provider setting: ${p.stt_provider}; not available on this server.`} />
            </ul>
          )}
        </Panel>
        <Panel title="Observability" action={p?.langfuse_configured ? <Button size="sm" variant="secondary" onClick={checkLangfuse} loading={checking}>Check connection</Button> : undefined}>
          {!p ? <SkeletonRows rows={2} /> : (
            <ul className="divide-y divide-line">
              <StatusRow
                name="Langfuse tracing"
                state={!p.langfuse_configured ? "off" : lf ? (lf.ok ? "ok" : "error") : "warn"}
                detail={!p.langfuse_configured ? "Keys not set. Agent traces are still recorded in the local database." : lf ? (lf.ok ? `Verified with ${lf.host}` : lf.detail ?? "Credentials were rejected.") : "Keys are set. Run a connection check to verify them."}
              />
              <StatusRow name="Local agent traces" state="ok" detail={<Link to="/admin/observability" className="text-brand-700 underline">Open AI & RAG Monitoring</Link>} />
            </ul>
          )}
        </Panel>
        <Panel title="Webhooks" description="Signed event delivery to external systems (for example n8n or Zapier).">
          {hooks.isLoading && <SkeletonRows rows={2} />}
          {hooks.isError && <ErrorState error={hooks.error} onRetry={() => hooks.refetch()} />}
          {hooks.data && hooks.data.items.length === 0 && <EmptyState title="No webhooks configured" body="Add one to send grievance events to another system." action={<Link to="/admin/webhooks" className="font-semibold text-brand-700 underline">Add a webhook</Link>} />}
          <ul className="divide-y divide-line">
            {hooks.data?.items.map((h) => {
              const last = h.deliveries[0];
              const state = !h.is_active ? "off" : !last ? "warn" : last.status === "delivered" ? "ok" : last.status === "failed" ? "error" : "warn";
              return (
                <StatusRow
                  key={h.id}
                  name={h.name}
                  state={state}
                  detail={<>{h.is_active ? "Active" : "Disabled"} · {h.events.length} event type(s) · {last ? `last delivery ${last.status}${last.response_code ? ` (HTTP ${last.response_code})` : ""} ${relTime(last.created_at)}` : "no deliveries yet"}</>}
                />
              );
            })}
          </ul>
        </Panel>
        <Panel title="Public data sources">
          {ext.isLoading && <SkeletonRows rows={2} />}
          {ext.isError && <ErrorState error={ext.error} onRetry={() => ext.refetch()} />}
          <ul className="divide-y divide-line">
            {ext.data?.items.map((d) => (
              <StatusRow key={d.key} name={d.title} state={d.status === "imported" ? "ok" : d.status === "not_fetched" ? "off" : "warn"} detail={`${d.status.replace(/_/g, " ")} · ${d.rows_imported.toLocaleString("en-IN")} rows imported`} />
            ))}
            {p && <StatusRow name="data.gov.in API key" state={p.data_gov_in_key_configured ? "ok" : "off"} detail={p.data_gov_in_key_configured ? "Key configured" : "Optional key not set"} />}
          </ul>
        </Panel>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ system settings */

export function SystemSettings() {
  const settings = useSettings();
  const toast = useToast();
  const [running, setRunning] = useState<string | null>(null);
  const run = async (job: "sla-scan" | "auto-close") => {
    setRunning(job);
    try {
      const out = await api<Record<string, unknown>>(`/admin/jobs/${job}`, { method: "POST" });
      toast.success(`${job === "sla-scan" ? "SLA scan" : "Auto-close"} finished: ${Object.entries(out).filter(([, v]) => typeof v === "number").map(([k, v]) => `${k.replace(/_/g, " ")} ${v}`).join(", ") || "done"}.`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Job failed.");
    } finally {
      setRunning(null);
    }
  };
  const s = settings.data;
  return (
    <div>
      <PageHeader title="System Settings" subtitle="Runtime configuration of this deployment. Values come from server environment variables and are read-only here; secrets are never displayed." />
      {settings.isLoading && <SkeletonRows rows={4} />}
      {settings.isError && <ErrorState error={settings.error} onRetry={() => settings.refetch()} />}
      {s && (
        <div className="grid gap-4 xl:grid-cols-2">
          <Panel title="Security">
            {(s.security.jwt_secret_is_default || s.security.webhook_secret_is_default) && (
              <div className="mb-3"><Alert tone="warning" title="Default secrets in use">Set {[s.security.jwt_secret_is_default && "JWT_SECRET", s.security.webhook_secret_is_default && "WEBHOOK_SIGNING_SECRET"].filter(Boolean).join(" and ")} before production use.</Alert></div>
            )}
            <dl className="divide-y divide-line text-sm">
              <div className="flex justify-between gap-4 py-2"><dt className="text-ink-muted">Environment</dt><dd className="font-medium">{s.environment}</dd></div>
              <div className="flex justify-between gap-4 py-2"><dt className="text-ink-muted">HTTPS enforced</dt><dd className="font-medium">{s.security.enforce_https ? "Yes" : "No"}</dd></div>
              <div className="flex justify-between gap-4 py-2"><dt className="text-ink-muted">Allowed origins</dt><dd className="break-all text-right font-medium">{s.security.cors_origins.join(", ")}</dd></div>
              <div className="flex justify-between gap-4 py-2"><dt className="text-ink-muted">Session length</dt><dd className="font-medium">{s.limits.session_minutes} minutes</dd></div>
            </dl>
          </Panel>
          <Panel title="Scheduled jobs" description={s.jobs.sla_scan_interval_seconds > 0 ? `SLA scan and auto-close run every ${Math.round(s.jobs.sla_scan_interval_seconds / 60)} minutes.` : "The background monitor is disabled; run jobs manually."}>
            <ul className="divide-y divide-line text-sm">
              <li className="flex flex-wrap items-center justify-between gap-3 py-2.5">
                <span><span className="font-medium text-ink">SLA scan</span><span className="block text-[13px] text-ink-muted">Updates at-risk and breached states, warns officers, escalates overdue cases.</span></span>
                <Button size="sm" variant="secondary" loading={running === "sla-scan"} onClick={() => run("sla-scan")}>Run now</Button>
              </li>
              <li className="flex flex-wrap items-center justify-between gap-3 py-2.5">
                <span><span className="font-medium text-ink">Auto-close</span><span className="block text-[13px] text-ink-muted">Closes non-sensitive resolved cases after {s.policy.auto_close_after_days} days without a citizen response. Sensitive cases are never closed.</span></span>
                <Button size="sm" variant="secondary" loading={running === "auto-close"} onClick={() => run("auto-close")}>Run now</Button>
              </li>
            </ul>
          </Panel>
          <Panel title="Usage limits">
            <dl className="divide-y divide-line text-sm">
              {[
                ["Grievances per citizen per day", s.limits.max_grievances_per_day],
                ["Drafts per citizen per day", s.limits.max_drafts_per_day],
                ["Maximum upload size", `${s.limits.max_upload_mb} MB`],
              ].map(([k, v]) => (
                <div key={String(k)} className="flex justify-between gap-4 py-2"><dt className="text-ink-muted">{k}</dt><dd className="font-medium">{v}</dd></div>
              ))}
            </dl>
          </Panel>
          <Panel title="Data management">
            <ul className="divide-y divide-line text-sm">
              <li className="flex items-center justify-between gap-3 py-2.5"><span><span className="font-medium text-ink">Dataset imports</span><span className="block text-[13px] text-ink-muted">Category Master, departments, officers and grievance history.</span></span><Link to="/admin/datasets" className="font-semibold text-brand-700 underline">Open</Link></li>
              <li className="flex items-center justify-between gap-3 py-2.5"><span><span className="font-medium text-ink">Public data</span><span className="block text-[13px] text-ink-muted">External datasets with provenance and licences.</span></span><Link to="/admin/public-data" className="font-semibold text-brand-700 underline">Open</Link></li>
              <li className="flex items-center justify-between gap-3 py-2.5"><span><span className="font-medium text-ink">Policy thresholds</span><span className="block text-[13px] text-ink-muted">Confidence, duplicate and auto-close values.</span></span><Link to="/admin/policy" className="font-semibold text-brand-700 underline">Open</Link></li>
            </ul>
          </Panel>
        </div>
      )}
    </div>
  );
}
