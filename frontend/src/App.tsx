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
const Profile = lazy(() => import("./pages/Profile"));
const Notifications = lazy(() => import("./pages/Notifications"));

const citizen = () => import("./pages/citizen/CitizenPages");
const CitizenDashboard = lazy(() => citizen().then((m) => ({ default: m.CitizenDashboard })));
const CitizenGrievances = lazy(() => citizen().then((m) => ({ default: m.CitizenGrievances })));
const TrackComplaint = lazy(() => citizen().then((m) => ({ default: m.TrackComplaint })));
const CitizenHelp = lazy(() => citizen().then((m) => ({ default: m.CitizenHelp })));
const NewGrievance = lazy(() => import("./pages/citizen/NewGrievance"));
const GrievanceTrack = lazy(() => import("./pages/citizen/GrievanceTrack"));

const officer = () => import("./pages/officer/OfficerPages");
const OfficerOverview = lazy(() => officer().then((m) => ({ default: m.OfficerOverview })));
const AssignedCases = lazy(() => officer().then((m) => ({ default: m.AssignedCases })));
const AllGrievances = lazy(() => officer().then((m) => ({ default: m.AllGrievances })));
const ReviewQueue = lazy(() => officer().then((m) => ({ default: m.ReviewQueue })));
const Escalations = lazy(() => officer().then((m) => ({ default: m.Escalations })));
const SlaMonitoring = lazy(() => officer().then((m) => ({ default: m.SlaMonitoring })));
const DuplicateIncidents = lazy(() => officer().then((m) => ({ default: m.DuplicateIncidents })));
const OfficerGrievance = lazy(() => import("./pages/officer/OfficerGrievance"));
const Reports = lazy(() => import("./pages/staff/Reports"));

const dept = () => import("./pages/department/DepartmentPages");
const DepartmentOverview = lazy(() => dept().then((m) => ({ default: m.DepartmentOverview })));
const DepartmentGrievances = lazy(() => dept().then((m) => ({ default: m.DepartmentGrievances })));
const CaseDistribution = lazy(() => dept().then((m) => ({ default: m.CaseDistribution })));
const OfficersTeam = lazy(() => dept().then((m) => ({ default: m.OfficersTeam })));
const AssignmentManagement = lazy(() => dept().then((m) => ({ default: m.AssignmentManagement })));
const PendingApprovals = lazy(() => dept().then((m) => ({ default: m.PendingApprovals })));
const SlaPerformance = lazy(() => dept().then((m) => ({ default: m.SlaPerformance })));

const admin = () => import("./pages/admin/AdminPages");
const UserManagement = lazy(() => admin().then((m) => ({ default: m.UserManagement })));
const GrievanceManagement = lazy(() => admin().then((m) => ({ default: m.GrievanceManagement })));
const PolicyRules = lazy(() => admin().then((m) => ({ default: m.PolicyRules })));
const SlaConfiguration = lazy(() => admin().then((m) => ({ default: m.SlaConfiguration })));
const Integrations = lazy(() => admin().then((m) => ({ default: m.Integrations })));
const SystemSettings = lazy(() => admin().then((m) => ({ default: m.SystemSettings })));
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
  ["/profile", "My profile", undefined, true],
  ["/notifications", "Notifications", undefined, true],
  ["/citizen", "My dashboard", undefined, true],
  ["/citizen/grievances", "My grievances", undefined, true],
  ["/citizen/new", "File a grievance", undefined, true],
  ["/citizen/track", "Track complaint", undefined, true],
  ["/citizen/help", "Help & support", undefined, true],
  ["/citizen/grievances/:id", "Track grievance", undefined, true],
  ["/officer", "Overview", undefined, true],
  ["/officer/cases", "Assigned cases", undefined, true],
  ["/officer/all", "All grievances", undefined, true],
  ["/officer/review", "Review queue", undefined, true],
  ["/officer/escalations", "Escalations", undefined, true],
  ["/officer/sla", "SLA monitoring", undefined, true],
  ["/officer/duplicates", "Duplicate incidents", undefined, true],
  ["/officer/reports", "Reports & analytics", undefined, true],
  ["/officer/grievances/:id", "Case workspace", undefined, true],
  ["/department", "Department overview", undefined, true],
  ["/department/grievances", "Department grievances", undefined, true],
  ["/department/grievances/:id", "Case workspace", undefined, true],
  ["/department/distribution", "Case distribution", undefined, true],
  ["/department/team", "Officers & team", undefined, true],
  ["/department/assignments", "Assignment management", undefined, true],
  ["/department/approvals", "Pending approvals", undefined, true],
  ["/department/sla", "SLA performance", undefined, true],
  ["/department/reports", "Reports & analytics", undefined, true],
  ["/admin", "Platform overview", undefined, true],
  ["/admin/users", "User management", undefined, true],
  ["/admin/grievances", "Grievance management", undefined, true],
  ["/admin/grievances/:id", "Case workspace", undefined, true],
  ["/admin/review", "Review queue", undefined, true],
  ["/admin/policy", "Policy & rules", undefined, true],
  ["/admin/sla-config", "SLA configuration", undefined, true],
  ["/admin/sla", "SLA analytics", undefined, true],
  ["/admin/categories", "Category Master", undefined, true],
  ["/admin/departments", "Departments", undefined, true],
  ["/admin/datasets", "Datasets", undefined, true],
  ["/admin/webhooks", "Webhooks", undefined, true],
  ["/admin/integrations", "Integrations", undefined, true],
  ["/admin/settings", "System settings", undefined, true],
  ["/admin/audit", "Audit log", undefined, true],
  ["/admin/public-data", "Public data", undefined, true],
  ["/admin/observability", "AI & RAG monitoring", undefined, true],
  ["/admin/observability/:traceId", "Trace", undefined, true],
];

