import { useAuth } from "../../context/AuthContext";
import { getRoleLabel } from "../../utils/roles";
import { displayName } from "../../utils/formatters";
import ThemeToggle from "../../components/ThemeToggle";
import "../../styles/adminLayout.css";

export default function DashboardShell({ roleTitle, accentIcon, children }) {
  const { user, logout } = useAuth();

  return (
    <div className="d-flex flex-column min-vh-100">
      <header className="sg-shell-header">
        <div className="d-flex align-items-center gap-2">
          <span className="sg-sidebar-brand p-0">
            <i className={`bi ${accentIcon}`}></i>
            <span>SMS Gateway — {roleTitle}</span>
          </span>
        </div>

        <div className="d-flex align-items-center gap-3 flex-wrap">
          <span style={{ fontSize: "0.9rem", color: "var(--sg-text-300)" }}>
            {displayName(user)}
            <span className="ms-2 sg-pill sg-pill--success">{getRoleLabel(user?.role)}</span>
          </span>
          <ThemeToggle />
          <button className="btn btn-sm btn-outline-secondary" onClick={logout}>
            <i className="bi bi-box-arrow-right me-1"></i>
            Sign out
          </button>
        </div>
      </header>

      <main className="flex-grow-1 p-3 p-md-4">{children}</main>
    </div>
  );
}
