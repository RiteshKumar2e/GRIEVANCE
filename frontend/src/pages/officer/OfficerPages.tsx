import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { CaseListPage, useCases } from "../../components/cases";
import { ActivityFeed, Metrics, Panel, useStaffStats, WorkloadBar } from "../../components/dashboard";
import { SlaIndicator, StatusBadge } from "../../components/domain";
import { caseHref } from "../../components/nav";
import { Alert, EmptyState, ErrorState, PageHeader, SkeletonRows } from "../../components/ui";
import { api } from "../../lib/api";
import { useAuth } from "../../lib/auth";
import { fmtDate, pct } from "../../lib/format";
import type { Status } from "../../lib/types";

/* ------------------------------------------------------------------ overview */

export function OfficerOverview() {
  const { user } = useAuth();
  const stats = useStaffStats();
  const mine = useCases({ scope: "mine" });
  const s = stats.data;
  const attention = [...(mine.data ?? [])]
    .filter((g) => g.status !== "RESOLVED")
    .sort((a, b) => (a.sla?.due_at ?? "9999").localeCompare(b.sla?.due_at ?? "9999"))
    .slice(0, 6);

  return (
    <div>
      <PageHeader
        title="Overview"
        subtitle={[user?.designation, user?.department_name].filter(Boolean).join(" · ") || "Your cases and your department at a glance."}
      />
      {stats.isError && <ErrorState error={stats.error} onRetry={() => stats.refetch()} />}
      {stats.isLoading && <SkeletonRows rows={2} />}
      {s && (
        <Metrics
          items={[
            { label: "Assigned to me", value: s.assigned_to_me, hint: "open cases", to: "/officer/cases" },
            { label: "Pending review", value: s.pending_review, tone: s.pending_review ? "warning" : undefined, to: "/officer/review" },
            { label: "Approaching deadline", value: s.at_risk, tone: s.at_risk ? "warning" : undefined, hint: "SLA at risk", to: "/officer/sla" },
            { label: "Overdue", value: s.overdue, tone: s.overdue ? "critical" : undefined, to: "/officer/sla" },
            { label: "Escalated", value: s.escalated, tone: s.escalated ? "warning" : undefined, to: "/officer/escalations" },
            { label: "Resolved / closed", value: s.resolved, hint: "in your scope", tone: "good" },
          ]}
        />
      )}

      <div className="grid gap-4 xl:grid-cols-[1.5fr_1fr]">
        <Panel
          title="Needs your attention"
          description="Your open cases with the nearest SLA deadline first."
          action={<Link to="/officer/cases" className="text-[13px] font-medium text-brand-700 hover:underline">All assigned cases</Link>}
        >
          {mine.isLoading && <SkeletonRows rows={3} />}
          {mine.isError && <ErrorState error={mine.error} onRetry={() => mine.refetch()} />}
          {mine.data && attention.length === 0 && <p className="py-4 text-sm text-ink-muted">You have no open cases assigned to you.</p>}
          <ul className="divide-y divide-line">
            {attention.map((g) => (
              <li key={g.public_id} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 py-2.5">
                <div className="min-w-0">
                  <Link to={caseHref("officer", g.public_id)} className="font-mono text-[12px] font-semibold text-brand-700 hover:underline">
                    {g.public_id}
                  </Link>
                  <p className="truncate text-sm text-ink">{g.title}</p>
                </div>
                <div className="flex items-center gap-3">
                  <StatusBadge status={g.status} />
                  <SlaIndicator sla={g.sla} compact />
                </div>
              </li>
            ))}
          </ul>
        </Panel>

        <div className="space-y-4">
          <Panel title="My workload" description="Open cases against the capacity set for you by your department.">
            {s ? (
              <WorkloadBar label={user?.full_name ?? "Me"} open={s.assigned_to_me} capacity={s.my_capacity} sub={s.awaiting_citizen ? `${s.awaiting_citizen} resolved case(s) in your scope await the citizen's confirmation.` : undefined} />
            ) : (
              <SkeletonRows rows={1} />
            )}
          </Panel>
          <Panel title="Recent case activity">
            <ActivityFeed limit={8} />
          </Panel>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ case lists */

export function AssignedCases() {
  return (
    <CaseListPage
      title="Assigned Cases"
      subtitle="Grievances assigned to you. Open a case to update its status, add notes or escalate it."
      query={{ scope: "mine" }}
      showOfficer={false}
      empty={{ title: "No cases are assigned to you", body: "New assignments appear here and in your notifications." }}
    />
  );
}

export function AllGrievances() {
  return (
    <CaseListPage
      title="All Grievances"
      subtitle="Every grievance you are authorised to see: your department's cases, and sensitive cases only if you are cleared to handle them."
      query={{ scope: "department" }}
      empty={{ title: "No active grievances in your scope" }}
    />
  );
}

export function ReviewQueue() {
  return (
    <CaseListPage
      title="Review Queue"
      subtitle="Sensitive, low-confidence or flagged grievances. The AI cannot assign or close these: open a case to inspect the recommendation, its evidence and similar past cases, then accept, correct or reassign it. Every decision is audited."
      query={{ scope: "review" }}
      allowStatusFilter={false}
      allowClosedToggle={false}
      action={(g) => <ReviewLink id={g.public_id} />}
      empty={{ title: "Nothing awaiting review", body: "Every flagged grievance has a human decision." }}
    />
  );
}

function ReviewLink({ id }: { id: string }) {
  const { user } = useAuth();
  return (
    <Link
      to={caseHref(user!.role, id)}
      className="inline-flex h-8 items-center rounded-md bg-brand-700 px-3 text-[13px] font-semibold text-white hover:bg-brand-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
    >
      Review<span className="sr-only"> {id}</span>
    </Link>
  );
}

export function Escalations() {
  return (
    <CaseListPage
      title="Escalations"
      subtitle="Open grievances escalated manually by an officer, automatically after an SLA breach, or by a repeated citizen dispute."
      query={{ scope: "department", escalated: true }}
      empty={{ title: "No escalated grievances", body: "Escalated cases in your scope will be listed here." }}
    />
  );
}

export function SlaMonitoring() {
  const stats = useStaffStats();
  const s = stats.data;
  return (
    <CaseListPage
      title="SLA Monitoring"
      subtitle="Open grievances at risk of missing, or past, the deadline set by their category in the Category Master. Deadlines are never edited here."
      query={{ scope: "department", sla_state: "at_risk,breached" }}
      intro={
        s && (
          <Metrics
            items={[
              { label: "At risk", value: s.at_risk, tone: s.at_risk ? "warning" : undefined },
              { label: "Breached (SLA monitor)", value: s.breached, tone: s.breached ? "critical" : undefined },
              { label: "Past deadline now", value: s.overdue, tone: s.overdue ? "critical" : undefined, hint: "includes cases not yet re-scanned" },
              { label: "Open in scope", value: s.open },
              { label: "On-time share", value: s.open ? pct(1 - s.overdue / s.open) : "n/a", hint: "of open cases" },
              { label: "Escalated", value: s.escalated },
            ]}
          />
        )
      }
      empty={{ title: "No cases at risk or overdue", body: "The SLA monitor flags cases here as their deadline approaches." }}
    />
  );
}

/* ------------------------------------------------------------------ duplicate incidents */

interface DupGroup {
  public_id: string;
  label: string;
  ward: string | null;
  category: string | null;
  created_by: string;
  created_at: string;
  member_count: number;
  hidden_members: number;
  members: { public_id: string; title: string; status: Status; ward: string | null; created_at: string; score: number; signals: Record<string, number | null>; linked_by: string }[];
}

export function DuplicateIncidents() {
  const { user } = useAuth();
  const q = useQuery({ queryKey: ["officer", "duplicates"], queryFn: () => api<DupGroup[]>("/officer/duplicates") });
  return (
    <div>
      <PageHeader
        title="Duplicate Incidents"
        subtitle="Reports linked as the same incident by meaning, distance and time. Linking never merges, closes or deletes a complaint: every report keeps its own ID, status and updates. Unlink an incorrect match from the case page."
      />
      {q.isLoading && <SkeletonRows rows={4} />}
      {q.isError && <ErrorState error={q.error} onRetry={() => q.refetch()} />}
      {q.data?.length === 0 && <EmptyState title="No linked incidents" body="Groups appear here when two or more reports in your scope describe the same problem." />}
      <div className="space-y-4">
        {q.data?.map((grp) => (
          <section key={grp.public_id} className="rounded-lg border border-line bg-surface" aria-label={`Group ${grp.public_id}`}>
            <header className="flex flex-wrap items-start justify-between gap-2 border-b border-line px-5 py-3.5">
              <div className="min-w-0">
                <h2 className="text-[15px] font-semibold text-ink">{grp.label}</h2>
                <p className="mt-0.5 text-[13px] text-ink-muted">
                  <span className="font-mono">{grp.public_id}</span> · {grp.category ?? "Category n/a"} · {grp.ward ?? "Ward n/a"} · linked by {grp.created_by === "AI_SYSTEM" ? "AI system" : grp.created_by} on {fmtDate(grp.created_at, false)}
                </p>
              </div>
              <p className="text-[13px] font-medium text-ink">
                {grp.member_count} report{grp.member_count === 1 ? "" : "s"}
                {grp.hidden_members > 0 && <span className="block text-[12px] font-normal text-ink-muted">{grp.hidden_members} outside your access</span>}
              </p>
            </header>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-sm">
                <caption className="sr-only">Reports in group {grp.public_id}</caption>
                <thead className="text-left text-[12px] uppercase tracking-[0.05em] text-ink-muted">
                  <tr>
                    <th scope="col" className="px-5 py-2 font-semibold">Report</th>
                    <th scope="col" className="px-3 py-2 font-semibold">Status</th>
                    <th scope="col" className="px-3 py-2 font-semibold">Match score</th>
                    <th scope="col" className="px-3 py-2 font-semibold">Evidence</th>
                    <th scope="col" className="px-5 py-2 font-semibold">Filed</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {grp.members.map((m) => (
                    <tr key={m.public_id} className="align-top">
                      <td className="px-5 py-2.5">
                        <Link to={caseHref(user!.role, m.public_id)} className="font-mono text-[12px] font-semibold text-brand-700 hover:underline">
                          {m.public_id}
                        </Link>
                        <p className="max-w-xs truncate text-ink">{m.title}</p>
                      </td>
                      <td className="px-3 py-2.5"><StatusBadge status={m.status} /></td>
                      <td className="px-3 py-2.5 tabular-nums">{m.score ? pct(m.score) : <span className="text-ink-muted">First report</span>}</td>
                      <td className="px-3 py-2.5 text-[12px] text-ink-soft">
                        {Object.entries(m.signals ?? {})
                          .filter(([, v]) => v !== null && v !== undefined)
                          .map(([k, v]) => `${k.replace(/_/g, " ")} ${typeof v === "number" ? (v <= 1 ? pct(v) : v.toFixed(1)) : v}`)
                          .join(" · ") || "n/a"}
                      </td>
                      <td className="px-5 py-2.5 whitespace-nowrap text-ink-soft">{fmtDate(m.created_at, false)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        ))}
      </div>
      {q.data && q.data.length > 0 && (
        <div className="mt-4">
          <Alert>Match scores combine semantic similarity, distance and time between reports. The threshold is configured by the system administrator.</Alert>
        </div>
      )}
    </div>
  );
}
