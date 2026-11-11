import type { ReactNode } from "react";
import type { Role } from "../lib/types";

/* ------------------------------------------------------------------ icons (24px grid, 1.6 stroke) */

function I({ children }: { children: ReactNode }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden focusable="false">
      {children}
    </svg>
  );
}

export const NavIcons = {
  home: <I><path d="M4 11l8-6.5 8 6.5" /><path d="M6 9.5V19h12V9.5" /><path d="M10 19v-5h4v5" /></I>,
  list: <I><path d="M9 6h11M9 12h11M9 18h11" /><path d="M4.5 6h.01M4.5 12h.01M4.5 18h.01" /></I>,
  plus: <I><rect x="4" y="4" width="16" height="16" rx="2" /><path d="M12 8v8M8 12h8" /></I>,
  track: <I><circle cx="11" cy="11" r="6.5" /><path d="M16 16l4 4" /><path d="M8.5 11h5M11 8.5v5" /></I>,
  bell: <I><path d="M6 16V11a6 6 0 1 1 12 0v5l1.5 2h-15L6 16z" /><path d="M10 20a2 2 0 0 0 4 0" /></I>,
  user: <I><circle cx="12" cy="8" r="3.5" /><path d="M5 20c.8-3.8 3.6-6 7-6s6.2 2.2 7 6" /></I>,
  help: <I><circle cx="12" cy="12" r="8.5" /><path d="M9.6 9.3a2.5 2.5 0 0 1 4.8.9c0 1.7-2.4 2.1-2.4 3.6" /><path d="M12 16.8v.2" /></I>,
  inbox: <I><path d="M4 13l2.5-7.5h11L20 13v5.5H4z" /><path d="M4 13h4.5l1 2h5l1-2H20" /></I>,
  folder: <I><path d="M3.5 7.5V18a1.5 1.5 0 0 0 1.5 1.5h14a1.5 1.5 0 0 0 1.5-1.5V9a1.5 1.5 0 0 0-1.5-1.5h-7L10 5H5a1.5 1.5 0 0 0-1.5 1.5z" /></I>,
  review: <I><rect x="5" y="3.5" width="14" height="17" rx="2" /><path d="M9 9h6M9 13h3" /><path d="M13 17l1.5 1.5L18 15" /></I>,
  escalate: <I><path d="M12 19V6M6.5 11.5L12 6l5.5 5.5" /><path d="M5 20h14" /></I>,
  clock: <I><circle cx="12" cy="12" r="8.5" /><path d="M12 7.5V12l3 2" /></I>,
  link: <I><path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1" /><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" /></I>,
  chart: <I><path d="M4 20h16" /><path d="M7 16v-5M12 16V7M17 16v-8" /></I>,
  pie: <I><path d="M12 3.5v8.5h8.5A8.5 8.5 0 1 1 12 3.5z" /><path d="M15 3.9A8.5 8.5 0 0 1 20.1 9H15z" /></I>,
  team: <I><circle cx="9" cy="8.5" r="3" /><path d="M3.5 19c.6-3.2 2.8-5 5.5-5s4.9 1.8 5.5 5" /><circle cx="17" cy="9.5" r="2.3" /><path d="M16 14.2c2.3.2 4 1.7 4.5 4.3" /></I>,
  assign: <I><path d="M4 7h11M11.5 3.5L15 7l-3.5 3.5" /><path d="M20 17H9M12.5 13.5L9 17l3.5 3.5" /></I>,
  approve: <I><circle cx="12" cy="12" r="8.5" /><path d="M8.5 12.3l2.4 2.4L15.7 9.8" /></I>,
  users: <I><circle cx="12" cy="8" r="3.5" /><path d="M5 20c.8-3.8 3.6-6 7-6s6.2 2.2 7 6" /><path d="M18.5 4.5l1.5 1.5-1.5 1.5" /></I>,
  building: <I><path d="M4 20h16M6 20V8l6-4 6 4v12" /><path d="M10 20v-4h4v4M9.5 10.5h.01M14.5 10.5h.01M9.5 13.5h.01M14.5 13.5h.01" /></I>,
  tags: <I><path d="M3.5 12.5V5a1.5 1.5 0 0 1 1.5-1.5h7.5L20.5 11.5l-9 9z" /><circle cx="8" cy="8" r="1.3" /></I>,
  shield: <I><path d="M12 3.5l7 3v5.5c0 4-3 7-7 8.5-4-1.5-7-4.5-7-8.5V6.5z" /><path d="M9 12l2 2 4-4" /></I>,
  ai: <I><rect x="6" y="6" width="12" height="12" rx="2" /><path d="M9.5 3.5v2.5M14.5 3.5v2.5M9.5 18v2.5M14.5 18v2.5M3.5 9.5H6M3.5 14.5H6M18 9.5h2.5M18 14.5h2.5" /><path d="M10 10h4v4h-4z" /></I>,
  audit: <I><path d="M7 3.5h7.5L19 8v12.5H7z" /><path d="M14 3.5V8h5" /><path d="M10 12h6M10 15.5h6" /></I>,
  plug: <I><path d="M9 3.5V8M15 3.5V8" /><path d="M6.5 8h11v3a5.5 5.5 0 0 1-11 0z" /><path d="M12 16.5v4" /></I>,
  settings: <I><circle cx="12" cy="12" r="3" /><path d="M12 3.5v2.2M12 18.3v2.2M20.5 12h-2.2M5.7 12H3.5M18 6l-1.6 1.6M7.6 16.4L6 18M18 18l-1.6-1.6M7.6 7.6L6 6" /></I>,
  data: <I><ellipse cx="12" cy="6" rx="7" ry="2.5" /><path d="M5 6v12c0 1.4 3.1 2.5 7 2.5s7-1.1 7-2.5V6" /><path d="M5 12c0 1.4 3.1 2.5 7 2.5s7-1.1 7-2.5" /></I>,
  globe: <I><circle cx="12" cy="12" r="8.5" /><path d="M3.5 12h17M12 3.5c2.4 2.4 3.5 5.3 3.5 8.5s-1.1 6.1-3.5 8.5c-2.4-2.4-3.5-5.3-3.5-8.5S9.6 5.9 12 3.5z" /></I>,
};

