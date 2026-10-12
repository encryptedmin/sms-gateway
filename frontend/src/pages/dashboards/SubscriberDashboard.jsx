import DashboardShell from "./DashboardShell";
import { useAuth } from "../../context/AuthContext";

export default function SubscriberDashboard() {
  const { user } = useAuth();

  return (
    <DashboardShell roleTitle="Subscriber" accentIcon="bi-person-fill">
      <div className="sg-panel p-4" style={{ maxWidth: 640 }}>
        <h4 className="mb-1">Welcome, {user?.first_name || user?.email}.</h4>
        <p className="text-muted mb-0">
          You're signed in as a Subscriber. Your message history and
          notification preferences will live here.
        </p>
      </div>
    </DashboardShell>
  );
}
