export default function ConfirmDialog({
  show,
  title,
  message,
  confirmLabel = "Confirm",
  isDangerous = false,
  isSubmitting = false,
  onConfirm,
  onCancel,
}) {
  if (!show) {
    return null;
  }

  return (
    <div className="sg-modal-backdrop" onClick={onCancel}>
      <div
        className="sg-modal-card"
        style={{ maxWidth: 400 }}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="d-flex align-items-start gap-3 mb-3">
          <div
            className="sg-stat-icon"
            style={{
              background: isDangerous ? "var(--sg-danger-100)" : "var(--sg-signal-100)",
              color: isDangerous ? "var(--sg-danger-500)" : "var(--sg-signal-600)",
              width: 44,
              height: 44,
              fontSize: "1.1rem",
            }}
          >
            <i className={`bi ${isDangerous ? "bi-exclamation-triangle-fill" : "bi-question-circle-fill"}`}></i>
          </div>
          <div>
            <h5 className="mb-1">{title}</h5>
            <p className="text-muted mb-0" style={{ fontSize: "0.9rem" }}>
              {message}
            </p>
          </div>
        </div>

        <div className="d-flex justify-content-end gap-2">
          <button className="btn btn-outline-secondary btn-sm" onClick={onCancel} disabled={isSubmitting}>
            Cancel
          </button>
          <button
            className={`btn btn-sm ${isDangerous ? "btn-danger" : "sg-submit-btn"}`}
            onClick={onConfirm}
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>
            ) : (
              confirmLabel
            )}
          </button>
        </div>
      </div>
    </div>
  );
}