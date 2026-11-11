import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { getConsent, setConsent, trackPageView } from "../lib/consent";
import { SUPPORT_EMAIL } from "../lib/meta";

export function SiteFooter({ compact = false }: { compact?: boolean }) {
  return (
    <footer className="border-t border-line bg-canvas">
      <div className={`mx-auto flex max-w-7xl flex-col gap-3 px-4 text-xs text-ink-muted sm:flex-row sm:items-center sm:justify-between ${compact ? "py-4" : "py-6"}`}>
        <p>GRIEVANCE · built for HackFusion 4 · demo deployment with SYNTHETIC data</p>
        <nav aria-label="Legal" className="flex flex-wrap gap-x-4 gap-y-1">
          <Link to="/privacy" className="hover:text-ink hover:underline">Privacy policy</Link>
          <Link to="/terms" className="hover:text-ink hover:underline">Terms &amp; conditions</Link>
          <button type="button" onClick={() => window.dispatchEvent(new Event("grievance:open-consent"))} className="hover:text-ink hover:underline">
            Storage preferences
          </button>
          {SUPPORT_EMAIL && (
            <a href={`mailto:${SUPPORT_EMAIL}`} className="hover:text-ink hover:underline">
              {SUPPORT_EMAIL}
            </a>
          )}
        </nav>
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
