import type { ReactNode } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { AppShell } from "./components/AppShell";
import { Spinner } from "./components/ui";
import { homeFor, useAuth } from "./lib/auth";
import type { Role } from "./lib/types";
import AdminAudit from "./pages/admin/AdminAudit";
import AdminCategories from "./pages/admin/AdminCategories";
import AdminDatasets from "./pages/admin/AdminDatasets";
import AdminDepartments from "./pages/admin/AdminDepartments";
import AdminOverview from "./pages/admin/AdminOverview";
import AdminSla from "./pages/admin/AdminSla";
import AdminWebhooks from "./pages/admin/AdminWebhooks";
import Observability from "./pages/admin/Observability";
import CitizenHome from "./pages/citizen/CitizenHome";
import GrievanceTrack from "./pages/citizen/GrievanceTrack";
import NewGrievance from "./pages/citizen/NewGrievance";
import Notifications from "./pages/Notifications";
import OfficerGrievance from "./pages/officer/OfficerGrievance";
import OfficerQueue from "./pages/officer/OfficerQueue";
import Landing from "./pages/public/Landing";
import Login from "./pages/public/Login";
import NotFound from "./pages/public/NotFound";
import Register from "./pages/public/Register";
import SharedTrace from "./pages/public/SharedTrace";

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
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
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
      <Route path="/admin/observability" element={<Protected roles={["admin"]}><Observability /></Protected>} />
      <Route path="/admin/observability/:traceId" element={<Protected roles={["admin"]}><Observability /></Protected>} />

      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}
