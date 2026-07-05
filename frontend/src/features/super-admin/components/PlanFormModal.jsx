import { useEffect, useId, useState } from "react";

const EMPTY_FORM = {
  plan_name: "",
  description: "",
  price: "",
  payment_type: "Cash",
};

export default function PlanFormModal({ show, plan, onSave, onCancel, isSubmitting }) {
  const [form, setForm] = useState(EMPTY_FORM);
  const nameId = useId();
  const descId = useId();
  const priceId = useId();
  const paymentId = useId();

  useEffect(() => {
    if (plan) {
      setForm({
        plan_name: plan.plan_name,
        description: plan.description,
        price: String(plan.price),
        payment_type: plan.payment_type,
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
    onSave({
      plan_name: form.plan_name.trim(),
      description: form.description.trim(),
      price: parseFloat(form.price) || 0,
      payment_type: form.payment_type.trim() || "Cash",
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