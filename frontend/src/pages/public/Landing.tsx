import { useQuery } from "@tanstack/react-query";
import clsx from "clsx";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";
import { Logo, useSystemStatus } from "../../components/AppShell";
import { IconClose, IconMenu } from "../../components/icons";
import { SiteFooter } from "../../components/SiteChrome";
import { api } from "../../lib/api";
import { homeFor, useAuth } from "../../lib/auth";
import { categoryName, LANG_LABEL, useI18n } from "../../lib/i18n";
import type { CategoryMeta, Lang } from "../../lib/types";
import { LANDING_COPY } from "./landingCopy";

/* ------------------------------------------------------------------ shared styles */

const FOCUS = "focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-navy";

/** Primary action: amber with navy text (6.9:1). The inset bottom edge gives it a pressable, non-glossy shape. */
const BTN_PRIMARY = clsx(
  "inline-flex min-h-12 items-center justify-center rounded-md bg-amber px-6 py-3 text-center text-[16px] font-semibold leading-tight text-navy",
  "shadow-[inset_0_-2px_0_rgba(16,29,43,0.22)] transition-colors duration-150 hover:bg-amber-hover active:bg-amber-active active:shadow-none motion-reduce:transition-none",
  FOCUS,
);
/** Supporting action: teal outline. */
const BTN_SECONDARY = clsx(
  "inline-flex min-h-12 items-center justify-center rounded-md border-2 border-brand-700 bg-transparent px-6 py-3 text-center text-[16px] font-semibold leading-tight text-brand-700",
  "transition-colors duration-150 hover:bg-brand-50 hover:text-brand-800 active:bg-brand-100 motion-reduce:transition-none",
  FOCUS,
);
const TEXT_LINK = clsx(
  "rounded-sm font-semibold text-brand-700 underline decoration-1 underline-offset-[3px] transition-colors duration-150 hover:text-brand-900 hover:decoration-2 motion-reduce:transition-none",
  FOCUS,
);

const NAV_LINK = clsx(
  "block rounded-sm px-3 py-2 text-[15px] font-medium text-ink-soft decoration-2 underline-offset-[6px] transition-colors duration-150 hover:text-navy hover:underline motion-reduce:transition-none",
  FOCUS,
);

/* ------------------------------------------------------------------ icons (24px grid, 1.6 stroke) */

function Glyph({ children, size = 22 }: { children: ReactNode; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden focusable="false">
      {children}
    </svg>
  );
}
/** One icon per entry in LANDING_COPY.services.items, in the same order. */
const SERVICE_ICONS = [
  <Glyph key="lang"><path d="M4 5h9M8.5 3v2M6 5c.6 3.4 2.6 6 6 7.5M11 5c-.7 3.6-3 6.5-7 8" /><path d="M13 21l4-9 4 9M14.5 18h5" /></Glyph>,
  <Glyph key="route"><circle cx="6" cy="6" r="2.5" /><circle cx="6" cy="18" r="2.5" /><circle cx="18" cy="12" r="2.5" /><path d="M8.5 6.5c4 .5 5 3 7 4.5M8.5 17.5c4-.5 5-3 7-4.5" /></Glyph>,
  <Glyph key="similar"><rect x="3.5" y="4" width="11" height="13" rx="1.5" /><path d="M9.5 20h9a1.5 1.5 0 0 0 1.5-1.5V8" /><path d="M7 9h4M7 12.5h4" /></Glyph>,
  <Glyph key="track"><path d="M4 6h10M4 12h7M4 18h10" /><circle cx="18" cy="12" r="3" /><path d="M18 9V5M18 19v-4" /></Glyph>,
  <Glyph key="bell"><path d="M6 16V11a6 6 0 1 1 12 0v5l1.5 2h-15L6 16z" /><path d="M10 20a2 2 0 0 0 4 0" /></Glyph>,
  <Glyph key="person"><circle cx="12" cy="8" r="3.5" /><path d="M5 20c.8-3.8 3.6-6 7-6s6.2 2.2 7 6" /></Glyph>,
];
const IconGlobe = () => (
  <Glyph size={18}><circle cx="12" cy="12" r="8.5" /><path d="M3.5 12h17M12 3.5c2.4 2.4 3.5 5.3 3.5 8.5s-1.1 6.1-3.5 8.5c-2.4-2.4-3.5-5.3-3.5-8.5S9.6 5.9 12 3.5z" /></Glyph>
);
const IconCheck = () => <Glyph size={18}><path d="M5 12.5l4.2 4L19 7" /></Glyph>;
const IconArrow = () => <Glyph size={18}><path d="M5 12h13M13 6.5l5.5 5.5-5.5 5.5" /></Glyph>;
const IconInfo = () => <Glyph size={18}><circle cx="12" cy="12" r="8.5" /><path d="M12 11v5.5M12 7.8v.2" /></Glyph>;

