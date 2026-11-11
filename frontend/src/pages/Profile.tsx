import { useQuery } from "@tanstack/react-query";
import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Avatar } from "../components/AppShell";
import { PasswordInput } from "../components/PasswordInput";
import { useToast } from "../components/Toast";
import { Alert, Badge, Button, Field, Input, PageHeader, Select } from "../components/ui";
import { api, ApiError } from "../lib/api";
import { ROLE_LABEL, useAuth } from "../lib/auth";
import { fmtDate } from "../lib/format";
import { LANG_LABEL, useI18n } from "../lib/i18n";
import type { Lang, User } from "../lib/types";

const PREF_LABEL: Record<string, { label: string; body: string }> = {
  status_updates: { label: "Progress updates", body: "Assignment, work started, closure and linked-report updates on your grievances." },
  sla_alerts: { label: "Deadline warnings", body: "Warnings when a case you handle is close to, or past, its SLA deadline." },
  escalations: { label: "Escalation alerts", body: "When a case in your scope is escalated by an officer, the SLA monitor or a citizen dispute." },
};
const ALWAYS_ON: Record<string, string> = {
  citizen: "A resolution that needs your confirmation is always sent.",
  officer: "New assignments, review requests and reopened cases are always sent.",
  dept_admin: "Review requests and reopened cases are always sent.",
  admin: "Review requests are always sent.",
};

function Section({ id, title, description, children }: { id: string; title: string; description?: ReactNode; children: ReactNode }) {
  return (
    <section aria-labelledby={id} className="grid gap-4 border-t border-line py-7 first:border-t-0 first:pt-0 lg:grid-cols-[16rem_1fr] lg:gap-10">
      <div>
        <h2 id={id} className="text-[16px] font-semibold text-ink">{title}</h2>
        {description && <p className="mt-1 text-[13px] leading-relaxed text-ink-muted">{description}</p>}
      </div>
      <div className="min-w-0">{children}</div>
    </section>
  );
}

function ReadOnly({ label, value, note }: { label: string; value: ReactNode; note?: string }) {
  return (
    <div className="space-y-1.5">
      <p className="text-sm font-medium text-ink">{label}</p>
      <p className="flex min-h-10 items-center rounded-md border border-line bg-canvas px-3 text-sm text-ink-soft">{value || "Not set"}</p>
      {note && <p className="text-[12px] text-ink-muted">{note}</p>}
    </div>
  );
}

/* ------------------------------------------------------------------ personal details */

