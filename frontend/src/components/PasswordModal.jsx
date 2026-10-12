import { useEffect, useId, useState } from "react";


const EMPTY_FORM = {
  current_password: "",
  new_password: "",
  confirm_password: "",
};

export default function PasswordModal({
  show,
  title,
  description,
  requireCurrentPassword = false,
  isSubmitting = false,
  onSubmit,
  onCancel,
}) {
  const [form, setForm] = useState(EMPTY_FORM);
  const [error, setError] = useState("");
  const currentPasswordId = useId();
  const newPasswordId = useId();
  const confirmPasswordId = useId();

  useEffect(() => {
    if (show) {
      setForm(EMPTY_FORM);
      setError("");
    }
  }, [show]);

  if (!show) return null;

  function update(field) {
    return (event) => {
      setForm((current) => ({ ...current, [field]: event.target.value }));
      setError("");
    };
  }

  function submit(event) {
    event.preventDefault();

    if (form.new_password !== form.confirm_password) {
      setError("The new passwords do not match.");
      return;
    }

    onSubmit(form);
  }

  return (
    <div className="sg-modal-backdrop" onClick={onCancel}>
      <div
        className="sg-modal-card"
        style={{ maxWidth: 440 }}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="d-flex align-items-start gap-3 mb-3">
          <div
            className="sg-stat-icon"
            style={{
              background: "var(--sg-signal-100)",
              color: "var(--sg-signal-600)",
              width: 44,
              height: 44,
              fontSize: "1.1rem",
            }}
          >
            <i className="bi bi-key-fill"></i>
          </div>
          <div>
            <h5 className="mb-1">{title}</h5>
            <p className="text-muted mb-0" style={{ fontSize: "0.86rem" }}>
              {description}
            </p>
          </div>
        </div>

        <form onSubmit={submit}>
          {requireCurrentPassword && (
            <div className="mb-3">
              <label htmlFor={currentPasswordId} className="form-label sg-label">
                Current password
              </label>
              <input
                id={currentPasswordId}
                type="password"
                className="form-control sg-input"
                value={form.current_password}
                onChange={update("current_password")}
                autoComplete="current-password"
                required
                disabled={isSubmitting}
              />
            </div>
          )}

          <div className="mb-3">
            <label htmlFor={newPasswordId} className="form-label sg-label">
              New password
            </label>
            <input
              id={newPasswordId}
              type="password"
              className="form-control sg-input"
              value={form.new_password}
              onChange={update("new_password")}
              autoComplete="new-password"
              minLength={8}
              required
              disabled={isSubmitting}
            />
            <div className="form-text">Use at least 8 characters and avoid common passwords.</div>
          </div>

          <div className="mb-3">
            <label htmlFor={confirmPasswordId} className="form-label sg-label">
              Confirm new password
            </label>
            <input
              id={confirmPasswordId}
              type="password"
              className="form-control sg-input"
              value={form.confirm_password}
              onChange={update("confirm_password")}
              autoComplete="new-password"
              minLength={8}
              required
              disabled={isSubmitting}
            />
          </div>

          {error && <div className="alert alert-danger py-2 small">{error}</div>}

          <div className="d-flex justify-content-end gap-2">
            <button
              type="button"
              className="btn btn-outline-secondary btn-sm"
              onClick={onCancel}
              disabled={isSubmitting}
            >
              Cancel
            </button>
            <button type="submit" className="btn sg-submit-btn btn-sm" disabled={isSubmitting}>
              {isSubmitting ? (
                <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>
              ) : (
                "Save password"
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
