import { Link } from "react-router-dom";
import { Logo } from "../../components/AppShell";
import { SiteFooter } from "../../components/SiteChrome";
import { SUPPORT_EMAIL } from "../../lib/meta";

const FAQ: [string, string][] = [
  [
    "How do I file a grievance?",
    "Create a citizen account, choose File a grievance and describe the problem in Marathi, Hindi or English. The assistant may ask where it is or since when. It then prepares a draft that you check and confirm. Nothing is filed until you confirm.",
  ],
  [
    "Can I speak instead of typing?",
    "Yes, if voice input is enabled on this server. Press Speak, talk, then press Stop. The transcript appears in the message box so you can correct it before sending. Recordings are deleted after transcription.",
  ],
  [
    "How do I track my grievance?",
    "Sign in and open My grievances. Each grievance shows its ID, current status, expected resolution date and the full history of who changed what and when. You also get a notification at every step.",
  ],
  [
    "What if the problem is not actually fixed?",
    "When an officer marks your grievance resolved, you can confirm it or dispute it. A dispute reopens the grievance and notifies the officer. A second dispute escalates it to senior officers. You can dispute up to 30 days after closure.",
  ],
  [
    "Someone else reported the same problem. Will my complaint be dropped?",
    "No. Related reports are linked so officers handle them together, but your grievance keeps its own ID, status and updates.",
  ],
  [
    "Who sees my name and phone number?",
    "Only the officer handling your grievance sees a masked version. For sensitive matters such as harassment or corruption, your identity is hidden from officers entirely and only authorised officers can open the case.",
  ],
  [
    "Does the AI decide my case?",
    "No. The assistant suggests a category and summary; rule-based checks decide routing; and sensitive or uncertain cases always go to a human officer. The system never rejects a grievance and never closes a sensitive one on its own.",
  ],
];

export default function Help() {
  return (
    <div className="flex min-h-screen flex-col bg-canvas">
      <header className="border-b border-stone">
        <div className="mx-auto flex h-16 max-w-3xl items-center justify-between px-4">
          <Logo />
          <Link to="/" className="text-sm font-semibold text-brand-700 hover:underline">Home</Link>
        </div>
      </header>
      <main id="main" className="mx-auto w-full max-w-3xl flex-1 px-4 py-12">
        <h1 className="text-[32px] font-extrabold tracking-[-0.01em] text-navy">Help and support</h1>
        <p className="mt-3 max-w-prose text-[16px] text-ink-soft">Answers to common questions about filing and tracking grievances.</p>
        <div className="mt-10 divide-y divide-stone border-y border-stone">
          {FAQ.map(([q, a]) => (
            <details key={q} className="group py-5">
              <summary className="cursor-pointer list-none text-[17px] font-bold text-navy marker:hidden">
                <span className="flex items-start justify-between gap-4">
                  {q}
                  <span className="mt-1 text-ink-muted transition-transform group-open:rotate-45 motion-reduce:transition-none" aria-hidden>+</span>
                </span>
              </summary>
              <p className="mt-3 max-w-prose text-[15px] leading-relaxed text-ink-soft">{a}</p>
            </details>
          ))}
        </div>
        <section id="contact" className="mt-12 scroll-mt-20">
          <h2 className="text-[20px] font-bold text-navy">Contact</h2>
          {SUPPORT_EMAIL ? (
            <p className="mt-2 text-[15px] text-ink-soft">
              Write to <a className="font-semibold text-brand-700 hover:underline" href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>. For a specific grievance,
              include its ID.
            </p>
          ) : (
            <p className="mt-2 text-[15px] text-ink-soft">
              Draft: a support contact has not been configured for this demonstration deployment. The operating authority should publish its grievance cell address
              here (set VITE_SUPPORT_EMAIL).
            </p>
          )}
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
