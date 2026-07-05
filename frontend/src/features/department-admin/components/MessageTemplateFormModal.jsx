import { useEffect, useId, useState } from "react";

const EMPTY_FORM = { title: "", content: "" };
const SMS_SEGMENT_LENGTH = 160;

export default function MessageTemplateFormModal({ show, template, onSave, onCancel, isSubmitting }) {
  const [form, setForm] = useState(EMPTY_FORM);
  const titleId = useId();
  const contentId = useId();

  useEffect(() => {
    if (template) {
      setForm({ title: template.title, content: template.content });
    } else {
      setForm(EMPTY_FORM);
    }
  }, [template, show]);

  if (!show) {
    return null;
  }

  function handleSubmit(event) {
    event.preventDefault();
    onSave({ title: form.title.trim(), content: form.content.trim() });
  }

  const charCount = form.content.length;
  const segments = Math.max(1, Math.ceil(charCount / SMS_SEGMENT_LENGTH));

  return (
    <div className="sg-modal-backdrop" onClick={onCancel}>
      <div className="sg-modal-card" onClick={(event) => event.stopPropagation()}>
        <h5 className="mb-1">{template ? "Edit Template" : "New Message Template"}</h5>
        <p className="text-muted mb-3" style={{ fontSize: "0.88rem" }}>
          Reusable message for common announcements.
        </p>

        <form onSubmit={handleSubmit}>
          <div className="mb-3">
            <label htmlFor={titleId} className="form-label sg-label">
              Title
            </label>
            <input
              id={titleId}
              type="text"
              className="form-control sg-input"
              value={form.title}
              onChange={(event) => setForm((prev) => ({ ...prev, title: event.target.value }))}
              placeholder="e.g. Class Suspension Notice"
              required
              disabled={isSubmitting}
            />
          </div>

          <div className="mb-2">
            <label htmlFor={contentId} className="form-label sg-label">
              Message
            </label>
            <textarea
              id={contentId}
              className="form-control sg-input"
              rows={5}
              value={form.content}
              onChange={(event) => setForm((prev) => ({ ...prev, content: event.target.value }))}
              required
              disabled={isSubmitting}
            />
          </div>
          <div className="sg-cell-muted mb-3">
            {charCount} characters · ~{segments} SMS segment{segments > 1 ? "s" : ""}
          </div>

          <div className="d-flex justify-content-end gap-2 mt-2">
            <button type="button" className="btn btn-outline-secondary btn-sm" onClick={onCancel} disabled={isSubmitting}>
              Cancel
            </button>
            <button type="submit" className="btn sg-submit-btn btn-sm" disabled={isSubmitting}>
              {isSubmitting ? (
                <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>
              ) : template ? (
                "Save changes"
              ) : (
                "Create template"
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}