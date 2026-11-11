import { useQuery } from "@tanstack/react-query";
import { useParams } from "react-router-dom";
import { Logo } from "../../components/AppShell";
import { TraceSteps, type TraceStep } from "../../components/TraceSteps";
import { ErrorState, Spinner } from "../../components/ui";
import { api } from "../../lib/api";
import { fmtDate } from "../../lib/format";

interface PublicTrace {
  trace_id: string;
  name: string;
  status: string;
  started_at: string;
  duration_ms: number;
  steps: TraceStep[];
}

export default function SharedTrace() {
  const { token = "" } = useParams();
  const q = useQuery({ queryKey: ["public-trace", token], queryFn: () => api<PublicTrace>(`/public/traces/${token}`, { auth: false }) });
  return (
    <div className="min-h-screen bg-canvas">
      <header className="border-b border-line bg-white">
        <div className="mx-auto flex h-14 max-w-4xl items-center px-4">
          <Logo />
        </div>
      </header>
      <main className="mx-auto max-w-4xl px-4 py-8">
        <h1 className="font-display text-2xl font-semibold">Shared agent trace</h1>
        <p className="mt-1 text-sm text-ink-soft">
          A redacted view of one agent workflow: structured decisions, models, confidence and references only. Complaint text, identities and model
          reasoning are never included.
        </p>
        <div className="mt-6">
          {q.isLoading && <Spinner />}
          {q.isError && <ErrorState error={q.error} />}
          {q.data && (
            <>
              <dl className="mb-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
                <div><dt className="text-ink-muted">Workflow</dt><dd className="font-medium">{q.data.name}</dd></div>
                <div><dt className="text-ink-muted">Status</dt><dd className="font-medium">{q.data.status}</dd></div>
                <div><dt className="text-ink-muted">Started</dt><dd className="font-medium">{fmtDate(q.data.started_at)}</dd></div>
                <div><dt className="text-ink-muted">Duration</dt><dd className="font-medium tabular-nums">{q.data.duration_ms} ms</dd></div>
              </dl>
              <TraceSteps steps={q.data.steps} showRaw={false} />
            </>
          )}
        </div>
      </main>
    </div>
  );
}
