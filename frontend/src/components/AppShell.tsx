import { useQuery, useQueryClient } from "@tanstack/react-query";
import clsx from "clsx";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Link, NavLink, useLocation, useNavigate } from "react-router-dom";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";
import { fmtDate } from "../lib/format";
import { LANG_LABEL, useI18n } from "../lib/i18n";
import type { Lang, Notification, SystemStatus } from "../lib/types";
import { SyntheticBanner } from "./domain";
import { IconBell, IconClose, IconMenu, IconSignOut } from "./icons";
import { SiteFooter } from "./SiteChrome";

/** GRIEVANCE logo: the official emblem plus the wordmark. `size` sets the emblem height in px. */
export function Logo({ to = "/", size = 34, emblemOnly = false }: { to?: string; size?: number; emblemOnly?: boolean }) {
  return (
    <Link to={to} className="flex shrink-0 items-center gap-2" aria-label="GRIEVANCE home">
      <img src="/brand/grievance-emblem.webp" alt="" width={Math.round(size * 1.08)} height={size} className="block" style={{ height: size, width: "auto" }} />
      {!emblemOnly && (
        <img
          src="/brand/grievance-wordmark.webp"
          alt="GRIEVANCE"
          width={Math.round(size * 0.52 * 6.8)}
          height={Math.round(size * 0.52)}
          className="block"
          style={{ height: Math.round(size * 0.52), width: "auto" }}
        />
      )}
    </Link>
  );
}

/** Full lockup with tagline, for sign-in screens and brand moments. */
export function FullLogo({ width = 320, className }: { width?: number; className?: string }) {
  return (
    <img
      src="/brand/grievance-logo.webp"
      alt="GRIEVANCE. Speak, Track, Resolve. An Intelligent Grievance Redressal Ecosystem."
      width={width}
      height={Math.round((width * 327) / 1200)}
      className={className}
      style={{ width, height: "auto", maxWidth: "100%" }}
    />
  );
}

export function useSystemStatus() {
  return useQuery({ queryKey: ["meta", "status"], queryFn: () => api<SystemStatus>("/meta/status", { auth: false }), staleTime: 60_000 });
}

export function LanguageSwitcher() {
  const { lang, setLang } = useI18n();
  return (
    <label className="flex items-center gap-1.5 text-sm">
      <span className="sr-only">Language</span>
      <select value={lang} onChange={(e) => setLang(e.target.value as Lang)} className="h-8 rounded-md border border-line bg-surface px-2 text-sm">
        {(Object.keys(LANG_LABEL) as Lang[]).map((l) => (
          <option key={l} value={l}>
            {LANG_LABEL[l]}
          </option>
        ))}
      </select>
    </label>
  );
}

