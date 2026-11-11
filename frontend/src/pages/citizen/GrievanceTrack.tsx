import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Link2, Star } from "lucide-react";
import { useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { SensitiveBadge, SlaIndicator, StatusBadge, Timeline, UrgencyBadge } from "../../components/domain";
import { Alert, Button, Card, ErrorState, Field, Modal, PageHeader, Spinner, Textarea } from "../../components/ui";
import { api } from "../../lib/api";
import { fmtDate } from "../../lib/format";
import { categoryName, useI18n } from "../../lib/i18n";
import type { GrievanceDetail } from "../../lib/types";

export default function GrievanceTrack() {
  const { id = "" } = useParams();
  const [params] = useSearchParams();
  const { t, lang } = useI18n();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["citizen", "grievance", id], queryFn: () => api<GrievanceDetail>(`/citizen/grievances/${id}`) });
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [disputeOpen, setDisputeOpen] = useState(false);
  const [reason, setReason] = useState("");

  const refresh = (g: GrievanceDetail) => {
    qc.setQueryData(["citizen", "grievance", id], g);
    void qc.invalidateQueries({ queryKey: ["citizen", "grievances"] });
    void qc.invalidateQueries({ queryKey: ["notifications"] });
  };
  const confirm = useMutation({
    mutationFn: () => api<GrievanceDetail>(`/citizen/grievances/${id}/confirm-resolution`, { body: { rating: rating || undefined, comment: comment || undefined } }),
    onSuccess: refresh,
  });
  const dispute = useMutation({
    mutationFn: () => api<GrievanceDetail>(`/citizen/grievances/${id}/dispute`, { body: { reason } }),
    onSuccess: (g) => {
      refresh(g);
      setDisputeOpen(false);
      setReason("");
    },
  });

  if (q.isLoading) return <Spinner />;
  if (q.isError) return <ErrorState error={q.error} onRetry={() => q.refetch()} />;
  const g = q.data!;
  const canDispute = g.status === "RESOLVED" || (g.status === "CLOSED" && g.closed_at && Date.now() - new Date(g.closed_at).getTime() < 30 * 86_400_000);

  return (
    <div className="mx-auto max-w-4xl">
      {params.get("new") && (
        <div className="mb-5">
          <Alert tone="good" title={t("submitted")}>
            Your grievance ID is <strong className="font-mono">{g.public_id}</strong>. Keep it for reference — you will be notified at every step.
          </Alert>
        </div>
      )}
      <PageHeader
        eyebrow={<Link to="/citizen" className="text-sm text-brand-700 hover:underline">← {t("myGrievances")}</Link>}
        title={g.title}
        subtitle={<span className="font-mono">{g.public_id}</span>}
        actions={<StatusBadge status={g.status} />}
      />
      <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
        <div className="space-y-5">
          {g.status === "RESOLVED" && (
            <Card title="Was your problem fixed?" subtitle="Confirm to close the grievance, or dispute it to reopen.">
              {g.resolution_summary && (
                <p className="mb-4 rounded-md bg-green-50 p-3 text-sm text-green-900">
                  <span className="font-semibold">Action taken:</span> {g.resolution_summary}
                </p>
              )}
              <p className="mb-1 text-sm font-medium" lang={lang}>{t("rate")}</p>
              <div className="mb-3 flex gap-1" role="radiogroup" aria-label="Rating">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button key={n} role="radio" aria-checked={rating === n} aria-label={`${n} star`} onClick={() => setRating(n)} className="p-0.5">
                    <Star className={n <= rating ? "h-6 w-6 fill-saffron-500 text-saffron-500" : "h-6 w-6 text-slate-300"} aria-hidden />
                  </button>
                ))}
              </div>
              <Textarea rows={2} placeholder="Comments (optional)" value={comment} onChange={(e) => setComment(e.target.value)} />
              {(confirm.error || dispute.error) && <div className="mt-3"><Alert tone="critical">{String((confirm.error || dispute.error)?.message)}</Alert></div>}
              <div className="mt-4 flex flex-wrap gap-2">
                <Button onClick={() => confirm.mutate()} loading={confirm.isPending}>
                  <CheckCircle2 className="h-4 w-4" aria-hidden /> <span lang={lang}>{t("confirmResolution")}</span>
                </Button>
                <Button variant="secondary" onClick={() => setDisputeOpen(true)}>
                  <span lang={lang}>{t("dispute")}</span>
                </Button>
              </div>
            </Card>
          )}
          {g.status === "CLOSED" && canDispute && (
            <Alert tone="info">
              This grievance is closed.{" "}
              <button className="font-medium underline" onClick={() => setDisputeOpen(true)}>
                Dispute the resolution
              </button>{" "}
              within 30 days if the problem is back.
            </Alert>
          )}
          {g.is_sensitive && <Alert tone="warning">{t("sensitiveNote")}</Alert>}
          <Card title="Your complaint">
            <p className="whitespace-pre-wrap text-sm leading-relaxed" lang={g.language}>
              {g.description}
            </p>
            {g.duplicate_group && (
              <p className="mt-4 flex items-start gap-2 rounded-md bg-brand-50 p-3 text-sm text-brand-900">
                <Link2 className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                {g.duplicate_group_size && g.duplicate_group_size > 1
                  ? `${g.duplicate_group_size - 1} other citizen report(s) about the same issue are linked to this one. Your grievance is still tracked individually.`
                  : "This grievance is linked to related reports. It is still tracked individually."}
              </p>
            )}
          </Card>
          <Card title={t("timeline")}>
            <Timeline items={g.status_history} />
          </Card>
        </div>
        <aside className="space-y-5">
          <Card title="Details">
            <dl className="space-y-3 text-sm">
              <div>
                <dt className="text-ink-muted">{t("category")}</dt>
                <dd className="font-medium" lang={lang}>{categoryName(g.category, lang)}</dd>
              </div>
              <div>
                <dt className="text-ink-muted">{t("department")}</dt>
                <dd className="font-medium">{g.department?.name ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-ink-muted">{t("urgency")}</dt>
                <dd><UrgencyBadge urgency={g.urgency} /></dd>
              </div>
              <div>
                <dt className="text-ink-muted">Location</dt>
                <dd className="font-medium">{g.location_text || g.ward || "—"}</dd>
              </div>
              <div>
                <dt className="text-ink-muted">Filed</dt>
                <dd className="font-medium">{fmtDate(g.created_at)}</dd>
              </div>
              {g.status !== "CLOSED" && g.status !== "RESOLVED" && (
                <div>
                  <dt className="text-ink-muted" lang={lang}>{t("expected")}</dt>
                  <dd className="mt-0.5"><SlaIndicator sla={g.sla} /></dd>
                </div>
              )}
              {g.is_sensitive && <SensitiveBadge hidden={g.identity_hidden} />}
            </dl>
          </Card>
        </aside>
      </div>

      <Modal
        open={disputeOpen}
        title="Dispute the resolution"
        onClose={() => setDisputeOpen(false)}
        footer={
          <>
            <Button variant="secondary" onClick={() => setDisputeOpen(false)}>Cancel</Button>
            <Button variant="danger" onClick={() => dispute.mutate()} loading={dispute.isPending} disabled={reason.trim().length < 10}>
              Reopen grievance
            </Button>
          </>
        }
      >
        <p className="text-sm text-ink-soft">The grievance will be reopened and the officer notified. Repeated disputes are escalated automatically.</p>
        <Field label={t("disputeReason")} htmlFor="reason" hint="At least 10 characters.">
          <Textarea id="reason" rows={4} value={reason} onChange={(e) => setReason(e.target.value)} />
        </Field>
        {dispute.error && <Alert tone="critical">{dispute.error.message}</Alert>}
      </Modal>
    </div>
  );
}
