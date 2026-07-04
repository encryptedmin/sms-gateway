import { Link } from "react-router-dom";

export default function NotFound() {
  return (
    <div className="d-flex flex-column align-items-center justify-content-center vh-100 text-center px-3">
      <i className="bi bi-signpost-split" style={{ fontSize: "3rem", color: "var(--sg-signal-600)" }}></i>
      <h2 className="mt-3 mb-2">Page not found</h2>
      <p className="text-muted mb-4">
        The page you're looking for doesn't exist or may have moved.
      </p>
      <Link to="/" className="btn sg-submit-btn">
        Back to safety
      </Link>
    </div>
  );
}