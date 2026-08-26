import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getDashboardStats } from "../../../api/smsLogsService";
import { useToast } from "../../../context/ToastContext";
import { useAuth } from "../../../context/AuthContext";
import StatCard from "../../../components/StatCard";

export default function OverviewPage() {
  const { showToast } = useToast();
  const { user } = useAuth();
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

  const quickLinks = [
    { to: "/instructor/contacts", icon: "bi-person-lines-fill", title: "My Contacts", desc: "Add contacts manually or import a CSV." },
    { to: "/instructor/groups", icon: "bi-diagram-3-fill", title: "My Groups", desc: "Manage your classes and adopt shared groups." },
    { to: "/instructor/templates", icon: "bi-file-earmark-text-fill", title: "Message Templates", desc: "Reusable messages for common announcements." },
    { to: "/instructor/send", icon: "bi-send-fill", title: "Send SMS", desc: "Message a contact or one of your classes." },
  ];

  return (
    <div>
      <p className="text-muted mb-4">
        Welcome, {user?.first_name}. Here's a snapshot of the messages you've sent.
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
        {quickLinks.map((link) => (
          <div className="col-md-4" key={link.to}>
            <Link to={link.to} className="sg-panel d-block p-3 text-decoration-none h-100">
              <i className={`bi ${link.icon} mb-2 d-block`} style={{ fontSize: "1.4rem", color: "var(--sg-signal-600)" }}></i>
              <div className="sg-panel-title mb-1">{link.title}</div>
              <div className="sg-panel-subtitle">{link.desc}</div>
            </Link>
          </div>
        ))}
      </div>
    </div>
  );
}
