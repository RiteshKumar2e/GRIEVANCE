import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { getConsent, setConsent, trackPageView } from "../lib/consent";
import { SUPPORT_EMAIL } from "../lib/meta";

export function SiteFooter({ compact = false }: { compact?: boolean }) {
  const storage = (
    <button type="button" onClick={() => window.dispatchEvent(new Event("grievance:open-consent"))} className="text-left hover:text-navy hover:underline">
      Storage preferences
    </button>
  );
  if (compact) {
    return (
      <footer className="border-t border-stone bg-canvas">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-4 text-[12px] text-ink-muted sm:flex-row sm:items-center sm:justify-between">
          <p>GRIEVANCE, built for HackFusion 4. Demo deployment with synthetic data.</p>
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
  const link =
    "inline-flex min-h-11 items-center rounded-sm font-medium text-navy underline-offset-[3px] transition-colors duration-150 hover:text-brand-700 hover:underline focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-navy sm:min-h-0 sm:py-1";
  return (
    <footer className="border-t border-stone bg-stone-light text-ink-soft">
      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
        <div className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between md:gap-12">
          <div className="max-w-md">
            <Link
              to="/"
              aria-label="GRIEVANCE home"
              className="inline-flex items-center gap-2 rounded-sm focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-navy"
            >
              <img src="/brand/grievance-emblem.webp" alt="" width={30} height={28} style={{ height: 28, width: "auto" }} />
              <img src="/brand/grievance-wordmark.webp" alt="GRIEVANCE" width={99} height={15} style={{ height: 15, width: "auto" }} />
            </Link>
            <p className="mt-3 text-[14px] leading-relaxed">
              An agentic grievance redressal system built for HackFusion 4.0. Not affiliated with any government body.
            </p>
          </div>
          <nav aria-label="Footer">
            <ul className="grid grid-cols-2 gap-x-8 text-[14px] sm:flex sm:flex-wrap sm:gap-x-6 sm:gap-y-2">
              <li><Link to="/" state={{ section: "about" }} className={link}>About</Link></li>
              <li><Link to="/help" className={link}>Help</Link></li>
              <li>
                {SUPPORT_EMAIL ? (
                  <a href={`mailto:${SUPPORT_EMAIL}`} className={link}>Contact</a>
                ) : (
                  <Link to="/help#contact" className={link}>Contact</Link>
                )}
              </li>
              <li><Link to="/privacy" className={link}>Privacy</Link></li>
              <li><Link to="/terms" className={link}>Terms</Link></li>
              <li>
                <button
                  type="button"
                  onClick={() => window.dispatchEvent(new Event("grievance:open-consent"))}
                  className={link}
                >
                  Storage preferences
                </button>
              </li>
            </ul>
          </nav>
        </div>
        <p className="mt-8 border-t border-stone-dark/60 pt-5 text-[12px] text-ink-muted">Draft legal pages pending review by the operating authority.</p>
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
