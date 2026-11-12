import { useEffect, useState, type ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";
import { getConsent, setConsent, trackPageView } from "../lib/consent";
import { SUPPORT_EMAIL } from "../lib/meta";

/** Maintainer contact shown in the footer. */
const OWNER = {
  name: "Ritesh Kumar",
  email: "riteshkumar90359@gmail.com",
  github: "https://github.com/RiteshKumar2e",
  linkedin: "https://www.linkedin.com/in/riteshkumar-tech",
};

const SOCIAL_ICON = {
  github: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden focusable="false">
      <path d="M12 2C6.48 2 2 6.58 2 12.23c0 4.52 2.87 8.35 6.84 9.7.5.1.68-.22.68-.49 0-.24-.01-.88-.01-1.73-2.78.62-3.37-1.37-3.37-1.37-.46-1.18-1.11-1.5-1.11-1.5-.91-.64.07-.62.07-.62 1 .07 1.53 1.06 1.53 1.06.9 1.57 2.35 1.12 2.92.85.09-.66.35-1.12.64-1.37-2.22-.26-4.55-1.14-4.55-5.07 0-1.12.39-2.04 1.03-2.76-.1-.26-.45-1.3.1-2.71 0 0 .84-.28 2.75 1.05A9.36 9.36 0 0 1 12 6.93c.85 0 1.71.12 2.51.34 1.91-1.33 2.75-1.05 2.75-1.05.55 1.41.2 2.45.1 2.71.64.72 1.03 1.64 1.03 2.76 0 3.94-2.34 4.81-4.57 5.06.36.32.68.94.68 1.9 0 1.37-.01 2.48-.01 2.82 0 .27.18.6.69.49A10.2 10.2 0 0 0 22 12.23C22 6.58 17.52 2 12 2z" />
    </svg>
  ),
  linkedin: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden focusable="false">
      <path d="M20.45 20.45h-3.56v-5.57c0-1.33-.02-3.04-1.85-3.04-1.85 0-2.14 1.45-2.14 2.94v5.67H9.34V9h3.42v1.56h.05c.48-.9 1.64-1.85 3.37-1.85 3.6 0 4.27 2.37 4.27 5.46v6.28zM5.34 7.43a2.06 2.06 0 1 1 0-4.13 2.06 2.06 0 0 1 0 4.13zM7.12 20.45H3.56V9h3.56v11.45zM22.22 0H1.77C.79 0 0 .77 0 1.73v20.54C0 23.23.79 24 1.77 24h20.45c.98 0 1.78-.77 1.78-1.73V1.73C24 .77 23.2 0 22.22 0z" />
    </svg>
  ),
  mail: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden focusable="false">
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="M3.5 6.5l8.5 6.5 8.5-6.5" />
    </svg>
  ),
};

const FOOT_LINK =
  "rounded-sm text-[14px] text-[#C9D1DB] transition-colors duration-150 hover:text-white hover:underline underline-offset-[3px] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber motion-reduce:transition-none";

function FooterColumn({ title, children }: { title: string; children: ReactNode }) {
  return (
    <nav aria-label={title}>
      <h2 className="text-[12px] font-semibold uppercase tracking-[0.12em] text-amber">{title}</h2>
      <ul className="mt-4 space-y-2.5">{children}</ul>
    </nav>
  );
}

