export default function AlertBanner({ message, onDismiss }) {
  if (!message) {
    return null;
  }

  return (
    <div
      className="alert-banner d-flex align-items-start gap-2"
      role="alert"
    >
      <i className="bi bi-exclamation-triangle-fill mt-1"></i>
      <div className="flex-grow-1">{message}</div>
      {onDismiss && (
        <button
          type="button"
          className="btn-close-inline"
          aria-label="Dismiss"
          onClick={onDismiss}
        >
          <i className="bi bi-x-lg"></i>
        </button>
      )}
    </div>
  );
}