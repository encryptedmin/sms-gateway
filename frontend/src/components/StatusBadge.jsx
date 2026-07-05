const STYLES = {
  SENT: { bg: "var(--sg-signal-100)", color: "var(--sg-signal-600)", icon: "bi-check-circle-fill" },
  PENDING: { bg: "rgba(245, 165, 36, 0.14)", color: "var(--sg-amber-500)", icon: "bi-hourglass-split" },
  FAILED: { bg: "var(--sg-danger-100)", color: "var(--sg-danger-500)", icon: "bi-x-circle-fill" },
  ACTIVE: { bg: "var(--sg-signal-100)", color: "var(--sg-signal-600)", icon: "bi-check-circle-fill" },
  INACTIVE: { bg: "var(--sg-surface-200)", color: "var(--sg-text-500)", icon: "bi-dash-circle-fill" },
};

export default function StatusBadge({ status }) {
  const style = STYLES[status] || STYLES.INACTIVE;

  return (
    <span
      className="d-inline-flex align-items-center gap-1 px-2 py-1 rounded-pill"
      style={{
        background: style.bg,
        color: style.color,
        fontSize: "0.78rem",
        fontWeight: 600,
      }}
    >
      <i className={`bi ${style.icon}`}></i>
      {status}
    </span>
  );
}