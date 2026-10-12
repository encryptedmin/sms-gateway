import { Link } from "react-router-dom";
import ThemeToggle from "../components/ThemeToggle";

export default function NotFound() {
  return (
    <div className="sg-state-page">
      <ThemeToggle className="sg-theme-floating" />
      <div className="sg-state-card sg-glass">
        <div
          className="sg-state-icon"
          style={{ background: "var(--sg-signal-100)", color: "var(--sg-signal-600)" }}
        >
          <i className="bi bi-signpost-split"></i>
        </div>
        <h2 className="mb-2">Page not found</h2>
        <p className="text-muted mb-4">
          The page you're looking for doesn't exist or may have moved.
        </p>
        <Link to="/" className="btn sg-submit-btn">
          Back to safety
        </Link>
      </div>
    </div>
  );
}
