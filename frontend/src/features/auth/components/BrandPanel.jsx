export default function BrandPanel() {
  return (
    <div className="sg-brand-panel d-none d-lg-flex flex-column justify-content-between">
      <div className="sg-grid-overlay" aria-hidden="true"></div>

      <div className="sg-brand-mark">
        <i className="bi bi-broadcast-pin"></i>
        <span>Colegio de Kidapawan ITE - SMS Gateway</span>
      </div>

      <div className="sg-signal-stage" aria-hidden="true">
        <span className="sg-ping sg-ping-1"></span>
        <span className="sg-ping sg-ping-2"></span>
        <span className="sg-ping sg-ping-3"></span>
        <span className="sg-signal-dot"></span>
      </div>

      <div className="sg-brand-copy">
        <h1>Every message,<br />on the record.</h1>
        <p>
          The ITE Department's operations console for outbound SMS
          campaigns, subscriber records, and modem health — all routed
          through one gateway.
        </p>

        <ul className="sg-feature-list">
          <li>
            <i className="bi bi-shield-check"></i>
            Role-based access for admins, instructors &amp; staff
          </li>
          <li>
            <i className="bi bi-activity"></i>
            Live delivery logs straight from the modem
          </li>
          <li>
            <i className="bi bi-people"></i>
            Centralized subscriber &amp; contact management
          </li>
        </ul>
      </div>

      <div className="sg-brand-footer">
        Technology &copy; 2026 Colegio de Kidapawan ITE. All rights reserved.
      </div>
    </div>
  );
}