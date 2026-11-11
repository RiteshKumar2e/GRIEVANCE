import { useState, type FormEvent } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Logo } from "../../components/AppShell";
import { Alert, Button, Field, Input } from "../../components/ui";
import { homeFor, useAuth } from "../../lib/auth";

const DEMO = [
  ["Citizen", "citizen@example.org"],
  ["Officer · Water", "officer.water@example.org"],
  ["Officer · Safety (sensitive)", "officer.safety@example.org"],
  ["Administrator", "admin@example.org"],
];

export default function Login() {
  const { login } = useAuth();
  const nav = useNavigate();
  const loc = useLocation() as { state?: { from?: string } };
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const u = await login(email.trim(), password);
      nav(loc.state?.from && loc.state.from !== "/login" ? loc.state.from : homeFor(u.role), { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign-in failed");
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
          <h1 className="text-xl font-semibold text-ink">Sign in</h1>
          <p className="mt-1 text-sm text-ink-muted">Citizens, officers and administrators use the same sign-in.</p>
          <form onSubmit={submit} className="mt-6 space-y-4" noValidate>
            {error && <Alert tone="critical">{error}</Alert>}
            <Field label="E-mail" htmlFor="email">
              <Input id="email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
            </Field>
            <Field label="Password" htmlFor="password">
              <Input id="password" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
            </Field>
            <Button type="submit" className="w-full" loading={busy} disabled={!email || !password}>
              Sign in
            </Button>
          </form>
          <p className="mt-4 text-center text-sm text-ink-muted">
            New citizen?{" "}
            <Link to="/register" className="font-medium text-brand-700 hover:underline">
              Create an account
            </Link>
          </p>
        </div>
        <div className="mt-4 rounded-lg border border-saffron-100 bg-saffron-50 p-4 text-sm">
          <p className="font-semibold text-saffron-700">Demo accounts (synthetic, development only)</p>
          <p className="mt-0.5 text-xs text-saffron-700">Password for all: the DEMO_PASSWORD in backend/.env (default Demo@12345).</p>
          <ul className="mt-2 space-y-1">
            {DEMO.map(([label, mail]) => (
              <li key={mail}>
                <button type="button" onClick={() => setEmail(mail)} className="text-left text-ink-soft hover:text-ink hover:underline">
                  <span className="font-medium">{label}:</span> {mail}
                </button>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
