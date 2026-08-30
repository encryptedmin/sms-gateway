export default function SubscriptionCell({ subscription, onEnroll, onChangePlan, isBusy }) {
  if (!subscription) {
    return (
      <button className="btn btn-sm btn-outline-secondary" onClick={onEnroll} disabled={isBusy}>
        {isBusy ? (
          <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>
        ) : (
          <>
            <i className="bi bi-card-checklist me-1"></i>
            Enroll in a plan
          </>
        )}
      </button>
    );
  }

  const isLimited = subscription.plan_type === "LIMITED";

  return (
    <div className="d-flex align-items-center gap-2 flex-wrap">
      <div>
        <div className="sg-cell-primary" style={{ fontSize: "0.85rem" }}>
          {subscription.plan_name}
        </div>
        <div className="sg-cell-muted" style={{ fontSize: "0.78rem" }}>
          {isLimited
            ? `${subscription.messages_sent_this_period} / ${subscription.plan_message_limit} msgs this period`
            : "Unlimited"}
        </div>
        {isLimited && subscription.messages_remaining === 0 && (
          <div style={{ fontSize: "0.75rem", color: "var(--sg-danger-600, #c0392b)" }}>
            <i className="bi bi-exclamation-circle-fill me-1"></i>
            Limit reached
          </div>
        )}
      </div>
      <button className="sg-icon-btn" onClick={onChangePlan} aria-label="Change plan" title="Change plan" disabled={isBusy}>
        <i className="bi bi-arrow-repeat"></i>
      </button>
    </div>
  );
}
