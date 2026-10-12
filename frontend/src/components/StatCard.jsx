export default function StatCard({ label, value, icon, accent = "signal" }) {
  const accents = {
    signal: { bg: "var(--sg-signal-100)", color: "var(--sg-signal-600)" },
    amber: { bg: "var(--sg-amber-100)", color: "var(--sg-amber-500)" },
    danger: { bg: "var(--sg-danger-100)", color: "var(--sg-danger-500)" },
    ink: { bg: "var(--sg-info-100)", color: "var(--sg-info-500)" },
  };
  const key = accents[accent] ? accent : "signal";
  const theme = accents[key];

  return (
    <div className={`sg-stat-card sg-stat-card--${key}`}>
      <div className="sg-stat-icon" style={{ background: theme.bg, color: theme.color }}>
        <i className={`bi ${icon}`}></i>
      </div>
      <div className="sg-stat-body">
        <div className="sg-stat-value">{value}</div>
        <div className="sg-stat-label">{label}</div>
      </div>
    </div>
  );
}
