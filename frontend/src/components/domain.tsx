import clsx from "clsx";
import { AlertOctagon, CheckCircle2, Clock, Database, EyeOff, ShieldAlert, TimerOff } from "lucide-react";
import { useEffect, useState } from "react";
import { fmtDate, hoursLabel, STATUS_LABEL } from "../lib/format";
import type { HistoryItem, Sla, Status, Urgency } from "../lib/types";
import { Badge } from "./ui";

export function StatusBadge({ status }: { status: Status }) {
  const tone = (
    {
      SUBMITTED: "neutral",
      PENDING_REVIEW: "warning",
      ASSIGNED: "brand",
      IN_PROGRESS: "brand",
      RESOLVED: "good",
      CLOSED: "outline",
      REOPENED: "serious",
    } as const
  )[status];
  return <Badge tone={tone}>{STATUS_LABEL[status]}</Badge>;
}

export function UrgencyBadge({ urgency }: { urgency: Urgency }) {
  const tone = ({ low: "outline", medium: "neutral", high: "serious", critical: "critical" } as const)[urgency];
  return <Badge tone={tone}>{urgency}</Badge>;
}

export function SourceBadge({ source }: { source: string }) {
  if (source === "LIVE") return null;
  return (
    <Badge tone={source === "SYNTHETIC" ? "saffron" : "brand"} title={source === "SYNTHETIC" ? "Generated demo data — not official" : "Imported official dataset"}>
      <Database className="h-3 w-3" aria-hidden />
      {source}
    </Badge>
  );
}

export function SensitiveBadge({ hidden }: { hidden?: boolean }) {
  return (
    <span className="inline-flex items-center gap-1">
      <Badge tone="critical">
        <ShieldAlert className="h-3 w-3" aria-hidden /> Sensitive
      </Badge>
      {hidden && (
        <Badge tone="outline" title="Complainant identity is masked">
          <EyeOff className="h-3 w-3" aria-hidden /> ID hidden
        </Badge>
      )}
    </span>
  );
}

/** SLA state with a live countdown. Status colour is always paired with an icon + text. */
export function SlaIndicator({ sla, compact = false, closed = false }: { sla: Sla | null; compact?: boolean; closed?: boolean }) {
  const [, tick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => tick((n) => n + 1), 60_000);
    return () => clearInterval(id);
  }, []);
  if (!sla?.due_at) return <span className="text-xs text-ink-muted">No SLA</span>;
  const hours = (new Date(sla.due_at).getTime() - Date.now()) / 3_600_000;
  const state = sla.state === "met" || sla.state === "missed" || closed ? sla.state : hours < 0 ? "breached" : sla.state;
  const cfg = {
    on_track: { icon: Clock, cls: "text-ink-soft", label: hoursLabel(hours) },
    at_risk: { icon: AlertOctagon, cls: "text-amber-700", label: `At risk · ${hoursLabel(hours)}` },
    breached: { icon: TimerOff, cls: "text-red-700", label: `Breached · ${hoursLabel(hours)}` },
    met: { icon: CheckCircle2, cls: "text-green-700", label: "SLA met" },
    missed: { icon: TimerOff, cls: "text-red-700", label: "Resolved late" },
  }[state ?? "on_track"] ?? { icon: Clock, cls: "text-ink-soft", label: hoursLabel(hours) };
  const Icon = cfg.icon;
  return (
    <span className={clsx("inline-flex items-center gap-1.5 text-xs font-medium tabular-nums", cfg.cls)} title={`Due ${fmtDate(sla.due_at)}`}>
      <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden />
      {compact ? cfg.label : `${cfg.label} (due ${fmtDate(sla.due_at)})`}
    </span>
  );
}

export function ConfidenceMeter({ value, threshold }: { value: number | null | undefined; threshold?: number }) {
  if (value === null || value === undefined) return <span className="text-xs text-ink-muted">—</span>;
  const below = threshold !== undefined && value < threshold;
  return (
    <div className="flex items-center gap-2" title={threshold !== undefined ? `Threshold ${(threshold * 100).toFixed(0)}%` : undefined}>
      <div className="relative h-1.5 w-24 overflow-hidden rounded-full bg-slate-200" aria-hidden>
        <div className={clsx("h-full rounded-full", below ? "bg-status-serious" : "bg-brand-600")} style={{ width: `${Math.round(value * 100)}%` }} />
        {threshold !== undefined && <div className="absolute top-0 h-full w-0.5 bg-ink" style={{ left: `${threshold * 100}%` }} />}
      </div>
      <span className="text-xs font-medium tabular-nums text-ink">{Math.round(value * 100)}%</span>
      {below && <span className="text-xs text-orange-800">below threshold</span>}
    </div>
  );
}

export function Timeline({ items }: { items: HistoryItem[] }) {
  return (
    <ol className="relative space-y-4 border-l border-line pl-5">
      {items.map((h, i) => (
        <li key={i} className="relative">
          <span
            className={clsx(
              "absolute -left-[26px] top-1 h-3 w-3 rounded-full border-2 border-white",
              h.actor_type === "AI_SYSTEM" ? "bg-brand-500" : h.actor_type === "CITIZEN" ? "bg-saffron-500" : "bg-slate-500",
            )}
            aria-hidden
          />
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={h.to_status} />
            <span className="text-xs text-ink-muted">{fmtDate(h.created_at)}</span>
          </div>
          <p className="mt-1 text-xs text-ink-soft">
            by <span className="font-medium text-ink">{h.actor_label}</span>
          </p>
          {h.note && <p className="mt-1 text-sm text-ink-soft">{h.note}</p>}
        </li>
      ))}
    </ol>
  );
}

export function SyntheticBanner() {
  return (
    <div className="border-b border-saffron-100 bg-saffron-50 px-4 py-1.5 text-center text-xs text-saffron-700">
      <strong>SYNTHETIC DEMO DATA.</strong> Categories, departments and history are generated for demonstration; they are not official HackFusion datasets. Predictions are demo estimates.
    </div>
  );
}
