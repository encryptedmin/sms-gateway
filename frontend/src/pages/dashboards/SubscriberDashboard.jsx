import DashboardShell from "./DashboardShell";
import { useAuth } from "../../context/AuthContext";

export default function SubscriberDashboard() {
  const { user } = useAuth();

  return (
    <DashboardShell roleTitle="Subscriber" accentIcon="bi-person-fill">
      <div className="card border-0 shadow-sm" style={{ maxWidth: 640 }}>
        <div className="card-body p-4">
          <h4 className="mb-1">Welcome, {user?.first_name}.</h4>
          <p className="text-muted mb-0">
            You're signed in as a Subscriber. Your message history and
            notification preferences will live here.
          </p>
        </div>
      </div>
    </DashboardShell>
  );
}