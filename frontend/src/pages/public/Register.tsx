import { useQuery } from "@tanstack/react-query";
import clsx from "clsx";
import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { Link, useNavigate } from "react-router-dom";
import { FullLogo } from "../../components/AppShell";
import { LegalDialog, type LegalDoc } from "../../components/LegalDialog";
import { PasswordInput } from "../../components/PasswordInput";
import { useToast } from "../../components/Toast";
import { Alert, Button, Input, Select } from "../../components/ui";
import { api, ApiError } from "../../lib/api";
import { useAuth, type PendingRequest } from "../../lib/auth";
import { LANG_LABEL, useI18n } from "../../lib/i18n";
import type { Lang } from "../../lib/types";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^\+?[0-9\- ]{7,20}$/;

type SignupRole = "citizen" | "officer";
const ROLE_OPTIONS: { value: SignupRole; label: string; body: string }[] = [
  { value: "citizen", label: "Citizen", body: "Report civic problems and track them. Your account is ready immediately." },
  { value: "officer", label: "Grievance Officer", body: "Handle grievances for your department. Needs approval by a system administrator." },
];

const LEGAL_LINK =
  "rounded-sm font-medium text-brand-700 underline underline-offset-2 hover:text-brand-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-500";

const STEPS = ["About you", "Your needs", "Password"] as const;
const STEP_FIELDS: string[][] = [["full_name", "email", "phone"], ["department_code"], ["password", "confirm", "agree"]];

/* ------------------------------------------------------------------ small pieces */

function Ico({ children }: { children: ReactNode }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden focusable="false">
      {children}
    </svg>
  );
}
const ICON = {
  user: <Ico><circle cx="12" cy="8" r="3.5" /><path d="M5 20c.8-3.8 3.6-6 7-6s6.2 2.2 7 6" /></Ico>,
  mail: <Ico><rect x="3.5" y="5.5" width="17" height="13" rx="1.5" /><path d="M4 7l8 6 8-6" /></Ico>,
  phone: <Ico><path d="M6.5 3.5h3l1.5 4-2 1.5a11 11 0 0 0 6 6l1.5-2 4 1.5v3A2 2 0 0 1 18.5 20 15 15 0 0 1 4 5.5a2 2 0 0 1 2.5-2z" /></Ico>,
  role: <Ico><rect x="4" y="7" width="16" height="12" rx="1.5" /><path d="M9 7V5.5A1.5 1.5 0 0 1 10.5 4h3A1.5 1.5 0 0 1 15 5.5V7" /></Ico>,
  building: <Ico><path d="M4 20h16M6 20V8l6-4 6 4v12" /><path d="M10 20v-4h4v4" /></Ico>,
  badge: <Ico><rect x="5" y="3.5" width="14" height="17" rx="2" /><circle cx="12" cy="10" r="2.5" /><path d="M8.5 16.5c.6-1.6 1.9-2.5 3.5-2.5s2.9.9 3.5 2.5" /></Ico>,
  globe: <Ico><circle cx="12" cy="12" r="8.5" /><path d="M3.5 12h17M12 3.5c2.4 2.4 3.5 5.3 3.5 8.5s-1.1 6.1-3.5 8.5c-2.4-2.4-3.5-5.3-3.5-8.5S9.6 5.9 12 3.5z" /></Ico>,
  lock: <Ico><rect x="5" y="10.5" width="14" height="10" rx="1.5" /><path d="M8 10.5V8a4 4 0 0 1 8 0v2.5" /></Ico>,
  arrow: <Ico><path d="M5 12h13M13 6.5l5.5 5.5-5.5 5.5" /></Ico>,
  back: <Ico><path d="M19 12H6M11 6.5L5.5 12l5.5 5.5" /></Ico>,
};

