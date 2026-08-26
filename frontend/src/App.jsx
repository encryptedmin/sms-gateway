import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import { ToastProvider } from "./context/ToastContext";
import ProtectedRoute from "./routes/ProtectedRoute";
import RoleRedirect from "./routes/RoleRedirect";
import LoginPage from "./features/auth/LoginPage";

import SuperAdminLayout from "./features/super-admin/SuperAdminLayout";
import SuperAdminOverviewPage from "./features/super-admin/pages/OverviewPage";
import PlansPage from "./features/super-admin/pages/PlansPage";
import DepartmentAdminsPage from "./features/super-admin/pages/DepartmentAdminsPage";
import SubscribersPage from "./features/super-admin/pages/SubscribersPage";
import SuperAdminSmsLogsPage from "./features/super-admin/pages/SmsLogsPage";

import DepartmentAdminLayout from "./features/department-admin/DepartmentAdminLayout";
import DeptOverviewPage from "./features/department-admin/pages/OverviewPage";
import InstructorsPage from "./features/department-admin/pages/InstructorsPage";
import ContactsPage from "./features/department-admin/pages/ContactsPage";
import ContactGroupsPage from "./features/department-admin/pages/ContactGroupsPage";
import MessageTemplatesPage from "./features/department-admin/pages/MessageTemplatesPage";
import SendSmsPage from "./features/department-admin/pages/SendSmsPage";
import DeptSmsLogsPage from "./features/department-admin/pages/SmsLogsPage";

import InstructorLayout from "./features/instructor/InstructorLayout";
import InstructorOverviewPage from "./features/instructor/pages/OverviewPage";
import InstructorContactsPage from "./features/instructor/pages/ContactsPage";
import InstructorContactGroupsPage from "./features/instructor/pages/ContactGroupsPage";
import InstructorMessageTemplatesPage from "./features/instructor/pages/MessageTemplatesPage";
import InstructorSendSmsPage from "./features/instructor/pages/SendSmsPage";
import InstructorSmsLogsPage from "./features/instructor/pages/SmsLogsPage";
import SubscriberDashboard from "./pages/dashboards/SubscriberDashboard";
import Unauthorized from "./pages/Unauthorized";
import NotFound from "./pages/NotFound";
import { ROLES } from "./utils/roles";

export default function App() {
  return (
    <BrowserRouter>
      <ToastProvider>
        <AuthProvider>
          <Routes>
            <Route path="/" element={<RoleRedirect />} />
            <Route path="/login" element={<LoginPage />} />

            <Route
              path="/super-admin"
              element={
                <ProtectedRoute allowedRoles={[ROLES.SUPER_ADMIN]}>
                  <SuperAdminLayout />
                </ProtectedRoute>
              }
            >
              <Route index element={<SuperAdminOverviewPage />} />
              <Route path="plans" element={<PlansPage />} />
              <Route path="department-admins" element={<DepartmentAdminsPage />} />
              <Route path="subscribers" element={<SubscribersPage />} />
              <Route path="logs" element={<SuperAdminSmsLogsPage />} />
            </Route>

            <Route
              path="/department-admin"
              element={
                <ProtectedRoute allowedRoles={[ROLES.DEPARTMENT_ADMIN]}>
                  <DepartmentAdminLayout />
                </ProtectedRoute>
              }
            >
              <Route index element={<DeptOverviewPage />} />
              <Route path="instructors" element={<InstructorsPage />} />
              <Route path="contacts" element={<ContactsPage />} />
              <Route path="groups" element={<ContactGroupsPage />} />
              <Route path="templates" element={<MessageTemplatesPage />} />
              <Route path="send" element={<SendSmsPage />} />
              <Route path="logs" element={<DeptSmsLogsPage />} />
            </Route>

            <Route
              path="/instructor"
              element={
                <ProtectedRoute allowedRoles={[ROLES.INSTRUCTOR]}>
                  <InstructorLayout />
                </ProtectedRoute>
              }
            >
              <Route index element={<InstructorOverviewPage />} />
              <Route path="contacts" element={<InstructorContactsPage />} />
              <Route path="groups" element={<InstructorContactGroupsPage />} />
              <Route path="templates" element={<InstructorMessageTemplatesPage />} />
              <Route path="send" element={<InstructorSendSmsPage />} />
              <Route path="logs" element={<InstructorSmsLogsPage />} />
            </Route>

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
      </ToastProvider>
    </BrowserRouter>
  );
}