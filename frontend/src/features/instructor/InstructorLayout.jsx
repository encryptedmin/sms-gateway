import { useState } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import ThemeToggle from "../../components/ThemeToggle";
import { displayName, initials } from "../../utils/formatters";
import { extractApiError } from "../../utils/apiErrors";
import { changeOwnPassword } from "../../api/authService";
import PasswordModal from "../../components/PasswordModal";
import { useToast } from "../../context/ToastContext";
import "../../styles/adminLayout.css";

const NAV_ITEMS = [
  { to: "/instructor", label: "Overview", icon: "bi-speedometer2", end: true },
  { to: "/instructor/contacts", label: "My Contacts", icon: "bi-person-lines-fill" },
  { to: "/instructor/groups", label: "My Groups", icon: "bi-diagram-3-fill" },
  { to: "/instructor/templates", label: "Message Templates", icon: "bi-file-earmark-text-fill" },
  { to: "/instructor/send", label: "Send SMS", icon: "bi-send-fill" },
  { to: "/instructor/logs", label: "My SMS Logs", icon: "bi-chat-left-text" },
];

const PAGE_TITLES = {
  "/instructor": "Overview",
  "/instructor/contacts": "My Contacts",
  "/instructor/groups": "My Groups",
  "/instructor/templates": "Message Templates",
  "/instructor/send": "Send SMS",
  "/instructor/logs": "My SMS Logs",
};

export default function InstructorLayout() {
  const { user, logout } = useAuth();
  const { showToast } = useToast();
  const location = useLocation();
  const [isNavOpen, setIsNavOpen] = useState(false);
  const [isPasswordOpen, setIsPasswordOpen] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  const pageTitle = PAGE_TITLES[location.pathname] || "Instructor";

  async function handleChangePassword(payload) {
    setIsChangingPassword(true);
    try {
      await changeOwnPassword(payload);
      setIsPasswordOpen(false);
      showToast("Password changed. Sign in again with your new password.");
      logout();
    } catch (error) {
      showToast(extractApiError(error, "Couldn't change your password."), "error");
    } finally {
      setIsChangingPassword(false);
    }
  }

  return (
    <div className="sg-admin-shell">
      {isNavOpen && (
        <div className="sg-sidebar-backdrop" onClick={() => setIsNavOpen(false)}></div>
      )}

      <aside className={`sg-sidebar ${isNavOpen ? "sg-sidebar-open" : ""}`}>
        <div className="sg-sidebar-brand">
          <i className="bi bi-broadcast-pin"></i>
          <span>SMS Gateway</span>
        </div>

        <nav className="sg-sidebar-nav">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `sg-nav-link ${isActive ? "sg-nav-link-active" : ""}`
              }
              onClick={() => setIsNavOpen(false)}
            >
              <i className={`bi ${item.icon}`}></i>
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="sg-sidebar-footer">
          <div className="sg-sidebar-user">
            <div className="sg-avatar">{initials(user?.first_name, user?.last_name, user?.email)}</div>
            <div>
              <div className="sg-sidebar-user-name">
                {displayName(user)}
              </div>
              <div className="sg-sidebar-user-role">ITE Instructor</div>
            </div>
          </div>
          <button
            className="btn btn-sm btn-outline-secondary w-100 mb-2"
            onClick={() => setIsPasswordOpen(true)}
          >
            <i className="bi bi-key-fill me-1"></i>
            Change password
          </button>
          <button className="btn btn-sm btn-outline-secondary w-100" onClick={logout}>
            <i className="bi bi-box-arrow-right me-1"></i>
            Sign out
          </button>
        </div>
      </aside>

      <div className="sg-admin-main">
        <header className="sg-admin-topbar">
          <div className="d-flex align-items-center gap-3">
            <button className="sg-mobile-nav-toggle" onClick={() => setIsNavOpen(true)} aria-label="Open menu">
              <i className="bi bi-list"></i>
            </button>
            <h1 className="sg-admin-page-title">{pageTitle}</h1>
          </div>
          <ThemeToggle />
        </header>

        <div className="sg-admin-content">
          <Outlet />
        </div>
      </div>

      <PasswordModal
        show={isPasswordOpen}
        title="Change your password"
        description="Confirm your current password, then choose a new one. You will be signed out afterward."
        requireCurrentPassword
        isSubmitting={isChangingPassword}
        onSubmit={handleChangePassword}
        onCancel={() => setIsPasswordOpen(false)}
      />
    </div>
  );
}
