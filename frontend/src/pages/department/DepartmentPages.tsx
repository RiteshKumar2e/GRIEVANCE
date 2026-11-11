import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Link } from "react-router-dom";
import { CaseListPage, caseColumns, CaseCard, OpenCase, useCases } from "../../components/cases";
import { ActivityFeed, BarList, Metrics, Panel, useStaffStats, WorkloadBar } from "../../components/dashboard";
import { DataTable } from "../../components/DataTable";
import { caseHref } from "../../components/nav";
import { useToast } from "../../components/Toast";
import { Alert, Badge, Button, ErrorState, Field, Input, Modal, PageHeader, Select, SkeletonRows, Textarea } from "../../components/ui";
import { api } from "../../lib/api";
import { useAuth } from "../../lib/auth";
import { pct, relTime } from "../../lib/format";
import type { GrievanceSummary } from "../../lib/types";
import { PeriodSelect, useReport } from "../staff/Reports";

export interface TeamOfficer {
  code: string;
  name: string;
  designation: string;
  email: string | null;
  wards: string[];
  max_active_cases: number;
  open_cases: number;
  handles_sensitive: boolean;
  is_active: boolean;
  has_login: boolean;
  last_login_at: string | null;
}
interface DeptSummary {
  code: string;
  name: string;
  email: string | null;
  phone: string | null;
  escalation_contact: string | null;
  is_active: boolean;
  unassigned_open: number;
  categories: { code: string; name_en: string; sla_hours: number; is_sensitive: boolean; auto_close_allowed: boolean }[];
}

const useTeam = () => useQuery({ queryKey: ["department", "officers"], queryFn: () => api<TeamOfficer[]>("/department/officers") });
const useSummary = () => useQuery({ queryKey: ["department", "summary"], queryFn: () => api<DeptSummary>("/department/summary") });

/* ------------------------------------------------------------------ overview */

