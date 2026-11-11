import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { LanguageSwitcher, Logo, useSystemStatus } from "../../components/AppShell";
import { SyntheticBanner } from "../../components/domain";
import { SiteFooter } from "../../components/SiteChrome";
import { api } from "../../lib/api";
import { homeFor, useAuth } from "../../lib/auth";
import { categoryName, useI18n } from "../../lib/i18n";
import type { CategoryMeta } from "../../lib/types";

const PIPELINE = [
  ["Conversation", "The assistant talks with the citizen in Marathi, Hindi or English, by text or voice, asks for the place and timing if they are missing, and writes a structured draft for the citizen to confirm."],
  ["Policy gate", "Deterministic rules from the Category Master set the department, the SLA and the sensitivity of the case. Sensitive and low-confidence cases go to a human officer."],
  ["Case memory", "Similar resolved grievances are retrieved from the grievance history with multilingual embeddings, so the officer sees what fixed comparable cases."],
  ["Duplicate grouping", "Reports of the same problem are linked by meaning, distance and time. Each citizen keeps their own grievance ID, updates and timeline."],
  ["Prediction", "Resolution time and breach risk are estimated from history and current department load, so warnings and escalations happen before the deadline passes."],
  ["Action", "The system assigns the department and officer, updates the record, notifies the citizen and sends signed webhooks to tools such as n8n or Zapier."],
] as const;

const RULES = [
  "A sensitive grievance is never closed by the AI.",
  "No grievance is rejected automatically.",
  "The AI never decides legal liability.",
  "Uncertain classifications wait for a human reviewer.",
  "Every automated step is written to the audit log with the model, confidence and policy reference.",
];

function Screenshot({ src, alt, caption }: { src: string; alt: string; caption: string }) {
  return (
    <figure className="overflow-hidden rounded-lg border border-line bg-surface">
      <img src={src} alt={alt} loading="lazy" decoding="async" width={1440} height={900} className="block h-auto w-full" />
      <figcaption className="border-t border-line px-4 py-2.5 text-[13px] text-ink-muted">{caption}</figcaption>
    </figure>
  );
}