function DetailsForm({ user }: { user: User }) {
  const { refresh } = useAuth();
  const { setLang } = useI18n();
  const toast = useToast();
  const can = new Set(user.editable_fields ?? []);
  const wards = useQuery({ queryKey: ["meta", "wards"], queryFn: () => api<string[] | { name: string }[]>("/meta/wards", { auth: false }), enabled: can.has("ward") });
  const initial = { full_name: user.full_name, phone: user.phone ?? "", preferred_language: user.preferred_language, address: user.address ?? "", ward: user.ward ?? "" };
  const [form, setForm] = useState(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => setForm({ full_name: user.full_name, phone: user.phone ?? "", preferred_language: user.preferred_language, address: user.address ?? "", ward: user.ward ?? "" }), [user]);

  const set = (k: keyof typeof form) => (e: { target: { value: string } }) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const validate = () => {
    const e: Record<string, string> = {};
    if (can.has("full_name") && form.full_name.trim().length < 2) e.full_name = "Enter your full name (at least 2 characters).";
    if (form.phone && !/^\+?[0-9\- ]{7,20}$/.test(form.phone.trim())) e.phone = "Enter a valid phone number, for example +91 98765 43210.";
    if (form.address.length > 300) e.address = "Keep the address under 300 characters.";
    return e;
  };
  const changed = (Object.keys(form) as (keyof typeof form)[]).filter((k) => can.has(k) && form[k] !== initial[k]);

  const submit = async (ev: FormEvent) => {
    ev.preventDefault();
    const e = validate();
    setErrors(e);
    setServerError(null);
    if (Object.keys(e).length || !changed.length) return;
    setBusy(true);
    try {
      const body = Object.fromEntries(changed.map((k) => [k, typeof form[k] === "string" ? form[k].trim() : form[k]]));
      await api("/auth/me", { method: "PATCH", body });
      if (changed.includes("preferred_language")) setLang(form.preferred_language as Lang);
      await refresh();
      toast.success("Your profile has been updated.");
    } catch (err) {
      if (err instanceof ApiError && err.fields) setErrors(Object.fromEntries(err.fields.map((f) => [f.field, f.message])));
      setServerError(err instanceof Error ? err.message : "Your profile could not be saved.");
    } finally {
      setBusy(false);
    }
  };
  const wardOptions = (wards.data ?? []).map((w) => (typeof w === "string" ? w : w.name));
  const adminNote = "Managed by your system administrator.";

  return (
    <form onSubmit={submit} noValidate className="max-w-2xl space-y-4">
      {serverError && <Alert tone="critical">{serverError}</Alert>}
      <div className="grid gap-4 sm:grid-cols-2">
        {can.has("full_name") ? (
          <Field label="Full name" htmlFor="pf-name" error={errors.full_name}>
            <Input id="pf-name" autoComplete="name" value={form.full_name} onChange={set("full_name")} aria-invalid={!!errors.full_name} />
          </Field>
        ) : (
          <ReadOnly label="Full name" value={user.full_name} note={adminNote} />
        )}
        <ReadOnly label="E-mail" value={user.email} note="Your sign-in address cannot be changed here." />
        {can.has("phone") && (
          <Field label="Mobile number" htmlFor="pf-phone" error={errors.phone} hint="Optional.">
            <Input id="pf-phone" type="tel" inputMode="tel" autoComplete="tel" value={form.phone} onChange={set("phone")} aria-invalid={!!errors.phone} />
          </Field>
        )}
        {can.has("preferred_language") && (
          <Field label="Preferred language" htmlFor="pf-lang" hint={user.role === "citizen" ? "Used for screens and messages that are translated." : "Staff screens are in English."}>
            <Select id="pf-lang" value={form.preferred_language} onChange={set("preferred_language")}>
              {(Object.keys(LANG_LABEL) as Lang[]).map((l) => (
                <option key={l} value={l} lang={l}>{LANG_LABEL[l]}</option>
              ))}
            </Select>
          </Field>
        )}
        {can.has("address") && (
          <div className="sm:col-span-2">
            <Field label="Address" htmlFor="pf-address" error={errors.address} hint="Optional. Helps when your grievance location is near home.">
              <Input id="pf-address" autoComplete="street-address" value={form.address} onChange={set("address")} maxLength={300} aria-invalid={!!errors.address} />
            </Field>
          </div>
        )}
        {can.has("ward") && (
          <Field label="Ward" htmlFor="pf-ward" hint="Optional.">
            {wardOptions.length ? (
              <Select id="pf-ward" value={form.ward} onChange={set("ward")}>
                <option value="">Not set</option>
                {wardOptions.map((w) => <option key={w} value={w}>{w}</option>)}
              </Select>
            ) : (
              <Input id="pf-ward" value={form.ward} onChange={set("ward")} maxLength={80} />
            )}
          </Field>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-3 pt-1">
        <Button type="submit" loading={busy} disabled={!changed.length}>Save changes</Button>
        {changed.length > 0 && (
          <Button type="button" variant="ghost" onClick={() => { setForm(initial); setErrors({}); }}>
            Discard
          </Button>
        )}
        {!changed.length && <span className="text-[13px] text-ink-muted">No unsaved changes.</span>}
      </div>
    </form>
  );
}

/* ------------------------------------------------------------------ password */

function PasswordForm() {
  const toast = useToast();
  const { refresh } = useAuth();
  const [f, setF] = useState({ current: "", next: "", confirm: "" });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const rules = [
    { ok: f.next.length >= 8, label: "At least 8 characters" },
    { ok: /[A-Za-z]/.test(f.next) && /[0-9]/.test(f.next), label: "Letters and numbers" },
    { ok: !!f.next && f.next === f.confirm, label: "Both new passwords match" },
  ];
  const ready = !!f.current && rules.every((r) => r.ok);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!ready) return setError("Complete all three fields and meet every rule below.");
    setBusy(true);
    setError(null);
    try {
      await api("/auth/change-password", { body: { current_password: f.current, new_password: f.next } });
      setF({ current: "", next: "", confirm: "" });
      await refresh();
      toast.success("Password changed. Use the new password next time you sign in.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Password could not be changed.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <form onSubmit={submit} noValidate className="max-w-md space-y-4">
      {error && <Alert tone="critical">{error}</Alert>}
      <Field label="Current password" htmlFor="pw-current">
        <PasswordInput id="pw-current" autoComplete="current-password" value={f.current} onChange={(e) => setF({ ...f, current: e.target.value })} />
      </Field>
      <Field label="New password" htmlFor="pw-new">
        <PasswordInput id="pw-new" autoComplete="new-password" value={f.next} onChange={(e) => setF({ ...f, next: e.target.value })} aria-describedby="pw-rules-list" />
      </Field>
      <Field label="Confirm new password" htmlFor="pw-confirm">
        <PasswordInput id="pw-confirm" autoComplete="new-password" value={f.confirm} onChange={(e) => setF({ ...f, confirm: e.target.value })} />
      </Field>
      <ul id="pw-rules-list" className="space-y-1 text-[13px]">
        {rules.map((r) => (
          <li key={r.label} className={r.ok ? "flex items-center gap-2 text-status-good" : "flex items-center gap-2 text-ink-muted"}>
            <span className={r.ok ? "h-1.5 w-1.5 rounded-full bg-status-good" : "h-1.5 w-1.5 rounded-full border border-ink-muted"} aria-hidden />
            {r.label}
            <span className="sr-only">{r.ok ? "(met)" : "(not yet met)"}</span>
          </li>
        ))}
      </ul>
      <Button type="submit" loading={busy}>Change password</Button>
    </form>
  );
}

/* ------------------------------------------------------------------ notification preferences */

function NotificationPrefs({ user }: { user: User }) {
  const { refresh } = useAuth();
  const toast = useToast();
  const [saving, setSaving] = useState<string | null>(null);
  const prefs = user.notification_prefs ?? {};
  const toggle = async (key: string, value: boolean) => {
    setSaving(key);
    try {
      await api("/auth/me", { method: "PATCH", body: { notification_prefs: { [key]: value } } });
      await refresh();
      toast.success(`${PREF_LABEL[key]?.label ?? key} turned ${value ? "on" : "off"}.`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Preference could not be saved.");
    } finally {
      setSaving(null);
    }
  };
  return (
    <div className="max-w-2xl">
      <ul className="divide-y divide-line rounded-lg border border-line bg-surface">
        {Object.entries(prefs).map(([key, on]) => (
          <li key={key} className="flex items-start justify-between gap-4 px-4 py-3.5">
            <div>
              <p className="text-sm font-medium text-ink" id={`pref-${key}`}>{PREF_LABEL[key]?.label ?? key}</p>
              <p className="mt-0.5 text-[13px] text-ink-muted">{PREF_LABEL[key]?.body}</p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={on}
              aria-labelledby={`pref-${key}`}
              disabled={saving === key}
              onClick={() => toggle(key, !on)}
              className={`relative mt-0.5 inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors duration-150 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 disabled:opacity-50 ${on ? "bg-brand-700" : "bg-stone-dark"}`}
            >
              <span className={`inline-block h-5 w-5 rounded-full bg-white shadow transition-transform duration-150 ${on ? "translate-x-[22px]" : "translate-x-0.5"}`} />
              <span className="sr-only">{on ? "On" : "Off"}</span>
            </button>
          </li>
        ))}
      </ul>
      <p className="mt-3 text-[13px] text-ink-muted">{ALWAYS_ON[user.role]}</p>
      <dl className="mt-4 grid gap-2 text-[13px] sm:grid-cols-2">
        <div className="flex items-center justify-between rounded-md border border-line px-3 py-2"><dt className="text-ink">In-app notifications</dt><dd><Badge tone="good">Active</Badge></dd></div>
        <div className="flex items-center justify-between rounded-md border border-line px-3 py-2"><dt className="text-ink">SMS, WhatsApp and e-mail</dt><dd><Badge tone="outline">Not available yet</Badge></dd></div>
      </dl>
    </div>
  );
}

/* ------------------------------------------------------------------ page */

export default function Profile() {
  const { user, logout } = useAuth();
  const nav = useNavigate();
  if (!user) return null;
  const signOut = () => {
    logout();
    nav("/");
  };
  return (
    <div className="max-w-5xl">
      <PageHeader title="My Profile" subtitle="Your account details, security and notification settings." />

      <div className="mb-8 flex flex-wrap items-center gap-4 rounded-lg border border-line bg-surface p-5">
        <Avatar name={user.full_name} size={56} />
        <div className="min-w-0 flex-1">
          <p className="text-[18px] font-semibold text-ink">{user.full_name}</p>
          <p className="text-sm text-ink-muted">{user.email}</p>
          <p className="mt-1 text-[13px] font-medium text-brand-700">
            {ROLE_LABEL[user.role]}
            {user.department_name ? ` · ${user.department_name}` : ""}
          </p>
        </div>
        <dl className="grid grid-cols-2 gap-x-6 gap-y-1 text-[13px]">
          <dt className="text-ink-muted">Member since</dt>
          <dd className="text-ink">{fmtDate(user.created_at, false)}</dd>
          <dt className="text-ink-muted">Last sign-in</dt>
          <dd className="text-ink">{fmtDate(user.last_login_at)}</dd>
        </dl>
        <p className="w-full text-[12px] text-ink-muted">Your avatar shows your initials. Uploading a profile photo is not supported.</p>
      </div>

      <Section id="sec-details" title="Personal details" description="Only the fields your role may change are editable. Every change is recorded in the audit log.">
        <DetailsForm user={user} />
      </Section>

      {user.role !== "citizen" && (
        <Section id="sec-role" title="Role and access" description="Assigned by a system administrator.">
          <div className="max-w-2xl space-y-4">
            <dl className="grid gap-3 text-sm sm:grid-cols-2">
              <div><dt className="text-ink-muted">Role</dt><dd className="font-medium text-ink">{ROLE_LABEL[user.role]}</dd></div>
              {user.designation && <div><dt className="text-ink-muted">Designation</dt><dd className="font-medium text-ink">{user.designation}</dd></div>}
              {user.department_name && <div><dt className="text-ink-muted">Department</dt><dd className="font-medium text-ink">{user.department_name} <span className="font-mono text-[12px] text-ink-muted">{user.department_code}</span></dd></div>}
              {user.officer_code && <div><dt className="text-ink-muted">Officer code</dt><dd className="font-mono text-ink">{user.officer_code}</dd></div>}
              {user.handles_sensitive !== null && user.handles_sensitive !== undefined && (
                <div><dt className="text-ink-muted">Sensitive cases</dt><dd className="font-medium text-ink">{user.handles_sensitive ? "Cleared to handle" : "Not cleared"}</dd></div>
              )}
            </dl>
            <div>
              <p className="text-sm font-medium text-ink">Permissions</p>
              <ul className="mt-2 flex flex-wrap gap-1.5">
                {user.permissions?.map((p) => <li key={p}><Badge tone="brand" className="normal-case tracking-normal">{p}</Badge></li>)}
              </ul>
            </div>
          </div>
        </Section>
      )}

      <Section id="sec-password" title="Password" description={user.password_changed_at ? `Last changed ${fmtDate(user.password_changed_at, false)}.` : "Choose a password you do not use anywhere else."}>
        <PasswordForm />
      </Section>

      <Section id="sec-notif" title="Notifications" description="Choose which optional updates you receive. Preferences are saved to your account and applied when notifications are created.">
        <NotificationPrefs user={user} />
      </Section>

      <Section id="sec-privacy" title="Privacy and session" description="How your information is used, and your current session.">
        <div className="max-w-2xl space-y-4 text-sm text-ink-soft">
          {user.role === "citizen" ? (
            <p>Officers see a masked version of your name and phone number. For sensitive grievances, such as harassment or corruption, your identity is hidden from officers entirely.</p>
          ) : (
            <p>Citizen identities are masked in your views according to your role. Sensitive cases hide the complainant's identity from every officer.</p>
          )}
          <div className="flex flex-wrap gap-3">
            <Link to="/privacy" className="font-semibold text-brand-700 underline underline-offset-2">Read the privacy policy</Link>
            <button type="button" onClick={() => window.dispatchEvent(new Event("grievance:open-consent"))} className="font-semibold text-brand-700 underline underline-offset-2">
              Browser storage preferences
            </button>
          </div>
          <p className="text-[13px] text-ink-muted">Account deletion is not available in this deployment. Contact support to close your account.</p>
          <Button variant="secondary" onClick={signOut}>Sign out of this browser</Button>
        </div>
      </Section>
    </div>
  );
}
