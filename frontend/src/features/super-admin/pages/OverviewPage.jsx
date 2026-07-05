import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getDashboardStats } from "../../../api/smsLogsService";
import { useToast } from "../../../context/ToastContext";
import StatCard from "../../../components/StatCard";

export default function OverviewPage() {
  const { showToast } = useToast();
  const [stats, setStats] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    async function loadStats() {
      try {
        const data = await getDashboardStats();
        if (isMounted) setStats(data);
      } catch {
        showToast("Couldn't load dashboard stats.", "error");
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }

    loadStats();
    return () => {
      isMounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div>
      <p className="text-muted mb-4">
        A quick snapshot of gateway activity across every department and subscriber.
      </p>

      {isLoading ? (
        <div className="d-flex justify-content-center py-5">
          <div className="spinner-border text-success" role="status">
            <span className="visually-hidden">Loading…</span>
          </div>
        </div>
      ) : (
        <div className="row g-3 mb-4">
          <div className="col-sm-6 col-xl-3">
            <StatCard label="Total Messages" value={stats?.total_messages ?? 0} icon="bi-chat-left-text-fill" accent="ink" />
          </div>
          <div className="col-sm-6 col-xl-3">
            <StatCard label="Sent" value={stats?.sent_messages ?? 0} icon="bi-check-circle-fill" accent="signal" />
          </div>
          <div className="col-sm-6 col-xl-3">
            <StatCard label="Pending" value={stats?.pending_messages ?? 0} icon="bi-hourglass-split" accent="amber" />
          </div>
          <div className="col-sm-6 col-xl-3">
            <StatCard label="Failed" value={stats?.failed_messages ?? 0} icon="bi-x-circle-fill" accent="danger" />
          </div>
        </div>
      )}

      <div className="row g-3">
        <div className="col-md-4">
          <Link to="/super-admin/plans" className="sg-panel d-block p-3 text-decoration-none h-100">
            <i className="bi bi-card-list mb-2 d-block" style={{ fontSize: "1.4rem", color: "var(--sg-signal-600)" }}></i>
            <div className="sg-panel-title mb-1">Subscription Plans</div>
            <div className="sg-panel-subtitle">Create and price the plans subscribers can be placed on.</div>
          </Link>
        </div>
        <div className="col-md-4">
          <Link to="/super-admin/department-admins" className="sg-panel d-block p-3 text-decoration-none h-100">
            <i className="bi bi-person-badge mb-2 d-block" style={{ fontSize: "1.4rem", color: "var(--sg-signal-600)" }}></i>
            <div className="sg-panel-title mb-1">Department Admins</div>
            <div className="sg-panel-subtitle">Provision ITE Department Admin accounts.</div>
          </Link>
        </div>
        <div className="col-md-4">
          <Link to="/super-admin/subscribers" className="sg-panel d-block p-3 text-decoration-none h-100">
            <i className="bi bi-key-fill mb-2 d-block" style={{ fontSize: "1.4rem", color: "var(--sg-signal-600)" }}></i>
            <div className="sg-panel-title mb-1">Subscribers & API Keys</div>
            <div className="sg-panel-subtitle">Manage accounts and enable or disable gateway access.</div>
          </Link>
        </div>
      </div>
    </div>
  );
}