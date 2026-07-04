import DashboardShell from "./DashboardShell";
import { useAuth } from "../../context/AuthContext";

export default function SuperAdminDashboard() {
  const { user } = useAuth();

  return (
    <DashboardShell roleTitle="Super Admin" accentIcon="bi-shield-lock-fill">
      <div className="card border-0 shadow-sm" style={{ maxWidth: 640 }}>
        <div className="card-body p-4">
          <h4 className="mb-1">Welcome, {user?.first_name}.</h4>
          <p className="text-muted mb-0">
            You're signed in as the Super Admin. Department admin
            provisioning, instructor oversight, and system-wide gateway
            controls will live here.
          </p>
        </div>
      </div>
    </DashboardShell>
  );
}