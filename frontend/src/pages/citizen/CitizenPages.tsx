import { useQuery } from "@tanstack/react-query";
import { useMemo, useState, type FormEvent } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { DataTable } from "../../components/DataTable";
import { Metrics, Panel } from "../../components/dashboard";
import { SlaIndicator, StatusBadge } from "../../components/domain";
import { IconSearch } from "../../components/icons";
import { Alert, Button, EmptyState, ErrorState, Field, Input, PageHeader, Select, SkeletonRows } from "../../components/ui";
import { api } from "../../lib/api";
import { useAuth } from "../../lib/auth";
import { fmtDate, relTime, STATUS_LABEL } from "../../lib/format";
import { categoryName, useI18n } from "../../lib/i18n";
import { SUPPORT_EMAIL } from "../../lib/meta";
import type { GrievanceSummary, Status } from "../../lib/types";
import { LANDING_COPY } from "../public/landingCopy";

const OPEN: Status[] = ["SUBMITTED", "PENDING_REVIEW", "ASSIGNED", "IN_PROGRESS", "REOPENED"];

/** What happens next, in plain words, for each status. */
const NEXT_STEP: Record<Status, string> = {
  SUBMITTED: "Being routed to the right department",
  PENDING_REVIEW: "An officer is reviewing the details",
  ASSIGNED: "An officer has been assigned",
  IN_PROGRESS: "Work is in progress",
  RESOLVED: "Your action: confirm or dispute the fix",
  CLOSED: "No further action",
  REOPENED: "Reopened, the officer has been notified",
};

const useMine = () => useQuery({ queryKey: ["citizen", "grievances"], queryFn: () => api<GrievanceSummary[]>("/citizen/grievances") });

function FileButton() {
  const { t } = useI18n();
  return (
    <Link
      to="/citizen/new"
      className="inline-flex h-10 items-center justify-center rounded-md bg-amber px-4 text-sm font-semibold text-navy shadow-[inset_0_-2px_0_rgba(16,29,43,0.2)] transition-colors duration-150 hover:bg-amber-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-navy"
    >
      {t("fileComplaint")}
    </Link>
  );
}

/* ------------------------------------------------------------------ dashboard */