function NotificationBell() {
  const [open, setOpen] = useState(false);
  const qc = useQueryClient();
  const nav = useNavigate();
  const { user } = useAuth();
  const ref = useRef<HTMLDivElement>(null);
  const { data } = useQuery({
    queryKey: ["notifications"],
    queryFn: () => api<{ unread: number; items: Notification[] }>("/notifications?limit=15"),
    refetchInterval: 30_000,
  });
  useEffect(() => {
    const close = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && setOpen(false);
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  const openItem = async (n: Notification) => {
    if (!n.is_read) await api(`/notifications/${n.id}/read`, { method: "POST" });
    void qc.invalidateQueries({ queryKey: ["notifications"] });
    setOpen(false);
    if (n.grievance_id) nav(user?.role === "citizen" ? `/citizen/grievances/${n.grievance_id}` : `/officer/grievances/${n.grievance_id}`);
  };
  const readAll = async () => {
    await api("/notifications/read-all", { method: "POST" });
    void qc.invalidateQueries({ queryKey: ["notifications"] });
  };

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="relative flex h-9 w-9 items-center justify-center rounded-md text-ink-soft hover:bg-canvas hover:text-ink"
        aria-label={`Notifications${data?.unread ? `, ${data.unread} unread` : ""}`}
      >
        <IconBell width={20} height={20} />
        {!!data?.unread && (
          <span className="absolute right-1 top-1 min-w-[16px] rounded-full bg-status-critical px-1 text-center text-[10px] font-bold leading-4 text-white">
            {data.unread > 99 ? "99+" : data.unread}
          </span>
        )}
      </button>
      {open && (
        <div className="absolute right-0 z-40 mt-2 w-[min(22rem,calc(100vw-2rem))] rounded-lg border border-line bg-surface shadow-overlay">
          <div className="flex items-center justify-between border-b border-line px-4 py-2.5">
            <p className="text-sm font-semibold">Notifications</p>
            {!!data?.unread && (
              <button onClick={readAll} className="text-xs font-medium text-brand-700 hover:underline">
                Mark all read
              </button>
            )}
          </div>
          <ul className="max-h-96 divide-y divide-line overflow-y-auto">
            {!data?.items.length && <li className="px-4 py-6 text-center text-sm text-ink-muted">No notifications yet.</li>}
            {data?.items.map((n) => (
              <li key={n.id}>
                <button onClick={() => openItem(n)} className={clsx("w-full px-4 py-3 text-left hover:bg-canvas", !n.is_read && "bg-brand-50/50")}>
                  <p className={clsx("text-sm", !n.is_read ? "font-semibold text-ink" : "text-ink-soft")}>{n.title}</p>
                  <p className="mt-0.5 line-clamp-2 text-xs text-ink-muted">{n.body}</p>
                  <p className="mt-1 text-[11px] text-ink-muted">{fmtDate(n.created_at)}</p>
                </button>
              </li>
            ))}
          </ul>
          <div className="border-t border-line px-4 py-2 text-right">
            <Link to="/notifications" onClick={() => setOpen(false)} className="text-xs font-medium text-brand-700 hover:underline">
              View all
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

type NavItem = { to: string; label: string; end?: boolean };

const NAV: Record<string, NavItem[]> = {
  citizen: [
    { to: "/citizen", label: "My grievances", end: true },
    { to: "/citizen/new", label: "File a grievance" },
    { to: "/notifications", label: "Notifications" },
  ],
  officer: [
    { to: "/officer", label: "My queue", end: true },
    { to: "/officer/review", label: "Human review" },
    { to: "/officer/department", label: "Department" },
    { to: "/notifications", label: "Notifications" },
  ],
  admin: [
    { to: "/admin", label: "Overview", end: true },
    { to: "/admin/sla", label: "SLA & insights" },
    { to: "/officer/review", label: "Human review" },
    { to: "/officer/department", label: "All grievances" },
    { to: "/admin/categories", label: "Category master" },
    { to: "/admin/departments", label: "Departments" },
    { to: "/admin/datasets", label: "Datasets" },
    { to: "/admin/public-data", label: "Public data" },
    { to: "/admin/webhooks", label: "Webhooks" },
    { to: "/admin/audit", label: "Audit log" },
    { to: "/admin/observability", label: "Observability" },
  ],
};

export function AppShell({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth();
  const { t } = useI18n();
  const status = useSystemStatus();
  const nav = useNavigate();
  const loc = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  useEffect(() => setMenuOpen(false), [loc.pathname]);
  if (!user) return null;
  const items = NAV[user.role];
  const navLabel = (it: NavItem) =>
    user.role === "citizen" ? ({ "/citizen": t("myGrievances"), "/citizen/new": t("fileComplaint"), "/notifications": t("notifications") }[it.to] ?? it.label) : it.label;
  const signOut = () => {
    logout();
    nav("/");
  };
  const linkCls = ({ isActive }: { isActive: boolean }) =>
    clsx("block whitespace-nowrap border-b-2 px-3 py-2.5 text-sm font-medium", isActive ? "border-brand-700 text-brand-800" : "border-transparent text-ink-soft hover:text-ink");

  return (
    <div className="flex min-h-screen flex-col">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-[70] focus:rounded focus:bg-surface focus:px-3 focus:py-2 focus:shadow">
        Skip to content
      </a>
      {status.data?.synthetic_data_in_use && <SyntheticBanner />}
      <header className="sticky top-0 z-30 border-b border-line bg-canvas/95 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between gap-2 px-4">
          <div className="flex min-w-0 items-center gap-3">
            <button
              className="flex h-9 w-9 items-center justify-center rounded-md text-ink-soft hover:bg-canvas hover:text-ink md:hidden"
              onClick={() => setMenuOpen((o) => !o)}
              aria-label={menuOpen ? "Close menu" : "Open menu"}
              aria-expanded={menuOpen}
              aria-controls="mobile-nav"
            >
              {menuOpen ? <IconClose width={20} height={20} /> : <IconMenu width={20} height={20} />}
            </button>
            <Logo to={user.role === "admin" ? "/admin" : user.role === "officer" ? "/officer" : "/citizen"} />
            <span className="hidden rounded bg-slate-100 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-ink-soft lg:inline">
              {user.role === "officer" && user.department_code ? `Officer · ${user.department_code}` : user.role}
            </span>
          </div>
          <div className="flex items-center gap-1">
            {user.role === "citizen" && <LanguageSwitcher />}
            <NotificationBell />
            <div className="hidden max-w-[14rem] text-right lg:block">
              <p className="truncate text-sm font-medium leading-tight">{user.full_name}</p>
              <p className="truncate text-[11px] leading-tight text-ink-muted">{user.email}</p>
            </div>
            <button onClick={signOut} className="hidden h-9 w-9 items-center justify-center rounded-md text-ink-soft hover:bg-canvas hover:text-ink md:flex" aria-label="Sign out" title="Sign out">
              <IconSignOut />
            </button>
          </div>
        </div>
        <nav className="mx-auto hidden max-w-7xl overflow-x-auto px-4 md:block" aria-label="Main">
          <ul className="flex gap-1">
            {items.map((it) => (
              <li key={it.to}>
                <NavLink to={it.to} end={it.end} className={linkCls}>
                  {navLabel(it)}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
        {menuOpen && (
          <nav id="mobile-nav" className="border-t border-line bg-surface md:hidden" aria-label="Main">
            <div className="px-4 py-3">
              <p className="truncate text-sm font-medium">{user.full_name}</p>
              <p className="truncate text-xs text-ink-muted">{user.email} · {user.role}</p>
            </div>
            <ul className="border-t border-line py-1">
              {items.map((it) => (
                <li key={it.to}>
                  <NavLink
                    to={it.to}
                    end={it.end}
                    className={({ isActive }) => clsx("block px-4 py-2.5 text-sm font-medium", isActive ? "bg-brand-50 text-brand-800" : "text-ink-soft hover:bg-canvas")}
                  >
                    {navLabel(it)}
                  </NavLink>
                </li>
              ))}
              <li>
                <button onClick={signOut} className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm font-medium text-ink-soft hover:bg-canvas">
                  <IconSignOut width={16} height={16} /> Sign out
                </button>
              </li>
            </ul>
          </nav>
        )}
      </header>
      <main id="main" className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:py-8">
        {children}
      </main>
      <SiteFooter compact />
    </div>
  );
}
