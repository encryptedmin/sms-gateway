const STYLES = {
  SENT: { tone: "success", icon: "bi-check-circle-fill" },
  PENDING: { tone: "warning", icon: "bi-hourglass-split" },
  FAILED: { tone: "danger", icon: "bi-x-circle-fill" },
  ACTIVE: { tone: "success", icon: "bi-check-circle-fill" },
  SCHEDULED: { tone: "info", icon: "bi-clock-history" },
  CANCELLED: { tone: "neutral", icon: "bi-slash-circle" },
  INACTIVE: { tone: "neutral", icon: "bi-dash-circle-fill" },
};

export default function StatusBadge({ status }) {
  const style = STYLES[status] || STYLES.INACTIVE;

  return (
    <span className={`sg-pill sg-pill--${style.tone}`}>
      <i className={`bi ${style.icon}`}></i>
      {status}
    </span>
  );
}
