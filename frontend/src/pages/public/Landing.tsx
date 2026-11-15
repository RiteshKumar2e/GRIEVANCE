import { useQuery } from "@tanstack/react-query";
import clsx from "clsx";
import { useEffect, useRef, useState, type MouseEvent, type ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";
import { Logo, useSystemStatus } from "../../components/AppShell";
import { IconClose, IconMenu } from "../../components/icons";
import { SiteFooter } from "../../components/SiteChrome";
import { api } from "../../lib/api";
import { homeFor, useAuth } from "../../lib/auth";
import { categoryName, LANG_LABEL, useI18n } from "../../lib/i18n";
import type { CategoryMeta, Lang } from "../../lib/types";
import { ASSISTANT_QUESTION, LANDING_COPY, type Actor, type LandingCopy } from "./landingCopy";

/* ------------------------------------------------------------------ shared styles
 * Tokens come from tailwind.config.js (see docs/landing/LANDING_PAGE_DESIGN_SYSTEM.md).
 * Layout: one 12-column grid inside a 1152px container (max-w-6xl) with 16/24px gutters.
 */

const FOCUS = "focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-navy";
const CONTAINER = "mx-auto max-w-6xl px-4 sm:px-6";

/**
 * Buttons. Three roles, never more than two filled buttons side by side.
 *   primary   GRIEVANCE orange, navy text (6.1:1), trailing arrow: the action we most want people to take.
 *   secondary solid navy, white text (17:1), leading icon: equal footing for citizens who are tracking.
 *   outline   navy hairline: tertiary, in-section actions only.
 * 56px tall (44px in the header), 6px radius, a darker inset bottom edge that flattens when pressed.
 */
const BTN_BASE = clsx(
  "group inline-flex min-h-14 items-center justify-center gap-3 rounded-md text-center text-[17px] font-semibold leading-tight",
  "transition-[background-color,box-shadow,transform] duration-150 active:translate-y-px active:shadow-none motion-reduce:transition-none motion-reduce:active:translate-y-0",
  FOCUS,
);
const BTN_PRIMARY = clsx(BTN_BASE, "bg-amber pl-6 pr-5 text-navy shadow-[inset_0_-3px_0_rgba(16,29,43,0.24)] hover:bg-amber-hover active:bg-amber-active");
const BTN_SECONDARY = clsx(BTN_BASE, "bg-navy pl-5 pr-6 text-white shadow-[inset_0_-3px_0_rgba(0,0,0,0.45)] hover:bg-navy-700 active:bg-navy-800");
const BTN_OUTLINE = clsx(
  "inline-flex min-h-12 items-center justify-center gap-2 rounded-md border border-navy/80 bg-transparent px-5 py-3 text-[16px] font-semibold leading-tight text-navy",
  "transition-colors duration-150 hover:bg-navy/[0.05] active:bg-navy/[0.09] motion-reduce:transition-none",
  FOCUS,
);
const BTN_HEADER = clsx(
  "inline-flex min-h-11 items-center justify-center whitespace-nowrap rounded-md bg-amber px-4 text-[15px] font-semibold text-navy",
  "shadow-[inset_0_-2px_0_rgba(16,29,43,0.22)] transition-colors duration-150 hover:bg-amber-hover active:translate-y-px active:bg-amber-active active:shadow-none motion-reduce:transition-none",
  FOCUS,
);
const TEXT_LINK = clsx(
  "rounded-sm font-semibold text-brand-700 underline decoration-1 underline-offset-[3px] transition-colors duration-150 hover:text-brand-900 hover:decoration-2 motion-reduce:transition-none",
  FOCUS,
);
const NAV_LINK = clsx(
  "block whitespace-nowrap rounded-sm px-3 py-2 text-[15px] font-medium text-ink-soft decoration-2 underline-offset-[6px] transition-colors duration-150 hover:text-navy hover:underline motion-reduce:transition-none",
  FOCUS,
);

/** Type scale. Devanagari gets more line height and no negative tracking. */
const T = {
  eyebrow: (deva: boolean) => clsx("font-semibold text-brand-700", deva ? "text-[15px]" : "text-[13px] uppercase tracking-[0.12em]"),
  h2: (deva: boolean) => clsx("font-bold text-navy", deva ? "text-[26px] leading-[1.45] sm:text-[32px]" : "text-[28px] leading-[1.15] tracking-[-0.015em] sm:text-[36px]"),
  body: (deva: boolean) => clsx("text-[16px] text-ink-soft", deva ? "leading-[1.8]" : "leading-relaxed"),
  small: (deva: boolean) => clsx("text-[14px] text-ink-muted", deva ? "leading-[1.75]" : "leading-relaxed"),
};

/**
 * In-page navigation that scrolls to a section without writing "#section" into the address bar.
 * The href stays on the link so it still works with JavaScript disabled or when opened in a new tab.
 */
function scrollToSection(e: MouseEvent<HTMLAnchorElement>, id: string) {
  if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
  e.preventDefault();
  if (id === "top") window.scrollTo({ top: 0 });
  else document.getElementById(id)?.scrollIntoView({ block: "start" });
}

/**
 * Reveals a block once as it enters the viewport. Hidden only when JavaScript runs, the browser supports
 * IntersectionObserver and the reader has not asked for reduced motion (see `.reveal` in index.css).
 */
function Reveal({ children, className, as: Tag = "div" }: { children: ReactNode; className?: string; as?: "div" | "li" }) {
  const ref = useRef<HTMLDivElement & HTMLLIElement>(null);
  const [state, setState] = useState<"static" | "hidden" | "shown">("static");
  useEffect(() => {
    const el = ref.current;
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (!el || reduce || typeof IntersectionObserver === "undefined") return;
    if (el.getBoundingClientRect().top < window.innerHeight) return; // already on screen: never hide it
    setState("hidden");
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setState("shown");
          io.disconnect();
        }
      },
      { rootMargin: "0px 0px -8% 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return (
    <Tag ref={ref} className={clsx(state !== "static" && "reveal", state === "shown" && "is-visible", className)}>
      {children}
    </Tag>
  );
}

/* ------------------------------------------------------------------ icons (24px grid, 1.6 stroke) */

function Glyph({ children, size = 22 }: { children: ReactNode; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden focusable="false">
      {children}
    </svg>
  );
}
const IconGlobe = () => (
  <Glyph size={18}><circle cx="12" cy="12" r="8.5" /><path d="M3.5 12h17M12 3.5c2.4 2.4 3.5 5.3 3.5 8.5s-1.1 6.1-3.5 8.5c-2.4-2.4-3.5-5.3-3.5-8.5S9.6 5.9 12 3.5z" /></Glyph>
);
const IconArrow = () => <Glyph size={18}><path d="M5 12h13M13 6.5l5.5 5.5-5.5 5.5" /></Glyph>;
const IconSearch = () => <Glyph size={20}><circle cx="10.5" cy="10.5" r="6" /><path d="M15 15l5 5" /></Glyph>;
/** Arrow that moves 3px on hover; it stays still when reduced motion is requested. */
const ArrowGlyph = () => (
  <span className="transition-transform duration-150 group-hover:translate-x-[3px] motion-reduce:transition-none motion-reduce:group-hover:translate-x-0">
    <Glyph size={20}><path d="M5 12h13M13 6.5l5.5 5.5-5.5 5.5" /></Glyph>
  </span>
);

/** The two main actions, used in the hero and the closing section. */
function Actions({ submitTo, trackTo, submit, track, stacked = false }: { submitTo: string; trackTo: string; submit: string; track: string; stacked?: boolean }) {
  return (
    <div className={clsx("flex flex-col gap-3", !stacked && "sm:flex-row")}>
      <Link to={submitTo} className={clsx(BTN_PRIMARY, stacked && "w-full !justify-between")}>
        {submit}
        <ArrowGlyph />
      </Link>
      <Link to={trackTo} className={clsx(BTN_SECONDARY, stacked && "w-full !justify-between !pl-6 !pr-5")}>
        {track}
        <IconSearch />
      </Link>
    </div>
  );
}
const IconInfo = () => <Glyph size={18}><circle cx="12" cy="12" r="8.5" /><path d="M12 11v5.5M12 7.8v.2" /></Glyph>;
const IconLock = ({ size = 16 }: { size?: number }) => <Glyph size={size}><rect x="5" y="10.5" width="14" height="10" rx="1.5" /><path d="M8 10.5V7.5a4 4 0 0 1 8 0v3" /></Glyph>;
const IconCheck = ({ size = 16 }: { size?: number }) => <Glyph size={size}><path d="M5 12.5l4.2 4L19 7" /></Glyph>;

/** Small pictograms that say who acts at a step, so the meaning never relies on colour alone. */
const ACTOR_GLYPH: Record<Actor, ReactNode> = {
  you: <Glyph size={14}><circle cx="12" cy="8" r="3.5" /><path d="M5 20c.8-3.8 3.6-6 7-6s6.2 2.2 7 6" /></Glyph>,
  auto: <Glyph size={14}><path d="M4 7h10M4 12h16M4 17h7" /><path d="M17 4l3 3-3 3" /></Glyph>,
  officer: <Glyph size={14}><path d="M12 3l7 3v5c0 4.5-3 8.2-7 10-4-1.8-7-5.5-7-10V6l7-3z" /><path d="M9 12l2 2 4-4" /></Glyph>,
};
const ACTOR_STYLE: Record<Actor, string> = {
  you: "border-amber/70 bg-amber-soft text-navy",
  auto: "border-brand-200 bg-brand-50 text-brand-800",
  officer: "border-navy/25 bg-surface text-navy",
};

function ActorTag({ actor, label }: { actor: Actor; label: string }) {
  return (
    <span className={clsx("inline-flex h-6 shrink-0 items-center gap-1.5 rounded border px-2 text-[12px] font-semibold", ACTOR_STYLE[actor])}>
      {ACTOR_GLYPH[actor]}
      {label}
    </span>
  );
}

/** Marks every product preview on this page as an example rather than a real record. */
function IllustrativeTag({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center rounded border border-dashed border-stone-field px-2 py-0.5 text-[12px] font-medium text-ink-muted">{children}</span>
  );
}

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
          "lang-select h-11 cursor-pointer appearance-none rounded-md border border-stone-field bg-surface pl-2.5 pr-7 text-[14px] font-medium text-navy sm:pl-9 sm:pr-8 sm:text-[15px]",
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

/* ------------------------------------------------------------------ header (items, order and behaviour preserved) */

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
    const mq = window.matchMedia?.("(min-width: 1280px)");
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
    ["#faq", c.faq],
  ];
  const accountTo = user ? homeFor(user.role) : "/login";
  const accountLabel = user ? c.dashboard : c.signIn;

  return (
    <header className="sticky top-0 z-40 border-b border-stone bg-canvas/95 backdrop-blur-[2px] supports-[backdrop-filter]:bg-canvas/90">
      <div className={clsx(CONTAINER, "flex h-16 items-center justify-between gap-3 lg:h-[72px]")}>
        {/* Same logo, drawn slightly smaller on phones so the header fits a 320px screen. */}
        <span className="sm:hidden"><Logo size={28} /></span>
        <span className="hidden sm:block"><Logo size={32} /></span>

        <nav aria-label="Primary" className="hidden xl:block">
          <ul className="flex items-center gap-1">
            {links.map(([href, label]) => (
              <li key={href}>
                <a href={href} onClick={(e) => scrollToSection(e, href.slice(1))} className={NAV_LINK}>
                  {label}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <div className="flex items-center gap-1.5 sm:gap-3">
          <LanguageSelect id="lang-header" label={c.language} />
          <Link
            to={accountTo}
            className={clsx(
              "hidden min-h-11 items-center whitespace-nowrap rounded-md px-3 text-[15px] font-semibold text-navy transition-colors duration-150 hover:bg-navy/[0.05] motion-reduce:transition-none md:inline-flex",
              FOCUS,
            )}
          >
            {accountLabel}
          </Link>
          <Link to={submitTo} className={clsx(BTN_HEADER, "hidden md:inline-flex")}>
            {c.submit}
          </Link>
          <button
            ref={toggleRef}
            type="button"
            className={clsx(
              "flex h-11 w-11 items-center justify-center rounded-md border border-stone-field text-navy transition-colors duration-150 hover:bg-navy/[0.05] motion-reduce:transition-none xl:hidden",
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

      <div id="site-menu" hidden={!open} className="border-t border-stone bg-canvas xl:hidden">
        <nav aria-label="Primary, mobile" className={clsx(CONTAINER, "pb-6 pt-2")}>
          <ul>
            {links.map(([href, label]) => (
              <li key={href} className="border-b border-stone">
                <a
                  href={href}
                  onClick={(e) => {
                    setOpen(false);
                    scrollToSection(e, href.slice(1));
                  }}
                  className={clsx("flex min-h-12 items-center text-[16px] font-medium text-navy", FOCUS)}
                >
                  {label}
                </a>
              </li>
            ))}
            <li className="border-b border-stone md:hidden">
              <Link to={accountTo} className={clsx("flex min-h-12 items-center text-[16px] font-semibold text-brand-700", FOCUS)}>
                {accountLabel}
              </Link>
            </li>
          </ul>
          <Link to={submitTo} className={clsx(BTN_PRIMARY, "mt-5 w-full md:hidden")}>
            {c.submit}
            <ArrowGlyph />
          </Link>
        </nav>
      </div>
    </header>
  );
}

/* ------------------------------------------------------------------ 1. hero: the tracking rail */

/**
 * One grievance followed from filing to resolution, laid out like a tracking rail: horizontal on wide
 * screens, vertical on phones. It shows what a citizen actually gets, a dated history that says who acted,
 * and it is labelled as an example: the reference number is masked and no real record is shown.
 */
function TrackingRail({ c, actors }: { c: LandingCopy["record"]; actors: LandingCopy["actors"] }) {
  const current = c.steps.findIndex((x) => x.pending) - 1;
  return (
    <figure>
      <div className="overflow-hidden rounded-lg border border-stone-dark bg-surface shadow-lift">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-3 border-b border-stone bg-stone-light/60 px-5 py-4 sm:px-7">
          <IllustrativeTag>{c.label}</IllustrativeTag>
          <div className="min-w-0">
            <p className="text-[12px] text-ink-muted">
              {c.referenceLabel} <span className="font-mono tracking-wide text-ink-soft">GRV-2026-······</span>
            </p>
            <p className="text-[17px] font-bold leading-snug text-navy">
              {c.category} <span className="font-normal text-ink-soft">· {c.place}</span>
            </p>
          </div>
          <dl className="flex flex-wrap gap-x-8 gap-y-1 text-[13px] lg:ml-auto">
            <div>
              <dt className="text-ink-muted">{c.deptLabel}</dt>
              <dd className="font-semibold text-navy">{c.dept}</dd>
            </div>
            <div>
              <dt className="text-ink-muted">{c.targetLabel}</dt>
              <dd className="font-semibold tabular-nums text-navy">{c.target}</dd>
            </div>
          </dl>
        </div>

        <ol className="px-5 pb-6 pt-6 sm:px-7 lg:grid lg:grid-cols-4 lg:pb-7 lg:pt-8" aria-label={c.historyLabel}>
          {c.steps.map((st, i) => {
            const last = i === c.steps.length - 1;
            const nextPending = !last && c.steps[i + 1].pending;
            return (
              <li key={st.status} className="grid grid-cols-[18px_1fr] gap-x-3 lg:block" aria-current={i === current ? "step" : undefined}>
                {/* node and connector: vertical on phones, horizontal on wide screens */}
                <div className="flex flex-col items-center lg:flex-row" aria-hidden>
                  <span
                    className={clsx(
                      "mt-1 h-3.5 w-3.5 shrink-0 rounded-full border-2 lg:mt-0",
                      st.pending ? "border-stone-field bg-surface" : i === current ? "border-brand-700 bg-brand-700 ring-4 ring-brand-100" : "border-navy bg-navy",
                    )}
                  />
                  {!last && (
                    <span
                      className={clsx(
                        "w-0 grow lg:h-0 lg:w-auto",
                        nextPending ? "border-l-2 border-dashed border-stone-field lg:border-l-0 lg:border-t-2" : "border-l-2 border-navy/60 lg:border-l-0 lg:border-t-2",
                      )}
                    />
                  )}
                </div>
                <div className={clsx("pb-6 lg:pb-0 lg:pr-8 lg:pt-5", last && "pb-0")}>
                  <p className={clsx("text-[16px] font-semibold", st.pending ? "text-ink-muted" : i === current ? "text-brand-800" : "text-navy")}>{st.status}</p>
                  <p className="mt-0.5 font-mono text-[12px] text-ink-muted">{st.when}</p>
                  <p className={clsx("mt-2 text-[14px] leading-relaxed", st.pending ? "text-ink-muted" : "text-ink-soft")}>{st.text}</p>
                  <div className="mt-2.5">
                    <ActorTag actor={st.actor} label={actors[st.actor]} />
                  </div>
                </div>
              </li>
            );
          })}
        </ol>
      </div>
      <figcaption className="mt-3 flex flex-wrap justify-between gap-x-6 gap-y-1 text-[13px] leading-relaxed text-ink-muted">
        <span>{c.footnote}</span>
        <span>{c.caption}</span>
      </figcaption>
    </figure>
  );
}

/** The brand promise from the logo, "Speak · Track · Resolve", drawn as the logo draws it: rules either side, orange dots between. */
function BrandPromise({ words, label, deva }: { words: [string, string, string]; label: string; deva: boolean }) {
  return (
    <div className={clsx(CONTAINER, "pb-10 sm:pb-14")}>
      <a
        href="#how"
        onClick={(e) => scrollToSection(e, "how")}
        title={label}
        className={clsx("group flex items-center gap-4 rounded-sm sm:gap-6", FOCUS)}
      >
        <span className="h-px grow bg-stone-dark" aria-hidden />
        <span className={clsx("flex items-center gap-3 font-semibold text-navy sm:gap-5", deva ? "text-[20px] sm:text-[24px]" : "text-[20px] tracking-[0.02em] sm:text-[26px]")}>
          {words.map((w, i) => (
            <span key={w} className="flex items-center gap-3 sm:gap-5">
              {i > 0 && <span className="h-2 w-2 rounded-full bg-amber" aria-hidden />}
              <span className="transition-colors duration-150 group-hover:text-brand-700 motion-reduce:transition-none">{w}</span>
            </span>
          ))}
        </span>
        <span className="h-px grow bg-stone-dark" aria-hidden />
      </a>
    </div>
  );
}

/* ------------------------------------------------------------------ 2. services: the issue directory */

interface DepartmentMeta {
  code: string;
  name: string;
  name_hi?: string | null;
  name_mr?: string | null;
}

function targetLabel(hours: number, c: LandingCopy["services"]) {
  return hours >= 48 && hours % 24 === 0 ? c.days(hours / 24) : c.hours(hours);
}

function IssueDirectory({ c, lang, deva, submitTo }: { c: LandingCopy["services"]; lang: Lang; deva: boolean; submitTo: string }) {
  const cats = useQuery({ queryKey: ["meta", "categories"], queryFn: () => api<CategoryMeta[]>("/meta/categories", { auth: false }) });
  const depts = useQuery({ queryKey: ["meta", "departments"], queryFn: () => api<DepartmentMeta[]>("/meta/departments", { auth: false }) });

  const deptName = (code: string) => {
    const d = depts.data?.find((x) => x.code === code);
    if (!d) return code;
    return (lang === "hi" ? d.name_hi : lang === "mr" ? d.name_mr : null) || d.name;
  };
  // Group the Category Master by responsible department; the general desk goes last.
  const groups = new Map<string, CategoryMeta[]>();
  for (const cat of cats.data ?? []) {
    const key = cat.department_code ?? "GENERAL";
    groups.set(key, [...(groups.get(key) ?? []), cat]);
  }
  const ordered = [...groups.entries()].sort(([a], [b]) => (a === "GENERAL" ? 1 : b === "GENERAL" ? -1 : deptName(a).localeCompare(deptName(b), lang)));
  const anySensitive = cats.data?.some((x) => x.is_sensitive);

  return (
    <section id="services" aria-labelledby="services-title" className="scroll-mt-20 border-y border-stone bg-surface">
      <div className={clsx(CONTAINER, "grid gap-10 py-16 lg:grid-cols-12 lg:gap-8 lg:py-24")}>
        <div className="lg:col-span-4">
          <div className="lg:sticky lg:top-28">
            <p className={T.eyebrow(deva)}>{c.eyebrow}</p>
            <h2 id="services-title" className={clsx("mt-3", T.h2(deva))}>
              {c.title}
            </h2>
            <p className={clsx("mt-5", T.body(deva))}>{c.intro}</p>
            <Link to={submitTo} className={clsx(BTN_OUTLINE, "mt-7")}>
              {c.start}
              <IconArrow />
            </Link>
            <div className={clsx("mt-8 space-y-2 border-t border-stone pt-5", T.small(deva))}>
              <p>{c.sourceNote}</p>
              {anySensitive && (
                <p className="flex gap-2">
                  <span className="mt-[3px] shrink-0 text-navy"><IconLock /></span>
                  {c.confidentialNote}
                </p>
              )}
            </div>
          </div>
        </div>

        <div className="lg:col-span-8">
          {cats.isLoading && <p className={T.small(deva)}>{c.loading}</p>}
          {cats.isError && <p className={T.body(deva)}>{c.error}</p>}
          {cats.data && (
            <div className="gap-x-10 sm:columns-2">
              {ordered.map(([code, items]) => (
                <Reveal key={code} className="mb-9 break-inside-avoid">
                  <h3 className={clsx("border-t-2 border-navy pt-3 text-[15px] font-bold text-navy", deva && "leading-snug")}>{deptName(code)}</h3>
                  <ul className="mt-1">
                    {items.map((cat) => (
                      <li key={cat.code} className="flex items-baseline justify-between gap-4 border-b border-stone py-2.5">
                        <span className={clsx("text-[15px] text-navy", deva ? "leading-[1.6]" : "leading-snug")}>
                          {categoryName(cat, lang)}
                          {cat.is_sensitive && (
                            <span className="ml-2 inline-flex translate-y-[2px] items-center gap-1 text-[12px] font-semibold text-navy">
                              <IconLock size={13} />
                              {c.confidential}
                            </span>
                          )}
                        </span>
                        <span className="shrink-0 text-right text-[13px] tabular-nums text-ink-muted">
                          <span className="sr-only">{c.targetLabel}: </span>
                          {targetLabel(cat.sla_hours, c)}
                        </span>
                      </li>
                    ))}
                  </ul>
                </Reveal>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ 3. how it works: three acts, five steps */

function Journey({ c, actors, deva }: { c: LandingCopy["how"]; actors: LandingCopy["actors"]; deva: boolean }) {
  let n = 0;
  return (
    <section id="how" aria-labelledby="how-title" className="scroll-mt-20">
      <div className={clsx(CONTAINER, "py-16 lg:py-24")}>
        <div className="grid gap-6 lg:grid-cols-12 lg:items-end lg:gap-8">
          <div className="lg:col-span-7">
            <p className={T.eyebrow(deva)}>{c.eyebrow}</p>
            <h2 id="how-title" className={clsx("mt-3 max-w-[26ch]", T.h2(deva))}>
              {c.title}
            </h2>
          </div>
          <div className="lg:col-span-5">
            <p className={T.body(deva)}>{c.intro}</p>
            <ul className="mt-4 flex flex-wrap gap-2" aria-label={c.intro}>
              {(["you", "auto", "officer"] as Actor[]).map((a) => (
                <li key={a}>
                  <ActorTag actor={a} label={actors[a]} />
                </li>
              ))}
            </ul>
          </div>
        </div>

        <ol className="mt-14 grid gap-12 lg:grid-cols-3 lg:gap-0">
          {c.acts.map((act, ai) => (
            <Reveal as="li" key={act.name} className={clsx("relative border-l-2 border-navy pl-6 lg:border-l-0 lg:border-t-2 lg:pl-0 lg:pt-8", ai < 2 && "lg:pr-10")}>
              <span className="absolute -left-[7px] top-0 h-3 w-3 rounded-full bg-amber ring-4 ring-canvas lg:-top-[7px] lg:left-0" aria-hidden />
              <h3 className={clsx("font-bold text-navy", deva ? "text-[26px] leading-snug" : "text-[30px] leading-none tracking-[-0.02em]")}>{act.name}</h3>
              <p className={clsx("mt-2 text-[15px] text-ink-soft", deva && "leading-[1.7]")}>{act.line}</p>
              <ol className="mt-6 space-y-6">
                {act.steps.map((s) => {
                  n += 1;
                  return (
                    <li key={s.title} className="border-t border-stone pt-5">
                      <div className="flex items-start justify-between gap-3">
                        <h4 className={clsx("text-[17px] font-semibold text-navy", deva ? "leading-snug" : "leading-tight")}>
                          <span className="mr-2 font-mono text-[13px] font-medium text-brand-700">{String(n).padStart(2, "0")}</span>
                          {s.title}
                        </h4>
                        <ActorTag actor={s.actor} label={actors[s.actor]} />
                      </div>
                      <p className={clsx("mt-2", T.body(deva), "text-[15px]")}>{s.body}</p>
                    </li>
                  );
                })}
              </ol>
            </Reveal>
          ))}
        </ol>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ 4. product previews */

function PreviewFrame({ title, step, tag, caption, children }: { title: string; step: number; tag: string; caption: string; children: ReactNode }) {
  return (
    <figure>
      <div className="overflow-hidden rounded-lg border border-stone-dark bg-surface">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-stone px-5 py-3">
          <p className="text-[14px] font-semibold text-navy">
            <span className="mr-2 font-mono text-[13px] text-brand-700">{step}</span>
            {title}
          </p>
          <IllustrativeTag>{tag}</IllustrativeTag>
        </div>
        <div className="px-5 py-5">{children}</div>
      </div>
      <figcaption className="mt-3 text-[14px] text-ink-soft">{caption}</figcaption>
    </figure>
  );
}

function ProductPreviews({ c, deva, greeting }: { c: LandingCopy["product"]; deva: boolean; greeting: string }) {
  const bubble = "max-w-[34ch] rounded-lg px-4 py-3 text-[14px]";
  return (
    <section aria-labelledby="product-title" className="border-y border-stone bg-stone-light">
      <div className={clsx(CONTAINER, "py-16 lg:py-24")}>
        <div className="max-w-2xl">
          <p className={T.eyebrow(deva)}>{c.eyebrow}</p>
          <h2 id="product-title" className={clsx("mt-3", T.h2(deva))}>
            {c.title}
          </h2>
          <p className={clsx("mt-4", T.body(deva))}>{c.intro}</p>
        </div>

        <div className="mt-12 grid gap-8 lg:grid-cols-12 lg:items-start">
          <Reveal className="lg:col-span-7">
            <PreviewFrame step={1} title={c.chat.title} tag={c.illustrative} caption={c.chat.caption}>
              <div className={clsx("space-y-4", deva ? "leading-[1.7]" : "leading-relaxed")}>
                <div>
                  <p className="mb-1 text-[12px] font-semibold uppercase tracking-[0.08em] text-ink-muted">{c.chat.assistant}</p>
                  <p className={clsx(bubble, "rounded-tl-sm bg-stone-light text-navy")}>{greeting}</p>
                </div>
                <div className="flex flex-col items-end">
                  <p className="mb-1 text-[12px] font-semibold uppercase tracking-[0.08em] text-ink-muted">{c.chat.you}</p>
                  <p className={clsx(bubble, "rounded-tr-sm bg-navy text-white")}>{c.chat.example}</p>
                </div>
                <div>
                  <p className="mb-1 text-[12px] font-semibold uppercase tracking-[0.08em] text-ink-muted">{c.chat.assistant}</p>
                  <p className={clsx(bubble, "rounded-tl-sm border-l-[3px] border-amber bg-stone-light text-navy")}>{c.chat.followUp}</p>
                </div>
              </div>
            </PreviewFrame>
          </Reveal>

          <Reveal className="lg:col-span-5">
            <PreviewFrame step={2} title={c.draft.title} tag={c.illustrative} caption={c.draft.caption}>
              <dl className="divide-y divide-stone text-[14px]">
                {c.draft.fields.map(([k, v]) => (
                  <div key={k} className="flex items-baseline justify-between gap-4 py-2.5 first:pt-0">
                    <dt className="text-ink-muted">{k}</dt>
                    <dd className="text-right font-semibold text-navy">{v}</dd>
                  </div>
                ))}
              </dl>
              <div className="mt-5 flex items-start gap-3 rounded-md border border-stone bg-canvas px-3 py-3 text-[14px] text-navy">
                <span className="mt-0.5 flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-sm bg-brand-700 text-white" aria-hidden>
                  <IconCheck size={14} />
                </span>
                {c.draft.check}
              </div>
              <p className="mt-3 text-[13px] font-medium text-ink-soft">{c.draft.note}</p>
            </PreviewFrame>
          </Reveal>
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ page */

export default function Landing() {
  const { user } = useAuth();
  const { lang, setLang, t } = useI18n();
  const loc = useLocation();
  const status = useSystemStatus();
  const s = status.data;
  const c = LANDING_COPY[lang];
  const deva = lang !== "en";
  const voice = s?.speech_to_text.available;

  // Visitors go to intake (sign-in first, then returned there); citizens straight to intake; staff to their own home.
  const submitTo = !user || user.role === "citizen" ? "/citizen/new" : homeFor(user.role);
  const trackTo = !user || user.role === "citizen" ? "/citizen/track" : homeFor(user.role);

  // Other pages link here with { state: { section } }; old "/#section" URLs still work and are tidied to "/".
  const section = (loc.state as { section?: string } | null)?.section ?? (loc.hash ? loc.hash.slice(1) : undefined);
  useEffect(() => {
    if (!section) return;
    document.getElementById(section)?.scrollIntoView({ block: "start" });
    if (window.location.hash) window.history.replaceState(window.history.state, "", window.location.pathname + window.location.search);
  }, [section, loc.key]);

  return (
    <div lang={lang} className="min-h-screen bg-canvas text-navy">
      <a
        href="#main"
        onClick={(e) => {
          e.preventDefault();
          document.getElementById("main")?.focus();
        }}
        className="sr-only rounded-md bg-navy px-4 py-3 font-semibold text-white focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:outline focus:outline-[3px] focus:outline-amber"
      >
        {c.nav.skip}
      </a>
      <Header submitTo={submitTo} />

      <main id="main" tabIndex={-1} className="focus:outline-none">
        {/* 1 · Hero: headline and actions on one row, the tracking rail full width beneath */}
        <section id="top" aria-labelledby="hero-title" className="scroll-mt-24">
          <div className={clsx(CONTAINER, "pt-10 sm:pt-14 lg:pt-20")}>
            <div className="grid gap-8 lg:grid-cols-12 lg:gap-10">
              <div className="lg:col-span-7 xl:col-span-8">
                <p className={clsx("flex items-center gap-3", T.eyebrow(deva))}>
                  <span className="h-[3px] w-8 shrink-0 bg-amber" aria-hidden />
                  {c.hero.eyebrow}
                </p>
                <h1
                  id="hero-title"
                  className={clsx(
                    "mt-5 max-w-[16ch] font-bold text-navy",
                    deva ? "text-[36px] leading-[1.35] sm:text-[50px]" : "text-[42px] leading-[1.02] tracking-[-0.035em] sm:text-[60px] xl:text-[68px]",
                  )}
                >
                  {c.hero.title}
                </h1>
              </div>
              {/* Top of the lead lines up with the first line of the headline (eyebrow height + gap). */}
              <div className="lg:col-span-5 lg:pt-[46px] xl:col-span-4">
                <p className={clsx("text-[18px] text-ink-soft", deva ? "leading-[1.8]" : "leading-relaxed")}>{c.hero.lead}</p>
                <div className="mt-7">
                  <Actions submitTo={submitTo} trackTo={trackTo} submit={c.hero.submit} track={c.hero.track} stacked />
                </div>
                {!user && (
                  <p className={clsx("mt-4 text-[15px] text-ink-muted", deva ? "leading-[1.75]" : "leading-relaxed")}>
                    {c.hero.accountNote}{" "}
                    <Link to="/register" className={TEXT_LINK}>
                      {c.hero.createAccount}
                    </Link>
                  </p>
                )}
              </div>
            </div>

            <div className="mt-12 lg:mt-16">
              <TrackingRail c={c.record} actors={c.actors} />
            </div>
          </div>
          <div className="mt-12 lg:mt-14">
            <BrandPromise words={c.hero.promise} label={c.hero.promiseLabel} deva={deva} />
          </div>
        </section>

        {/* 2 · Services */}
        <IssueDirectory c={c.services} lang={lang} deva={deva} submitTo={submitTo} />

        {/* 3 · How it works */}
        <Journey c={c.how} actors={c.actors} deva={deva} />

        {/* 4 · Product experience */}
        <ProductPreviews c={c.product} deva={deva} greeting={t("chatGreeting")} />

        {/* 5 · Behind the scenes */}
        <section aria-labelledby="behind-title">
          <div className={clsx(CONTAINER, "grid gap-10 py-16 lg:grid-cols-12 lg:gap-8 lg:py-24")}>
            <div className="lg:col-span-5">
              <p className={T.eyebrow(deva)}>{c.behind.eyebrow}</p>
              <h2 id="behind-title" className={clsx("mt-3 max-w-[18ch]", T.h2(deva))}>
                {c.behind.title}
              </h2>
              <p className={clsx("mt-5", T.body(deva))}>{c.behind.lead}</p>
              <ul className={clsx("mt-7 space-y-3", T.small(deva))}>
                {voice !== undefined && (
                  <li className="flex gap-2.5">
                    <span className="mt-[2px] shrink-0 text-brand-700"><IconInfo /></span>
                    {voice ? c.behind.voiceOn : c.behind.voiceOff}
                  </li>
                )}
                <li className="flex gap-2.5">
                  <span className="mt-[2px] shrink-0 text-brand-700"><IconInfo /></span>
                  {c.behind.notYet}
                </li>
              </ul>
            </div>
            <ol className="lg:col-span-7 lg:col-start-6 lg:pl-8">
              {c.behind.items.map(([title, body], i) => (
                <Reveal as="li" key={title} className="grid grid-cols-[2.5rem_1fr] gap-x-2 border-t border-stone py-6 first:border-t-2 first:border-navy">
                  <span className="pt-0.5 font-mono text-[13px] text-brand-700" aria-hidden>
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <div>
                    <h3 className={clsx("text-[18px] font-semibold text-navy", deva ? "leading-snug" : "leading-tight")}>{title}</h3>
                    <p className={clsx("mt-2", T.body(deva), "text-[15px]")}>{body}</p>
                  </div>
                </Reveal>
              ))}
            </ol>
          </div>
        </section>

        {/* 6 · About / accountability */}
        <section id="about" aria-labelledby="about-title" className="scroll-mt-20 bg-navy">
          <div className={clsx(CONTAINER, "grid gap-10 py-16 lg:grid-cols-12 lg:gap-8 lg:py-24")}>
            <div className="lg:col-span-5">
              <p className={clsx("font-semibold text-amber", deva ? "text-[15px]" : "text-[13px] uppercase tracking-[0.12em]")}>{c.about.eyebrow}</p>
              <h2 id="about-title" className={clsx("mt-3 font-bold text-white", deva ? "text-[26px] leading-[1.45] sm:text-[30px]" : "text-[28px] leading-[1.2] tracking-[-0.015em] sm:text-[32px]")}>
                {c.about.title}
              </h2>
              <p className={clsx("mt-6 border-l-2 border-amber pl-4 text-[15px] text-[#C9D1DB]", deva ? "leading-[1.8]" : "leading-relaxed")}>
                {s?.synthetic_data_in_use === false ? c.about.body : c.about.bodySynthetic}
              </p>
            </div>
            <dl className="lg:col-span-7 lg:col-start-6 lg:pl-8">
              {c.about.rows.map(([k, v]) => (
                <div key={k} className="grid gap-1 border-t border-white/15 py-6 first:border-t-0 first:pt-1 sm:grid-cols-[9rem_1fr] sm:gap-6">
                  <dt className="text-[16px] font-semibold text-white">{k}</dt>
                  <dd className={clsx("text-[15px] text-[#C9D1DB]", deva ? "leading-[1.8]" : "leading-relaxed")}>{v}</dd>
                </div>
              ))}
            </dl>
          </div>
        </section>

        {/* 7 · Languages */}
        <section aria-labelledby="lang-title">
          <div className={clsx(CONTAINER, "grid gap-10 py-16 lg:grid-cols-12 lg:gap-8 lg:py-24")}>
            <div className="lg:col-span-5">
              <p className={T.eyebrow(deva)}>{c.languages.eyebrow}</p>
              <h2 id="lang-title" className={clsx("mt-3", T.h2(deva))}>
                {c.languages.title}
              </h2>
              <p className={clsx("mt-5", T.body(deva))}>{c.languages.body}</p>
            </div>
            <figure className="lg:col-span-7 lg:col-start-6 lg:pl-8">
              <ul className="border-t-2 border-navy">
                {(Object.keys(LANG_LABEL) as Lang[]).map((l) => (
                  <li key={l} lang={l} className="grid gap-3 border-b border-stone py-6 sm:grid-cols-[7.5rem_1fr] sm:gap-6">
                    <div className="flex items-center justify-between gap-3 sm:flex-col sm:items-start sm:justify-start">
                      <span className="text-[15px] font-semibold text-navy">{LANG_LABEL[l]}</span>
                      {l !== lang && (
                        <button
                          type="button"
                          onClick={() => setLang(l)}
                          className={clsx("min-h-6 rounded-sm text-[13px] font-semibold text-brand-700 underline underline-offset-[3px] hover:text-brand-900", FOCUS)}
                        >
                          {l === "en" ? "Use English" : l === "hi" ? "हिंदी में देखें" : "मराठीत पाहा"}
                        </button>
                      )}
                    </div>
                    <p className={clsx("text-[19px] text-navy sm:text-[21px]", l === "en" ? "leading-snug" : "leading-[1.6]")}>{ASSISTANT_QUESTION[l]}</p>
                  </li>
                ))}
              </ul>
              <figcaption className={clsx("mt-3", T.small(deva))}>{c.languages.sampleCaption}</figcaption>
            </figure>
          </div>
        </section>

        {/* 8 · Responsible handling */}
        <section aria-labelledby="care-title" className="border-y border-stone bg-surface">
          <div className={clsx(CONTAINER, "py-16 lg:py-24")}>
            <p className={T.eyebrow(deva)}>{c.care.eyebrow}</p>
            <h2 id="care-title" className={clsx("mt-3 max-w-[24ch]", T.h2(deva))}>
              {c.care.title}
            </h2>
            <ul className="mt-12 grid gap-x-12 sm:grid-cols-2">
              {c.care.items.map(([title, body]) => (
                <Reveal as="li" key={title} className="border-t border-stone py-7">
                  <h3 className={clsx("flex items-start gap-3 text-[18px] font-semibold text-navy", deva ? "leading-snug" : "leading-tight")}>
                    <span className="mt-0.5 shrink-0 text-brand-700"><IconLock size={20} /></span>
                    {title}
                  </h3>
                  <p className={clsx("mt-2 pl-8", T.body(deva), "text-[15px]")}>{body}</p>
                </Reveal>
              ))}
            </ul>
          </div>
        </section>

        {/* 9 · FAQ */}
        <section id="faq" aria-labelledby="faq-title" className="scroll-mt-20">
          <div className={clsx(CONTAINER, "grid gap-10 py-16 lg:grid-cols-12 lg:gap-8 lg:py-24")}>
            <div className="lg:col-span-4">
              <p className={T.eyebrow(deva)}>{c.faqSection.eyebrow}</p>
              <h2 id="faq-title" className={clsx("mt-3", T.h2(deva))}>
                {c.faqSection.title}
              </h2>
            </div>
            <div className="border-t-2 border-navy lg:col-span-8">
              {c.faqSection.items.map(([q, a]) => (
                <details key={q} className="group border-b border-stone">
                  <summary
                    className={clsx(
                      "flex min-h-14 cursor-pointer list-none items-start justify-between gap-6 rounded-sm py-4 text-[17px] font-semibold text-navy transition-colors duration-150 hover:text-brand-700 motion-reduce:transition-none [&::-webkit-details-marker]:hidden",
                      deva && "leading-snug",
                      FOCUS,
                    )}
                  >
                    {q}
                    <span className="mt-0.5 shrink-0 text-brand-700 transition-transform duration-150 group-open:rotate-45 motion-reduce:transition-none" aria-hidden>
                      <Glyph size={20}>
                        <path d="M12 5v14M5 12h14" />
                      </Glyph>
                    </span>
                  </summary>
                  <p className={clsx("max-w-prose pb-6 pr-10", T.body(deva))}>{a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        {/* 10 · Closing call to action */}
        <section aria-labelledby="cta-title" className="border-t-4 border-amber bg-stone-light">
          <div className={clsx(CONTAINER, "grid gap-8 py-14 lg:grid-cols-12 lg:items-end lg:gap-8 lg:py-20")}>
            <div className="lg:col-span-7">
              <h2 id="cta-title" className={clsx("font-bold text-navy", deva ? "text-[30px] leading-[1.4] sm:text-[36px]" : "text-[34px] leading-[1.08] tracking-[-0.025em] sm:text-[44px]")}>
                {c.cta.title}
              </h2>
              <p className={clsx("mt-4 max-w-[46ch] text-[17px] text-ink-soft", deva ? "leading-[1.8]" : "leading-relaxed")}>{c.cta.body}</p>
            </div>
            <div className="lg:col-span-5 lg:justify-self-end">
              <Actions submitTo={submitTo} trackTo={trackTo} submit={c.hero.submit} track={c.hero.track} />
              <Link to="/help" className={clsx(TEXT_LINK, "mt-4 inline-block text-[15px]")}>
                {c.cta.help}
              </Link>
            </div>
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
