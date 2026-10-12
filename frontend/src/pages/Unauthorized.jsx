import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { getHomeRouteForRole } from "../utils/roles";
import ThemeToggle from "../components/ThemeToggle";

export default function Unauthorized() {
  const { user, logout } = useAuth();
  const homeRoute = user ? getHomeRouteForRole(user.role) : "/login";

  return (
    <div className="sg-state-page">
      <ThemeToggle className="sg-theme-floating" />
      <div className="sg-state-card sg-glass">
        <div
          className="sg-state-icon"
          style={{ background: "var(--sg-danger-100)", color: "var(--sg-danger-500)" }}
        >
          <i className="bi bi-shield-exclamation"></i>
        </div>
        <h2 className="mb-2">You don't have access to this page</h2>
        <p className="text-muted mb-4">
          Your account role doesn't include permission to view this section.
          If you think this is a mistake, contact your administrator.
        </p>
        <div className="d-flex gap-2 justify-content-center flex-wrap">
          <Link to={homeRoute} className="btn sg-submit-btn">
            Go to my dashboard
          </Link>
          <button className="btn btn-outline-secondary" onClick={logout}>
            Sign out
          </button>
        </div>
      </div>
    </div>
  );
}