export function DepartmentOverview() {
  const { user } = useAuth();
  const stats = useStaffStats();
  const team = useTeam();
  const summary = useSummary();
  const report = useReport(30);
  const s = stats.data;
  return (
    <div>
      <PageHeader title="Department Overview" subtitle={`${user?.department_name ?? "Your department"}: live figures for every grievance routed to this department.`} />
      {stats.isError && <ErrorState error={stats.error} onRetry={() => stats.refetch()} />}
      {stats.isLoading && <SkeletonRows rows={2} />}
      {s && (
        <Metrics
          items={[
            { label: "Total cases", value: s.total, hint: "all time" },
            { label: "Pending", value: s.open, hint: summary.data ? `${summary.data.unassigned_open} unassigned` : undefined, to: "/department/grievances" },
            { label: "Awaiting approval", value: s.pending_review, tone: s.pending_review ? "warning" : undefined, to: "/department/approvals" },
            { label: "Overdue", value: s.overdue, tone: s.overdue ? "critical" : undefined, to: "/department/sla" },
            { label: "Resolved / closed", value: s.resolved, tone: "good" },
            { label: "SLA compliance", value: pct(report.data?.sla.compliance), hint: "cases filed in last 30 days", to: "/department/sla" },
          ]}
        />
      )}
      <div className="grid gap-4 xl:grid-cols-[1.2fr_1fr]">
        <Panel
          title="Officer workload"
          description="Open cases held by each officer against their capacity."
          action={<Link to="/department/team" className="text-[13px] font-medium text-brand-700 hover:underline">Manage team</Link>}
        >
          {team.isLoading && <SkeletonRows rows={3} />}
          {team.isError && <ErrorState error={team.error} onRetry={() => team.refetch()} />}
          {team.data?.length === 0 && <p className="text-sm text-ink-muted">No officers are registered in this department.</p>}
          <ul className="space-y-4">
            {team.data
              ?.filter((o) => o.is_active)
              .sort((a, b) => b.open_cases / b.max_active_cases - a.open_cases / a.max_active_cases)
              .map((o) => (
                <li key={o.code}>
                  <WorkloadBar label={`${o.name} · ${o.designation}`} open={o.open_cases} capacity={o.max_active_cases} />
                </li>
              ))}
          </ul>
        </Panel>
        <Panel title="Recent department activity">
          <ActivityFeed limit={10} />
        </Panel>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ case lists */

export function DepartmentGrievances() {
  return (
    <CaseListPage
      title="Department Grievances"
      subtitle="Every grievance routed to your department, including sensitive ones. Complainant identity stays hidden wherever the category requires it."
      query={{ scope: "department" }}
      empty={{ title: "No active grievances in your department" }}
    />
  );
}

export function PendingApprovals() {
  return (
    <CaseListPage
      title="Pending Approvals"
      subtitle="Grievances that need a human decision before any officer is assigned: sensitive categories, low AI confidence, or cases flagged by the policy gate. Approve the category and assign an officer from the case page."
      query={{ scope: "review" }}
      allowStatusFilter={false}
      allowClosedToggle={false}
      action={(g) => <ApproveLink g={g} />}
      empty={{ title: "Nothing awaiting approval", body: "Cases needing a department decision appear here." }}
    />
  );
}

function ApproveLink({ g }: { g: GrievanceSummary }) {
  return (
    <Link
      to={caseHref("dept_admin", g.public_id)}
      className="inline-flex h-8 items-center rounded-md bg-brand-700 px-3 text-[13px] font-semibold text-white hover:bg-brand-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
    >
      Review & approve<span className="sr-only"> {g.public_id}</span>
    </Link>
  );
}

/* ------------------------------------------------------------------ assignment management */

export function AssignmentManagement() {
  const [target, setTarget] = useState<GrievanceSummary | null>(null);
  const action = (g: GrievanceSummary) => {
    if (g.status === "PENDING_REVIEW" || g.status === "SUBMITTED") return <ApproveLink g={g} />;
    if (["ASSIGNED", "IN_PROGRESS", "REOPENED"].includes(g.status))
      return (
        <Button size="sm" variant="secondary" onClick={() => setTarget(g)}>
          {g.assigned_officer ? "Reassign" : "Assign"}
          <span className="sr-only"> {g.public_id}</span>
        </Button>
      );
    return <OpenCase g={g} />;
  };
  return (
    <>
      <CaseListPage
        title="Assignment Management"
        subtitle="Assign or reassign active cases to officers of your department. Officers must be active, and sensitive cases can only go to officers cleared for them. Every change is written to the audit log and the officer is notified."
        query={{ scope: "department" }}
        action={action}
        empty={{ title: "No active cases to assign" }}
      />
      {target && <ReassignDialog g={target} onClose={() => setTarget(null)} />}
    </>
  );
}

function ReassignDialog({ g, onClose }: { g: GrievanceSummary; onClose: () => void }) {
  const team = useTeam();
  const qc = useQueryClient();
  const toast = useToast();
  const [officer, setOfficer] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const eligible = (team.data ?? []).filter((o) => o.is_active && o.code !== g.assigned_officer?.code && (!g.is_sensitive || o.handles_sensitive));
  const m = useMutation({
    mutationFn: () => api(`/officer/grievances/${g.public_id}/reassign`, { body: { officer_code: officer, note: note.trim() } }),
    onSuccess: () => {
      toast.success(`${g.public_id} assigned to ${eligible.find((o) => o.code === officer)?.name ?? officer}.`);
      void qc.invalidateQueries({ queryKey: ["officer"] });
      void qc.invalidateQueries({ queryKey: ["department"] });
      onClose();
    },
    onError: (e) => setError(e instanceof Error ? e.message : "Could not reassign."),
  });
  const valid = officer && note.trim().length >= 3;
  return (
    <Modal
      open
      title={`${g.assigned_officer ? "Reassign" : "Assign"} ${g.public_id}`}
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button onClick={() => m.mutate()} loading={m.isPending} disabled={!valid}>
            Confirm assignment
          </Button>
        </>
      }
    >
      <p className="text-sm text-ink-soft">{g.title}</p>
      <p className="text-[13px] text-ink-muted">Currently: {g.assigned_officer ? `${g.assigned_officer.name} (${g.assigned_officer.code})` : "unassigned"}</p>
      {g.is_sensitive && <Alert tone="warning">Sensitive case: only officers cleared for sensitive cases are listed.</Alert>}
      {error && <Alert tone="critical">{error}</Alert>}
      <Field label="Assign to" htmlFor="reassign-officer">
        <Select id="reassign-officer" value={officer} onChange={(e) => setOfficer(e.target.value)}>
          <option value="">Choose an officer</option>
          {eligible.map((o) => (
            <option key={o.code} value={o.code}>
              {o.name} · {o.open_cases}/{o.max_active_cases} open{o.open_cases >= o.max_active_cases ? " (at capacity)" : ""}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Reason (recorded in the audit log)" htmlFor="reassign-note" hint="At least 3 characters.">
        <Textarea id="reassign-note" rows={3} value={note} onChange={(e) => setNote(e.target.value)} maxLength={2000} />
      </Field>
    </Modal>
  );
}

/* ------------------------------------------------------------------ team */

export function OfficersTeam() {
  const team = useTeam();
  const [edit, setEdit] = useState<TeamOfficer | null>(null);
  return (
    <div>
      <PageHeader
        title="Officers & Team"
        subtitle="Officers in your department, their workload and status. You can change capacity, ward coverage and active status. Sensitive-case clearance and new accounts are managed by the system administrator."
      />
      <DataTable
        caption="Department officers"
        rows={team.data}
        loading={team.isLoading}
        error={team.error}
        onRetry={() => team.refetch()}
        rowKey={(o) => o.code}
        initialSort={{ key: "name", dir: "asc" }}
        empty={{ title: "No officers in this department" }}
        columns={[
          { key: "name", header: "Officer", render: (o) => <span><span className="font-medium text-ink">{o.name}</span><span className="block font-mono text-[12px] text-ink-muted">{o.code}</span></span>, sortValue: (o) => o.name },
          { key: "designation", header: "Designation", render: (o) => <span className="text-ink-soft">{o.designation}</span>, sortValue: (o) => o.designation },
          { key: "status", header: "Status", render: (o) => (o.is_active ? <Badge tone="good">Active</Badge> : <Badge tone="outline">Inactive</Badge>), sortValue: (o) => (o.is_active ? 0 : 1) },
          { key: "load", header: "Workload", render: (o) => <div className="w-44"><WorkloadBar label="" open={o.open_cases} capacity={o.max_active_cases} /></div>, sortValue: (o) => o.open_cases / o.max_active_cases },
          { key: "wards", header: "Wards", render: (o) => <span className="text-[13px] text-ink-soft">{o.wards.length ? o.wards.join(", ") : "All wards"}</span> },
          { key: "sensitive", header: "Sensitive", render: (o) => (o.handles_sensitive ? "Cleared" : <span className="text-ink-muted">No</span>) },
          { key: "login", header: "Last sign-in", render: (o) => <span className="text-[13px] text-ink-soft">{o.has_login ? (o.last_login_at ? relTime(o.last_login_at) : "Never") : "No login"}</span>, sortValue: (o) => o.last_login_at },
          { key: "action", header: "Action", align: "right", render: (o) => <Button size="sm" variant="secondary" onClick={() => setEdit(o)}>Edit<span className="sr-only"> {o.name}</span></Button> },
        ]}
        mobileCard={(o) => (
          <div>
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="font-medium text-ink">{o.name}</p>
                <p className="text-[13px] text-ink-muted">{o.designation} · <span className="font-mono">{o.code}</span></p>
              </div>
              {o.is_active ? <Badge tone="good">Active</Badge> : <Badge tone="outline">Inactive</Badge>}
            </div>
            <div className="mt-3"><WorkloadBar label="Workload" open={o.open_cases} capacity={o.max_active_cases} /></div>
            <Button size="sm" variant="secondary" className="mt-3" onClick={() => setEdit(o)}>Edit officer</Button>
          </div>
        )}
      />
      {edit && <EditOfficer o={edit} onClose={() => setEdit(null)} />}
    </div>
  );
}

function EditOfficer({ o, onClose }: { o: TeamOfficer; onClose: () => void }) {
  const qc = useQueryClient();
  const toast = useToast();
  const [active, setActive] = useState(o.is_active);
  const [cap, setCap] = useState(String(o.max_active_cases));
  const [wards, setWards] = useState(o.wards.join(", "));
  const [error, setError] = useState<string | null>(null);
  const capNum = Number(cap);
  const capError = !Number.isInteger(capNum) || capNum < 1 || capNum > 500 ? "Enter a whole number from 1 to 500." : capNum < o.open_cases ? `Must be at least ${o.open_cases}, the cases this officer holds now.` : undefined;
  const m = useMutation({
    mutationFn: () => {
      const body: Record<string, unknown> = {};
      if (active !== o.is_active) body.is_active = active;
      if (capNum !== o.max_active_cases) body.max_active_cases = capNum;
      const w = wards.split(",").map((x) => x.trim()).filter(Boolean);
      if (w.join("|") !== o.wards.join("|")) body.wards = w;
      if (!Object.keys(body).length) return Promise.reject(new Error("Nothing has changed."));
      return api(`/department/officers/${o.code}`, { method: "PATCH", body });
    },
    onSuccess: () => {
      toast.success(`${o.name} updated.`);
      void qc.invalidateQueries({ queryKey: ["department"] });
      onClose();
    },
    onError: (e) => setError(e instanceof Error ? e.message : "Update failed."),
  });
  return (
    <Modal
      open
      title={`Edit ${o.name}`}
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button onClick={() => m.mutate()} loading={m.isPending} disabled={!!capError}>Save changes</Button>
        </>
      }
    >
      {error && <Alert tone="critical">{error}</Alert>}
      <label className="flex items-start gap-2.5 text-sm">
        <input type="checkbox" className="mt-0.5 h-4 w-4 accent-brand-700" checked={active} onChange={(e) => setActive(e.target.checked)} />
        <span>
          <span className="font-medium text-ink">Active</span>
          <span className="block text-[13px] text-ink-muted">Inactive officers cannot sign in or receive cases. Reassign their open cases first.</span>
        </span>
      </label>
      <Field label="Maximum open cases" htmlFor="cap" error={capError}>
        <Input id="cap" type="number" inputMode="numeric" min={1} max={500} value={cap} onChange={(e) => setCap(e.target.value)} aria-invalid={!!capError} />
      </Field>
      <Field label="Ward coverage" htmlFor="wards" hint="Comma-separated, for example: Ward 2, Ward 3. Leave empty to cover all wards.">
        <Input id="wards" value={wards} onChange={(e) => setWards(e.target.value)} />
      </Field>
    </Modal>
  );
}

/* ------------------------------------------------------------------ distribution & SLA */

export function CaseDistribution() {
  const [days, setDays] = useState(30);
  const r = useReport(days);
  return (
    <div>
      <PageHeader title="Case Distribution" subtitle="How grievances filed in the period are spread across categories, wards, statuses and officers." actions={<PeriodSelect value={days} onChange={setDays} />} />
      {r.isLoading && <SkeletonRows rows={4} />}
      {r.isError && <ErrorState error={r.error} onRetry={() => r.refetch()} />}
      {r.data && r.data.total === 0 && <Alert title="No grievances in this period">Choose a longer period.</Alert>}
      {r.data && r.data.total > 0 && (
        <div className="grid gap-4 lg:grid-cols-2">
          <Panel title="By category" description={`${r.data.total} grievances filed`}><BarList rows={r.data.by_category} /></Panel>
          <Panel title="By ward"><BarList rows={r.data.by_ward} /></Panel>
          <Panel title="By assigned officer"><BarList rows={r.data.by_officer.map((o) => [o.name, o.total] as [string, number])} empty="No grievances were assigned in this period." /></Panel>
          <Panel title="By current status"><BarList rows={Object.entries(r.data.by_status)} /></Panel>
        </div>
      )}
    </div>
  );
}

export function SlaPerformance() {
  const [days, setDays] = useState(30);
  const r = useReport(days);
  const stats = useStaffStats();
  const summary = useSummary();
  const risky = useCases({ scope: "department", sla_state: "at_risk,breached" });
  const s = stats.data;
  return (
    <div>
      <PageHeader
        title="SLA Performance"
        subtitle="Deadlines come from each category's SLA hours in the Category Master. Compliance counts resolved grievances filed in the period."
        actions={<PeriodSelect value={days} onChange={setDays} />}
      />
      <Metrics
        items={[
          { label: "Compliance", value: pct(r.data?.sla.compliance), tone: r.data?.sla.compliance != null && r.data.sla.compliance < 0.8 ? "warning" : undefined },
          { label: "Resolved on time", value: r.data?.sla.met ?? "…", tone: "good" },
          { label: "Resolved late", value: r.data?.sla.missed ?? "…", tone: r.data?.sla.missed ? "critical" : undefined },
          { label: "Median resolution", value: r.data?.median_resolution_hours != null ? `${r.data.median_resolution_hours} h` : "n/a" },
          { label: "Open at risk", value: s?.at_risk ?? "…", tone: s?.at_risk ? "warning" : undefined },
          { label: "Open overdue", value: s?.overdue ?? "…", tone: s?.overdue ? "critical" : undefined },
        ]}
      />
      <div className="grid gap-4 xl:grid-cols-[1.6fr_1fr]">
        <Panel title="Open cases at risk or breached" description="Ordered by deadline.">
          <DataTable
            caption="At-risk and breached cases"
            rows={risky.data}
            loading={risky.isLoading}
            error={risky.error}
            onRetry={() => risky.refetch()}
            rowKey={(g) => g.public_id}
            pageSize={8}
            minWidth={640}
            initialSort={{ key: "sla", dir: "asc" }}
            columns={caseColumns({ showOfficer: true }).filter((c) => ["ref", "sla", "status", "officer", "action"].includes(c.key))}
            mobileCard={(g) => <CaseCard g={g} />}
            empty={{ title: "No open case is at risk", body: "Cases appear here as their deadline approaches." }}
          />
        </Panel>
        <Panel title="SLA by category" description="Configured by the system administrator.">
          {summary.isLoading && <SkeletonRows rows={3} />}
          {summary.isError && <ErrorState error={summary.error} onRetry={() => summary.refetch()} />}
          <ul className="divide-y divide-line">
            {summary.data?.categories.map((c) => (
              <li key={c.code} className="flex items-center justify-between gap-3 py-2 text-sm">
                <span className="min-w-0 text-ink">
                  {c.name_en}
                  {c.is_sensitive && <Badge tone="critical" className="ml-2">Sensitive</Badge>}
                </span>
                <span className="shrink-0 tabular-nums text-ink-soft">{c.sla_hours} h</span>
              </li>
            ))}
          </ul>
          {summary.data && <p className="mt-3 text-[12px] text-ink-muted">Department contact: {summary.data.email ?? "not set"}</p>}
        </Panel>
      </div>
    </div>
  );
}
