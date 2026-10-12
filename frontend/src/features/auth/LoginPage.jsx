import { useState } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { getHomeRouteForRole } from "../../utils/roles";
import ThemeToggle from "../../components/ThemeToggle";
import BrandPanel from "./components/BrandPanel";
import LoginForm from "./components/LoginForm";
import "./LoginPage.css";

export default function LoginPage() {
  const { login, user, isAuthenticated, isBootstrapping } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  if (isBootstrapping) {
    return (
      <div className="d-flex vh-100 align-items-center justify-content-center">
        <div className="spinner-border text-success" role="status">
          <span className="visually-hidden">Loading…</span>
        </div>
      </div>
    );
  }

  if (isAuthenticated) {
    return <Navigate to={getHomeRouteForRole(user.role)} replace />;
  }

  async function handleSubmit({ email, password }) {
    setErrorMessage("");

    if (!email.trim() || !password) {
      setErrorMessage("Enter both your email and password.");
      return;
    }

    setIsSubmitting(true);

    try {
      const user = await login(email.trim(), password);
      const homeRoute = getHomeRouteForRole(user.role);

      const requestedPath = location.state?.from?.pathname;
      const canReturnToRequestedPath =
        requestedPath && requestedPath.startsWith(homeRoute);

      navigate(canReturnToRequestedPath ? requestedPath : homeRoute, {
        replace: true,
      });
    } catch (error) {
      setErrorMessage(error.message);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="sg-login-page">
      <ThemeToggle className="sg-theme-floating" />
      <div className="sg-login-shell">
        <BrandPanel />

        <div className="sg-form-panel d-flex align-items-center justify-content-center">
          <div className="sg-form-card sg-glass">
            <div className="sg-form-card-header d-lg-none">
              <i className="bi bi-broadcast-pin"></i>
              <span>SMS Gateway</span>
            </div>

            <h2 className="sg-form-title">Welcome back</h2>
            <p className="sg-form-subtitle">
              Sign in with the account issued to you.
            </p>

            <LoginForm
              onSubmit={handleSubmit}
              isSubmitting={isSubmitting}
              errorMessage={errorMessage}
              onDismissError={() => setErrorMessage("")}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