function IconField({ label, icon, htmlFor, error, hint, children }: { label: string; icon: ReactNode; htmlFor: string; error?: string; hint?: string; children: ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={htmlFor} className="flex items-center gap-2 text-sm font-semibold text-ink">
        <span className="text-ink-muted">{icon}</span>
        {label}
      </label>
      {children}
      {hint && !error && <p className="text-[13px] text-ink-muted">{hint}</p>}
      {error && (
        <p className="text-[13px] font-medium text-status-critical" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

function Stepper({ step }: { step: number }) {
  return (
    <div className="mb-6">
      <div className="h-1.5 overflow-hidden rounded-full bg-amber-soft" aria-hidden>
        <div className="h-full rounded-full bg-navy transition-[width] duration-200 motion-reduce:transition-none" style={{ width: `${((step + 1) / STEPS.length) * 100}%` }} />
      </div>
      <ol className="mt-3 grid grid-cols-3 gap-2" aria-label="Registration steps">
        {STEPS.map((label, i) => {
          const state = i < step ? "done" : i === step ? "current" : "todo";
          return (
            <li key={label} aria-current={state === "current" ? "step" : undefined} className="flex min-w-0 items-center gap-2">
              <span
                className={clsx(
                  "flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-[12px] font-semibold",
                  state === "current" && "border-navy text-navy ring-2 ring-navy/15",
                  state === "done" && "border-brand-700 bg-brand-700 text-white",
                  state === "todo" && "border-stone-dark text-ink-muted",
                )}
                aria-hidden
              >
                {state === "done" ? "✓" : i + 1}
              </span>
              <span className={clsx("truncate text-[13px] sm:text-sm", state === "current" ? "font-semibold text-ink" : "text-ink-muted")}>
                {label}
                <span className="sr-only">{state === "done" ? " (completed)" : state === "current" ? " (current step)" : ""}</span>
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

/* ------------------------------------------------------------------ page */

export default function Register() {
  const { register } = useAuth();
  const toast = useToast();
  const { lang, setLang } = useI18n();
  const nav = useNavigate();
  const [step, setStep] = useState(0);
  const [form, setForm] = useState({
    full_name: "", email: "", phone: "", password: "", confirm: "", preferred_language: lang as Lang, website: "",
    role: "citizen" as SignupRole, department_code: "", designation: "",
  });
  const [agree, setAgree] = useState(false);
  const [legal, setLegal] = useState<LegalDoc | null>(null);
  const [pending, setPending] = useState<PendingRequest | null>(null);
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [error, setError] = useState<string | null>(null);
  const [serverErrors, setServerErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const heading = useRef<HTMLHeadingElement>(null);
  const first = useRef(true);
  const staff = form.role !== "citizen";
  const depts = useQuery({ queryKey: ["meta", "departments"], queryFn: () => api<{ code: string; name: string }[]>("/meta/departments", { auth: false }), enabled: staff });

  // Move focus to the step heading when the step changes, so keyboard and screen-reader users start at the top.
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    heading.current?.focus();
  }, [step]);

  const set = (k: keyof typeof form) => (e: { target: { value: string } }) => {
    setForm((f) => ({ ...f, [k]: e.target.value }));
    setServerErrors((s) => ({ ...s, [k]: "" }));
  };
  const blur = (k: string) => () => setTouched((t) => ({ ...t, [k]: true }));

  const rules = [
    { ok: form.password.length >= 8, label: "At least 8 characters" },
    { ok: /[a-z]/i.test(form.password), label: "A letter" },
    { ok: /\d/.test(form.password), label: "A number" },
  ];
  const errors: Record<string, string | undefined> = {
    full_name: form.full_name.trim().length < 2 ? "Enter your full name." : undefined,
    email: !EMAIL_RE.test(form.email.trim()) ? "Enter a valid e-mail address." : undefined,
    phone: form.phone.trim() && !PHONE_RE.test(form.phone.trim()) ? "Use digits only, for example +91 98765 43210." : undefined,
    department_code: staff && !form.department_code ? "Choose the department you work in." : undefined,
    password: rules.every((r) => r.ok) ? undefined : "Password does not meet the requirements.",
    confirm: form.confirm !== form.password ? "Passwords do not match." : undefined,
    agree: agree ? undefined : "Please accept the terms and privacy policy to continue.",
  };
  const show = (k: string) => (touched[k] ? errors[k] : undefined) || serverErrors[k] || undefined;

  const stepValid = (i: number) => STEP_FIELDS[i].every((k) => !errors[k]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setTouched((t) => ({ ...t, ...Object.fromEntries(STEP_FIELDS[step].map((k) => [k, true])) }));
    if (!stepValid(step)) return;
    if (step < STEPS.length - 1) {
      setError(null);
      setStep(step + 1);
      return;
    }
    setError(null);
    setServerErrors({});
    setBusy(true);
    try {
      const res = await register({
        full_name: form.full_name.trim(),
        email: form.email.trim(),
        phone: form.phone.trim() || undefined,
        password: form.password,
        preferred_language: form.preferred_language,
        role: form.role,
        department_code: staff ? form.department_code : undefined,
        designation: form.role === "officer" ? form.designation.trim() || undefined : undefined,
        website: form.website, // honeypot, must stay empty
      } as Parameters<typeof register>[0]);
      setLang(form.preferred_language);
      if ("pending" in res) {
        setPending(res);
        return;
      }
      toast.success("Account created. You can now file your first grievance.");
      nav("/citizen/new", { replace: true });
    } catch (err) {
      const fieldErrors = err instanceof ApiError && err.fields ? Object.fromEntries(err.fields.map((f) => [f.field, f.message])) : {};
      if (err instanceof ApiError && err.status === 409) fieldErrors.email = err.message;
      setServerErrors(fieldErrors);
      // Send the user back to the step that holds the problem.
      const target = STEP_FIELDS.findIndex((fields) => fields.some((k) => fieldErrors[k]));
      if (target >= 0 && target !== step) setStep(target);
      setError(err instanceof Error ? err.message : "Registration failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-canvas">
      <main className="flex flex-1 items-center justify-center px-4 py-10">
        <div className="w-full max-w-md">
          <div className="mb-6 flex justify-center">
            <Link to="/" aria-label="GRIEVANCE home">
              <FullLogo width={280} />
            </Link>
          </div>
          <div className="rounded-lg border border-line bg-surface p-6 sm:p-8">
            {pending ? (
              <div role="status">
                <h1 className="text-xl font-semibold text-ink">Request sent</h1>
                <p className="mt-2 text-sm leading-relaxed text-ink-soft">
                  Your request for <strong>{ROLE_OPTIONS.find((r) => r.value === pending.role)?.label}</strong> access to <strong>{pending.department}</strong> has been sent. A
                  system administrator must approve it. You can sign in once it is approved.
                </p>
                <Link to="/login" className="mt-5 inline-flex h-11 items-center rounded-md bg-navy px-5 text-sm font-semibold text-white hover:bg-navy-800">
                  Go to sign in
                </Link>
              </div>
            ) : (
              <>
                <h1 className="text-xl font-semibold text-ink">Create an account</h1>
                <p className="mt-1 mb-6 text-sm text-ink-muted">Your contact details are shared only with the officer handling your grievance, and are hidden for sensitive matters.</p>
                <Stepper step={step} />

                <form onSubmit={submit} noValidate className="space-y-5">
                  <h2 ref={heading} tabIndex={-1} className="sr-only focus:outline-none">
                    Step {step + 1} of {STEPS.length}: {STEPS[step]}
                  </h2>
                  {error && <Alert tone="critical">{error}</Alert>}
                  {/* Honeypot: invisible to people, tempting to bots. */}
                  <div aria-hidden="true" className="absolute left-[-10000px] top-auto h-px w-px overflow-hidden">
                    <label htmlFor="website">Website</label>
                    <input id="website" name="website" tabIndex={-1} autoComplete="off" value={form.website} onChange={set("website")} />
                  </div>

                  {step === 0 && (
                    <>
                      <IconField label="Full name" icon={ICON.user} htmlFor="name" error={show("full_name")}>
                        <Input id="name" name="name" autoComplete="name" placeholder="Enter your full name" value={form.full_name} onChange={set("full_name")} onBlur={blur("full_name")} aria-invalid={!!show("full_name")} className="h-11" autoFocus />
                      </IconField>
                      <IconField label="E-mail address" icon={ICON.mail} htmlFor="email" error={show("email")}>
                        <Input id="email" name="email" type="email" inputMode="email" autoComplete="username" placeholder="your.email@example.com" value={form.email} onChange={set("email")} onBlur={blur("email")} aria-invalid={!!show("email")} className="h-11" />
                      </IconField>
                      <IconField label="Mobile number (optional)" icon={ICON.phone} htmlFor="phone" error={show("phone")}>
                        <Input id="phone" name="tel" type="tel" inputMode="tel" autoComplete="tel" placeholder="10-digit mobile number" value={form.phone} onChange={set("phone")} onBlur={blur("phone")} aria-invalid={!!show("phone")} className="h-11" />
                      </IconField>
                    </>
                  )}

                  {step === 1 && (
                    <>
                      <fieldset className="space-y-2">
                        <legend className="mb-1.5 flex items-center gap-2 text-sm font-semibold text-ink">
                          <span className="text-ink-muted">{ICON.role}</span>I am registering as
                        </legend>
                        {ROLE_OPTIONS.map((r) => (
                          <label
                            key={r.value}
                            className={clsx(
                              "flex cursor-pointer gap-3 rounded-md border px-3.5 py-3 transition-colors duration-150 motion-reduce:transition-none",
                              form.role === r.value ? "border-navy bg-navy/[0.04]" : "border-stone-dark hover:bg-canvas",
                            )}
                          >
                            <input type="radio" name="role" value={r.value} checked={form.role === r.value} onChange={() => setForm((f) => ({ ...f, role: r.value }))} className="mt-1 h-4 w-4 accent-navy" />
                            <span>
                              <span className="block text-sm font-semibold text-ink">{r.label}</span>
                              <span className="block text-[13px] text-ink-muted">{r.body}</span>
                            </span>
                          </label>
                        ))}
                      </fieldset>
                      {staff && (
                        <>
                          <IconField label="Department" icon={ICON.building} htmlFor="dept" error={show("department_code")}>
                            <Select id="dept" value={form.department_code} onChange={set("department_code")} onBlur={blur("department_code")} aria-invalid={!!show("department_code")} className="h-11">
                              <option value="">{depts.isLoading ? "Loading departments…" : "Choose your department"}</option>
                              {depts.data?.map((d) => <option key={d.code} value={d.code}>{d.name}</option>)}
                            </Select>
                          </IconField>
                          {form.role === "officer" && (
                            <IconField label="Designation (optional)" icon={ICON.badge} htmlFor="desig" hint="For example: Junior Engineer.">
                              <Input id="desig" value={form.designation} onChange={set("designation")} maxLength={120} className="h-11" />
                            </IconField>
                          )}
                        </>
                      )}
                      <IconField label="Preferred language" icon={ICON.globe} htmlFor="lang" hint="Used for screens and messages that are translated.">
                        <Select id="lang" value={form.preferred_language} onChange={set("preferred_language")} className="h-11">
                          {(Object.keys(LANG_LABEL) as Lang[]).map((l) => (
                            <option key={l} value={l} lang={l}>{LANG_LABEL[l]}</option>
                          ))}
                        </Select>
                      </IconField>
                    </>
                  )}

                  {step === 2 && (
                    <>
                      {/* Lets the browser's password manager pair the new password with this e-mail. */}
                      <input type="email" name="email" autoComplete="username" value={form.email} readOnly hidden />
                      <IconField label="Password" icon={ICON.lock} htmlFor="pw" error={touched.password ? show("password") : serverErrors.password || undefined}>
                        <PasswordInput id="pw" name="new-password" autoComplete="new-password" value={form.password} onChange={set("password")} onBlur={blur("password")} aria-invalid={!!show("password")} aria-describedby="pw-rules" className="h-11" autoFocus />
                        <ul id="pw-rules" className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs">
                          {rules.map((r) => (
                            <li key={r.label} className={r.ok ? "flex items-center gap-1.5 text-status-good" : "flex items-center gap-1.5 text-ink-muted"}>
                              <span className={r.ok ? "h-1.5 w-1.5 rounded-full bg-status-good" : "h-1.5 w-1.5 rounded-full border border-ink-muted"} aria-hidden />
                              {r.label}
                              <span className="sr-only">{r.ok ? "(met)" : "(not yet met)"}</span>
                            </li>
                          ))}
                        </ul>
                      </IconField>
                      <IconField label="Confirm password" icon={ICON.lock} htmlFor="pw2" error={show("confirm")}>
                        <PasswordInput id="pw2" name="confirm-password" autoComplete="new-password" value={form.confirm} onChange={set("confirm")} onBlur={blur("confirm")} aria-invalid={!!show("confirm")} className="h-11" />
                      </IconField>
                      <div>
                        <label className="flex items-start gap-2.5 text-sm text-ink-soft">
                          <input type="checkbox" className="mt-0.5 h-4 w-4 accent-navy" checked={agree} onChange={(e) => { setAgree(e.target.checked); setTouched((t) => ({ ...t, agree: true })); }} aria-invalid={!!show("agree")} />
                          <span>
                            I agree to the{" "}
                            <button type="button" onClick={() => setLegal("terms")} className={LEGAL_LINK}>terms</button> and{" "}
                            <button type="button" onClick={() => setLegal("privacy")} className={LEGAL_LINK}>privacy policy</button>.
                          </span>
                        </label>
                        {show("agree") && <p className="mt-1 text-[13px] font-medium text-status-critical" role="alert">{show("agree")}</p>}
                      </div>
                    </>
                  )}

                  <div className="flex gap-3 pt-1">
                    {step > 0 && (
                      <Button type="button" variant="secondary" className="h-12 px-5" onClick={() => { setError(null); setStep(step - 1); }}>
                        {ICON.back} Back
                      </Button>
                    )}
                    <button
                      type="submit"
                      disabled={busy}
                      aria-busy={busy || undefined}
                      className="inline-flex h-12 flex-1 items-center justify-center gap-2 rounded-md bg-navy-700 px-5 text-[15px] font-semibold text-white transition-colors duration-150 hover:bg-navy-800 active:bg-navy focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-navy disabled:cursor-not-allowed disabled:opacity-60 motion-reduce:transition-none"
                    >
                      {step < STEPS.length - 1 ? <>Continue {ICON.arrow}</> : busy ? "Creating…" : staff ? "Send access request" : "Create account"}
                    </button>
                  </div>
                </form>

                <p className="mt-6 border-t border-line pt-5 text-center text-sm text-ink-muted">
                  Already have an account?{" "}
                  <Link to="/login" className="font-semibold text-navy hover:underline">
                    Login
                  </Link>
                </p>
              </>
            )}
          </div>
        </div>
      </main>
      <LegalDialog
        doc={legal}
        onClose={() => setLegal(null)}
        onAgree={() => {
          setAgree(true);
          setTouched((t) => ({ ...t, agree: true }));
        }}
      />
    </div>
  );
}
