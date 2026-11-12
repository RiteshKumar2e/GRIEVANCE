import { useEffect, useRef, type KeyboardEvent } from "react";
import { LEGAL_PROSE, PrivacyContent, TermsContent } from "../pages/public/Legal";
import { IconClose } from "./icons";

export type LegalDoc = "terms" | "privacy";
const TITLE: Record<LegalDoc, string> = { terms: "Terms & conditions", privacy: "Privacy policy" };

/**
 * Terms or privacy policy in a dialog, so reading them never navigates away from a half-filled form.
 * Escape, the close button or the backdrop closes it; focus stays inside while open and returns afterwards.
 */
export function LegalDialog({ doc, onClose, onAgree }: { doc: LegalDoc | null; onClose: () => void; onAgree?: () => void }) {
  const panel = useRef<HTMLDivElement>(null);
  const closeBtn = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!doc) return;
    const returnTo = document.activeElement as HTMLElement | null;
    closeBtn.current?.focus();
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
      returnTo?.focus?.();
    };
  }, [doc]);

  if (!doc) return null;

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Escape") {
      e.stopPropagation();
      onClose();
      return;
    }
    if (e.key !== "Tab" || !panel.current) return;
    // Keep keyboard focus inside the dialog.
    const items = panel.current.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])');
    if (!items.length) return;
    const first = items[0];
    const last = items[items.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-navy/50 sm:items-center sm:p-6" onMouseDown={onClose}>
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby="legal-title"
        onMouseDown={(e) => e.stopPropagation()}
        onKeyDown={onKeyDown}
        className="flex max-h-[92vh] w-full max-w-2xl flex-col rounded-t-lg bg-surface shadow-overlay sm:max-h-[85vh] sm:rounded-lg"
      >
        <header className="flex items-start justify-between gap-4 border-b border-line px-5 py-4 sm:px-6">
          <div>
            <h2 id="legal-title" className="text-lg font-semibold text-ink">{TITLE[doc]}</h2>
            <p className="text-[13px] text-ink-muted">Last updated 11 November 2026</p>
          </div>
          <button
            ref={closeBtn}
            type="button"
            onClick={onClose}
            aria-label={`Close ${TITLE[doc].toLowerCase()}`}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md text-ink-muted hover:bg-canvas hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-500"
          >
            <IconClose width={20} height={20} />
          </button>
        </header>
        <div className="flex-1 overflow-y-auto px-5 py-5 sm:px-6" tabIndex={0} aria-label={`${TITLE[doc]} text`}>
          <div className={LEGAL_PROSE}>{doc === "terms" ? <TermsContent /> : <PrivacyContent />}</div>
        </div>
        <footer className="flex flex-wrap justify-end gap-2 border-t border-line px-5 py-3 sm:px-6">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-10 items-center rounded-md border border-stone-dark bg-surface px-4 text-sm font-semibold text-ink hover:bg-canvas focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-500"
          >
            Close
          </button>
          {onAgree && (
            <button
              type="button"
              onClick={() => {
                onAgree();
                onClose();
              }}
              className="inline-flex h-10 items-center rounded-md bg-navy px-4 text-sm font-semibold text-white hover:bg-navy-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-navy"
            >
              I agree
            </button>
          )}
        </footer>
      </div>
    </div>
  );
}