/* ------------------------------------------------------------------ navigation model */

export interface NavItem {
  to: string;
  label: string;
  icon: ReactNode;
  /** Exact-match only (dashboards). */
  end?: boolean;
  /** Extra path prefixes that should highlight this item (detail pages, legacy routes). */
  match?: string[];
}
export interface NavGroup {
  label?: string;
  items: NavItem[];
}

const ACCOUNT_STAFF: NavGroup = {
  label: "Account",
  items: [
    { to: "/notifications", label: "Notifications", icon: NavIcons.bell },
    { to: "/profile", label: "My Profile", icon: NavIcons.user },
  ],
};

export const NAV: Record<Role, NavGroup[]> = {
  citizen: [
    { items: [{ to: "/citizen", label: "My Dashboard", icon: NavIcons.home, end: true }] },
    {
      label: "Grievances",
      items: [
        { to: "/citizen/grievances", label: "My Grievances", icon: NavIcons.list },
        { to: "/citizen/new", label: "File a Grievance", icon: NavIcons.plus },
        { to: "/citizen/track", label: "Track Complaint", icon: NavIcons.track },
      ],
    },
    {
      label: "Account",
      items: [
        { to: "/notifications", label: "Notifications", icon: NavIcons.bell },
        { to: "/profile", label: "My Profile", icon: NavIcons.user },
        { to: "/citizen/help", label: "Help & Support", icon: NavIcons.help },
      ],
    },
  ],
  officer: [
    { items: [{ to: "/officer", label: "Overview", icon: NavIcons.home, end: true }] },
    {
      label: "Case work",
      items: [
        { to: "/officer/cases", label: "Assigned Cases", icon: NavIcons.inbox, match: ["/officer/grievances"] },
        { to: "/officer/all", label: "All Grievances", icon: NavIcons.folder, match: ["/officer/department"] },
        { to: "/officer/review", label: "Review Queue", icon: NavIcons.review },
        { to: "/officer/escalations", label: "Escalations", icon: NavIcons.escalate },
        { to: "/officer/sla", label: "SLA Monitoring", icon: NavIcons.clock },
        { to: "/officer/duplicates", label: "Duplicate Incidents", icon: NavIcons.link },
      ],
    },
    { label: "Insights", items: [{ to: "/officer/reports", label: "Reports & Analytics", icon: NavIcons.chart }] },
    ACCOUNT_STAFF,
  ],
  dept_admin: [
    { items: [{ to: "/department", label: "Department Overview", icon: NavIcons.home, end: true }] },
    {
      label: "Cases",
      items: [
        { to: "/department/grievances", label: "Department Grievances", icon: NavIcons.folder },
        { to: "/department/distribution", label: "Case Distribution", icon: NavIcons.pie },
        { to: "/department/assignments", label: "Assignment Management", icon: NavIcons.assign },
        { to: "/department/approvals", label: "Pending Approvals", icon: NavIcons.approve },
      ],
    },
    { label: "Team", items: [{ to: "/department/team", label: "Officers & Team", icon: NavIcons.team }] },
    {
      label: "Performance",
      items: [
        { to: "/department/sla", label: "SLA Performance", icon: NavIcons.clock },
        { to: "/department/reports", label: "Reports & Analytics", icon: NavIcons.chart },
      ],
    },
    ACCOUNT_STAFF,
  ],
  admin: [
    { items: [{ to: "/admin", label: "Platform Overview", icon: NavIcons.home, end: true }] },
    {
      label: "Administration",
      items: [
        { to: "/admin/users", label: "User Management", icon: NavIcons.users },
        { to: "/admin/departments", label: "Departments", icon: NavIcons.building },
        { to: "/admin/categories", label: "Category Master", icon: NavIcons.tags },
        { to: "/admin/policy", label: "Policy & Rules", icon: NavIcons.shield },
        { to: "/admin/sla-config", label: "SLA Configuration", icon: NavIcons.clock, match: ["/admin/sla"] },
      ],
    },
    {
      label: "Operations",
      items: [
        { to: "/admin/grievances", label: "Grievance Management", icon: NavIcons.folder, match: ["/admin/review", "/officer/review", "/officer/department"] },
        { to: "/admin/audit", label: "Audit Logs", icon: NavIcons.audit },
      ],
    },
    {
      label: "Monitoring",
      items: [
        { to: "/admin/observability", label: "AI & RAG Monitoring", icon: NavIcons.ai },
        { to: "/admin/integrations", label: "Integrations & Webhooks", icon: NavIcons.plug, match: ["/admin/webhooks"] },
      ],
    },
    {
      label: "System",
      items: [{ to: "/admin/settings", label: "System Settings", icon: NavIcons.settings, match: ["/admin/datasets", "/admin/public-data"] }],
    },
    ACCOUNT_STAFF,
  ],
};

export function isActive(item: NavItem, pathname: string): boolean {
  const hit = (p: string) => pathname === p || pathname.startsWith(p + "/");
  if (item.end) return pathname === item.to;
  return hit(item.to) || (item.match ?? []).some(hit);
}

/** Finds the navigation item for the current path (most specific match wins). */
export function currentItem(role: Role, pathname: string): NavItem | undefined {
  const all = NAV[role].flatMap((g) => g.items);
  return all.filter((it) => isActive(it, pathname)).sort((a, b) => b.to.length - a.to.length)[0];
}

/** Where a staff member opens a case, so breadcrumbs and the sidebar stay in their own section. */
export function caseHref(role: Role, publicId: string): string {
  if (role === "citizen") return `/citizen/grievances/${publicId}`;
  if (role === "dept_admin") return `/department/grievances/${publicId}`;
  if (role === "admin") return `/admin/grievances/${publicId}`;
  return `/officer/grievances/${publicId}`;
}
