import DashboardShell from "./DashboardShell";
import { useAuth } from "../../context/AuthContext";

export default function InstructorDashboard() {
  const { user } = useAuth();

  return (
    <DashboardShell roleTitle="Instructor" accentIcon="bi-person-workspace">
      <div className="card border-0 shadow-sm" style={{ maxWidth: 640 }}>
        <div className="card-body p-4">
          <h4 className="mb-1">Welcome, {user?.first_name}.</h4>
          <p className="text-muted mb-0">
            You're signed in as an Instructor. Sending SMS to your
            sections and reviewing your delivery logs will live here.
          </p>
        </div>
      </div>
    </DashboardShell>
  );
}