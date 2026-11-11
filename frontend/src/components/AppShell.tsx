import { useQuery, useQueryClient } from "@tanstack/react-query";
import clsx from "clsx";
import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { Link, NavLink, useLocation, useNavigate } from "react-router-dom";
import { api } from "../lib/api";
import { homeFor, ROLE_LABEL, useAuth } from "../lib/auth";
import { fmtDate } from "../lib/format";
import { LANG_LABEL, useI18n } from "../lib/i18n";
import type { Lang, Notification, Role, SystemStatus, User } from "../lib/types";
import { IconBell, IconChevron, IconClose, IconMenu, IconSearch, IconSignOut } from "./icons";
import { currentItem, isActive, NAV, NavIcons, type NavItem } from "./nav";

/** GRIEVANCE logo: the official emblem plus the wordmark. `size` sets the emblem height in px. */
export function Logo({ to = "/", size = 34, emblemOnly = false }: { to?: string; size?: number; emblemOnly?: boolean }) {
  return (
    <Link to={to} className="flex shrink-0 items-center gap-2 rounded-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500" aria-label="GRIEVANCE home">
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
      <select value={lang} onChange={(e) => setLang(e.target.value as Lang)} className="h-9 rounded-md border border-line bg-surface px-2 text-sm text-ink hover:border-stone-dark">
        {(Object.keys(LANG_LABEL) as Lang[]).map((l) => (
          <option key={l} value={l} lang={l}>
            {LANG_LABEL[l]}
          </option>
        ))}
      </select>
    </label>
  );
}

const FOCUS = "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500";

/** Closes a popover on outside click or Escape, returning focus to its trigger. */
function usePopover() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && setOpen(false);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        trigger.current?.focus();
      }
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);
  return { open, setOpen, ref, trigger };
}

/* ------------------------------------------------------------------ notifications */

