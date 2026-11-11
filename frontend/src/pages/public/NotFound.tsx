import { Link } from "react-router-dom";
import { Logo } from "../../components/AppShell";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-canvas px-4 text-center">
      <Logo />
      <h1 className="font-display text-2xl font-semibold">Page not found</h1>
      <p className="text-ink-soft">The page you are looking for does not exist or has moved.</p>
      <Link to="/" className="rounded-md bg-brand-800 px-4 py-2 text-sm font-medium text-white hover:bg-brand-900">
        Go to home
      </Link>
    </div>
  );
}
