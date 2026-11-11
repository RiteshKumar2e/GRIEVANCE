import { lazy, Suspense, type ReactNode } from "react";
import { matchPath, Navigate, Route, Routes, useLocation } from "react-router-dom";
import { AppShell } from "./components/AppShell";
import { ConsentBanner, PageViewTracker } from "./components/SiteChrome";
import { Spinner } from "./components/ui";
import { homeFor, useAuth } from "./lib/auth";
import { usePageMeta } from "./lib/meta";
import type { Role } from "./lib/types";
import Landing from "./pages/public/Landing";
import Login from "./pages/public/Login";
import NotFound from "./pages/public/NotFound";
import Register from "./pages/public/Register";

// Route-level code splitting: dashboards and charts load only when needed.
const Help = lazy(() => import("./pages/public/Help"));
const SharedTrace = lazy(() => import("./pages/public/SharedTrace"));
const PrivacyPolicy = lazy(() => import("./pages/public/Legal").then((m) => ({ default: m.PrivacyPolicy })));
const Terms = lazy(() => import("./pages/public/Legal").then((m) => ({ default: m.Terms })));
const CitizenHome = lazy(() => import("./pages/citizen/CitizenHome"));
const NewGrievance = lazy(() => import("./pages/citizen/NewGrievance"));
const GrievanceTrack = lazy(() => import("./pages/citizen/GrievanceTrack"));
const Notifications = lazy(() => import("./pages/Notifications"));
const OfficerQueue = lazy(() => import("./pages/officer/OfficerQueue"));
const OfficerGrievance = lazy(() => import("./pages/officer/OfficerGrievance"));
const AdminOverview = lazy(() => import("./pages/admin/AdminOverview"));
const AdminSla = lazy(() => import("./pages/admin/AdminSla"));
const AdminCategories = lazy(() => import("./pages/admin/AdminCategories"));
const AdminDepartments = lazy(() => import("./pages/admin/AdminDepartments"));
const AdminDatasets = lazy(() => import("./pages/admin/AdminDatasets"));
const AdminWebhooks = lazy(() => import("./pages/admin/AdminWebhooks"));
const AdminAudit = lazy(() => import("./pages/admin/AdminAudit"));
const ExternalData = lazy(() => import("./pages/admin/ExternalData"));
const Observability = lazy(() => import("./pages/admin/Observability"));

/** Title + description per route. Private pages are marked noindex. */
const META: [string, string, string?, boolean?][] = [
  ["/", "", undefined, false],
  ["/login", "Sign in", "Sign in to file and track grievances, or to manage them as an officer or administrator."],
  ["/register", "Create an account", "Register as a citizen to report civic problems in Hindi, Marathi or English."],
  ["/help", "Help and support", "Answers to common questions about filing, tracking and disputing grievances."],
  ["/privacy", "Privacy policy", "How GRIEVANCE collects, uses, protects and retains information."],
  ["/terms", "Terms & conditions", "Terms for using the GRIEVANCE grievance-redressal platform."],
  ["/share/trace/:token", "Shared agent trace", "A redacted, shareable view of one agent workflow.", true],
  ["/citizen", "My grievances", undefined, true],
  ["/citizen/new", "File a grievance", undefined, true],
  ["/citizen/grievances/:id", "Track grievance", undefined, true],
  ["/notifications", "Notifications", undefined, true],
  ["/officer", "My queue", undefined, true],
  ["/officer/review", "Human review queue", undefined, true],
  ["/officer/department", "Department grievances", undefined, true],
  ["/officer/grievances/:id", "Grievance workspace", undefined, true],
  ["/admin", "Administration overview", undefined, true],
  ["/admin/sla", "SLA & insights", undefined, true],
  ["/admin/categories", "Category Master", undefined, true],
  ["/admin/departments", "Departments", undefined, true],
  ["/admin/datasets", "Datasets", undefined, true],
  ["/admin/webhooks", "Webhooks", undefined, true],
  ["/admin/audit", "Audit log", undefined, true],
  ["/admin/public-data", "Public data", undefined, true],
  ["/admin/observability", "Observability", undefined, true],
  ["/admin/observability/:traceId", "Trace", undefined, true],
];

function RouteMeta() {
  const { pathname } = useLocation();
  const hit = META.find(([pattern]) => matchPath({ path: pattern, end: true }, pathname));
  usePageMeta(hit ? hit[1] : "Page not found", hit?.[2], { noindex: hit ? !!hit[3] : true });
  return null;
}

function Protected({ roles, children }: { roles: Role[]; children: ReactNode }) {
  const { user, loading } = useAuth();
  const loc = useLocation();
  if (loading) return <Spinner label="Checking your session" />;
  if (!user) return <Navigate to="/login" state={{ from: loc.pathname }} replace />;
  if (!roles.includes(user.role)) return <Navigate to={homeFor(user.role)} replace />;
  return <AppShell>{children}</AppShell>;
}

const ALL: Role[] = ["citizen", "officer", "admin"];
const STAFF: Role[] = ["officer", "admin"];

export default function App() {
  return (
    <>
      <RouteMeta />
      <PageViewTracker />
      <Suspense fallback={<Spinner />}>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/help" element={<Help />} />
          <Route path="/privacy" element={<PrivacyPolicy />} />
          <Route path="/terms" element={<Terms />} />
          <Route path="/share/trace/:token" element={<SharedTrace />} />

          <Route path="/citizen" element={<Protected roles={["citizen"]}><CitizenHome /></Protected>} />
          <Route path="/citizen/new" element={<Protected roles={["citizen"]}><NewGrievance /></Protected>} />
          <Route path="/citizen/grievances/:id" element={<Protected roles={["citizen"]}><GrievanceTrack /></Protected>} />
          <Route path="/notifications" element={<Protected roles={ALL}><Notifications /></Protected>} />

          <Route path="/officer" element={<Protected roles={STAFF}><OfficerQueue scope="mine" /></Protected>} />
          <Route path="/officer/review" element={<Protected roles={STAFF}><OfficerQueue scope="review" /></Protected>} />
          <Route path="/officer/department" element={<Protected roles={STAFF}><OfficerQueue scope="department" /></Protected>} />
          <Route path="/officer/grievances/:id" element={<Protected roles={STAFF}><OfficerGrievance /></Protected>} />

          <Route path="/admin" element={<Protected roles={["admin"]}><AdminOverview /></Protected>} />
          <Route path="/admin/sla" element={<Protected roles={["admin"]}><AdminSla /></Protected>} />
          <Route path="/admin/categories" element={<Protected roles={["admin"]}><AdminCategories /></Protected>} />
          <Route path="/admin/departments" element={<Protected roles={["admin"]}><AdminDepartments /></Protected>} />
          <Route path="/admin/datasets" element={<Protected roles={["admin"]}><AdminDatasets /></Protected>} />
          <Route path="/admin/webhooks" element={<Protected roles={["admin"]}><AdminWebhooks /></Protected>} />
          <Route path="/admin/audit" element={<Protected roles={["admin"]}><AdminAudit /></Protected>} />
          <Route path="/admin/public-data" element={<Protected roles={["admin"]}><ExternalData /></Protected>} />
          <Route path="/admin/observability" element={<Protected roles={["admin"]}><Observability /></Protected>} />
          <Route path="/admin/observability/:traceId" element={<Protected roles={["admin"]}><Observability /></Protected>} />

          <Route path="*" element={<NotFound />} />
        </Routes>
      </Suspense>
      <ConsentBanner />
    </>
  );
}