export function CitizenDashboard() {
  const { user } = useAuth();
  const { lang } = useI18n();
  const q = useMine();
  const rows = q.data ?? [];
  const active = rows.filter((g) => OPEN.includes(g.status));
  const action = rows.filter((g) => g.status === "RESOLVED");
  const resolved = rows.filter((g) => g.status === "CLOSED" || g.status === "RESOLVED");
  const deadlines = active
    .filter((g) => g.sla?.due_at)
    .sort((a, b) => a.sla!.due_at!.localeCompare(b.sla!.due_at!))
    .slice(0, 5);
  const recent = [...rows].sort((a, b) => b.updated_at.localeCompare(a.updated_at)).slice(0, 6);

  return (
    <div>
      <PageHeader title="My Dashboard" subtitle={`Namaste, ${user?.full_name.split(" ")[0]}. Here is where your grievances stand.`} actions={<FileButton />} />
      {q.isLoading && <SkeletonRows rows={3} />}
      {q.isError && <ErrorState error={q.error} onRetry={() => q.refetch()} />}
      {q.data && (
        <>
          <Metrics
            items={[
              { label: "Submitted", value: rows.length, hint: "all time", to: "/citizen/grievances" },
              { label: "Active", value: active.length, to: "/citizen/grievances" },
              { label: "Resolved", value: resolved.length, tone: resolved.length ? "good" : undefined, hint: "resolved or closed" },
              { label: "Needs your action", value: action.length, tone: action.length ? "warning" : undefined, hint: "confirm or dispute" },
            ]}
          />
          {action.length > 0 && (
            <div className="mb-6">
              <Alert tone="warning" title={`${action.length} grievance${action.length > 1 ? "s" : ""} marked resolved`}>
                Please check whether the problem is really fixed, then confirm or dispute:{" "}
                {action.map((g, i) => (
                  <span key={g.public_id}>
                    {i > 0 && ", "}
                    <Link to={`/citizen/grievances/${g.public_id}`} className="font-semibold underline">{g.public_id}</Link>
                  </span>
                ))}
              </Alert>
            </div>
          )}
          {rows.length === 0 ? (
            <EmptyState title="You have not filed a grievance yet" body="Describe a civic problem in English, Hindi or Marathi, by typing or speaking where voice input is enabled." action={<FileButton />} />
          ) : (
            <div className="grid gap-4 xl:grid-cols-[1.4fr_1fr]">
              <Panel title="Recent activity" description="Your grievances, most recently updated first." action={<Link to="/citizen/grievances" className="text-[13px] font-medium text-brand-700 hover:underline">View all</Link>}>
                <ul className="divide-y divide-line">
                  {recent.map((g) => (
                    <li key={g.public_id} className="py-2.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <Link to={`/citizen/grievances/${g.public_id}`} className="font-mono text-[12px] font-semibold text-brand-700 hover:underline">{g.public_id}</Link>
                        <StatusBadge status={g.status} />
                        <span className="text-[12px] text-ink-muted">updated {relTime(g.updated_at)}</span>
                      </div>
                      <p className="mt-0.5 truncate text-sm text-ink">{g.title}</p>
                      <p className="text-[12px] text-ink-muted" lang={lang}>{categoryName(g.category, lang)} · {NEXT_STEP[g.status]}</p>
                    </li>
                  ))}
                </ul>
              </Panel>
              <Panel title="Upcoming deadlines" description="Target resolution dates set by each category's service level.">
                {deadlines.length === 0 ? (
                  <p className="text-sm text-ink-muted">No active grievance has a deadline right now.</p>
                ) : (
                  <ul className="divide-y divide-line">
                    {deadlines.map((g) => (
                      <li key={g.public_id} className="flex items-center justify-between gap-3 py-2.5">
                        <div className="min-w-0">
                          <Link to={`/citizen/grievances/${g.public_id}`} className="font-mono text-[12px] font-semibold text-brand-700 hover:underline">{g.public_id}</Link>
                          <p className="truncate text-sm text-ink">{g.title}</p>
                        </div>
                        <div className="shrink-0 text-right">
                          <p className="text-[13px] text-ink">{fmtDate(g.sla!.due_at, false)}</p>
                          <SlaIndicator sla={g.sla} compact />
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </Panel>
            </div>
          )}
        </>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ my grievances */

export function CitizenGrievances() {
  const { lang, t } = useI18n();
  const q = useMine();
  const [search, setSearch] = useSearchParams();
  const [status, setStatus] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const text = search.get("q") ?? "";
  const setText = (v: string) => {
    const n = new URLSearchParams(search);
    if (v) n.set("q", v);
    else n.delete("q");
    setSearch(n, { replace: true });
  };
  const rows = useMemo(() => {
    const f = from ? new Date(from + "T00:00:00").getTime() : null;
    const tt = to ? new Date(to + "T23:59:59").getTime() : null;
    const needle = text.trim().toLowerCase();
    return q.data?.filter((g) => {
      const time = new Date(g.created_at).getTime();
      if (status === "open" ? !OPEN.includes(g.status) : status && g.status !== status) return false;
      if ((f !== null && time < f) || (tt !== null && time > tt)) return false;
      return !needle || g.public_id.toLowerCase().includes(needle) || g.title.toLowerCase().includes(needle) || (g.location_text ?? "").toLowerCase().includes(needle);
    });
  }, [q.data, status, from, to, text]);
  const filtered = !!(text || status || from || to);

  return (
    <div>
      <PageHeader title={t("myGrievances")} subtitle="Every grievance you have filed. Open one to see its full timeline, or to confirm or dispute a resolution." actions={<FileButton />} />
      <div className="mb-4 grid gap-2 rounded-lg border border-line bg-surface p-3 sm:grid-cols-2 lg:grid-cols-[1.6fr_1fr_auto_auto]">
        <label className="relative sm:col-span-2 lg:col-span-1">
          <span className="sr-only">Search by reference, subject or place</span>
          <IconSearch width={16} height={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted" />
          <Input className="pl-9" placeholder="Search reference, subject or place" value={text} onChange={(e) => setText(e.target.value)} />
        </label>
        <Select aria-label="Status" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">All statuses</option>
          <option value="open">Active only</option>
          {(Object.keys(STATUS_LABEL) as Status[]).map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
        </Select>
        <label className="text-[13px] text-ink-muted">
          <span className="sr-only">Filed from</span>
          <Input type="date" aria-label="Filed from" value={from} onChange={(e) => setFrom(e.target.value)} max={to || undefined} />
        </label>
        <label className="text-[13px] text-ink-muted">
          <span className="sr-only">Filed to</span>
          <Input type="date" aria-label="Filed to" value={to} onChange={(e) => setTo(e.target.value)} min={from || undefined} />
        </label>
      </div>
      <DataTable
        caption="My grievances"
        rows={rows}
        loading={q.isLoading}
        error={q.error}
        onRetry={() => q.refetch()}
        rowKey={(g) => g.public_id}
        initialSort={{ key: "filed", dir: "desc" }}
        pageSize={10}
        empty={filtered ? { title: "No grievances match", body: "Change or clear the filters." } : { title: "You have not filed a grievance yet", action: <FileButton /> }}
        columns={[
          { key: "ref", header: "Reference", render: (g) => <Link to={`/citizen/grievances/${g.public_id}`} className="font-mono text-[12px] font-semibold text-brand-700 hover:underline">{g.public_id}</Link>, sortValue: (g) => g.public_id },
          { key: "subject", header: "Subject", render: (g) => <span className="line-clamp-2 font-medium text-ink">{g.title}</span>, sortValue: (g) => g.title, className: "w-[26%]" },
          { key: "category", header: "Category", render: (g) => <span lang={lang} className="text-ink-soft">{categoryName(g.category, lang)}</span>, sortValue: (g) => g.category?.name_en },
          { key: "dept", header: "Department", render: (g) => <span className="text-ink-soft">{g.department?.name ?? "Being routed"}</span>, sortValue: (g) => g.department?.name },
          { key: "filed", header: "Submitted", render: (g) => <span className="whitespace-nowrap text-ink-soft">{fmtDate(g.created_at, false)}</span>, sortValue: (g) => g.created_at },
          { key: "status", header: "Status", render: (g) => <StatusBadge status={g.status} />, sortValue: (g) => g.status },
          {
            key: "next",
            header: "Next step / deadline",
            render: (g) => (
              <span className="text-[13px]">
                <span className={g.status === "RESOLVED" ? "font-semibold text-status-warning" : "text-ink-soft"}>{NEXT_STEP[g.status]}</span>
                {OPEN.includes(g.status) && g.sla?.due_at && <span className="block text-ink-muted">Target {fmtDate(g.sla.due_at, false)}</span>}
              </span>
            ),
            sortValue: (g) => g.sla?.due_at ?? null,
          },
          { key: "view", header: "Action", align: "right", render: (g) => <Link to={`/citizen/grievances/${g.public_id}`} className="inline-flex h-8 items-center rounded-md border border-stone-dark px-3 text-[13px] font-semibold text-ink hover:bg-canvas">View<span className="sr-only"> {g.public_id}</span></Link> },
        ]}
        mobileCard={(g) => (
          <Link to={`/citizen/grievances/${g.public_id}`} className="block">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-[12px] font-semibold text-brand-700">{g.public_id}</span>
              <StatusBadge status={g.status} />
            </div>
            <p className="mt-1 font-medium text-ink">{g.title}</p>
            <p className="mt-0.5 text-[13px] text-ink-muted" lang={lang}>{categoryName(g.category, lang)} · {fmtDate(g.created_at, false)}</p>
            <p className={g.status === "RESOLVED" ? "mt-1 text-[13px] font-semibold text-status-warning" : "mt-1 text-[13px] text-ink-soft"}>{NEXT_STEP[g.status]}</p>
          </Link>
        )}
      />
    </div>
  );
}

/* ------------------------------------------------------------------ track */

export function TrackComplaint() {
  const nav = useNavigate();
  const q = useMine();
  const [ref, setRef] = useState("");
  const [error, setError] = useState<string | null>(null);
  const submit = (e: FormEvent) => {
    e.preventDefault();
    const v = ref.trim().toUpperCase();
    if (!v) return setError("Enter the reference number shown when you filed the grievance, for example GRV-2026-000123.");
    const match = q.data?.find((g) => g.public_id.toUpperCase() === v);
    if (q.data && !match) return setError(`No grievance with reference ${v} was found in your account. Check the number and try again.`);
    setError(null);
    nav(`/citizen/grievances/${encodeURIComponent(match?.public_id ?? v)}`);
  };
  const open = (q.data ?? []).filter((g) => OPEN.includes(g.status) || g.status === "RESOLVED");
  return (
    <div className="max-w-3xl">
      <PageHeader title="Track Complaint" subtitle="Enter a reference number to see the full status history, or choose one of your active grievances." />
      <form onSubmit={submit} noValidate className="rounded-lg border border-line bg-surface p-5">
        <Field label="Grievance reference number" htmlFor="ref" error={error ?? undefined} hint="You can only track grievances filed from your own account.">
          <div className="flex flex-col gap-2 sm:flex-row">
            <Input id="ref" value={ref} onChange={(e) => setRef(e.target.value)} placeholder="GRV-2026-000123" autoComplete="off" aria-invalid={!!error} className="font-mono sm:max-w-xs" />
            <Button type="submit">Track</Button>
          </div>
        </Field>
      </form>
      <h2 className="mb-2 mt-8 text-[15px] font-semibold text-ink">Your active grievances</h2>
      {q.isLoading && <SkeletonRows rows={3} />}
      {q.isError && <ErrorState error={q.error} onRetry={() => q.refetch()} />}
      {q.data && open.length === 0 && <p className="text-sm text-ink-muted">You have no active grievances.</p>}
      <ul className="divide-y divide-line overflow-hidden rounded-lg border border-line bg-surface empty:hidden">
        {open.map((g) => (
          <li key={g.public_id}>
            <Link to={`/citizen/grievances/${g.public_id}`} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 hover:bg-canvas">
              <span className="min-w-0">
                <span className="font-mono text-[12px] font-semibold text-brand-700">{g.public_id}</span>
                <span className="block truncate text-sm text-ink">{g.title}</span>
              </span>
              <span className="flex items-center gap-3">
                <StatusBadge status={g.status} />
                <span className="text-[13px] font-medium text-brand-700">Track</span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ------------------------------------------------------------------ help */

export function CitizenHelp() {
  const { lang } = useI18n();
  const faq = LANDING_COPY[lang].faqSection;
  return (
    <div className="max-w-3xl" lang={lang}>
      <PageHeader title="Help & Support" subtitle="Answers to common questions about filing, tracking and disputing grievances." />
      <div className="divide-y divide-line rounded-lg border border-line bg-surface">
        {faq.items.map(([q, a]) => (
          <details key={q} className="group px-5">
            <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-4 py-3 text-[15px] font-semibold text-ink [&::-webkit-details-marker]:hidden">
              {q}
              <span className="text-brand-700 transition-transform duration-150 group-open:rotate-45 motion-reduce:transition-none" aria-hidden>+</span>
            </summary>
            <p className="max-w-prose pb-4 text-[15px] leading-relaxed text-ink-soft">{a}</p>
          </details>
        ))}
      </div>
      <section className="mt-8">
        <h2 className="text-[17px] font-semibold text-ink">Contact</h2>
        {SUPPORT_EMAIL ? (
          <p className="mt-2 text-sm text-ink-soft">
            Write to <a className="font-semibold text-brand-700 underline" href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a> and include your grievance reference number.
          </p>
        ) : (
          <p className="mt-2 text-sm text-ink-soft">A support contact has not been configured for this deployment yet. For a specific grievance, use the dispute option on its tracking page.</p>
        )}
      </section>
    </div>
  );
}
