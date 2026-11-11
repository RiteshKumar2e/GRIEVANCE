import clsx from "clsx";
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
    <Badge tone={source === "SYNTHETIC" ? "saffron" : "brand"} title={source === "SYNTHETIC" ? "Generated demo data, not official" : "Imported official dataset"}>
      {source}
    </Badge>
  );
}

export function SensitiveBadge({ hidden }: { hidden?: boolean }) {
  return (
    <span className="inline-flex flex-wrap items-center gap-1">
      <Badge tone="critical">Sensitive</Badge>
      {hidden && (
        <Badge tone="outline" title="Complainant identity is masked">
          Identity hidden
        </Badge>
      )}
    </span>
  );
}

/** SLA state with a live countdown. The state is always spelled out, never colour alone. */
export function SlaIndicator({ sla, compact = false, closed = false }: { sla: Sla | null; compact?: boolean; closed?: boolean }) {
  const [, tick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => tick((n) => n + 1), 60_000);
    return () => clearInterval(id);
  }, []);
  if (!sla?.due_at) return <span className="text-[13px] text-ink-muted">No SLA</span>;
  const hours = (new Date(sla.due_at).getTime() - Date.now()) / 3_600_000;
  const state = sla.state === "met" || sla.state === "missed" || closed ? sla.state : hours < 0 ? "breached" : sla.state;
  const cfg =
    {
      on_track: { cls: "text-ink-soft", label: hoursLabel(hours) },
      at_risk: { cls: "text-status-warning", label: `At risk, ${hoursLabel(hours)}` },
      breached: { cls: "text-status-critical", label: `Breached, ${hoursLabel(hours)}` },
      met: { cls: "text-status-good", label: "SLA met" },
      missed: { cls: "text-status-critical", label: "Resolved late" },
    }[state ?? "on_track"] ?? { cls: "text-ink-soft", label: hoursLabel(hours) };
  return (
    <span className={clsx("inline-flex items-center gap-1.5 text-[13px] font-medium tabular-nums", cfg.cls)} title={`Due ${fmtDate(sla.due_at)}`}>
      {(state === "at_risk" || state === "breached") && <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden />}
      {compact ? cfg.label : `${cfg.label} (due ${fmtDate(sla.due_at)})`}
    </span>
  );
}

export function ConfidenceMeter({ value, threshold }: { value: number | null | undefined; threshold?: number }) {
  if (value === null || value === undefined) return <span className="text-[13px] text-ink-muted">Not scored</span>;
  const below = threshold !== undefined && value < threshold;
  return (
    <div className="flex items-center gap-2" title={threshold !== undefined ? `Threshold ${(threshold * 100).toFixed(0)}%` : undefined}>
      <div className="relative h-1 w-20 bg-black/[0.08]" aria-hidden>
        <div className={clsx("h-full", below ? "bg-status-serious" : "bg-brand-600")} style={{ width: `${Math.round(value * 100)}%` }} />
        {threshold !== undefined && <div className="absolute -top-1 h-3 w-px bg-ink" style={{ left: `${threshold * 100}%` }} />}
      </div>
      <span className="text-[13px] font-medium tabular-nums text-ink">{Math.round(value * 100)}%</span>
      {below && <span className="text-[12px] text-status-serious">below threshold</span>}
    </div>
  );
}

export function Timeline({ items }: { items: HistoryItem[] }) {
  return (
    <ol className="relative space-y-5 border-l border-line pl-5">
      {items.map((h, i) => (
        <li key={i} className="relative">
          <span
            className={clsx(
              "absolute -left-[24.5px] top-1.5 h-2 w-2 rounded-full ring-4 ring-surface",
              h.actor_type === "AI_SYSTEM" ? "bg-brand-600" : h.actor_type === "CITIZEN" ? "bg-ink-muted" : "bg-ink",
            )}
            aria-hidden
          />
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={h.to_status} />
            <time className="text-[12px] text-ink-muted">{fmtDate(h.created_at)}</time>
          </div>
          <p className="mt-1 text-[13px] text-ink-muted">
            by <span className="font-medium text-ink-soft">{h.actor_label}</span>
          </p>
          {h.note && <p className="mt-1 text-sm text-ink-soft">{h.note}</p>}
        </li>
      ))}
    </ol>
  );
}

export function SyntheticBanner() {
  return (
    <div className="border-b border-saffron-100 bg-saffron-50 px-4 py-1.5 text-center text-[12px] text-saffron-700">
      <strong className="font-semibold">Synthetic demo data.</strong> Categories, departments and history are generated for this demonstration and are not official
      HackFusion datasets. Predictions are demo estimates.
    </div>
  );
}

/** Ordered reasoning trail recorded by an agent (structured decisions, not raw model chain-of-thought). */
export function ReasoningList({ lines, compact = false }: { lines: string[]; compact?: boolean }) {
  if (!lines?.length) return null;
  return (
    <ol className={clsx("space-y-1.5 text-ink-soft", compact ? "text-[12px]" : "text-[13px]")}>
      {lines.filter(Boolean).map((l, i) => (
        <li key={i} className="grid grid-cols-[1.5rem_1fr] gap-1">
          <span className="font-mono text-[11px] leading-5 text-ink-muted">{String(i + 1).padStart(2, "0")}</span>
          <span className="break-words leading-5">{l}</span>
        </li>
      ))}
    </ol>
  );
}

/** Reads text aloud with the browser's speech synthesis, in the citizen's language. */
export function ReadAloud({ text, lang, label = "Listen" }: { text: string; lang: "en" | "hi" | "mr"; label?: string }) {
  const [speaking, setSpeaking] = useState(false);
  const supported = typeof window !== "undefined" && "speechSynthesis" in window;
  useEffect(() => () => { if (supported) window.speechSynthesis.cancel(); }, [supported]);
  if (!supported) return null;
  const toggle = () => {
    if (speaking) {
      window.speechSynthesis.cancel();
      setSpeaking(false);
      return;
    }
    const u = new SpeechSynthesisUtterance(text);
    u.lang = { en: "en-IN", hi: "hi-IN", mr: "mr-IN" }[lang];
    u.rate = 0.95;
    u.onend = () => setSpeaking(false);
    u.onerror = () => setSpeaking(false);
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(u);
    setSpeaking(true);
  };
  return (
    <button type="button" onClick={toggle} aria-pressed={speaking} className="inline-flex items-center gap-1.5 text-[13px] font-medium text-brand-700 hover:underline">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" />
        {speaking ? <path d="M16 9l5 6M21 9l-5 6" /> : <path d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11" />}
      </svg>
      {speaking ? "Stop reading" : label}
    </button>
  );
}
