import { useEffect, useId, useState } from "react";

const EMPTY_FORM = {
  plan_name: "",
  description: "",
  price: "",
  payment_type: "Cash",
  plan_type: "UNLIMITED",
  message_limit: "",
};

export default function PlanFormModal({ show, plan, onSave, onCancel, isSubmitting }) {
  const [form, setForm] = useState(EMPTY_FORM);
  const nameId = useId();
  const descId = useId();
  const priceId = useId();
  const paymentId = useId();
  const limitId = useId();

  useEffect(() => {
    if (plan) {
      setForm({
        plan_name: plan.plan_name,
        description: plan.description,
        price: String(plan.price),
        payment_type: plan.payment_type,
        plan_type: plan.plan_type || "UNLIMITED",
        message_limit: plan.message_limit != null ? String(plan.message_limit) : "",
      });
    } else {
      setForm(EMPTY_FORM);
    }
  }, [plan, show]);

  if (!show) {
    return null;
  }

  function handleChange(field) {
    return (event) => setForm((prev) => ({ ...prev, [field]: event.target.value }));
  }

  function handleSubmit(event) {
    event.preventDefault();
    const isLimited = form.plan_type === "LIMITED";
    onSave({
      plan_name: form.plan_name.trim(),
      description: form.description.trim(),
      price: parseFloat(form.price) || 0,
      payment_type: form.payment_type.trim() || "Cash",
      plan_type: form.plan_type,
      message_limit: isLimited ? parseInt(form.message_limit, 10) || 0 : null,
    });
  }

  return (
    <div className="sg-modal-backdrop" onClick={onCancel}>
      <div className="sg-modal-card" onClick={(event) => event.stopPropagation()}>
        <h5 className="mb-1">{plan ? "Edit Plan" : "New Subscription Plan"}</h5>
        <p className="text-muted mb-3" style={{ fontSize: "0.88rem" }}>
          {plan ? "Update the details subscribers see for this plan." : "Define a new plan subscribers can be placed on."}
        </p>

        <form onSubmit={handleSubmit}>
          <div className="mb-3">
            <label htmlFor={nameId} className="form-label sg-label">
              Plan name
            </label>
            <input
              id={nameId}
              type="text"
              className="form-control sg-input"
              value={form.plan_name}
              onChange={handleChange("plan_name")}
              placeholder="e.g. Basic, Standard, Unlimited"
              required
              disabled={isSubmitting}
            />
          </div>

          <div className="mb-3">
            <label htmlFor={descId} className="form-label sg-label">
              Description
            </label>
            <textarea
              id={descId}
              className="form-control sg-input"
              rows={3}
              value={form.description}
              onChange={handleChange("description")}
              placeholder="What's included in this plan?"
              required
              disabled={isSubmitting}
            />
          </div>

          <div className="mb-3">
            <label className="form-label sg-label">Plan type</label>
            <div className="d-flex gap-2">
              <button
                type="button"
                className="btn btn-sm"
                onClick={() => setForm((prev) => ({ ...prev, plan_type: "UNLIMITED" }))}
                disabled={isSubmitting}
                style={{
                  border: `1.5px solid ${form.plan_type === "UNLIMITED" ? "var(--sg-signal-500)" : "var(--sg-surface-200)"}`,
                  background: form.plan_type === "UNLIMITED" ? "var(--sg-signal-100)" : "var(--sg-surface-0)",
                  color: form.plan_type === "UNLIMITED" ? "var(--sg-signal-600)" : "var(--sg-text-500)",
                }}
              >
                {form.plan_type === "UNLIMITED" && <i className="bi bi-check-lg me-1"></i>}
                Unlimited
              </button>
              <button
                type="button"
                className="btn btn-sm"
                onClick={() => setForm((prev) => ({ ...prev, plan_type: "LIMITED" }))}
                disabled={isSubmitting}
                style={{
                  border: `1.5px solid ${form.plan_type === "LIMITED" ? "var(--sg-signal-500)" : "var(--sg-surface-200)"}`,
                  background: form.plan_type === "LIMITED" ? "var(--sg-signal-100)" : "var(--sg-surface-0)",
                  color: form.plan_type === "LIMITED" ? "var(--sg-signal-600)" : "var(--sg-text-500)",
                }}
              >
                {form.plan_type === "LIMITED" && <i className="bi bi-check-lg me-1"></i>}
                Limited
              </button>
            </div>
          </div>

          {form.plan_type === "LIMITED" && (
            <div className="mb-3">
              <label htmlFor={limitId} className="form-label sg-label">
                Messages per period
              </label>
              <input
                id={limitId}
                type="number"
                min="1"
                step="1"
                className="form-control sg-input"
                value={form.message_limit}
                onChange={handleChange("message_limit")}
                placeholder="e.g. 500"
                required
                disabled={isSubmitting}
              />
              <div className="form-text" style={{ fontSize: "0.78rem" }}>
                Resets each billing period. Enforcement of this limit is a separate step, not active yet.
              </div>
            </div>
          )}

          <div className="row g-3 mb-3">
            <div className="col-6">
              <label htmlFor={priceId} className="form-label sg-label">
                Price (₱)
              </label>
              <input
                id={priceId}
                type="number"
                min="0"
                step="0.01"
                className="form-control sg-input"
                value={form.price}
                onChange={handleChange("price")}
                placeholder="0.00"
                required
                disabled={isSubmitting}
              />
            </div>
            <div className="col-6">
              <label htmlFor={paymentId} className="form-label sg-label">
                Payment type
              </label>
              <input
                id={paymentId}
                type="text"
                className="form-control sg-input"
                value={form.payment_type}
                onChange={handleChange("payment_type")}
                placeholder="e.g. Cash"
                required
                disabled={isSubmitting}
              />
            </div>
          </div>

          <div className="d-flex justify-content-end gap-2 mt-2">
            <button type="button" className="btn btn-outline-secondary btn-sm" onClick={onCancel} disabled={isSubmitting}>
              Cancel
            </button>
            <button type="submit" className="btn sg-submit-btn btn-sm" disabled={isSubmitting}>
              {isSubmitting ? (
                <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>
              ) : plan ? (
                "Save changes"
              ) : (
                "Create plan"
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}