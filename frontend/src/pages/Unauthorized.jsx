import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { getHomeRouteForRole } from "../utils/roles";

export default function Unauthorized() {
  const { user, logout } = useAuth();
  const homeRoute = user ? getHomeRouteForRole(user.role) : "/login";

  return (
    <div className="d-flex flex-column align-items-center justify-content-center vh-100 text-center px-3">
      <i className="bi bi-shield-exclamation" style={{ fontSize: "3rem", color: "var(--sg-danger-500)" }}></i>
      <h2 className="mt-3 mb-2">You don't have access to this page</h2>
      <p className="text-muted mb-4" style={{ maxWidth: 420 }}>
        Your account role doesn't include permission to view this section.
        If you think this is a mistake, contact your administrator.
      </p>
      <div className="d-flex gap-2">
        <Link to={homeRoute} className="btn sg-submit-btn">
          Go to my dashboard
        </Link>
        <button className="btn btn-outline-secondary" onClick={logout}>
          Sign out
        </button>
      </div>
    </div>
  );
}