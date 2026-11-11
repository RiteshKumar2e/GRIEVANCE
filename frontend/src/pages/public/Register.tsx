import { Check, X } from "lucide-react";
import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Logo } from "../../components/AppShell";
import { PasswordInput } from "../../components/PasswordInput";
import { SiteFooter } from "../../components/SiteChrome";
import { useToast } from "../../components/Toast";
import { Alert, Button, Field, Input, Select } from "../../components/ui";
import { ApiError } from "../../lib/api";
import { useAuth } from "../../lib/auth";
import { LANG_LABEL, useI18n } from "../../lib/i18n";
import type { Lang } from "../../lib/types";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^\+?[0-9\- ]{7,20}$/;

export default function Register() {
  const { register } = useAuth();
  const toast = useToast();
  const { lang, setLang } = useI18n();
  const nav = useNavigate();
  const [form, setForm] = useState({ full_name: "", email: "", phone: "", password: "", confirm: "", preferred_language: lang as Lang, website: "" });
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
  };
  const show = (k: string) => (touched[k] ? errors[k] : undefined) ?? serverErrors[k];

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setTouched({ full_name: true, email: true, phone: true, password: true, confirm: true });
    if (Object.values(errors).some(Boolean) || !agree) {
      if (!agree) setError("Please accept the terms and privacy policy to continue.");
      return;
    }
    setError(null);
    setServerErrors({});
    setBusy(true);
    try {
      await register({
        full_name: form.full_name.trim(),
        email: form.email.trim(),
        phone: form.phone.trim() || undefined,
        password: form.password,
        preferred_language: form.preferred_language,
        website: form.website, // honeypot — must stay empty
      } as Parameters<typeof register>[0]);
      setLang(form.preferred_language);
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
            <Logo />
          </div>
          <div className="rounded-lg border border-line bg-white p-6 shadow-card">
            <h1 className="text-xl font-semibold text-ink">Create a citizen account</h1>
            <p className="mt-1 text-sm text-ink-muted">Your contact details are shared only with the officer handling your grievance, and are hidden for sensitive matters.</p>
            <form onSubmit={submit} className="mt-6 space-y-4" noValidate>
              {error && <Alert tone="critical">{error}</Alert>}
              {/* Honeypot: invisible to people, tempting to bots. */}
              <div aria-hidden="true" className="absolute left-[-10000px] top-auto h-px w-px overflow-hidden">
                <label htmlFor="website">Website</label>
                <input id="website" name="website" tabIndex={-1} autoComplete="off" value={form.website} onChange={set("website")} />
              </div>
              <Field label="Full name" htmlFor="name" error={show("full_name")}>
                <Input id="name" autoComplete="name" value={form.full_name} onChange={set("full_name")} onBlur={blur("full_name")} aria-invalid={!!show("full_name")} required />
              </Field>
              <Field label="E-mail" htmlFor="email" error={show("email")}>
                <Input id="email" type="email" inputMode="email" autoComplete="email" value={form.email} onChange={set("email")} onBlur={blur("email")} aria-invalid={!!show("email")} required />
              </Field>
              <Field label="Mobile number (optional)" htmlFor="phone" error={show("phone")}>
                <Input id="phone" type="tel" inputMode="tel" autoComplete="tel" value={form.phone} onChange={set("phone")} onBlur={blur("phone")} aria-invalid={!!show("phone")} />
              </Field>
              <Field label="Password" htmlFor="pw" error={touched.password ? show("password") : serverErrors.password}>
                <PasswordInput id="pw" autoComplete="new-password" value={form.password} onChange={set("password")} onBlur={blur("password")} aria-invalid={!!show("password")} aria-describedby="pw-rules" required />
                <ul id="pw-rules" className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs">
                  {rules.map((r) => (
                    <li key={r.label} className={r.ok ? "flex items-center gap-1 text-green-700" : "flex items-center gap-1 text-ink-muted"}>
                      {r.ok ? <Check className="h-3.5 w-3.5" aria-hidden /> : <X className="h-3.5 w-3.5" aria-hidden />}
                      {r.label}
                    </li>
                  ))}
                </ul>
              </Field>
              <Field label="Confirm password" htmlFor="pw2" error={show("confirm")}>
                <PasswordInput id="pw2" autoComplete="new-password" value={form.confirm} onChange={set("confirm")} onBlur={blur("confirm")} aria-invalid={!!show("confirm")} required />
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
                Create account
              </Button>
            </form>
            <p className="mt-4 text-center text-sm text-ink-muted">
              Already registered?{" "}
              <Link to="/login" className="font-medium text-brand-700 hover:underline">
                Sign in
              </Link>
            </p>
          </div>
        </div>
      </main>
      <SiteFooter compact />
    </div>
  );
}
