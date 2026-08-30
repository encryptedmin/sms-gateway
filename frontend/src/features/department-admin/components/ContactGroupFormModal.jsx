import { useEffect, useId, useState } from "react";

const EMPTY_FORM = { name: "", description: "", is_shared: false };

export default function ContactGroupFormModal({ show, group, onSave, onCancel, isSubmitting }) {
  const [form, setForm] = useState(EMPTY_FORM);
  const nameId = useId();
  const descId = useId();
  const sharedId = useId();

  useEffect(() => {
    if (group) {
      setForm({
        name: group.name,
        description: group.description || "",
        is_shared: Boolean(group.is_shared),
      });
    } else {
      setForm(EMPTY_FORM);
    }
  }, [group, show]);

  if (!show) {
    return null;
  }

  function handleSubmit(event) {
    event.preventDefault();
    onSave({
      name: form.name.trim(),
      description: form.description.trim(),
      is_shared: form.is_shared,
    });
  }

  return (
    <div className="sg-modal-backdrop">
      <div className="sg-modal-card" role="dialog" aria-modal="true">
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

          <div
            className="form-check form-switch mb-3 p-3"
            style={{ border: "1px solid var(--sg-surface-200)", borderRadius: 8 }}
          >
            <input
              id={sharedId}
              type="checkbox"
              className="form-check-input"
              checked={form.is_shared}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, is_shared: event.target.checked }))
              }
              disabled={isSubmitting}
            />
            <label htmlFor={sharedId} className="form-check-label sg-label">
              Share this group
            </label>
            <div className="text-muted" style={{ fontSize: "0.8rem" }}>
              {form.is_shared
                ? "Visible to other authorized users."
                : "Private to you and hidden from instructors unless shared later."}
            </div>
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