export function SiteFooter({ compact = false }: { compact?: boolean }) {
  const storage = (
    <button type="button" onClick={() => window.dispatchEvent(new Event("grievance:open-consent"))} className="text-left hover:text-navy hover:underline">
      Storage preferences
    </button>
  );
  if (compact) {
    return (
      <footer className="border-t border-stone bg-canvas">
        <div className="mx-auto flex max-w-7xl justify-center px-4 py-4 text-[12px] text-ink-muted sm:justify-end">
          <nav aria-label="Footer" className="flex flex-wrap gap-x-4 gap-y-1">
            <Link to="/help" className="hover:text-navy hover:underline">Help</Link>
            <Link to="/privacy" className="hover:text-navy hover:underline">Privacy</Link>
            <Link to="/terms" className="hover:text-navy hover:underline">Terms</Link>
            {storage}
          </nav>
        </div>
      </footer>
    );
  }

  const contactEmail = SUPPORT_EMAIL || OWNER.email;
  const year = new Date().getFullYear();
  const social = [
    { href: OWNER.github, label: "GitHub", icon: SOCIAL_ICON.github, external: true },
    { href: OWNER.linkedin, label: "LinkedIn", icon: SOCIAL_ICON.linkedin, external: true },
    { href: `mailto:${OWNER.email}`, label: "E-mail", icon: SOCIAL_ICON.mail, external: false },
  ];

  return (
    <footer className="bg-navy text-[#C9D1DB]">
      <div className="mx-auto max-w-6xl px-4 pb-8 pt-14 sm:px-6">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-[1.6fr_1fr_1fr_1fr] lg:gap-12">
          {/* Brand */}
          <div className="sm:col-span-2 lg:col-span-1">
            <Link
              to="/"
              aria-label="GRIEVANCE home"
              className="inline-flex items-center gap-3 rounded-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-amber"
            >
              <span className="flex h-10 w-10 items-center justify-center rounded-md bg-canvas">
                <img src="/brand/grievance-emblem.webp" alt="" width={30} height={28} style={{ height: 28, width: "auto" }} />
              </span>
              <span className="text-[17px] font-bold tracking-[0.14em] text-white">GRIEVANCE</span>
            </Link>
            <p className="mt-4 max-w-sm text-[14px] leading-relaxed">
              Report civic issues in English, हिंदी or मराठी, and follow every step until they are resolved. Sensitive cases are always reviewed by people.
            </p>
            <ul className="mt-6 flex gap-2" aria-label="Find us online">
              {social.map((s) => (
                <li key={s.label}>
                  <a
                    href={s.href}
                    {...(s.external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
                    aria-label={s.external ? `${s.label} (opens in a new tab)` : `${s.label}: ${OWNER.email}`}
                    title={s.label}
                    className="flex h-10 w-10 items-center justify-center rounded-md border border-white/15 text-[#C9D1DB] transition-colors duration-150 hover:border-amber hover:bg-white/[0.06] hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber motion-reduce:transition-none"
                  >
                    {s.icon}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          <FooterColumn title="Platform">
            <li><Link to="/" state={{ section: "how" }} className={FOOT_LINK}>How it works</Link></li>
            <li><Link to="/" state={{ section: "services" }} className={FOOT_LINK}>Services</Link></li>
            <li><Link to="/" state={{ section: "about" }} className={FOOT_LINK}>About</Link></li>
            <li><Link to="/" state={{ section: "faq" }} className={FOOT_LINK}>FAQ</Link></li>
          </FooterColumn>

          <FooterColumn title="Support">
            <li><Link to="/help" className={FOOT_LINK}>Help centre</Link></li>
            <li><Link to="/citizen/track" className={FOOT_LINK}>Track a complaint</Link></li>
            <li><a href={`mailto:${contactEmail}`} className={FOOT_LINK}>Contact us</a></li>
            <li className="break-all text-[13px] text-[#8FA0B3]">{contactEmail}</li>
          </FooterColumn>

          <FooterColumn title="Legal">
            <li><Link to="/privacy" className={FOOT_LINK}>Privacy policy</Link></li>
            <li><Link to="/terms" className={FOOT_LINK}>Terms &amp; conditions</Link></li>
            <li>
              <button type="button" onClick={() => window.dispatchEvent(new Event("grievance:open-consent"))} className={`${FOOT_LINK} text-left`}>
                Storage preferences
              </button>
            </li>
          </FooterColumn>
        </div>

        <div className="mt-12 flex flex-col gap-2 border-t border-white/10 pt-6 text-[13px] text-[#8FA0B3] sm:flex-row sm:items-center sm:justify-between">
          <p>© {year} GRIEVANCE. Designed and built by {OWNER.name}.</p>
          <p>Not affiliated with any government body.</p>
        </div>
      </div>
    </footer>
  );
}

/** Storage / analytics notice. Essential storage needs no consent; analytics waits for "Accept". */
export function ConsentBanner() {
  const [open, setOpen] = useState(() => getConsent() === null);
  useEffect(() => {
    const show = () => setOpen(true);
    window.addEventListener("grievance:open-consent", show);
    return () => window.removeEventListener("grievance:open-consent", show);
  }, []);
  if (!open) return null;
  const choose = (v: "accepted" | "declined") => {
    setConsent(v);
    setOpen(false);
    if (v === "accepted") trackPageView(window.location.pathname);
  };
  return (
    <div role="dialog" aria-modal="false" aria-labelledby="consent-title" className="fixed inset-x-0 bottom-0 z-50 p-3 sm:p-4">
      <div className="mx-auto flex max-w-3xl flex-col gap-3 rounded-lg border border-line bg-surface p-4 shadow-overlay sm:flex-row sm:items-center">
        <div className="flex-1 text-sm">
          <p id="consent-title" className="font-semibold text-ink">Your privacy</p>
          <p className="mt-0.5 text-ink-soft">
            We use no cookies. Essential browser storage keeps you signed in and remembers your language. With your permission we also count
            anonymous page visits (no IDs, no third parties).{" "}
            <Link to="/privacy" className="font-medium text-brand-700 underline-offset-2 hover:underline">Privacy policy</Link>
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          <button onClick={() => choose("declined")} className="h-9 rounded-md border border-line px-3 text-sm font-medium text-ink hover:bg-canvas">
            Essential only
          </button>
          <button onClick={() => choose("accepted")} className="h-9 rounded-md bg-brand-700 px-3 text-sm font-medium text-white hover:bg-brand-800">
            Accept analytics
          </button>
        </div>
      </div>
    </div>
  );
}

export function PageViewTracker() {
  const { pathname } = useLocation();
  useEffect(() => {
    trackPageView(pathname);
    window.scrollTo?.({ top: 0 });
  }, [pathname]);
  return null;
}