export default function Landing() {
  const { user } = useAuth();
  const { t, lang } = useI18n();
  const status = useSystemStatus();
  const cats = useQuery({ queryKey: ["meta", "categories"], queryFn: () => api<CategoryMeta[]>("/meta/categories", { auth: false }) });
  const primaryTo = user?.role === "citizen" ? "/citizen/new" : user ? homeFor(user.role) : "/register";
  const s = status.data;

  return (
    <div className="min-h-screen bg-canvas">
      {s?.synthetic_data_in_use && <SyntheticBanner />}
      <header className="border-b border-line">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-3 px-4">
          <Logo />
          <nav aria-label="Primary" className="flex items-center gap-1 sm:gap-2">
            <a href="#how" className="hidden rounded-md px-3 py-2 text-sm text-ink-soft hover:text-ink md:block">
              How it works
            </a>
            <LanguageSwitcher />
            {user ? (
              <Link to={homeFor(user.role)} className="rounded-md px-3 py-2 text-sm font-medium text-ink hover:underline">
                Dashboard
              </Link>
            ) : (
              <Link to="/login" className="rounded-md px-3 py-2 text-sm font-medium text-ink hover:underline">
                Sign in
              </Link>
            )}
          </nav>
        </div>
      </header>

      <main id="main">
        {/* Hero: the conversation itself is the visual */}
        <section className="mx-auto grid max-w-6xl gap-10 px-4 pb-16 pt-12 lg:grid-cols-[1fr_1.15fr] lg:items-center lg:pt-20">
          <div>
            <p className="text-[13px] font-semibold uppercase tracking-[0.12em] text-brand-700">Grievance redressal</p>
            <h1 className="mt-4 font-display text-[40px] font-semibold leading-[1.08] text-ink sm:text-[52px]">
              Report a civic problem in your own language. Follow it until it is fixed.
            </h1>
            <p lang={lang} className="mt-6 max-w-prose text-lg leading-relaxed text-ink-soft">
              {t("tagline")}
            </p>
            <p className="mt-3 max-w-prose text-[15px] leading-relaxed text-ink-soft">
              An assistant asks the right questions, routes the complaint to the responsible department and keeps you informed at every step. Officers decide
              anything sensitive or uncertain.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-3">
              <Link to={primaryTo} className="inline-flex h-12 items-center rounded-md bg-brand-700 px-6 text-[15px] font-medium text-white hover:bg-brand-800">
                {t("fileComplaint")}
              </Link>
              {!user && (
                <Link to="/login" className="text-[15px] font-medium text-brand-700 underline-offset-4 hover:underline">
                  Track an existing grievance
                </Link>
              )}
            </div>
          </div>
          <Screenshot
            src="/screens/intake.webp"
            alt="The GRIEVANCE assistant asking a citizen in Hindi where a sewage overflow is, before preparing a draft"
            caption="Conversational intake in Hindi. The assistant asks for missing details, then prepares a draft for the citizen to confirm."
          />
        </section>

        {/* Pipeline: one sequence, read top to bottom */}
        <section id="how" className="border-y border-line bg-surface">
          <div className="mx-auto grid max-w-6xl gap-12 px-4 py-16 lg:grid-cols-[0.9fr_1.1fr] lg:py-24">
            <div className="lg:sticky lg:top-8 lg:self-start">
              <h2 className="font-display text-[32px] font-semibold leading-tight text-ink">Six agents handle each complaint in order.</h2>
              <p className="mt-4 max-w-prose text-[15px] leading-relaxed text-ink-soft">
                Each step is a working backend service with its own trace. Language models suggest; the policy gate decides what the system is allowed to do.
              </p>
              <div className="mt-8 hidden lg:block">
                <Screenshot
                  src="/screens/officer.webp"
                  alt="Officer workspace showing the AI summary, the policy decision with confidence against the threshold, and similar resolved grievances"
                  caption="The officer sees the summary, the policy decision and the evidence behind it."
                />
              </div>
            </div>
            <ol className="divide-y divide-line border-y border-line">
              {PIPELINE.map(([name, body], i) => (
                <li key={name} className="grid grid-cols-[3rem_1fr] gap-2 py-6">
                  <span className="font-mono text-sm text-ink-muted">{String(i + 1).padStart(2, "0")}</span>
                  <div>
                    <h3 className="text-lg font-semibold text-ink">{name}</h3>
                    <p className="mt-1.5 text-[15px] leading-relaxed text-ink-soft">{body}</p>
                  </div>
                </li>
              ))}
            </ol>
            <div className="lg:hidden">
              <Screenshot
                src="/screens/officer.webp"
                alt="Officer workspace showing the AI summary, the policy decision with confidence against the threshold, and similar resolved grievances"
                caption="The officer sees the summary, the policy decision and the evidence behind it."
              />
            </div>
          </div>
        </section>

        {/* Rules + traceability */}
        <section className="mx-auto grid max-w-6xl gap-12 px-4 py-16 lg:grid-cols-2 lg:py-24">
          <div>
            <h2 className="font-display text-[32px] font-semibold leading-tight text-ink">Rules the AI cannot override</h2>
            <p className="mt-4 max-w-prose text-[15px] leading-relaxed text-ink-soft">These limits are enforced in the backend and covered by automated tests.</p>
            <ul className="mt-8 border-t border-line">
              {RULES.map((r) => (
                <li key={r} className="border-b border-line py-4 text-[16px] text-ink">
                  {r}
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h2 className="font-display text-[32px] font-semibold leading-tight text-ink">Every decision can be inspected</h2>
            <p className="mt-4 max-w-prose text-[15px] leading-relaxed text-ink-soft">
              Each agent records what it saw, which rule or score it applied and what it decided. Traces can be shared as redacted public links and exported to Langfuse.
              Complaint text and identities stay out of shared traces.
            </p>
            <div className="mt-8">
              <Screenshot
                src="/screens/trace.webp"
                alt="Trace view listing the six agent steps with models, confidence, timing and the decision trail of the policy gate"
                caption="A grievance pipeline trace with the policy gate's decision trail expanded."
              />
            </div>
          </div>
        </section>

        {/* Live deployment facts, read from the API */}
        <section className="border-t border-line">
          <div className="mx-auto grid max-w-6xl gap-10 px-4 py-14 lg:grid-cols-[1fr_1.4fr]">
            <div>
              <h2 className="text-lg font-semibold text-ink">This deployment, right now</h2>
              <p className="mt-2 text-[14px] text-ink-muted">Read live from the server.</p>
              {s ? (
                <dl className="mt-5 divide-y divide-line border-y border-line text-[14px]">
                  <div className="flex justify-between gap-4 py-2.5"><dt className="text-ink-muted">Language model</dt><dd className="text-right font-medium">{s.llm.mode === "llm" ? s.llm.chain.join(", then ") : "Rule-based mode (no LLM keys configured)"}</dd></div>
                  <div className="flex justify-between gap-4 py-2.5"><dt className="text-ink-muted">Embeddings</dt><dd className="break-all text-right font-medium">{s.embeddings.provider.split("/").pop()}</dd></div>
                  <div className="flex justify-between gap-4 py-2.5"><dt className="text-ink-muted">Voice input</dt><dd className="text-right font-medium">{s.speech_to_text.available ? `Whisper (${s.speech_to_text.model})` : "Not enabled"}</dd></div>
                  <div className="flex justify-between gap-4 py-2.5"><dt className="text-ink-muted">Database</dt><dd className="text-right font-medium">{s.database.engine}</dd></div>
                  <div className="flex justify-between gap-4 py-2.5"><dt className="text-ink-muted">Langfuse export</dt><dd className="text-right font-medium">{s.langfuse.enabled ? "On" : "Off"}</dd></div>
                </dl>
              ) : status.isError ? (
                <p className="mt-5 text-[14px] text-ink-muted">The server is not reachable at the moment.</p>
              ) : (
                <div className="mt-5 h-40 animate-pulse rounded-md bg-black/[0.05] motion-reduce:animate-none" aria-hidden />
              )}
            </div>
            <div>
              <h2 className="text-lg font-semibold text-ink">What you can report</h2>
              <p className="mt-2 text-[14px] text-ink-muted">
                Categories from the loaded Category Master{s?.data_sources.category_master.includes("SYNTHETIC") ? ", currently the synthetic demo set" : ""}.
              </p>
              <ul className="mt-5 flex flex-wrap gap-2">
                {cats.data?.map((c) => (
                  <li key={c.code} lang={lang} className="rounded-sm border border-line bg-surface px-2.5 py-1 text-[14px] text-ink-soft">
                    {categoryName(c, lang)}
                  </li>
                ))}
                {cats.isError && <li className="text-[14px] text-ink-muted">Categories are unavailable while the server is offline.</li>}
              </ul>
              <Link to={primaryTo} className="mt-8 inline-flex h-11 items-center rounded-md bg-brand-700 px-5 text-[15px] font-medium text-white hover:bg-brand-800">
                {t("fileComplaint")}
              </Link>
            </div>
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
