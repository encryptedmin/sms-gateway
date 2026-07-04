import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import ProtectedRoute from "./routes/ProtectedRoute";
import RoleRedirect from "./routes/RoleRedirect";
import LoginPage from "./features/auth/LoginPage";
import SuperAdminDashboard from "./pages/dashboards/SuperAdminDashboard";
import DepartmentAdminDashboard from "./pages/dashboards/DepartmentAdminDashboard";
import InstructorDashboard from "./pages/dashboards/InstructorDashboard";
import SubscriberDashboard from "./pages/dashboards/SubscriberDashboard";
import Unauthorized from "./pages/Unauthorized";
import NotFound from "./pages/NotFound";
import { ROLES } from "./utils/roles";

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/" element={<RoleRedirect />} />
          <Route path="/login" element={<LoginPage />} />

          <Route
            path="/super-admin"
            element={
              <ProtectedRoute allowedRoles={[ROLES.SUPER_ADMIN]}>
                <SuperAdminDashboard />
              </ProtectedRoute>
            }
          />

          <Route
            path="/department-admin"
            element={
              <ProtectedRoute allowedRoles={[ROLES.DEPARTMENT_ADMIN]}>
                <DepartmentAdminDashboard />
              </ProtectedRoute>
            }
          />

          <Route
            path="/instructor"
            element={
              <ProtectedRoute allowedRoles={[ROLES.INSTRUCTOR]}>
                <InstructorDashboard />
              </ProtectedRoute>
            }
          />

          <Route
            path="/subscriber"
            element={
              <ProtectedRoute allowedRoles={[ROLES.SUBSCRIBER]}>
                <SubscriberDashboard />
              </ProtectedRoute>
            }
          />

          <Route path="/unauthorized" element={<Unauthorized />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}