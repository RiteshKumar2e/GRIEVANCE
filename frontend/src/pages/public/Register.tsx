import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Logo } from "../../components/AppShell";
import { Alert, Button, Field, Input, Select } from "../../components/ui";
import { ApiError } from "../../lib/api";
import { useAuth } from "../../lib/auth";
import { LANG_LABEL, useI18n } from "../../lib/i18n";
import type { Lang } from "../../lib/types";

export default function Register() {
  const { register } = useAuth();
  const { lang, setLang } = useI18n();
  const nav = useNavigate();
  const [form, setForm] = useState({ full_name: "", email: "", phone: "", password: "", preferred_language: lang as Lang });
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof form) => (e: { target: { value: string } }) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const pwOk = form.password.length >= 8 && /\d/.test(form.password) && /[a-z]/i.test(form.password);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setFieldErrors({});
    setBusy(true);
    try {
      await register({ ...form, phone: form.phone.trim() || undefined, email: form.email.trim() });
      setLang(form.preferred_language);
      nav("/citizen/new", { replace: true });
    } catch (err) {
      if (err instanceof ApiError && err.fields) setFieldErrors(Object.fromEntries(err.fields.map((f) => [f.field, f.message])));
      setError(err instanceof Error ? err.message : "Registration failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-canvas px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-6 flex justify-center">
          <Logo />
        </div>
        <div className="rounded-lg border border-line bg-white p-6 shadow-card">
          <h1 className="text-xl font-semibold text-ink">Create a citizen account</h1>
          <p className="mt-1 text-sm text-ink-muted">Your contact details are shared only with the officer handling your grievance, and are hidden for sensitive matters.</p>
          <form onSubmit={submit} className="mt-6 space-y-4" noValidate>
            {error && <Alert tone="critical">{error}</Alert>}
            <Field label="Full name" htmlFor="name" error={fieldErrors.full_name}>
              <Input id="name" autoComplete="name" value={form.full_name} onChange={set("full_name")} required />
            </Field>
            <Field label="E-mail" htmlFor="email" error={fieldErrors.email}>
              <Input id="email" type="email" autoComplete="email" value={form.email} onChange={set("email")} required />
            </Field>
            <Field label="Mobile number (optional)" htmlFor="phone" error={fieldErrors.phone}>
              <Input id="phone" type="tel" autoComplete="tel" placeholder="+91 98xxxxxx01" value={form.phone} onChange={set("phone")} />
            </Field>
            <Field label="Password" htmlFor="pw" hint="At least 8 characters with letters and numbers." error={fieldErrors.password}>
              <Input id="pw" type="password" autoComplete="new-password" value={form.password} onChange={set("password")} required />
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
            <Button type="submit" className="w-full" loading={busy} disabled={!form.full_name || !form.email || !pwOk}>
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
    </div>
  );
}
