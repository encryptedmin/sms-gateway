import { useEffect, useId, useState } from "react";

const EMPTY_FORM = { name: "", description: "" };

export default function ContactGroupFormModal({ show, group, onSave, onCancel, isSubmitting }) {
  const [form, setForm] = useState(EMPTY_FORM);
  const nameId = useId();
  const descId = useId();

  useEffect(() => {
    if (group) {
      setForm({ name: group.name, description: group.description || "" });
    } else {
      setForm(EMPTY_FORM);
    }
  }, [group, show]);

  if (!show) {
    return null;
  }

  function handleSubmit(event) {
    event.preventDefault();
    onSave({ name: form.name.trim(), description: form.description.trim() });
  }

  return (
    <div className="sg-modal-backdrop" onClick={onCancel}>
      <div className="sg-modal-card" onClick={(event) => event.stopPropagation()}>
        <h5 className="mb-1">{group ? "Edit Contact Group" : "New Contact Group"}</h5>
        <p className="text-muted mb-3" style={{ fontSize: "0.88rem" }}>
          e.g. "BSIT 1A", "BSIT 2B", or a broader group like "BSIT 1".
        </p>

        <form onSubmit={handleSubmit}>
          <div className="mb-3">
            <label htmlFor={nameId} className="form-label sg-label">
              Group name
            </label>
            <input
              id={nameId}
              type="text"
              className="form-control sg-input"
              value={form.name}
              onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
              placeholder="e.g. BSIT 1A"
              required
              disabled={isSubmitting}
            />
          </div>

          <div className="mb-3">
            <label htmlFor={descId} className="form-label sg-label">
              Description <span className="text-muted fw-normal">(optional)</span>
            </label>
            <textarea
              id={descId}
              className="form-control sg-input"
              rows={2}
              value={form.description}
              onChange={(event) => setForm((prev) => ({ ...prev, description: event.target.value }))}
              disabled={isSubmitting}
            />
          </div>

          <div className="d-flex justify-content-end gap-2 mt-2">
            <button type="button" className="btn btn-outline-secondary btn-sm" onClick={onCancel} disabled={isSubmitting}>
              Cancel
            </button>
            <button type="submit" className="btn sg-submit-btn btn-sm" disabled={isSubmitting}>
              {isSubmitting ? (
                <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>
              ) : group ? (
                "Save changes"
              ) : (
                "Create group"
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}