import { useQuery } from "@tanstack/react-query";
import { ArrowRight, BrainCircuit, Copy, FileSearch, Gauge, Languages, ShieldCheck, Workflow } from "lucide-react";
import { Link } from "react-router-dom";
import { LanguageSwitcher, Logo, useSystemStatus } from "../../components/AppShell";
import { SyntheticBanner } from "../../components/domain";
import { Badge } from "../../components/ui";
import { api } from "../../lib/api";
import { homeFor, useAuth } from "../../lib/auth";
import { categoryName, useI18n } from "../../lib/i18n";
import type { CategoryMeta } from "../../lib/types";

const AGENTS = [
  { icon: Languages, title: "Multilingual intake", body: "Hindi, Marathi and English, typed or spoken. Extracts category, place, urgency and department, then asks you to confirm." },
  { icon: ShieldCheck, title: "Policy & safety gate", body: "Deterministic rules from the Category Master. Sensitive or uncertain cases always go to a human; nothing is auto-rejected." },
  { icon: FileSearch, title: "Precedent retrieval", body: "Finds similar resolved grievances with local multilingual embeddings, as supporting evidence for officers." },
  { icon: Copy, title: "Duplicate grouping", body: "Links reports of the same problem by meaning, place and time. Every grievance keeps its own ID and updates." },
  { icon: Gauge, title: "Predictive SLA", body: "Watches deadlines, warns early, escalates breaches and surfaces recurring hotspots and department bottlenecks." },
  { icon: Workflow, title: "Backend actions", body: "Assigns departments and officers, sends notifications and webhooks, and writes an audit record for every AI step." },
];

export default function Landing() {
  const { user } = useAuth();
  const { t, lang } = useI18n();
  const status = useSystemStatus();
  const cats = useQuery({ queryKey: ["meta", "categories"], queryFn: () => api<CategoryMeta[]>("/meta/categories", { auth: false }) });

  return (
    <div className="min-h-screen bg-white">
      {status.data?.synthetic_data_in_use && <SyntheticBanner />}
      <header className="border-b border-line">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
          <Logo />
          <div className="flex items-center gap-2">
            <LanguageSwitcher />
            {user ? (
              <Link to={homeFor(user.role)} className="rounded-md bg-brand-800 px-3.5 py-2 text-sm font-medium text-white hover:bg-brand-900">
                Open dashboard
              </Link>
            ) : (
              <>
                <Link to="/login" className="rounded-md px-3 py-2 text-sm font-medium text-ink-soft hover:text-ink">
                  Sign in
                </Link>
                <Link to="/register" className="rounded-md bg-brand-800 px-3.5 py-2 text-sm font-medium text-white hover:bg-brand-900">
                  Register
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      <section className="border-b border-line bg-canvas">
        <div className="mx-auto grid max-w-6xl gap-10 px-4 py-14 md:grid-cols-[1.25fr_1fr] md:py-20">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.14em] text-saffron-700">Agentic grievance redressal</p>
            <h1 className="mt-3 font-display text-4xl font-bold leading-tight text-brand-900 sm:text-5xl">
              Every complaint heard, routed and followed through.
            </h1>
            <p lang={lang} className="mt-5 max-w-xl text-lg text-ink-soft">
              {t("tagline")}
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                to={user?.role === "citizen" ? "/citizen/new" : user ? homeFor(user.role) : "/register"}
                className="inline-flex items-center gap-2 rounded-md bg-saffron-600 px-5 py-3 font-medium text-white hover:bg-saffron-700"
              >
                {t("fileComplaint")} <ArrowRight className="h-4 w-4" aria-hidden />
              </Link>
              <Link to={user ? homeFor(user.role) : "/login"} className="inline-flex items-center gap-2 rounded-md border border-line bg-white px-5 py-3 font-medium text-ink hover:bg-canvas">
                {t("track")}
              </Link>
            </div>
          </div>
          <div className="rounded-lg border border-line bg-white p-5 shadow-card">
            <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">How a grievance moves</p>
            <ol className="mt-4 space-y-4">
              {[
                ["Describe", "Type or speak in your language."],
                ["Confirm", "Review what the assistant understood. Nothing is filed without your confirmation."],
                ["Routed", "Policy rules pick the department and SLA. Sensitive cases go to an authorised human."],
                ["Resolved", "You confirm the fix — or dispute it and the grievance reopens."],
              ].map(([h, b], i) => (
                <li key={h} className="flex gap-3">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-800 text-sm font-semibold text-white">{i + 1}</span>
                  <div>
                    <p className="font-medium text-ink">{h}</p>
                    <p className="text-sm text-ink-soft">{b}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-14">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="font-display text-2xl font-semibold text-ink">Six agents, one accountable workflow</h2>
            <p className="mt-1 max-w-2xl text-ink-soft">AI suggestions are advisory. A deterministic policy gate decides what the system may do, and every automated step is audited.</p>
          </div>
          {status.data && (
            <div className="flex flex-wrap gap-1.5" aria-label="System capabilities">
              <Badge tone={status.data.llm.mode === "llm" ? "good" : "neutral"}>
                <BrainCircuit className="h-3 w-3" aria-hidden /> LLM: {status.data.llm.chain.join(" → ")}
              </Badge>
              <Badge tone="outline">Embeddings: {status.data.embeddings.provider.split("/").pop()}</Badge>
              <Badge tone={status.data.speech_to_text.available ? "good" : "outline"}>Voice: {status.data.speech_to_text.available ? "Whisper" : "unavailable"}</Badge>
            </div>
          )}
        </div>
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {AGENTS.map(({ icon: Icon, title, body }, i) => (
            <div key={title} className="rounded-lg border border-line p-5">
              <div className="flex items-center gap-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-md bg-brand-50 text-brand-700">
                  <Icon className="h-5 w-5" aria-hidden />
                </span>
                <p className="text-xs font-semibold text-ink-muted">Agent {i + 1}</p>
              </div>
              <h3 className="mt-3 font-semibold text-ink">{title}</h3>
              <p className="mt-1 text-sm text-ink-soft">{body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="border-t border-line bg-canvas">
        <div className="mx-auto max-w-6xl px-4 py-12">
          <h2 className="font-semibold text-ink">What you can report</h2>
          <p className="mt-1 text-sm text-ink-muted">From the Category Master currently loaded{status.data?.data_sources.category_master.includes("SYNTHETIC") ? " (synthetic demo set)" : ""}.</p>
          <ul className="mt-4 flex flex-wrap gap-2">
            {cats.data?.map((c) => (
              <li key={c.code} lang={lang} className="rounded-full border border-line bg-white px-3 py-1 text-sm text-ink-soft">
                {categoryName(c, lang)}
              </li>
            ))}
            {cats.isError && <li className="text-sm text-ink-muted">Categories are unavailable while the server is offline.</li>}
          </ul>
        </div>
      </section>

      <footer className="border-t border-line">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2 px-4 py-6 text-xs text-ink-muted">
          <p>GRIEVANCE · built for HackFusion 4</p>
          <p>The AI never rejects a grievance, never closes a sensitive case and never decides legal liability.</p>
        </div>
      </footer>
    </div>
  );
}