function RouteMeta() {
  const { pathname } = useLocation();
  const hit = META.find(([pattern]) => matchPath({ path: pattern, end: true }, pathname));
  usePageMeta(hit ? hit[1] : "Page not found", hit?.[2], { noindex: hit ? !!hit[3] : true });
  return null;
}

/** Signed-in route guard. The backend enforces the same roles on every API call; this only picks the screen. */
function Protected({ roles, children }: { roles: Role[]; children: ReactNode }) {
  const { user, loading, signedOut } = useAuth();
  const loc = useLocation();
  if (loading) return <Spinner label="Checking your session" />;
  // After a deliberate sign-out go to the landing page; otherwise ask the visitor to sign in.
  if (!user) return signedOut ? <Navigate to="/" replace /> : <Navigate to="/login" state={{ from: loc.pathname }} replace />;
  if (!roles.includes(user.role)) return <Navigate to={homeFor(user.role)} replace />;
  return <AppShell>{children}</AppShell>;
}

const ALL: Role[] = ["citizen", "officer", "dept_admin", "admin"];
const C: Role[] = ["citizen"];
const O: Role[] = ["officer"];
const D: Role[] = ["dept_admin"];
const A: Role[] = ["admin"];
const STAFF: Role[] = ["officer", "dept_admin", "admin"];

const page = (roles: Role[], el: ReactNode) => <Protected roles={roles}>{el}</Protected>;

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

          {/* Every role */}
          <Route path="/profile" element={page(ALL, <Profile />)} />
          <Route path="/notifications" element={page(ALL, <Notifications />)} />

          {/* Citizen */}
          <Route path="/citizen" element={page(C, <CitizenDashboard />)} />
          <Route path="/citizen/grievances" element={page(C, <CitizenGrievances />)} />
          <Route path="/citizen/new" element={page(C, <NewGrievance />)} />
          <Route path="/citizen/track" element={page(C, <TrackComplaint />)} />
          <Route path="/citizen/help" element={page(C, <CitizenHelp />)} />
          <Route path="/citizen/grievances/:id" element={page(C, <GrievanceTrack />)} />

          {/* Grievance officer */}
          <Route path="/officer" element={page(O, <OfficerOverview />)} />
          <Route path="/officer/cases" element={page(O, <AssignedCases />)} />
          <Route path="/officer/all" element={page(O, <AllGrievances />)} />
          <Route path="/officer/review" element={page(O, <ReviewQueue />)} />
          <Route path="/officer/escalations" element={page(O, <Escalations />)} />
          <Route path="/officer/sla" element={page(O, <SlaMonitoring />)} />
          <Route path="/officer/duplicates" element={page(O, <DuplicateIncidents />)} />
          <Route path="/officer/reports" element={page(O, <Reports />)} />
          <Route path="/officer/department" element={<Navigate to="/officer/all" replace />} />
          {/* Kept open to every staff role so existing links (notifications, audit) still resolve. */}
          <Route path="/officer/grievances/:id" element={page(STAFF, <OfficerGrievance />)} />

          {/* Department admin */}
          <Route path="/department" element={page(D, <DepartmentOverview />)} />
          <Route path="/department/grievances" element={page(D, <DepartmentGrievances />)} />
          <Route path="/department/grievances/:id" element={page(D, <OfficerGrievance />)} />
          <Route path="/department/distribution" element={page(D, <CaseDistribution />)} />
          <Route path="/department/team" element={page(D, <OfficersTeam />)} />
          <Route path="/department/assignments" element={page(D, <AssignmentManagement />)} />
          <Route path="/department/approvals" element={page(D, <PendingApprovals />)} />
          <Route path="/department/sla" element={page(D, <SlaPerformance />)} />
          <Route path="/department/reports" element={page(D, <Reports />)} />

          {/* System admin */}
          <Route path="/admin" element={page(A, <AdminOverview />)} />
          <Route path="/admin/users" element={page(A, <UserManagement />)} />
          <Route path="/admin/departments" element={page(A, <AdminDepartments />)} />
          <Route path="/admin/categories" element={page(A, <AdminCategories />)} />
          <Route path="/admin/grievances" element={page(A, <GrievanceManagement />)} />
          <Route path="/admin/grievances/:id" element={page(A, <OfficerGrievance />)} />
          <Route path="/admin/review" element={page(A, <ReviewQueue />)} />
          <Route path="/admin/policy" element={page(A, <PolicyRules />)} />
          <Route path="/admin/sla-config" element={page(A, <SlaConfiguration />)} />
          <Route path="/admin/sla" element={page(A, <AdminSla />)} />
          <Route path="/admin/audit" element={page(A, <AdminAudit />)} />
          <Route path="/admin/observability" element={page(A, <Observability />)} />
          <Route path="/admin/observability/:traceId" element={page(A, <Observability />)} />
          <Route path="/admin/integrations" element={page(A, <Integrations />)} />
          <Route path="/admin/webhooks" element={page(A, <AdminWebhooks />)} />
          <Route path="/admin/settings" element={page(A, <SystemSettings />)} />
          <Route path="/admin/datasets" element={page(A, <AdminDatasets />)} />
          <Route path="/admin/public-data" element={page(A, <ExternalData />)} />

          <Route path="*" element={<NotFound />} />
        </Routes>
      </Suspense>
      <ConsentBanner />
    </>
  );
}
