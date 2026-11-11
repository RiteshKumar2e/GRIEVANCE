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
  return (
    <footer className="bg-navy text-[#C9D1DB]">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-14 sm:px-6 md:grid-cols-[1.4fr_1fr_1fr_1fr]">
        <div>
          <Link to="/" aria-label="GRIEVANCE home" className="inline-block rounded-md bg-canvas px-3 py-2">
            <img src="/brand/grievance-logo.webp" alt="GRIEVANCE. Speak, Track, Resolve." width={220} height={60} style={{ width: 220, height: "auto" }} />
          </Link>
          <p className="mt-3 max-w-xs text-[14px] leading-relaxed">
            An agentic grievance redressal system built for HackFusion 4.0 (Agentic AI track). This deployment uses synthetic demo data and is not affiliated with any
            government body.
          </p>
        </div>
        <nav aria-label="Product">
          <p className="text-[12px] font-bold uppercase tracking-[0.1em] text-white">Product</p>
          <ul className="mt-3 space-y-2 text-[14px]">
            <li><a href="/#how" className="hover:text-white hover:underline">How it works</a></li>
            <li><a href="/#features" className="hover:text-white hover:underline">Features</a></li>
            <li><a href="/#about" className="hover:text-white hover:underline">About</a></li>
          </ul>
        </nav>
        <nav aria-label="Support">
          <p className="text-[12px] font-bold uppercase tracking-[0.1em] text-white">Support</p>
          <ul className="mt-3 space-y-2 text-[14px]">
            <li><Link to="/help" className="hover:text-white hover:underline">Help and support</Link></li>
            <li>
              {SUPPORT_EMAIL ? (
                <a href={`mailto:${SUPPORT_EMAIL}`} className="hover:text-white hover:underline">Contact: {SUPPORT_EMAIL}</a>
              ) : (
                <Link to="/help#contact" className="hover:text-white hover:underline">Contact</Link>
              )}
            </li>
          </ul>
        </nav>
        <nav aria-label="Legal">
          <p className="text-[12px] font-bold uppercase tracking-[0.1em] text-white">Legal</p>
          <ul className="mt-3 space-y-2 text-[14px]">
            <li><Link to="/privacy" className="hover:text-white hover:underline">Privacy policy</Link></li>
            <li><Link to="/terms" className="hover:text-white hover:underline">Terms and conditions</Link></li>
            <li className="[&_button:hover]:text-white">{storage}</li>
          </ul>
        </nav>
      </div>
      <div className="border-t border-white/10">
        <p className="mx-auto max-w-6xl px-4 py-5 text-[12px] sm:px-6">Draft legal pages pending review by the operating authority.</p>
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
