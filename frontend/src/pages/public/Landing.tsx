import { useQuery } from "@tanstack/react-query";
import clsx from "clsx";
import { useEffect, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { LanguageSwitcher, Logo, useSystemStatus } from "../../components/AppShell";
import { SyntheticBanner } from "../../components/domain";
import { IconClose, IconMenu } from "../../components/icons";
import { SiteFooter } from "../../components/SiteChrome";
import { api } from "../../lib/api";
import { homeFor, useAuth } from "../../lib/auth";
import { categoryName, useI18n } from "../../lib/i18n";
import type { CategoryMeta } from "../../lib/types";

/* ------------------------------------------------------------------ small pieces */

const CTA_PRIMARY =
  "inline-flex h-12 items-center justify-center rounded-md bg-amber px-6 text-[15px] font-bold text-navy transition-colors duration-150 hover:bg-amber-hover active:bg-amber-active focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-navy";
const CTA_SECONDARY =
  "inline-flex h-12 items-center justify-center rounded-md border border-brand-700 px-6 text-[15px] font-bold text-brand-700 transition-colors duration-150 hover:bg-brand-50 active:bg-brand-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500";

function Glyph({ children }: { children: ReactNode }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      {children}
    </svg>
  );
}
const G = {
  language: <Glyph><path d="M4 5h9M8.5 3v2M6 5c.6 3.4 2.6 6 6 7.5M11 5c-.7 3.6-3 6.5-7 8" /><path d="M13 21l4-9 4 9M14.5 18h5" /></Glyph>,
  track: <Glyph><path d="M4 6h10M4 12h7M4 18h10" /><circle cx="18" cy="12" r="3" /><path d="M18 9V5M18 19v-4" /></Glyph>,
  route: <Glyph><circle cx="6" cy="6" r="2.5" /><circle cx="6" cy="18" r="2.5" /><circle cx="18" cy="12" r="2.5" /><path d="M8.5 6.5c4 .5 5 3 7 4.5M8.5 17.5c4-.5 5-3 7-4.5" /></Glyph>,
  person: <Glyph><circle cx="12" cy="8" r="3.5" /><path d="M5 20c.8-3.8 3.6-6 7-6s6.2 2.2 7 6" /></Glyph>,
  speak: <Glyph><rect x="9" y="3" width="6" height="11" rx="3" /><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21" /></Glyph>,
  review: <Glyph><rect x="5" y="3.5" width="14" height="17" rx="2" /><path d="M9 9h6M9 13h6M9 17h3" /></Glyph>,
  bell: <Glyph><path d="M6 16V11a6 6 0 1 1 12 0v5l1.5 2h-15L6 16z" /><path d="M10 20a2 2 0 0 0 4 0" /></Glyph>,
};

/* ------------------------------------------------------------------ navigation */