function NotificationBell({ role }: { role: Role }) {
  const { open, setOpen, ref, trigger } = usePopover();
  const qc = useQueryClient();
  const nav = useNavigate();
  const { data } = useQuery({
    queryKey: ["notifications"],
    queryFn: () => api<{ unread: number; items: Notification[] }>("/notifications?limit=15"),
    refetchInterval: 30_000,
  });

  const openItem = async (n: Notification) => {
    if (!n.is_read) await api(`/notifications/${n.id}/read`, { method: "POST" }).catch(() => undefined);
    void qc.invalidateQueries({ queryKey: ["notifications"] });
    setOpen(false);
    if (n.grievance_id) {
      const base = { citizen: "/citizen", officer: "/officer", dept_admin: "/department", admin: "/admin" }[role];
      nav(`${base}/grievances/${n.grievance_id}`);
    }
  };
  const readAll = async () => {
    await api("/notifications/read-all", { method: "POST" });
    void qc.invalidateQueries({ queryKey: ["notifications"] });
  };

  return (
    <div className="relative" ref={ref}>
      <button
        ref={trigger}
        onClick={() => setOpen((o) => !o)}
        className={clsx("relative flex h-10 w-10 items-center justify-center rounded-md text-ink-soft transition-colors duration-150 hover:bg-navy/[0.05] hover:text-ink", FOCUS)}
        aria-label={`Notifications${data?.unread ? `, ${data.unread} unread` : ""}`}
        aria-expanded={open}
        aria-haspopup="true"
      >
        <IconBell width={20} height={20} />
        {!!data?.unread && (
          <span className="absolute right-1 top-1 min-w-[17px] rounded-full bg-status-critical px-1 text-center text-[10px] font-bold leading-[17px] text-white" aria-hidden>
            {data.unread > 99 ? "99+" : data.unread}
          </span>
        )}
      </button>
      {open && (
        <div className="absolute right-0 z-50 mt-2 w-[min(22rem,calc(100vw-1.5rem))] rounded-lg border border-line bg-surface shadow-overlay">
          <div className="flex items-center justify-between border-b border-line px-4 py-2.5">
            <p className="text-sm font-semibold">Notifications</p>
            {!!data?.unread && (
              <button onClick={readAll} className={clsx("rounded-sm text-xs font-medium text-brand-700 hover:underline", FOCUS)}>
                Mark all read
              </button>
            )}
          </div>
          <ul className="max-h-96 divide-y divide-line overflow-y-auto">
            {!data?.items.length && <li className="px-4 py-6 text-center text-sm text-ink-muted">No notifications yet.</li>}
            {data?.items.map((n) => (
              <li key={n.id}>
                <button onClick={() => openItem(n)} className={clsx("w-full px-4 py-3 text-left hover:bg-canvas", FOCUS, !n.is_read && "bg-brand-50/60")}>
                  <p className={clsx("text-sm", !n.is_read ? "font-semibold text-ink" : "text-ink-soft")}>
                    {!n.is_read && <span className="sr-only">Unread: </span>}
                    {n.title}
                  </p>
                  <p className="mt-0.5 line-clamp-2 text-xs text-ink-muted">{n.body}</p>
                  <p className="mt-1 text-[11px] text-ink-muted">{fmtDate(n.created_at)}</p>
                </button>
              </li>
            ))}
          </ul>
          <div className="border-t border-line px-4 py-2 text-right">
            <Link to="/notifications" onClick={() => setOpen(false)} className={clsx("rounded-sm text-xs font-medium text-brand-700 hover:underline", FOCUS)}>
              View all notifications
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ profile menu */

export function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");
}

export function Avatar({ name, size = 32 }: { name: string; size?: number }) {
  return (
    <span
      className="inline-flex shrink-0 items-center justify-center rounded-full bg-brand-700 font-semibold text-white"
      style={{ width: size, height: size, fontSize: Math.round(size * 0.38) }}
      aria-hidden
    >
      {initials(name) || "?"}
    </span>
  );
}

function ProfileMenu({ user, onSignOut }: { user: User; onSignOut: () => void }) {
  const { open, setOpen, ref, trigger } = usePopover();
  const item = clsx("flex w-full items-center gap-2.5 px-4 py-2.5 text-left text-sm text-ink hover:bg-canvas", FOCUS);
  return (
    <div className="relative" ref={ref}>
      <button
        ref={trigger}
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        className={clsx("flex h-10 items-center gap-2 rounded-md pl-1 pr-1.5 transition-colors duration-150 hover:bg-navy/[0.05] sm:pr-2", FOCUS)}
      >
        <Avatar name={user.full_name} />
        <span className="hidden min-w-0 text-left lg:block">
          <span className="block max-w-[11rem] truncate text-[13px] font-semibold leading-tight text-ink">{user.full_name}</span>
          <span className="block max-w-[11rem] truncate text-[11px] leading-tight text-ink-muted">{ROLE_LABEL[user.role]}</span>
        </span>
        <span className="sr-only">Account menu for {user.full_name}</span>
        <IconChevron width={14} height={14} className="hidden rotate-90 text-ink-muted lg:block" />
      </button>
      {open && (
        <div role="menu" aria-label="Account" className="absolute right-0 z-50 mt-2 w-64 rounded-lg border border-line bg-surface py-1 shadow-overlay">
          <div className="border-b border-line px-4 py-3">
            <p className="truncate text-sm font-semibold text-ink">{user.full_name}</p>
            <p className="truncate text-xs text-ink-muted">{user.email}</p>
            <p className="mt-1 text-xs font-medium text-brand-700">
              {ROLE_LABEL[user.role]}
              {user.department_name ? ` · ${user.department_name}` : ""}
            </p>
          </div>
          <Link role="menuitem" to="/profile" onClick={() => setOpen(false)} className={item}>
            {NavIcons.user} My Profile
          </Link>
          <Link role="menuitem" to="/notifications" onClick={() => setOpen(false)} className={item}>
            {NavIcons.bell} Notifications
          </Link>
          {user.role === "citizen" && (
            <Link role="menuitem" to="/citizen/help" onClick={() => setOpen(false)} className={item}>
              {NavIcons.help} Help & Support
            </Link>
          )}
          <div className="my-1 border-t border-line" />
          <button role="menuitem" onClick={onSignOut} className={item}>
            <IconSignOut width={20} height={20} /> Sign out
          </button>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ sidebar */

const COLLAPSE_KEY = "grievance.sidebar.collapsed";

function SidebarNav({ role, collapsed, onNavigate }: { role: Role; collapsed: boolean; onNavigate?: () => void }) {
  const { pathname } = useLocation();
  const { t } = useI18n();
  // Citizen-facing labels follow the chosen language where a translation exists.
  const label = (it: NavItem) =>
    role === "citizen" ? ({ "/citizen/new": t("fileComplaint"), "/citizen/grievances": t("myGrievances"), "/notifications": t("notifications") }[it.to] ?? it.label) : it.label;
  return (
    <nav aria-label="Main" className="flex-1 overflow-y-auto px-2 py-3">
      {NAV[role].map((g, gi) => (
        <div key={gi} className={clsx(gi > 0 && "mt-4")}>
          {g.label &&
            (collapsed ? (
              <div className="mx-3 mb-2 border-t border-white/10" aria-hidden />
            ) : (
              <p className="mb-1 px-3 text-[11px] font-semibold uppercase tracking-[0.1em] text-[#8FA0B3]">{g.label}</p>
            ))}
          <ul className="space-y-0.5">
            {g.items.map((it) => {
              const active = isActive(it, pathname);
              return (
                <li key={it.to}>
                  <NavLink
                    to={it.to}
                    end={it.end}
                    onClick={onNavigate}
                    title={collapsed ? label(it) : undefined}
                    aria-current={active ? "page" : undefined}
                    className={clsx(
                      "relative flex min-h-10 items-center gap-3 rounded-md px-3 text-[14px] font-medium transition-colors duration-150 motion-reduce:transition-none",
                      "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-amber",
                      collapsed && "justify-center px-0",
                      active ? "bg-white/[0.09] text-white" : "text-[#C9D1DB] hover:bg-white/[0.05] hover:text-white",
                    )}
                  >
                    {active && <span className="absolute inset-y-1.5 left-0 w-[3px] rounded-r bg-amber" aria-hidden />}
                    <span className={clsx("shrink-0", active ? "text-amber" : "text-[#8FA0B3]")}>{it.icon}</span>
                    <span className={clsx("truncate", collapsed && "sr-only")}>{label(it)}</span>
                  </NavLink>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}

function SidebarBrand({ user, collapsed }: { user: User; collapsed: boolean }) {
  return (
    <div className={clsx("border-b border-white/10", collapsed ? "px-2 py-4" : "px-4 py-4")}>
      <Link
        to={homeFor(user.role)}
        aria-label="GRIEVANCE dashboard"
        className={clsx("flex items-center gap-2.5 rounded-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber", collapsed && "justify-center")}
      >
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-canvas">
          <img src="/brand/grievance-emblem.webp" alt="" width={28} height={26} style={{ height: 26, width: "auto" }} />
        </span>
        {!collapsed && <span className="text-[15px] font-bold tracking-[0.12em] text-white">GRIEVANCE</span>}
      </Link>
      {!collapsed && (
        <div className="mt-3 rounded-md bg-white/[0.06] px-3 py-2">
          <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-amber">{ROLE_LABEL[user.role]}</p>
          {user.department_name && <p className="mt-0.5 truncate text-[12px] text-[#C9D1DB]">{user.department_name}</p>}
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ header pieces */

function Breadcrumbs({ role }: { role: Role }) {
  const { pathname } = useLocation();
  const item = currentItem(role, pathname);
  const home = NAV[role][0].items[0];
  const crumbs: { to?: string; label: string }[] = [{ to: home.to, label: home.label }];
  if (item && item.to !== home.to) crumbs.push({ to: item.to, label: item.label });
  const detail = pathname.match(/\/grievances\/([^/]+)$/)?.[1] ?? pathname.match(/\/observability\/([^/]+)$/)?.[1];
  if (detail) crumbs.push({ label: decodeURIComponent(detail) });
  if (!item && pathname !== home.to) crumbs.push({ label: "Page" });
  return (
    <nav aria-label="Breadcrumb" className="min-w-0">
      <ol className="flex min-w-0 items-center gap-1.5 text-[13px]">
        {crumbs.map((c, i) => {
          const last = i === crumbs.length - 1;
          return (
            <li key={i} className={clsx("flex min-w-0 items-center gap-1.5", !last && i === 0 && crumbs.length > 2 && "hidden sm:flex")}>
              {i > 0 && <IconChevron width={12} height={12} className={clsx("shrink-0 text-ink-muted", i === 1 && crumbs.length > 2 && "hidden sm:block")} aria-hidden />}
              {last || !c.to ? (
                <span aria-current={last ? "page" : undefined} className={clsx("truncate", last ? "font-semibold text-ink" : "text-ink-muted")}>
                  {c.label}
                </span>
              ) : (
                <Link to={c.to} className={clsx("truncate rounded-sm text-ink-muted hover:text-ink hover:underline", FOCUS)}>
                  {c.label}
                </Link>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

/** Staff search: finds grievances by reference, title or location within the user's own access scope. */
function CaseSearch({ role }: { role: Role }) {
  const nav = useNavigate();
  const [q, setQ] = useState("");
  const target = { officer: "/officer/all", dept_admin: "/department/grievances", admin: "/admin/grievances", citizen: "/citizen/grievances" }[role];
  const submit = (e: FormEvent) => {
    e.preventDefault();
    const v = q.trim();
    if (v) nav(`${target}?q=${encodeURIComponent(v)}`);
  };
  return (
    <form role="search" onSubmit={submit} className="relative hidden md:block">
      <label htmlFor="case-search" className="sr-only">
        Search grievances
      </label>
      <IconSearch width={16} height={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted" />
      <input
        id="case-search"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder={role === "citizen" ? "Search my grievances" : "Search grievance ID, title, place"}
        className="h-10 w-56 rounded-md border border-line bg-surface pl-9 pr-3 text-sm text-ink placeholder:text-ink-muted focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100 xl:w-72"
      />
    </form>
  );
}

/* ------------------------------------------------------------------ shell */

export function AppShell({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth();
  const nav = useNavigate();
  const { pathname } = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem(COLLAPSE_KEY) === "1";
    } catch {
      return false;
    }
  });
  const menuButton = useRef<HTMLButtonElement>(null);
  const drawer = useRef<HTMLDivElement>(null);

  useEffect(() => setMobileOpen(false), [pathname]);
  useEffect(() => {
    if (!mobileOpen) return;
    drawer.current?.querySelector<HTMLElement>("a,button")?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setMobileOpen(false);
        menuButton.current?.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [mobileOpen]);

  if (!user) return null;
  const toggleCollapsed = () => {
    setCollapsed((c) => {
      try {
        localStorage.setItem(COLLAPSE_KEY, c ? "0" : "1");
      } catch {
        /* preference not persisted */
      }
      return !c;
    });
  };
  const signOut = () => {
    logout();
    nav("/");
  };

  return (
    <div className="min-h-screen bg-canvas">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[70] focus:rounded-md focus:bg-navy focus:px-4 focus:py-2.5 focus:font-semibold focus:text-white">
        Skip to content
      </a>

      {/* Desktop sidebar */}
      <aside
        className={clsx(
          "fixed inset-y-0 left-0 z-30 hidden flex-col bg-navy transition-[width] duration-200 motion-reduce:transition-none lg:flex",
          collapsed ? "w-[72px]" : "w-64",
        )}
        aria-label="Sidebar"
      >
        <SidebarBrand user={user} collapsed={collapsed} />
        <SidebarNav role={user.role} collapsed={collapsed} />
        <div className="border-t border-white/10 p-2">
          <button
            onClick={toggleCollapsed}
            aria-expanded={!collapsed}
            className={clsx(
              "flex min-h-10 w-full items-center gap-3 rounded-md px-3 text-[13px] font-medium text-[#C9D1DB] transition-colors duration-150 hover:bg-white/[0.05] hover:text-white",
              "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-amber",
              collapsed && "justify-center px-0",
            )}
          >
            <IconChevron width={18} height={18} className={clsx("shrink-0 transition-transform duration-200 motion-reduce:transition-none", !collapsed && "rotate-180")} aria-hidden />
            <span className={clsx(collapsed && "sr-only")}>{collapsed ? "Expand sidebar" : "Collapse sidebar"}</span>
          </button>
        </div>
      </aside>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-navy/50" onClick={() => setMobileOpen(false)} aria-hidden />
          <div ref={drawer} id="mobile-sidebar" role="dialog" aria-modal="true" aria-label="Navigation" className="absolute inset-y-0 left-0 flex w-[min(18rem,85vw)] flex-col bg-navy shadow-overlay">
            <div className="flex items-start justify-between">
              <div className="min-w-0 flex-1">
                <SidebarBrand user={user} collapsed={false} />
              </div>
              <button
                onClick={() => {
                  setMobileOpen(false);
                  menuButton.current?.focus();
                }}
                className="m-3 flex h-10 w-10 shrink-0 items-center justify-center rounded-md text-[#C9D1DB] hover:bg-white/[0.06] hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber"
                aria-label="Close navigation"
              >
                <IconClose width={20} height={20} />
              </button>
            </div>
            <SidebarNav role={user.role} collapsed={false} onNavigate={() => setMobileOpen(false)} />
            <div className="border-t border-white/10 p-2">
              <button onClick={signOut} className="flex min-h-10 w-full items-center gap-3 rounded-md px-3 text-[14px] font-medium text-[#C9D1DB] hover:bg-white/[0.05] hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber">
                <IconSignOut width={20} height={20} /> Sign out
              </button>
            </div>
          </div>
        </div>
      )}

      <div className={clsx("flex min-h-screen flex-col transition-[padding] duration-200 motion-reduce:transition-none", collapsed ? "lg:pl-[72px]" : "lg:pl-64")}>
        <header className="sticky top-0 z-20 border-b border-line bg-surface">
          <div className="flex h-16 items-center gap-3 px-3 sm:px-5 lg:px-8">
            <button
              ref={menuButton}
              onClick={() => setMobileOpen(true)}
              className={clsx("flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-line text-ink lg:hidden", FOCUS)}
              aria-label="Open navigation"
              aria-expanded={mobileOpen}
              aria-controls="mobile-sidebar"
            >
              <IconMenu width={20} height={20} />
            </button>
            <div className="min-w-0 flex-1">
              <Breadcrumbs role={user.role} />
            </div>
            <div className="flex shrink-0 items-center gap-1 sm:gap-2">
              <CaseSearch role={user.role} />
              {user.role === "citizen" && (
                <div className="hidden sm:block">
                  <LanguageSwitcher />
                </div>
              )}
              <NotificationBell role={user.role} />
              <ProfileMenu user={user} onSignOut={signOut} />
            </div>
          </div>
        </header>
        <main id="main" tabIndex={-1} className="mx-auto w-full max-w-[1280px] flex-1 px-4 py-6 focus:outline-none sm:px-6 sm:py-8 lg:px-8">
          {children}
        </main>
        <footer className="border-t border-line px-4 py-4 text-[12px] text-ink-muted sm:px-6 lg:px-8">
          <div className="mx-auto flex max-w-[1280px] flex-wrap items-center justify-between gap-2">
            <p>GRIEVANCE · built for HackFusion 4.0 · not affiliated with any government body</p>
            <nav aria-label="Footer" className="flex flex-wrap gap-x-4">
              <Link to="/help" className="hover:text-ink hover:underline">Help</Link>
              <Link to="/privacy" className="hover:text-ink hover:underline">Privacy</Link>
              <Link to="/terms" className="hover:text-ink hover:underline">Terms</Link>
            </nav>
          </div>
        </footer>
      </div>
    </div>
  );
}
