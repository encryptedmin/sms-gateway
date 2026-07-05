import { useState } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { initials } from "../../utils/formatters";
import "../../styles/adminLayout.css";

const NAV_ITEMS = [
  { to: "/department-admin", label: "Overview", icon: "bi-speedometer2", end: true },
  { to: "/department-admin/instructors", label: "Instructors", icon: "bi-person-workspace" },
  { to: "/department-admin/contacts", label: "Contacts", icon: "bi-person-lines-fill" },
  { to: "/department-admin/groups", label: "Contact Groups", icon: "bi-diagram-3-fill" },
  { to: "/department-admin/templates", label: "Message Templates", icon: "bi-file-earmark-text-fill" },
  { to: "/department-admin/send", label: "Send SMS", icon: "bi-send-fill" },
  { to: "/department-admin/logs", label: "SMS Logs", icon: "bi-chat-left-text" },
];

const PAGE_TITLES = {
  "/department-admin": "Overview",
  "/department-admin/instructors": "Instructors",
  "/department-admin/contacts": "Contacts",
  "/department-admin/groups": "Contact Groups",
  "/department-admin/templates": "Message Templates",
  "/department-admin/send": "Send SMS",
  "/department-admin/logs": "SMS Logs",
};

export default function DepartmentAdminLayout() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const [isNavOpen, setIsNavOpen] = useState(false);

  const pageTitle = PAGE_TITLES[location.pathname] || "ITE Department Admin";

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
            <div className="sg-avatar">{initials(user?.first_name, user?.last_name)}</div>
            <div>
              <div className="sg-sidebar-user-name">
                {user?.first_name} {user?.last_name}
              </div>
              <div className="sg-sidebar-user-role">ITE Department Admin</div>
            </div>
          </div>
          <button className="btn btn-sm btn-outline-light w-100" onClick={logout}>
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
        </header>

        <div className="sg-admin-content">
          <Outlet />
        </div>
      </div>
    </div>
  );
}