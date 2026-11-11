import { useQuery, useQueryClient } from "@tanstack/react-query";
import clsx from "clsx";
import { useState } from "react";
import { Link } from "react-router-dom";
import { caseHref } from "../components/nav";
import { Button, EmptyState, ErrorState, PageHeader, SkeletonRows, Tabs } from "../components/ui";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";
import { fmtDate, titleCase } from "../lib/format";
import { useI18n } from "../lib/i18n";
import type { Notification } from "../lib/types";

export default function Notifications() {
  const { user } = useAuth();
  const { t } = useI18n();
  const qc = useQueryClient();
  const [filter, setFilter] = useState<"all" | "unread">("all");
  const q = useQuery({
    queryKey: ["notifications", "page", filter],
    queryFn: () => api<{ unread: number; items: Notification[] }>(`/notifications?limit=200${filter === "unread" ? "&unread=true" : ""}`),
  });
  const markAll = async () => {
    await api("/notifications/read-all", { method: "POST" });
    void qc.invalidateQueries({ queryKey: ["notifications"] });
  };
  const markOne = async (n: Notification) => {
    if (n.is_read) return;
    await api(`/notifications/${n.id}/read`, { method: "POST" });
    void qc.invalidateQueries({ queryKey: ["notifications"] });
  };

  return (
    <div className="max-w-4xl">
      <PageHeader
        title={user?.role === "citizen" ? t("notifications") : "Notifications"}
        subtitle="Updates about grievances you filed or handle. Read and unread states are saved to your account."
        actions={
          <>
            <Tabs value={filter} onChange={setFilter} items={[{ value: "all", label: "All" }, { value: "unread", label: `Unread${q.data ? ` (${q.data.unread})` : ""}` }]} />
            <Button variant="secondary" size="sm" onClick={markAll} disabled={!q.data?.unread}>
              Mark all read
            </Button>
          </>
        }
      />
      {q.isLoading && <SkeletonRows />}
      {q.isError && <ErrorState error={q.error} onRetry={() => q.refetch()} />}
      {q.data && q.data.items.length === 0 && <EmptyState title="Nothing here yet" body="Updates about your grievances will appear here." />}
      {q.data && q.data.items.length > 0 && (
        <ul className="divide-y divide-line overflow-hidden rounded-lg border border-line bg-surface">
          {q.data.items.map((n) => (
            <li key={n.id} className={clsx("px-4 py-3.5", !n.is_read && "bg-brand-50/40")}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className={clsx("text-sm", !n.is_read ? "font-semibold" : "font-medium text-ink-soft")}>{n.title}</p>
                  <p className="mt-0.5 text-sm text-ink-soft">{n.body}</p>
                  <p className="mt-1 text-xs text-ink-muted">
                    {titleCase(n.kind)} · {fmtDate(n.created_at)}
                    {n.grievance_id && (
                      <>
                        {" · "}
                        <Link to={caseHref(user!.role, n.grievance_id)} onClick={() => markOne(n)} className="font-medium text-brand-700 hover:underline">
                          Open {n.grievance_id}
                        </Link>
                      </>
                    )}
                  </p>
                </div>
                {!n.is_read && (
                  <button onClick={() => markOne(n)} className="shrink-0 text-xs font-medium text-brand-700 hover:underline">
                    Mark read
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
