import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { Logo } from "../../components/AppShell";
import { SiteFooter } from "../../components/SiteChrome";
import { SUPPORT_EMAIL } from "../../lib/meta";

function LegalLayout({ title, updated, children }: { title: string; updated: string; children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-white">
      <header className="border-b border-line">
        <div className="mx-auto flex h-16 max-w-3xl items-center justify-between px-4">
          <Logo />
          <Link to="/" className="text-sm font-medium text-brand-700 hover:underline">Home</Link>
        </div>
      </header>
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-10">
        <h1 className="font-display text-3xl font-semibold text-ink">{title}</h1>
        <p className="mt-1 text-sm text-ink-muted">Last updated {updated}</p>
        <div className="mt-4 rounded-md border border-saffron-100 bg-saffron-50 p-3 text-sm text-saffron-700">
          This is a hackathon demonstration deployment that runs on SYNTHETIC data. This text describes how the software handles data;
          it is not legal advice and must be reviewed by the operating authority before any real-world use.
        </div>
        <div className="mt-8 space-y-6 text-[15px] leading-relaxed text-ink-soft [&_h2]:mb-2 [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:text-ink [&_li]:ml-5 [&_li]:list-disc">
          {children}
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}

const contact = SUPPORT_EMAIL ? (
  <a className="font-medium text-brand-700 hover:underline" href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>
) : (
  "the grievance cell of the operating authority"
);

export function PrivacyPolicy() {
  return (
    <LegalLayout title="Privacy policy" updated="11 November 2026">
      <section>
        <h2>What we collect</h2>
        <ul>
          <li>Account details you provide: name, e-mail, optional mobile number and preferred language.</li>
          <li>Grievance details: your description (typed or transcribed), location or ward, and the status history.</li>
          <li>Voice recordings are transcribed on the server and deleted immediately; audio is never stored.</li>
          <li>With your consent only: anonymous page-visit counts (the page pattern and date — no IDs, IP address or device data).</li>
        </ul>
      </section>
      <section>
        <h2>How it is used</h2>
        <ul>
          <li>To register, route, resolve and track your grievance and to notify you of progress.</li>
          <li>AI assistants classify complaints and suggest routing. Their output is advisory: sensitive or uncertain cases are always decided by a human officer, and no grievance is rejected automatically.</li>
          <li>If an external language model is enabled (Groq or Google Gemini), your complaint text is sent to that provider solely to extract structured fields. Identifying details such as phone numbers are not added by the system.</li>
        </ul>
      </section>
      <section>
        <h2>Who can see it</h2>
        <ul>
          <li>Only officers of the responsible department and administrators. Officers see a masked name and phone number.</li>
          <li>For sensitive categories (for example harassment or corruption), your identity is hidden from officers entirely and only authorised officers can open the case.</li>
          <li>Shared diagnostic links for system traces never contain complaint text or identities.</li>
        </ul>
      </section>
      <section>
        <h2>Storage and security</h2>
        <ul>
          <li>No cookies are used. Your sign-in token is kept in session storage and cleared when you close the browser tab; your language choice is kept in local storage.</li>
          <li>Passwords are stored as salted bcrypt hashes. Every action on a grievance is recorded in an audit log; personal data in logs and traces is redacted.</li>
        </ul>
      </section>
      <section>
        <h2>Your choices</h2>
        <p>You can change analytics consent at any time from “Storage preferences” in the footer. For access, correction or deletion of your data, contact {contact}.</p>
      </section>
    </LegalLayout>
  );
}

export function Terms() {
  return (
    <LegalLayout title="Terms & conditions" updated="11 November 2026">
      <section>
        <h2>Using the service</h2>
        <ul>
          <li>File genuine grievances about public services. Do not submit false, abusive or deliberately duplicate complaints.</li>
          <li>Review the details the assistant extracts and confirm them before submitting; you are responsible for the accuracy of what you confirm.</li>
          <li>Automated limits apply to sign-ups and submissions to prevent abuse.</li>
        </ul>
      </section>
      <section>
        <h2>What the system does and does not do</h2>
        <ul>
          <li>AI assistance is advisory. It does not reject grievances, decide legal liability or close sensitive cases; officers make those decisions.</li>
          <li>Service-level targets and predicted resolution times are estimates, not guarantees. In this demonstration they are based on synthetic data.</li>
          <li>Similar past cases shown to officers are supporting references only.</li>
        </ul>
      </section>
      <section>
        <h2>Disputes</h2>
        <p>If a resolution does not fix your problem you can dispute it from the tracking page within 30 days of closure; the grievance is reopened and repeated disputes are escalated.</p>
      </section>
      <section>
        <h2>Contact</h2>
        <p>Questions about these terms: {contact}.</p>
      </section>
    </LegalLayout>
  );
}
