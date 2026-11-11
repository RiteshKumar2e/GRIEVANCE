import clsx from "clsx";
import { CheckCircle2, XCircle } from "lucide-react";
import { useState } from "react";
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
  intake: "1 · Intake",
  policy_preview: "2 · Policy (preview)",
  policy: "2 · Policy gate",
  rag: "3 · RAG precedents",
  duplicate: "4 · Duplicates",
  predictive: "5 · Predictive SLA",
  actions: "6 · Backend actions",
  human_review: "Human review",
};

export function TraceSteps({ steps, showRaw = true }: { steps: TraceStep[]; showRaw?: boolean }) {
  const [open, setOpen] = useState<number | null>(null);
  const max = Math.max(1, ...steps.map((s) => s.duration_ms));
  return (
    <ol className="divide-y divide-line rounded-lg border border-line">
      {steps.map((s, i) => {
        const data = s.output ?? s.decision ?? {};
        return (
          <li key={i}>
            <button className="flex w-full flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 text-left hover:bg-canvas" onClick={() => setOpen(open === i ? null : i)} aria-expanded={open === i}>
              {s.status === "error" ? <XCircle className="h-4 w-4 text-red-700" aria-label="error" /> : <CheckCircle2 className="h-4 w-4 text-green-700" aria-label="ok" />}
              <span className="w-44 font-medium text-ink">{AGENT_LABEL[s.agent] ?? s.agent}</span>
              <span className="text-xs text-ink-soft">
                {s.provider ?? "—"}
                {s.model ? ` · ${s.model}` : ""}
              </span>
              {s.confidence !== null && s.confidence !== undefined && <Badge tone="outline">conf {(s.confidence * 100).toFixed(0)}%</Badge>}
              {s.references?.length > 0 && <Badge tone="brand">{s.references.length} refs</Badge>}
              <span className="ml-auto flex items-center gap-2 text-xs tabular-nums text-ink-muted">
                <span className="hidden h-1.5 w-24 overflow-hidden rounded-full bg-slate-100 sm:block" aria-hidden>
                  <span className={clsx("block h-full rounded-full bg-brand-500")} style={{ width: `${(s.duration_ms / max) * 100}%` }} />
                </span>
                {s.duration_ms} ms
              </span>
            </button>
            {open === i && (
              <div className="space-y-3 border-t border-line bg-canvas px-4 py-3 text-xs">
                {s.error && <p className="font-medium text-red-800">Error: {s.error}</p>}
                {s.references?.length > 0 && (
                  <p>
                    <span className="font-semibold">References:</span> {s.references.join(", ")}
                  </p>
                )}
                {showRaw && s.input && Object.keys(s.input).length > 0 && (
                  <div>
                    <p className="font-semibold">Input (redacted)</p>
                    <pre className="mt-1 overflow-x-auto whitespace-pre-wrap rounded bg-white p-2 text-[11px]">{JSON.stringify(s.input, null, 2)}</pre>
                  </div>
                )}
                <div>
                  <p className="font-semibold">Structured decision</p>
                  <pre className="mt-1 overflow-x-auto whitespace-pre-wrap rounded bg-white p-2 text-[11px]">{JSON.stringify(data, null, 2)}</pre>
                </div>
              </div>
            )}
          </li>
        );
      })}
    </ol>
  );
}
