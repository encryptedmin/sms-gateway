import { useAuth } from "../../context/AuthContext";
import { getRoleLabel } from "../../utils/roles";

export default function DashboardShell({ roleTitle, accentIcon, children }) {
  const { user, logout } = useAuth();

  return (
    <div className="d-flex flex-column min-vh-100" style={{ background: "var(--sg-surface-50)" }}>
      <header
        className="d-flex align-items-center justify-content-between px-4 py-3"
        style={{ background: "var(--sg-ink-900)", color: "var(--sg-text-100)" }}
      >
        <div className="d-flex align-items-center gap-2">
          <i className={`bi ${accentIcon}`} style={{ color: "var(--sg-signal-500)", fontSize: "1.3rem" }}></i>
          <span style={{ fontFamily: "var(--sg-font-display)", fontWeight: 600 }}>
            SMS Gateway — {roleTitle}
          </span>
        </div>

        <div className="d-flex align-items-center gap-3">
          <span style={{ fontSize: "0.9rem", color: "var(--sg-text-300)" }}>
            {user?.first_name} {user?.last_name}
            <span className="ms-2 badge" style={{ background: "var(--sg-signal-100)", color: "var(--sg-signal-500)" }}>
              {getRoleLabel(user?.role)}
            </span>
          </span>
          <button className="btn btn-sm btn-outline-light" onClick={logout}>
            <i className="bi bi-box-arrow-right me-1"></i>
            Sign out
          </button>
        </div>
      </header>

      <main className="flex-grow-1 p-4">{children}</main>
    </div>
  );
}