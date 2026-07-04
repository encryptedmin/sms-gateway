import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { getHomeRouteForRole } from "../utils/roles";

/**
 * Sits on "/" and sends the visitor either to their role's dashboard
 * or to the login page if there is no active session yet.
 */
export default function RoleRedirect() {
  const { user, isAuthenticated, isBootstrapping } = useAuth();

  if (isBootstrapping) {
    return (
      <div className="d-flex vh-100 align-items-center justify-content-center">
        <div className="spinner-border text-success" role="status">
          <span className="visually-hidden">Loading…</span>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <Navigate to={getHomeRouteForRole(user.role)} replace />;
}