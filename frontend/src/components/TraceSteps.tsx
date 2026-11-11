import clsx from "clsx";
import { useState } from "react";
import { ReasoningList } from "./domain";
import { IconChevron } from "./icons";
import { Badge } from "./ui";

export interface TraceStep {
  agent: string;
  status: string;
  provider: string | null;
  model: string | null;
  confidence: number | null;
  duration_ms: number;
  references: string[];
  output?: Record<string, unknown>;
  decision?: Record<string, unknown>;
  input?: Record<string, unknown>;
  error?: string | null;
}

const AGENT_LABEL: Record<string, string> = {
  intake_dialogue: "1. Conversational intake",
  intake: "1. Intake",
  policy_preview: "2. Policy check (preview)",
  policy: "2. Policy gate",
  rag: "3. Case memory (RAG)",
  duplicate: "4. Duplicate grouping",
  predictive: "5. Predictive SLA",
  actions: "6. Backend actions",
  human_review: "Human review decision",
};

export function TraceSteps({ steps, showRaw = true, defaultOpen = 0 }: { steps: TraceStep[]; showRaw?: boolean; defaultOpen?: number | null }) {
  const [open, setOpen] = useState<number | null>(defaultOpen);
  const max = Math.max(1, ...steps.map((s) => s.duration_ms));
  return (
    <ol className="divide-y divide-line rounded-lg border border-line bg-surface">
      {steps.map((s, i) => {
        const data = (s.output ?? s.decision ?? {}) as Record<string, unknown>;
        const reasoning = Array.isArray(data.reasoning) ? (data.reasoning as string[]) : [];
        const { reasoning: _omit, ...rest } = data;
        void _omit;
        return (
          <li key={i}>
            <button
              className="flex w-full flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 text-left hover:bg-black/[0.02]"
              onClick={() => setOpen(open === i ? null : i)}
              aria-expanded={open === i}
            >
              <IconChevron width={14} height={14} className={clsx("shrink-0 text-ink-muted transition-transform motion-reduce:transition-none", open === i && "rotate-90")} />
              <span className="min-w-[11rem] font-medium text-ink">{AGENT_LABEL[s.agent] ?? s.agent}</span>
              {s.status === "error" ? <Badge tone="critical">Error</Badge> : <Badge tone="good">OK</Badge>}
              <span className="text-[12px] text-ink-muted">
                {s.provider ?? "n/a"}
                {s.model ? ` · ${s.model}` : ""}
              </span>
              {s.confidence !== null && s.confidence !== undefined && <span className="text-[12px] tabular-nums text-ink-soft">confidence {(s.confidence * 100).toFixed(0)}%</span>}
              {s.references?.length > 0 && <span className="text-[12px] text-ink-soft">{s.references.length} references</span>}
              <span className="ml-auto flex items-center gap-2 text-[12px] tabular-nums text-ink-muted">
                <span className="hidden h-1 w-20 bg-black/[0.07] sm:block" aria-hidden>
                  <span className="block h-full bg-brand-500" style={{ width: `${(s.duration_ms / max) * 100}%` }} />
                </span>
                {s.duration_ms} ms
              </span>
            </button>
            {open === i && (
              <div className="grid gap-5 border-t border-line bg-canvas/60 px-4 py-4 lg:grid-cols-[1.2fr_1fr]">
                <div>
                  <p className="mb-2 text-[12px] font-semibold uppercase tracking-[0.06em] text-ink-muted">Decision trail</p>
                  {reasoning.length ? <ReasoningList lines={reasoning} /> : <p className="text-[13px] text-ink-muted">No reasoning recorded for this step.</p>}
                  {s.error && <p className="mt-3 text-[13px] font-medium text-status-critical">Error: {s.error}</p>}
                  {s.references?.length > 0 && (
                    <p className="mt-3 break-words text-[13px] text-ink-soft">
                      <span className="font-semibold text-ink">Evidence used:</span> {s.references.join(", ")}
                    </p>
                  )}
                </div>
                <div className="min-w-0 space-y-3">
                  {showRaw && s.input && Object.keys(s.input).length > 0 && (
                    <div>
                      <p className="mb-1 text-[12px] font-semibold uppercase tracking-[0.06em] text-ink-muted">Input (PII redacted)</p>
                      <pre className="max-h-48 overflow-auto whitespace-pre-wrap break-words rounded-md border border-line bg-surface p-2 font-mono text-[11px]">{JSON.stringify(s.input, null, 2)}</pre>
                    </div>
                  )}
                  <div>
                    <p className="mb-1 text-[12px] font-semibold uppercase tracking-[0.06em] text-ink-muted">Structured output</p>
                    <pre className="max-h-64 overflow-auto whitespace-pre-wrap break-words rounded-md border border-line bg-surface p-2 font-mono text-[11px]">{JSON.stringify(rest, null, 2)}</pre>
                  </div>
                </div>
              </div>
            )}
          </li>
        );
      })}
    </ol>
  );
}
