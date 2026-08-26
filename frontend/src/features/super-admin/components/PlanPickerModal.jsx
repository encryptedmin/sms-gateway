import { useEffect, useState } from "react";
import { formatCurrency } from "../../../utils/formatters";

export default function PlanPickerModal({ show, mode, subscriber, plans, currentPlanId, onConfirm, onCancel, isSubmitting }) {
  const [selectedPlanId, setSelectedPlanId] = useState(null);

  useEffect(() => {
    if (show) {
      setSelectedPlanId(currentPlanId || null);
    }
  }, [show, currentPlanId]);

  if (!show) {
    return null;
  }

  const isChange = mode === "change";

  function handleConfirm() {
    if (!selectedPlanId) return;
    onConfirm(selectedPlanId);
  }

  return (
    <div className="sg-modal-backdrop" onClick={onCancel}>
      <div className="sg-modal-card" style={{ maxWidth: 480 }} onClick={(event) => event.stopPropagation()}>
        <h5 className="mb-1">{isChange ? "Change plan" : "Enroll in a plan"}</h5>
        <p className="text-muted mb-3" style={{ fontSize: "0.88rem" }}>
          {subscriber ? `${subscriber.user.first_name} ${subscriber.user.last_name}` : ""}
          {isChange ? " — pick the plan to switch them to." : " — pick which plan to enroll them in."}
        </p>

        {plans.length === 0 ? (
          <div className="sg-table-empty">No plans exist yet. Create one on the Plans page first.</div>
        ) : (
          <div className="d-flex flex-column gap-2 mb-3" style={{ maxHeight: 320, overflowY: "auto" }}>
            {plans.map((plan) => {
              const isSelected = selectedPlanId === plan.id;
              return (
                <button
                  type="button"
                  key={plan.id}
                  onClick={() => setSelectedPlanId(plan.id)}
                  disabled={isSubmitting}
                  className="btn text-start"
                  style={{
                    border: `1.5px solid ${isSelected ? "var(--sg-signal-500)" : "var(--sg-surface-200)"}`,
                    background: isSelected ? "var(--sg-signal-100)" : "var(--sg-surface-0)",
                  }}
                >
                  <div className="d-flex justify-content-between align-items-center">
                    <span className="sg-cell-primary">{plan.plan_name}</span>
                    <span className="sg-cell-muted">{formatCurrency(plan.price)}</span>
                  </div>
                  <div className="sg-cell-muted" style={{ fontSize: "0.78rem" }}>
                    {plan.plan_type === "LIMITED" ? `${plan.message_limit} msgs / period` : "Unlimited"}
                  </div>
                </button>
              );
            })}
          </div>
        )}

        <div className="d-flex justify-content-end gap-2">
          <button type="button" className="btn btn-outline-secondary btn-sm" onClick={onCancel} disabled={isSubmitting}>
            Cancel
          </button>
          <button
            type="button"
            className="btn sg-submit-btn btn-sm"
            onClick={handleConfirm}
            disabled={isSubmitting || !selectedPlanId}
          >
            {isSubmitting ? (
              <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>
            ) : isChange ? (
              "Switch plan"
            ) : (
              "Enroll"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
