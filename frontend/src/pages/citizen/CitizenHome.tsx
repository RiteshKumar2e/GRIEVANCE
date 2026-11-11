import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { SlaIndicator, StatusBadge } from "../../components/domain";
import { IconChevron } from "../../components/icons";
import { Button, EmptyState, ErrorState, PageHeader, SkeletonRows } from "../../components/ui";
import { api } from "../../lib/api";
import { useAuth } from "../../lib/auth";
import { relTime } from "../../lib/format";
import { categoryName, useI18n } from "../../lib/i18n";
import type { GrievanceSummary } from "../../lib/types";

export default function CitizenHome() {
  const { user } = useAuth();
  const { t, lang } = useI18n();
  const q = useQuery({ queryKey: ["citizen", "grievances"], queryFn: () => api<GrievanceSummary[]>("/citizen/grievances") });
  const open = q.data?.filter((g) => !["CLOSED"].includes(g.status)) ?? [];
  const closed = q.data?.filter((g) => g.status === "CLOSED") ?? [];

  return (
    <div>
      <PageHeader
        title={`${t("myGrievances")}`}
        subtitle={`Namaste, ${user?.full_name.split(" ")[0]}.`}
        actions={
          <Link to="/citizen/new">
            <Button variant="accent">
              {t("fileComplaint")}
            </Button>
          </Link>
        }
      />
      {q.isLoading && <SkeletonRows />}
      {q.isError && <ErrorState error={q.error} onRetry={() => q.refetch()} />}
      {q.data && q.data.length === 0 && (
        <EmptyState title={t("emptyGrievances")} body="Describe a civic problem in English, Hindi or Marathi, by typing or speaking." action={<Link to="/citizen/new"><Button>{t("fileComplaint")}</Button></Link>} />
      )}
      {[{ label: "Active", rows: open }, { label: "Closed", rows: closed }].map(
        (sec) =>
          sec.rows.length > 0 && (
            <section key={sec.label} className="mb-8">
              <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-muted">
                {sec.label} · {sec.rows.length}
              </h2>
              <ul className="divide-y divide-line overflow-hidden rounded-lg border border-line bg-surface">
                {sec.rows.map((g) => (
                  <li key={g.public_id}>
                    <Link to={`/citizen/grievances/${g.public_id}`} className="flex items-center gap-4 px-4 py-3.5 hover:bg-black/[0.02]">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-mono text-xs text-ink-muted">{g.public_id}</span>
                          <StatusBadge status={g.status} />
                          {g.status === "RESOLVED" && <span className="text-xs font-medium text-green-800">Please confirm or dispute</span>}
                        </div>
                        <p className="mt-1 truncate font-medium text-ink">{g.title}</p>
                        <p className="mt-0.5 text-xs text-ink-muted" lang={lang}>
                          {categoryName(g.category, lang)} · {g.department?.name ?? "n/a"} · filed {relTime(g.created_at)}
                        </p>
                      </div>
                      <div className="hidden sm:block">{g.status !== "CLOSED" && g.status !== "RESOLVED" && <SlaIndicator sla={g.sla} compact />}</div>
                      <IconChevron width={16} height={16} className="text-ink-muted" />
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ),
      )}
    </div>
  );
}