/* ------------------------------------------------------------------ language selector */

function LanguageSelect({ id, label }: { id: string; label: string }) {
  const { lang, setLang } = useI18n();
  return (
    <div className="relative flex items-center">
      <label htmlFor={id} className="sr-only">
        {label}
      </label>
      <span className="pointer-events-none absolute left-2.5 hidden text-brand-700 sm:block">
        <IconGlobe />
      </span>
      <select
        id={id}
        value={lang}
        onChange={(e) => setLang(e.target.value as Lang)}
        className={clsx(
          "lang-select h-11 cursor-pointer appearance-none rounded-md border border-stone-dark bg-surface pl-3 pr-8 text-[15px] font-medium text-navy sm:pl-9",
          "transition-colors duration-150 hover:border-navy motion-reduce:transition-none",
          FOCUS,
        )}
      >
        {(Object.keys(LANG_LABEL) as Lang[]).map((l) => (
          <option key={l} value={l} lang={l}>
            {LANG_LABEL[l]}
          </option>
        ))}
      </select>
    </div>
  );
}

/* ------------------------------------------------------------------ header */

function Header({ submitTo }: { submitTo: string }) {
  const { user } = useAuth();
  const { lang } = useI18n();
  const c = LANDING_COPY[lang].nav;
  const [open, setOpen] = useState(false);
  const toggleRef = useRef<HTMLButtonElement>(null);

  // Escape closes the menu and returns focus to its button; widening to desktop closes it too.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        toggleRef.current?.focus();
      }
    };
    const mq = window.matchMedia?.("(min-width: 1024px)");
    const onWide = () => mq?.matches && setOpen(false);
    document.addEventListener("keydown", onKey);
    mq?.addEventListener?.("change", onWide);
    return () => {
      document.removeEventListener("keydown", onKey);
      mq?.removeEventListener?.("change", onWide);
    };
  }, [open]);

  const links: [string, string][] = [
    ["#top", c.home],
    ["#how", c.how],
    ["#services", c.services],
    ["#about", c.about],
  ];
  const accountTo = user ? homeFor(user.role) : "/login";
  const accountLabel = user ? c.dashboard : c.signIn;

  return (
    <header className="sticky top-0 z-40 border-b border-stone bg-canvas">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-3 px-4 sm:px-6 lg:h-[72px]">
        <Logo size={32} />

        <nav aria-label="Primary" className="hidden lg:block">
          <ul className="flex items-center gap-1">
            {links.map(([href, label]) => (
              <li key={href}>
                <a href={href} className={NAV_LINK}>
                  {label}
                </a>
              </li>
            ))}
            <li>
              <Link to="/help" className={NAV_LINK}>
                {c.faq}
              </Link>
            </li>
          </ul>
        </nav>

        <div className="flex items-center gap-2 sm:gap-3">
          <LanguageSelect id="lang-header" label={c.language} />
          <Link
            to={accountTo}
            className={clsx(
              "hidden min-h-11 items-center rounded-md px-3 text-[15px] font-semibold text-navy transition-colors duration-150 hover:bg-navy/[0.05] motion-reduce:transition-none md:inline-flex",
              FOCUS,
            )}
          >
            {accountLabel}
          </Link>
          <Link to={submitTo} className={clsx(BTN_PRIMARY, "hidden !min-h-11 !px-4 !py-2 !text-[15px] md:inline-flex")}>
            {c.submit}
          </Link>
          <button
            ref={toggleRef}
            type="button"
            className={clsx(
              "flex h-11 w-11 items-center justify-center rounded-md border border-stone-dark text-navy transition-colors duration-150 hover:bg-navy/[0.05] motion-reduce:transition-none lg:hidden",
              FOCUS,
            )}
            onClick={() => setOpen((o) => !o)}
            aria-expanded={open}
            aria-controls="site-menu"
          >
            <span className="sr-only">{open ? c.menuClose : c.menuOpen}</span>
            {open ? <IconClose width={20} height={20} aria-hidden /> : <IconMenu width={20} height={20} aria-hidden />}
          </button>
        </div>
      </div>

      <div id="site-menu" hidden={!open} className="border-t border-stone bg-canvas lg:hidden">
        <nav aria-label="Primary, mobile" className="mx-auto max-w-6xl px-4 pb-6 pt-2 sm:px-6">
          <ul>
            {links.map(([href, label]) => (
              <li key={href} className="border-b border-stone">
                <a href={href} onClick={() => setOpen(false)} className={clsx("flex min-h-12 items-center text-[16px] font-medium text-navy", FOCUS)}>
                  {label}
                </a>
              </li>
            ))}
            <li className="border-b border-stone">
              <Link to="/help" className={clsx("flex min-h-12 items-center text-[16px] font-medium text-navy", FOCUS)}>
                {c.faq}
              </Link>
            </li>
            <li className="border-b border-stone md:hidden">
              <Link to={accountTo} className={clsx("flex min-h-12 items-center text-[16px] font-semibold text-brand-700", FOCUS)}>
                {accountLabel}
              </Link>
            </li>
          </ul>
          <Link to={submitTo} className={clsx(BTN_PRIMARY, "mt-5 w-full md:hidden")}>
            {c.submit}
          </Link>
        </nav>
      </div>
    </header>
  );
}

