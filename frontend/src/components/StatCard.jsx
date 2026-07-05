export default function StatCard({ label, value, icon, accent = "signal" }) {
  const accents = {
    signal: { bg: "var(--sg-signal-100)", color: "var(--sg-signal-600)" },
    amber: { bg: "rgba(245, 165, 36, 0.14)", color: "var(--sg-amber-500)" },
    danger: { bg: "var(--sg-danger-100)", color: "var(--sg-danger-500)" },
    ink: { bg: "var(--sg-surface-200)", color: "var(--sg-ink-800)" },
  };
  const theme = accents[accent] || accents.signal;

  return (
    <div className="sg-stat-card">
      <div className="sg-stat-icon" style={{ background: theme.bg, color: theme.color }}>
        <i className={`bi ${icon}`}></i>
      </div>
      <div>
        <div className="sg-stat-value">{value}</div>
        <div className="sg-stat-label">{label}</div>
      </div>
    </div>
  );
}