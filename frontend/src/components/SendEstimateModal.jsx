function formatDuration(totalSeconds) {
  if (totalSeconds < 60) {
    return `~${totalSeconds} second${totalSeconds === 1 ? "" : "s"}`;
  }

  if (totalSeconds >= 3600) {
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const hourText = `${hours} hour${hours === 1 ? "" : "s"}`;
    return minutes
      ? `~${hourText} ${minutes} minute${minutes === 1 ? "" : "s"}`
      : `~${hourText}`;
  }

  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  const minuteText = `${minutes} minute${minutes === 1 ? "" : "s"}`;
  return seconds ? `~${minuteText} ${seconds} seconds` : `~${minuteText}`;
}

export default function SendEstimateModal({
  show,
  recipientCount,
  targetLabel,
  isSubmitting,
  onConfirm,
  onCancel,
}) {
  if (!show) return null;

  const estimates = [
    { label: "Best case", seconds: recipientCount * 4, color: "var(--sg-signal-600)", icon: "bi-lightning-fill" },
    { label: "Average", seconds: recipientCount * 5, color: "#3977a8", icon: "bi-clock-fill" },
    { label: "Worst case", seconds: recipientCount * 6, color: "#c9820a", icon: "bi-hourglass-split" },
  ];

  return (
    <div className="sg-modal-backdrop" onClick={isSubmitting ? undefined : onCancel}>
      <div
        className="sg-modal-card"
        style={{ maxWidth: 520 }}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="d-flex align-items-start gap-3 mb-3">
          <div
            className="sg-stat-icon"
            style={{
              width: 44,
              height: 44,
              fontSize: "1.1rem",
              color: "var(--sg-signal-600)",
              background: "var(--sg-signal-100)",
            }}
          >
            <i className="bi bi-send-fill"></i>
          </div>
          <div>
            <h5 className="mb-1">Confirm SMS transmission</h5>
            <p className="text-muted mb-0" style={{ fontSize: "0.88rem" }}>
              {recipientCount > 0 ? (
                <>
                  This message will be queued for <strong>{recipientCount}</strong>{" "}
                  active {recipientCount === 1 ? "contact" : "contacts"}.
                  {targetLabel && <> Target: <strong>{targetLabel}</strong>.</>}
                </>
              ) : (
                "This target currently has no active contacts."
              )}
            </p>
          </div>
        </div>

        {recipientCount > 0 && (
          <>
            <div className="row g-2 mb-3">
              {estimates.map((estimate) => (
                <div className="col-12 col-sm-4" key={estimate.label}>
                  <div
                    className="h-100 p-3 text-center"
                    style={{
                      border: "1px solid var(--sg-surface-200)",
                      borderRadius: 10,
                      background: "var(--sg-surface-100)",
                    }}
                  >
                    <i className={`bi ${estimate.icon} d-block mb-1`} style={{ color: estimate.color }}></i>
                    <div className="sg-cell-muted" style={{ fontSize: "0.72rem" }}>
                      {estimate.label}
                    </div>
                    <div className="sg-cell-primary mt-1" style={{ fontSize: "0.9rem" }}>
                      {formatDuration(estimate.seconds)}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div
              className="p-3 mb-3"
              style={{
                borderRadius: 8,
                background: "var(--sg-signal-100)",
                color: "var(--sg-text-500)",
                fontSize: "0.8rem",
              }}
            >
              <i className="bi bi-info-circle me-2" style={{ color: "var(--sg-signal-600)" }}></i>
              Estimate uses approximately 4–6 seconds per contact. Actual time can vary with signal quality, modem availability, and queued messages.
            </div>
          </>
        )}

        <div className="d-flex justify-content-end gap-2">
          <button
            type="button"
            className="btn btn-outline-secondary btn-sm"
            onClick={onCancel}
            disabled={isSubmitting}
          >
            Go back
          </button>
          <button
            type="button"
            className="btn sg-submit-btn btn-sm"
            onClick={onConfirm}
            disabled={isSubmitting || recipientCount === 0}
          >
            {isSubmitting ? (
              <>
                <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                Queueing…
              </>
            ) : (
              <>
                <i className="bi bi-send-fill me-2"></i>
                Confirm and send
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
