import { useQuery } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { FullLogo } from "../../components/AppShell";
import { PasswordInput } from "../../components/PasswordInput";
import { SiteFooter } from "../../components/SiteChrome";
import { useToast } from "../../components/Toast";
import { Alert, Button, Field, Input, Select } from "../../components/ui";
import { api, ApiError } from "../../lib/api";
import { useAuth, type PendingRequest } from "../../lib/auth";
import { LANG_LABEL, useI18n } from "../../lib/i18n";
import type { Lang } from "../../lib/types";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type SignupRole = "citizen" | "officer" | "dept_admin";
const ROLE_OPTIONS: { value: SignupRole; label: string; body: string }[] = [
  { value: "citizen", label: "Citizen", body: "Report civic problems and track them. Your account is ready immediately." },
  { value: "officer", label: "Grievance Officer", body: "Handle grievances for your department. A system administrator must approve your request." },
  { value: "dept_admin", label: "Department Admin", body: "Manage your department's officers and cases. A system administrator must approve your request." },
];
const PHONE_RE = /^\+?[0-9\- ]{7,20}$/;

export default function Register() {
  const { register } = useAuth();
  const toast = useToast();
  const { lang, setLang } = useI18n();
  const nav = useNavigate();
  const [form, setForm] = useState({ full_name: "", email: "", phone: "", password: "", confirm: "", preferred_language: lang as Lang, website: "", role: "citizen" as SignupRole, department_code: "", designation: "" });
  const [pending, setPending] = useState<PendingRequest | null>(null);
  const staff = form.role !== "citizen";
  const depts = useQuery({ queryKey: ["meta", "departments"], queryFn: () => api<{ code: string; name: string }[]>("/meta/departments", { auth: false }), enabled: staff });
  const [agree, setAgree] = useState(false);
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [error, setError] = useState<string | null>(null);
  const [serverErrors, setServerErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof form) => (e: { target: { value: string } }) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const blur = (k: string) => () => setTouched((t) => ({ ...t, [k]: true }));

  const rules = [
    { ok: form.password.length >= 8, label: "At least 8 characters" },
    { ok: /[a-z]/i.test(form.password), label: "A letter" },
    { ok: /\d/.test(form.password), label: "A number" },
  ];
  const errors: Record<string, string | undefined> = {
    full_name: form.full_name.trim().length < 2 ? "Enter your full name." : undefined,
    email: !EMAIL_RE.test(form.email.trim()) ? "Enter a valid e-mail address." : undefined,
    phone: form.phone.trim() && !PHONE_RE.test(form.phone.trim()) ? "Use digits only, e.g. +91 9876543210." : undefined,
    password: rules.every((r) => r.ok) ? undefined : "Password does not meet the requirements.",
    confirm: form.confirm !== form.password ? "Passwords do not match." : undefined,
    department_code: staff && !form.department_code ? "Choose the department you work in." : undefined,
  };
  const show = (k: string) => (touched[k] ? errors[k] : undefined) ?? serverErrors[k];

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setTouched({ full_name: true, email: true, phone: true, password: true, confirm: true, department_code: true });
    if (Object.values(errors).some(Boolean) || !agree) {
      if (!agree) setError("Please accept the terms and privacy policy to continue.");
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
      if (err instanceof ApiError && err.fields) setServerErrors(Object.fromEntries(err.fields.map((f) => [f.field, f.message])));
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
              <FullLogo width={300} />
            </Link>
          </div>
          <div className="rounded-lg border border-line bg-surface p-6 shadow-card">
            {pending ? (
              <div role="status">
                <h1 className="text-xl font-semibold text-ink">Request sent</h1>
                <p className="mt-2 text-sm text-ink-soft">
                  Your request for <strong>{ROLE_OPTIONS.find((r) => r.value === pending.role)?.label}</strong> access to <strong>{pending.department}</strong> has been sent.
                  A system administrator must approve it. You can sign in once it is approved.
                </p>
                <Link to="/login" className="mt-5 inline-flex h-10 items-center rounded-md bg-brand-700 px-4 text-sm font-semibold text-white hover:bg-brand-800">
                  Go to sign in
                </Link>
              </div>
            ) : (
            <>
            <h1 className="text-xl font-semibold text-ink">Create an account</h1>
            <p className="mt-1 text-sm text-ink-muted">Your contact details are shared only with the officer handling your grievance, and are hidden for sensitive matters.</p>
            <form onSubmit={submit} className="mt-6 space-y-4" noValidate>
              {error && <Alert tone="critical">{error}</Alert>}
              {/* Honeypot: invisible to people, tempting to bots. */}
              <div aria-hidden="true" className="absolute left-[-10000px] top-auto h-px w-px overflow-hidden">
                <label htmlFor="website">Website</label>
                <input id="website" name="website" tabIndex={-1} autoComplete="off" value={form.website} onChange={set("website")} />
              </div>
              <fieldset>
                <legend className="mb-1.5 block text-sm font-medium text-ink">I am registering as</legend>
                <div className="space-y-2">
                  {ROLE_OPTIONS.map((r) => (
                    <label key={r.value} className={`flex cursor-pointer gap-3 rounded-md border px-3 py-2.5 transition-colors duration-150 ${form.role === r.value ? "border-brand-600 bg-brand-50" : "border-stone-dark hover:bg-canvas"}`}>
                      <input type="radio" name="role" value={r.value} checked={form.role === r.value} onChange={() => setForm((f) => ({ ...f, role: r.value }))} className="mt-1 h-4 w-4 accent-brand-700" />
                      <span>
                        <span className="block text-sm font-semibold text-ink">{r.label}</span>
                        <span className="block text-[13px] text-ink-muted">{r.body}</span>
                      </span>
                    </label>
                  ))}
                </div>
              </fieldset>
              {staff && (
                <>
                  <Field label="Department" htmlFor="dept" error={show("department_code")}>
                    <Select id="dept" value={form.department_code} onChange={set("department_code")} onBlur={blur("department_code")} aria-invalid={!!show("department_code")}>
                      <option value="">Choose your department</option>
                      {depts.data?.map((d) => <option key={d.code} value={d.code}>{d.name}</option>)}
                    </Select>
                  </Field>
                  {form.role === "officer" && (
                    <Field label="Designation (optional)" htmlFor="desig" hint="For example: Junior Engineer.">
                      <Input id="desig" value={form.designation} onChange={set("designation")} maxLength={120} />
                    </Field>
                  )}
                </>
              )}
              <Field label="Full name" htmlFor="name" error={show("full_name")}>
                <Input id="name" autoComplete="name" value={form.full_name} onChange={set("full_name")} onBlur={blur("full_name")} aria-invalid={!!show("full_name")} required />
              </Field>
              <Field label="E-mail" htmlFor="email" error={show("email")}>
                <Input id="email" name="email" type="email" inputMode="email" autoComplete="username" value={form.email} onChange={set("email")} onBlur={blur("email")} aria-invalid={!!show("email")} required />
              </Field>
              <Field label="Mobile number (optional)" htmlFor="phone" error={show("phone")}>
                <Input id="phone" type="tel" inputMode="tel" autoComplete="tel" value={form.phone} onChange={set("phone")} onBlur={blur("phone")} aria-invalid={!!show("phone")} />
              </Field>
              <Field label="Password" htmlFor="pw" error={touched.password ? show("password") : serverErrors.password}>
                <PasswordInput id="pw" name="new-password" autoComplete="new-password" value={form.password} onChange={set("password")} onBlur={blur("password")} aria-invalid={!!show("password")} aria-describedby="pw-rules" required />
                <ul id="pw-rules" className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs">
                  {rules.map((r) => (
                    <li key={r.label} className={r.ok ? "flex items-center gap-1.5 text-status-good" : "flex items-center gap-1.5 text-ink-muted"}>
                      <span className={r.ok ? "h-1.5 w-1.5 rounded-full bg-status-good" : "h-1.5 w-1.5 rounded-full border border-ink-muted"} aria-hidden />
                      {r.label}
                      <span className="sr-only">{r.ok ? "(met)" : "(not yet met)"}</span>
                    </li>
                  ))}
                </ul>
              </Field>
              <Field label="Confirm password" htmlFor="pw2" error={show("confirm")}>
                <PasswordInput id="pw2" name="confirm-password" autoComplete="new-password" value={form.confirm} onChange={set("confirm")} onBlur={blur("confirm")} aria-invalid={!!show("confirm")} required />
              </Field>
              <Field label="Preferred language" htmlFor="lang">
                <Select id="lang" value={form.preferred_language} onChange={set("preferred_language")}>
                  {(Object.keys(LANG_LABEL) as Lang[]).map((l) => (
                    <option key={l} value={l}>
                      {LANG_LABEL[l]}
                    </option>
                  ))}
                </Select>
              </Field>
              <label className="flex items-start gap-2 text-sm text-ink-soft">
                <input type="checkbox" className="mt-0.5 h-4 w-4 accent-brand-800" checked={agree} onChange={(e) => setAgree(e.target.checked)} />
                <span>
                  I accept the{" "}
                  <Link to="/terms" className="font-medium text-brand-700 hover:underline">terms</Link> and{" "}
                  <Link to="/privacy" className="font-medium text-brand-700 hover:underline">privacy policy</Link>.
                </span>
              </label>
              <Button type="submit" className="w-full" loading={busy}>
                {staff ? "Send access request" : "Create account"}
              </Button>
            </form>
            <p className="mt-4 text-center text-sm text-ink-muted">
              Already registered?{" "}
              <Link to="/login" className="font-medium text-brand-700 hover:underline">
                Sign in
              </Link>
            </p>
            </>
            )}
          </div>
        </div>
      </main>
      <SiteFooter compact />
    </div>
  );
}