/* ------------------------------------------------------------------ section heading */

function SectionHeading({ id, eyebrow, title, dark = false, deva }: { id: string; eyebrow: string; title: string; dark?: boolean; deva: boolean }) {
  return (
    <>
      <p className={clsx("font-semibold", dark ? "text-amber" : "text-brand-700", deva ? "text-[15px]" : "text-[13px] uppercase tracking-[0.12em]")}>{eyebrow}</p>
      <h2
        id={id}
        className={clsx(
          "mt-3 max-w-[24ch] text-[28px] font-bold sm:text-[34px]",
          deva ? "leading-[1.4]" : "leading-[1.15] tracking-[-0.015em]",
          dark ? "text-white" : "text-navy",
        )}
      >
        {title}
      </h2>
    </>
  );
}

/* ------------------------------------------------------------------ page */

export default function Landing() {
  const { user } = useAuth();
  const { lang } = useI18n();
  const loc = useLocation();
  const status = useSystemStatus();
  const cats = useQuery({ queryKey: ["meta", "categories"], queryFn: () => api<CategoryMeta[]>("/meta/categories", { auth: false }) });
  const s = status.data;
  const c = LANDING_COPY[lang];
  const deva = lang !== "en";
  const voice = s?.speech_to_text.available;

  // Visitors go to intake (sign-in first, then returned there); citizens straight to intake; staff to their own home.
  const submitTo = !user || user.role === "citizen" ? "/citizen/new" : homeFor(user.role);
  const trackTo = !user || user.role === "citizen" ? "/citizen" : homeFor(user.role);

  // Honour /#section links arriving from other pages.
  useEffect(() => {
    if (!loc.hash) return;
    document.getElementById(loc.hash.slice(1))?.scrollIntoView();
  }, [loc.hash]);

  return (
    <div lang={lang} className="min-h-screen bg-canvas text-navy">
      <a
        href="#main"
        className="sr-only rounded-md bg-navy px-4 py-3 font-semibold text-white focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:outline focus:outline-[3px] focus:outline-amber"
      >
        {c.nav.skip}
      </a>
      <Header submitTo={submitTo} />

      <main id="main" tabIndex={-1} className="focus:outline-none">
        {/* Hero */}
        <section id="top" aria-labelledby="hero-title" className="scroll-mt-24">
          <div className="mx-auto grid max-w-6xl gap-12 px-4 pb-16 pt-12 sm:px-6 sm:pt-16 lg:grid-cols-12 lg:gap-8 lg:pb-24 lg:pt-20">
            <div className="lg:col-span-7">
              <p className={clsx("flex items-center gap-3 font-semibold text-brand-700", deva ? "text-[15px]" : "text-[13px] uppercase tracking-[0.12em]")}>
                <span className="h-[3px] w-8 shrink-0 bg-amber" aria-hidden />
                {c.hero.eyebrow}
              </p>
              <h1
                id="hero-title"
                className={clsx(
                  "mt-5 max-w-[16ch] font-bold text-navy",
                  deva ? "text-[34px] leading-[1.35] sm:text-[44px]" : "text-[38px] leading-[1.08] tracking-[-0.025em] sm:text-[52px]",
                )}
              >
                {c.hero.title}
              </h1>
              <p className={clsx("mt-6 max-w-[38rem] text-[18px] text-ink-soft sm:text-[19px]", deva ? "leading-[1.75]" : "leading-relaxed")}>{c.hero.lead}</p>

              <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                <Link to={submitTo} className={BTN_PRIMARY}>
                  {c.hero.submit}
                </Link>
                <Link to={trackTo} className={BTN_SECONDARY}>
                  {c.hero.track}
                </Link>
              </div>
              {!user && (
                <p className="mt-4 text-[15px] leading-relaxed text-ink-muted">
                  {c.hero.accountNote}{" "}
                  <Link to="/register" className={TEXT_LINK}>
                    {c.hero.createAccount}
                  </Link>
                </p>
              )}

              <dl className="mt-10 grid gap-6 border-t border-stone-dark/70 pt-6 sm:grid-cols-2 sm:gap-8">
                <div>
                  <dt className="text-[16px] font-semibold text-navy">{c.hero.langTitle}</dt>
                  <dd className={clsx("mt-1 text-[15px] text-ink-soft", deva ? "leading-[1.75]" : "leading-relaxed")}>
                    {c.hero.langBody}
                    {voice ? c.hero.voiceExtra : ""}
                  </dd>
                </div>
                <div>
                  <dt className="text-[16px] font-semibold text-navy">{c.hero.trackTitle}</dt>
                  <dd className={clsx("mt-1 text-[15px] text-ink-soft", deva ? "leading-[1.75]" : "leading-relaxed")}>{c.hero.trackBody}</dd>
                </div>
              </dl>
            </div>

            {/* Practical preparation guidance instead of a product mock-up. */}
            <aside aria-labelledby="before-title" className="lg:col-span-4 lg:col-start-9 lg:self-end">
              <div className="border-t-4 border-brand-700 bg-stone-light px-5 py-6 sm:px-7 sm:py-7">
                <h2 id="before-title" className="text-[20px] font-bold text-navy">
                  {c.before.title}
                </h2>
                <p className="mt-2 text-[15px] leading-relaxed text-ink-soft">{c.before.intro}</p>
                <ul className="mt-4 space-y-3">
                  {c.before.items.map((item) => (
                    <li key={item} className="flex gap-3 text-[15px] leading-relaxed text-navy">
                      <span className="mt-[3px] shrink-0 text-brand-700">
                        <IconCheck />
                      </span>
                      {item}
                    </li>
                  ))}
                </ul>
                <p className="mt-5 border-t border-stone-dark/70 pt-4 text-[14px] leading-relaxed text-ink-soft">{c.before.sensitive}</p>
                <Link to="/help" className={clsx(TEXT_LINK, "mt-4 inline-flex items-center gap-1.5 text-[15px]")}>
                  {c.before.help}
                  <IconArrow />
                </Link>
              </div>
            </aside>
          </div>
        </section>

        {/* How it works */}
        <section id="how" aria-labelledby="how-title" className="scroll-mt-20 border-y border-stone bg-surface">
          <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:py-24">
            <SectionHeading id="how-title" eyebrow={c.how.eyebrow} title={c.how.title} deva={deva} />
            <ol className="mt-12 grid gap-10 md:grid-cols-3 md:gap-0">
              {c.how.steps.map(([title, body], i) => (
                <li key={title} className={clsx("md:pr-8", i > 0 && "md:border-l md:border-stone md:pl-8")}>
                  <div className="flex items-baseline gap-4 md:block">
                    <span className="text-[40px] font-bold leading-none tabular-nums text-brand-700" aria-hidden>
                      {i + 1}
                    </span>
                    <h3 className={clsx("text-[20px] font-bold text-navy md:mt-5", deva && "leading-snug")}>
                      <span className="sr-only">{i + 1}. </span>
                      {title}
                    </h3>
                  </div>
                  <p className={clsx("mt-3 max-w-[36ch] text-[16px] text-ink-soft", deva ? "leading-[1.75]" : "leading-relaxed")}>{body}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* Services */}
        <section id="services" aria-labelledby="services-title" className="scroll-mt-20">
          <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:py-24">
            <div className="grid gap-10 lg:grid-cols-12 lg:gap-8">
              <div className="lg:col-span-4">
                <SectionHeading id="services-title" eyebrow={c.services.eyebrow} title={c.services.title} deva={deva} />
                <p className={clsx("mt-5 max-w-prose text-[16px] text-ink-soft", deva ? "leading-[1.75]" : "leading-relaxed")}>{c.services.intro}</p>
                <ul className="mt-6 space-y-3 text-[14px] leading-relaxed text-ink-soft">
                  {voice !== undefined && (
                    <li className="flex gap-2.5">
                      <span className="mt-[2px] shrink-0 text-brand-700">
                        <IconInfo />
                      </span>
                      {voice ? c.services.voiceOn : c.services.voiceOff}
                    </li>
                  )}
                  <li className="flex gap-2.5">
                    <span className="mt-[2px] shrink-0 text-brand-700">
                      <IconInfo />
                    </span>
                    {c.services.notYet}
                  </li>
                </ul>
              </div>

              <ul className="grid gap-x-10 sm:grid-cols-2 lg:col-span-8">
                {c.services.items.map(([title, body], i) => (
                  <li key={title} className="flex gap-4 border-t border-stone py-6">
                    <span className="mt-0.5 shrink-0 text-brand-700">{SERVICE_ICONS[i]}</span>
                    <div>
                      <h3 className={clsx("text-[17px] font-bold text-navy", deva && "leading-snug")}>{title}</h3>
                      <p className={clsx("mt-1.5 text-[15px] text-ink-soft", deva ? "leading-[1.75]" : "leading-relaxed")}>{body}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </div>

            {(!!cats.data?.length || cats.isError) && (
              <div className="mt-14 border-t-2 border-navy pt-6 lg:grid lg:grid-cols-12 lg:gap-8">
                <div className="lg:col-span-4">
                  <h3 className="text-[18px] font-bold text-navy">{c.services.categoriesTitle}</h3>
                  <p className="mt-1 text-[14px] text-ink-muted">{c.services.categoriesNote}</p>
                </div>
                {cats.isError ? (
                  <p className="mt-4 text-[15px] text-ink-muted lg:col-span-8 lg:mt-0">{c.services.categoriesError}</p>
                ) : (
                  <ul className="mt-4 columns-1 gap-x-10 text-[15px] text-navy sm:columns-2 lg:col-span-8 lg:mt-0 lg:columns-3">
                    {cats.data?.map((cat) => (
                      <li key={cat.code} className="flex break-inside-avoid gap-2.5 py-1.5">
                        <span className="mt-[0.6em] h-1.5 w-1.5 shrink-0 bg-brand-700" aria-hidden />
                        {categoryName(cat, lang)}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>
        </section>

        {/* Accountability */}
        <section id="about" aria-labelledby="about-title" className="scroll-mt-20 bg-navy">
          <div className="mx-auto grid max-w-6xl gap-10 px-4 py-16 sm:px-6 lg:grid-cols-12 lg:gap-8 lg:py-24">
            <div className="lg:col-span-5">
              <SectionHeading id="about-title" eyebrow={c.about.eyebrow} title={c.about.title} dark deva={deva} />
              <p className={clsx("mt-5 max-w-prose text-[16px] text-[#C9D1DB]", deva ? "leading-[1.75]" : "leading-relaxed")}>
                {s?.synthetic_data_in_use === false ? c.about.body : c.about.bodySynthetic}
              </p>
            </div>
            <dl className="lg:col-span-7 lg:col-start-6 lg:pl-8">
              {c.about.rows.map(([k, v]) => (
                <div key={k} className="grid gap-1 border-t border-white/15 py-5 first:border-t-0 first:pt-0 sm:grid-cols-[10rem_1fr] sm:gap-6 lg:first:pt-1">
                  <dt className="text-[16px] font-semibold text-white">{k}</dt>
                  <dd className={clsx("text-[15px] text-[#C9D1DB]", deva ? "leading-[1.75]" : "leading-relaxed")}>{v}</dd>
                </div>
              ))}
            </dl>
          </div>
        </section>

        {/* Next step */}
        <section aria-labelledby="cta-title">
          <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-14 sm:px-6 lg:flex-row lg:items-end lg:justify-between lg:py-16">
            <div className="max-w-xl">
              <h2 id="cta-title" className={clsx("text-[24px] font-bold text-navy sm:text-[28px]", deva ? "leading-[1.4]" : "leading-tight tracking-[-0.01em]")}>
                {c.cta.title}
              </h2>
              <p className={clsx("mt-2 text-[16px] text-ink-soft", deva ? "leading-[1.75]" : "leading-relaxed")}>{c.cta.body}</p>
              <Link to="/help" className={clsx(TEXT_LINK, "mt-3 inline-block text-[15px]")}>
                {c.cta.help}
              </Link>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row">
              <Link to={submitTo} className={BTN_PRIMARY}>
                {c.hero.submit}
              </Link>
              <Link to={trackTo} className={BTN_SECONDARY}>
                {c.hero.track}
              </Link>
            </div>
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