function Nav() {
  const { user } = useAuth();
  const { t } = useI18n();
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  const links = [
    ["#top", "Home"],
    ["#how", "How it works"],
    ["#features", "Features"],
    ["#about", "About"],
  ];
  const submitTo = user?.role === "citizen" ? "/citizen/new" : user ? homeFor(user.role) : "/register";
  return (
    <header
      className={clsx(
        "sticky top-0 z-40 border-b transition-colors duration-200 motion-reduce:transition-none",
        scrolled || open ? "border-stone bg-canvas/95 backdrop-blur" : "border-transparent bg-canvas",
      )}
    >
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-3 px-4 sm:px-6">
        <Logo size={36} />
        <nav aria-label="Primary" className="hidden items-center gap-1 lg:flex">
          {links.map(([href, label]) => (
            <a key={href} href={href} className="relative px-3 py-2 text-[14px] font-medium text-ink-soft transition-colors hover:text-navy after:absolute after:inset-x-3 after:bottom-1 after:h-px after:origin-left after:scale-x-0 after:bg-navy after:transition-transform hover:after:scale-x-100 motion-reduce:after:transition-none">
              {label}
            </a>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          <div className="hidden sm:block">
            <LanguageSwitcher />
          </div>
          <Link to={user ? homeFor(user.role) : "/login"} className="hidden px-2 py-2 text-[14px] font-semibold text-navy hover:underline sm:block">
            {user ? "Dashboard" : "Sign in"}
          </Link>
          <Link to={submitTo} className="hidden h-10 items-center rounded-md bg-amber px-4 text-[14px] font-bold text-navy transition-colors hover:bg-amber-hover active:bg-amber-active md:inline-flex">
            {t("fileComplaint")}
          </Link>
          <button
            className="flex h-10 w-10 items-center justify-center rounded-md text-navy hover:bg-navy/[0.05] lg:hidden"
            onClick={() => setOpen((o) => !o)}
            aria-expanded={open}
            aria-controls="landing-menu"
            aria-label={open ? "Close menu" : "Open menu"}
          >
            {open ? <IconClose width={20} height={20} /> : <IconMenu width={20} height={20} />}
          </button>
        </div>
      </div>
      {open && (
        <nav id="landing-menu" aria-label="Primary" className="border-t border-stone bg-canvas px-4 pb-5 pt-2 lg:hidden">
          <ul>
            {links.map(([href, label]) => (
              <li key={href}>
                <a href={href} onClick={() => setOpen(false)} className="block border-b border-stone py-3 text-[15px] font-medium text-navy">
                  {label}
                </a>
              </li>
            ))}
          </ul>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <LanguageSwitcher />
            <Link to={user ? homeFor(user.role) : "/login"} className="text-[15px] font-semibold text-navy underline">
              {user ? "Dashboard" : "Sign in"}
            </Link>
          </div>
          <Link to={submitTo} className={clsx(CTA_PRIMARY, "mt-4 w-full")}>
            {t("fileComplaint")}
          </Link>
        </nav>
      )}
    </header>
  );
}

/* ------------------------------------------------------------------ product preview (real UI pieces, sample content) */

function ProductPreview() {
  return (
    <figure className="relative">
      <div className="overflow-hidden rounded-xl border border-stone-dark/70 bg-surface shadow-lift">
        <div className="flex items-center justify-between border-b border-stone bg-canvas px-4 py-2.5">
          <span className="text-[12px] font-bold tracking-[0.08em] text-navy">GRIEVANCE</span>
          <span className="rounded-sm bg-brand-50 px-1.5 py-0.5 text-[11px] font-semibold text-brand-800">हिंदी</span>
        </div>
        <div className="space-y-3 px-4 py-4 sm:px-5" lang="hi">
          <div className="flex justify-end">
            <p className="max-w-[85%] rounded-lg bg-brand-700 px-3.5 py-2.5 text-[14px] leading-relaxed text-white">
              हमारे इलाके में पिछले 4 दिनों से सीवर का पानी सड़क पर बह रहा है। बच्चे बीमार हो रहे हैं।
            </p>
          </div>
          <div className="flex">
            <p className="max-w-[85%] rounded-lg border border-stone bg-canvas px-3.5 py-2.5 text-[14px] leading-relaxed text-navy">
              यह समस्या ठीक कहाँ है? कृपया इलाका, वार्ड या पास का कोई पहचान चिह्न बताएं।
            </p>
          </div>
          <div className="flex justify-end">
            <p className="max-w-[85%] rounded-lg bg-brand-700 px-3.5 py-2.5 text-[14px] leading-relaxed text-white">Ganesh Peth, मंदिर के पास</p>
          </div>
        </div>
        <div className="border-t border-stone bg-canvas/60 px-4 py-4 sm:px-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-[12px] font-bold uppercase tracking-[0.08em] text-ink-muted">Draft for your confirmation</p>
            <span className="rounded-sm bg-amber-soft px-1.5 py-0.5 text-[11px] font-bold uppercase tracking-[0.05em] text-[#7A4810]">Awaiting confirmation</span>
          </div>
          <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-[13px]">
            <dt className="text-ink-muted">Category</dt>
            <dd className="font-semibold text-navy">Sewage overflow</dd>
            <dt className="text-ink-muted">Department</dt>
            <dd className="font-semibold text-navy">Drainage &amp; Sewerage</dd>
            <dt className="text-ink-muted">Location</dt>
            <dd className="font-semibold text-navy">Ganesh Peth, Ward 11</dd>
            <dt className="text-ink-muted">Urgency</dt>
            <dd className="font-semibold text-status-serious">High</dd>
            <dt className="text-ink-muted">Resolution target</dt>
            <dd className="font-semibold text-navy">24 hours</dd>
          </dl>
          <div className="mt-4 flex flex-wrap gap-2">
            <span className="inline-flex h-9 items-center rounded-md bg-brand-700 px-3.5 text-[13px] font-semibold text-white">Confirm and submit</span>
            <span className="inline-flex h-9 items-center rounded-md border border-stone-dark px-3.5 text-[13px] font-semibold text-navy">Edit details</span>
          </div>
        </div>
      </div>
      <figcaption className="mt-3 text-[13px] text-ink-muted">
        The intake screen with a sample conversation. Nothing is filed until the citizen confirms the draft.
      </figcaption>
    </figure>
  );
}

/* ------------------------------------------------------------------ content */

const HIGHLIGHTS = [
  [G.language, "Your language", "Marathi, Hindi or English, typed or spoken."],
  [G.track, "Open tracking", "Every status change is visible on your tracking page."],
  [G.route, "Routed to the right desk", "Category rules pick the department and deadline."],
  [G.person, "People decide sensitive cases", "Harassment and corruption reports go to an authorised officer."],
] as const;

const STEPS = [
  [G.speak, "Describe your issue", "Type or speak in your language. The assistant asks for the place or timing if they are missing."],
  [G.review, "Review and confirm", "Check the category, location and urgency it prepared. Correct anything, then confirm. Nothing is filed before that."],
  [G.bell, "Track the resolution", "You receive a grievance ID and an update at every step. If the fix does not hold, dispute it and the case reopens."],
] as const;

const FEATURES: { name: string; body: string; status: "Available" | "Planned" }[] = [
  { name: "Conversational multilingual intake", body: "Chat or voice intake in Marathi, Hindi and English that produces a structured draft. Voice uses Whisper on the server when it is installed.", status: "Available" },
  { name: "Similar complaint discovery", body: "Officers see resolved grievances most similar to the new one, retrieved with multilingual embeddings, with what was done to fix them.", status: "Available" },
  { name: "Duplicate incident detection", body: "Reports of the same problem are linked by meaning, distance and time. No report is merged, dropped or deleted.", status: "Available" },
  { name: "Smart department assignment", body: "The Category Master decides the department and deadline; the least-loaded officer covering the ward is assigned.", status: "Available" },
  { name: "Proactive SLA and delay alerts", body: "Breach risk is predicted from history and department load. Officers are warned before the deadline and overdue cases escalate.", status: "Available" },
  { name: "Human oversight and policy enforcement", body: "A rule-based policy gate checks every AI suggestion. Sensitive or uncertain cases wait for an officer, and every step is audited.", status: "Available" },
  { name: "SMS and WhatsApp updates", body: "Updates are delivered in the app today. Signed webhooks can already connect an SMS or WhatsApp gateway through n8n or Zapier.", status: "Planned" },
];

/* ------------------------------------------------------------------ page */

export default function Landing() {
  const { user } = useAuth();
  const { t, lang } = useI18n();
  const status = useSystemStatus();
  const cats = useQuery({ queryKey: ["meta", "categories"], queryFn: () => api<CategoryMeta[]>("/meta/categories", { auth: false }) });
  const submitTo = user?.role === "citizen" ? "/citizen/new" : user ? homeFor(user.role) : "/register";
  const trackTo = user?.role === "citizen" ? "/citizen" : user ? homeFor(user.role) : "/login";
  const s = status.data;

  return (
    <div className="min-h-screen bg-canvas text-navy">
      {s?.synthetic_data_in_use && <SyntheticBanner />}
      <Nav />

      <main id="main">
        {/* B. Hero */}
        <section id="top" className="scroll-mt-20">
          <div className="mx-auto grid max-w-6xl gap-12 px-4 pb-20 pt-12 sm:px-6 lg:grid-cols-[1.05fr_1fr] lg:items-center lg:gap-16 lg:pt-20">
            <div>
              <p className="text-[13px] font-bold uppercase tracking-[0.14em] text-brand-700">Citizen grievance redressal</p>
              <h1 className="mt-4 text-[40px] font-extrabold leading-[1.05] tracking-[-0.02em] text-navy sm:text-[56px]">Your Voice Deserves to Be Heard.</h1>
              <p className="mt-6 max-w-prose text-[18px] leading-relaxed text-ink-soft">
                Tell us about a broken road, a sewage overflow or an official asking for a bribe, in the language you speak at home. GRIEVANCE turns it into a
                complaint the right department can act on, and shows you its progress until it is resolved.
              </p>
              <p lang={lang} className="mt-3 max-w-prose text-[15px] text-ink-muted">
                {t("tagline")}
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Link to={submitTo} className={CTA_PRIMARY}>
                  {t("fileComplaint")}
                </Link>
                <Link to={trackTo} className={CTA_SECONDARY}>
                  Track Complaint
                </Link>
              </div>
              <ul className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-[14px] text-ink-soft" aria-label="What you can rely on">
                {["Marathi, Hindi and English", "Every status change visible", "Sensitive cases reviewed by people"].map((x) => (
                  <li key={x} className="flex items-center gap-2">
                    <span className="h-1.5 w-1.5 rounded-full bg-brand-700" aria-hidden />
                    {x}
                  </li>
                ))}
              </ul>
            </div>
            <ProductPreview />
          </div>
        </section>

        {/* C. Highlights */}
        <section aria-label="Service highlights" className="border-y border-stone bg-surface">
          <ul className="mx-auto grid max-w-6xl gap-x-10 gap-y-8 px-4 py-10 sm:grid-cols-2 sm:px-6 lg:grid-cols-4">
            {HIGHLIGHTS.map(([icon, title, body]) => (
              <li key={title} className="flex gap-3">
                <span className="mt-0.5 text-brand-700">{icon}</span>
                <div>
                  <p className="font-bold text-navy">{title}</p>
                  <p className="mt-1 text-[14px] leading-relaxed text-ink-muted">{body}</p>
                </div>
              </li>
            ))}
          </ul>
        </section>

        {/* D. How it works */}
        <section id="how" className="scroll-mt-20">
          <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6 lg:py-28">
            <div className="max-w-2xl">
              <p className="text-[13px] font-bold uppercase tracking-[0.14em] text-brand-700">How it works</p>
              <h2 className="mt-3 text-[32px] font-extrabold leading-tight tracking-[-0.01em] sm:text-[40px]">Three steps from problem to resolution</h2>
            </div>
            <ol className="mt-12 grid gap-10 md:grid-cols-3 md:gap-8">
              {STEPS.map(([icon, title, body], i) => (
                <li key={title} className="relative border-t-2 border-navy pt-6">
                  <div className="flex items-center gap-3">
                    <span className="text-[13px] font-bold tabular-nums text-ink-muted">0{i + 1}</span>
                    <span className="text-brand-700">{icon}</span>
                  </div>
                  <h3 className="mt-4 text-[20px] font-bold">{title}</h3>
                  <p className="mt-2 text-[15px] leading-relaxed text-ink-soft">{body}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* E. Features */}
        <section id="features" className="scroll-mt-20 bg-navy text-canvas">
          <div className="mx-auto grid max-w-6xl gap-12 px-4 py-20 sm:px-6 lg:grid-cols-[0.8fr_1.2fr] lg:py-28">
            <div className="lg:sticky lg:top-24 lg:self-start">
              <p className="text-[13px] font-bold uppercase tracking-[0.14em] text-amber">Features</p>
              <h2 className="mt-3 text-[32px] font-extrabold leading-tight tracking-[-0.01em] sm:text-[40px]">What the system does with your complaint</h2>
              <p className="mt-5 max-w-prose text-[16px] leading-relaxed text-[#C9D1DB]">
                Six cooperating agents run behind every grievance. Language models make suggestions; a rule-based policy gate decides what the system is allowed
                to do with them.
              </p>
            </div>
            <ul className="divide-y divide-white/10 border-y border-white/10">
              {FEATURES.map((f) => (
                <li key={f.name} className="grid gap-2 py-6 sm:grid-cols-[1fr_auto] sm:gap-6">
                  <div>
                    <h3 className="text-[18px] font-bold text-white">{f.name}</h3>
                    <p className="mt-1.5 text-[15px] leading-relaxed text-[#C9D1DB]">{f.body}</p>
                  </div>
                  <span
                    className={clsx(
                      "h-fit w-fit rounded-sm px-2 py-1 text-[11px] font-bold uppercase tracking-[0.06em]",
                      f.status === "Available" ? "bg-[#1F4A3F] text-[#BFE5D3]" : "border border-white/25 text-[#C9D1DB]",
                    )}
                  >
                    {f.status}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* F. Transparency / accountability (About) */}
        <section id="about" className="scroll-mt-20">
          <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6 lg:py-28">
            <div className="grid gap-12 lg:grid-cols-2">
              <div>
                <p className="text-[13px] font-bold uppercase tracking-[0.14em] text-brand-700">Transparency and accountability</p>
                <h2 className="mt-3 text-[32px] font-extrabold leading-tight tracking-[-0.01em] sm:text-[40px]">You can see what happens, and so can the officers who answer for it.</h2>
                <p className="mt-5 max-w-prose text-[16px] leading-relaxed text-ink-soft">
                  GRIEVANCE was built for HackFusion 4 as an agentic grievance redressal system for a college or district. This deployment runs on generated demo
                  data and is not connected to any government office.
                </p>
              </div>
              <dl className="divide-y divide-stone border-y border-stone">
                {[
                  ["Citizens", "See every status change with the date and who made it, confirm a resolution or dispute it to reopen the case."],
                  ["Officers", "Receive the AI summary, the policy decision with its reasons and similar past cases. They accept, correct or override every recommendation."],
                  ["Sensitive cases", "Harassment, child safety and corruption reports are hidden from general queues, reviewed by authorised officers, and are never closed automatically."],
                  ["Audit", "Every automated step is recorded with the model used, its confidence and the policy rule that applied."],
                ].map(([k, v]) => (
                  <div key={k} className="grid gap-1 py-5 sm:grid-cols-[9rem_1fr] sm:gap-6">
                    <dt className="font-bold text-navy">{k}</dt>
                    <dd className="text-[15px] leading-relaxed text-ink-soft">{v}</dd>
                  </div>
                ))}
              </dl>
            </div>

            <div className="mt-16 grid gap-10 border-t border-stone pt-10 lg:grid-cols-[1fr_1.3fr]">
              <div>
                <h3 className="text-[16px] font-bold">This deployment, right now</h3>
                <p className="mt-1 text-[14px] text-ink-muted">Read live from the server.</p>
                {s ? (
                  <dl className="mt-4 divide-y divide-stone text-[14px]">
                    {[
                      ["Language model", s.llm.mode === "llm" ? s.llm.chain.join(", then ") : "Rule-based mode, no model keys configured"],
                      ["Voice input", s.speech_to_text.available ? `Whisper (${s.speech_to_text.model})` : "Not enabled on this server"],
                      ["Embeddings", s.embeddings.provider.split("/").pop() ?? s.embeddings.provider],
                      ["Database", s.database.engine],
                    ].map(([k, v]) => (
                      <div key={k} className="flex justify-between gap-4 py-2.5">
                        <dt className="text-ink-muted">{k}</dt>
                        <dd className="break-all text-right font-semibold">{v}</dd>
                      </div>
                    ))}
                  </dl>
                ) : status.isError ? (
                  <p className="mt-4 text-[14px] text-ink-muted">The server cannot be reached at the moment.</p>
                ) : (
                  <div className="mt-4 h-36 animate-pulse rounded-md bg-navy/[0.05] motion-reduce:animate-none" aria-hidden />
                )}
              </div>
              <div>
                <h3 className="text-[16px] font-bold">What you can report</h3>
                <p className="mt-1 text-[14px] text-ink-muted">
                  Categories from the loaded Category Master{s?.data_sources.category_master.includes("SYNTHETIC") ? " (synthetic demo set)" : ""}.
                </p>
                <ul className="mt-4 flex flex-wrap gap-2">
                  {cats.data?.map((c) => (
                    <li key={c.code} lang={lang} className="rounded-sm border border-stone bg-surface px-2.5 py-1 text-[14px] text-ink-soft">
                      {categoryName(c, lang)}
                    </li>
                  ))}
                  {cats.isLoading && <li className="h-8 w-full animate-pulse rounded-md bg-navy/[0.05] motion-reduce:animate-none" aria-hidden />}
                  {cats.isError && <li className="text-[14px] text-ink-muted">Categories are unavailable while the server is offline.</li>}
                </ul>
              </div>
            </div>
          </div>
        </section>

        {/* G. Final CTA */}
        <section className="border-t border-stone bg-brand-700 text-white">
          <div className="mx-auto flex max-w-6xl flex-col items-start gap-8 px-4 py-16 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:py-20">
            <div className="max-w-2xl">
              <h2 className="text-[30px] font-extrabold leading-tight tracking-[-0.01em] sm:text-[36px]">Something in your area needs fixing?</h2>
              <p className="mt-3 text-[16px] leading-relaxed text-[#D2E4E4]">It takes a few minutes to report, and you can follow every step until it is resolved.</p>
            </div>
            <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
              <Link to={submitTo} className={CTA_PRIMARY}>
                {t("fileComplaint")}
              </Link>
              <Link
                to={trackTo}
                className="inline-flex h-12 items-center justify-center rounded-md border border-white/60 px-6 text-[15px] font-bold text-white transition-colors duration-150 hover:bg-white/10 active:bg-white/15 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
              >
                Track Complaint
              </Link>
            </div>
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
