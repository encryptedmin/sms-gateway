import { useEffect, useId, useState } from "react";

const EMPTY_FORM = {
  first_name: "",
  last_name: "",
  mobile_number: "",
  course: "",
  year_level: "",
  section: "",
  is_shared: false,
  active: true,
};

export default function ContactFormModal({ show, contact, groups, onSave, onCancel, isSubmitting }) {
  const [form, setForm] = useState(EMPTY_FORM);
  const [selectedGroupIds, setSelectedGroupIds] = useState([]);
  const firstNameId = useId();
  const lastNameId = useId();
  const mobileId = useId();
  const courseId = useId();
  const yearId = useId();
  const sectionId = useId();
  const sharedId = useId();

  const isEditing = Boolean(contact);

  useEffect(() => {
    if (contact) {
      setForm({
        first_name: contact.first_name,
        last_name: contact.last_name || "",
        mobile_number: contact.mobile_number,
        course: contact.course || "",
        year_level: contact.year_level || "",
        section: contact.section || "",
        is_shared: Boolean(contact.is_shared),
        active: contact.active,
      });
      setSelectedGroupIds(contact.groups || []);
    } else {
      setForm(EMPTY_FORM);
      setSelectedGroupIds([]);
    }
  }, [contact, show]);

  if (!show) {
    return null;
  }

  function handleChange(field) {
    return (event) => setForm((prev) => ({ ...prev, [field]: event.target.value }));
  }

  function toggleGroup(groupId) {
    setSelectedGroupIds((prev) =>
      prev.includes(groupId) ? prev.filter((id) => id !== groupId) : [...prev, groupId]
    );
  }

  function handleSubmit(event) {
    event.preventDefault();
    onSave({
      ...form,
      first_name: form.first_name.trim(),
      last_name: form.last_name.trim(),
      mobile_number: form.mobile_number.trim(),
      course: form.course.trim(),
      year_level: form.year_level.trim(),
      section: form.section.trim(),
      groups: selectedGroupIds,
    });
  }

  return (
    <div className="sg-modal-backdrop">
      <div
        className="sg-modal-card"
        role="dialog"
        aria-modal="true"
        style={{ maxWidth: 560 }}
      >
        <h5 className="mb-1">{isEditing ? "Edit Contact" : "New Contact"}</h5>
        <p className="text-muted mb-3" style={{ fontSize: "0.88rem" }}>
          {isEditing ? "Update this contact's details." : "Add a single contact to the directory."}
        </p>

        <form onSubmit={handleSubmit}>
          <div className="row g-3">
            <div className="col-md-6">
              <label htmlFor={firstNameId} className="form-label sg-label">
                First name
              </label>
              <input
                id={firstNameId}
                type="text"
                className="form-control sg-input"
                value={form.first_name}
                onChange={handleChange("first_name")}
                required
                disabled={isSubmitting}
              />
            </div>

            <div className="col-md-6">
              <label htmlFor={lastNameId} className="form-label sg-label">
                Last name
              </label>
              <input
                id={lastNameId}
                type="text"
                className="form-control sg-input"
                value={form.last_name}
                onChange={handleChange("last_name")}
                disabled={isSubmitting}
              />
            </div>

            <div className="col-md-6">
              <label htmlFor={mobileId} className="form-label sg-label">
                Mobile number
              </label>
              <input
                id={mobileId}
                type="tel"
                className="form-control sg-input"
                value={form.mobile_number}
                onChange={handleChange("mobile_number")}
                placeholder="09XXXXXXXXX"
                required
                disabled={isSubmitting}
              />
            </div>

            <div className="col-md-6">
              <label htmlFor={courseId} className="form-label sg-label">
                Course
              </label>
              <input
                id={courseId}
                type="text"
                className="form-control sg-input"
                value={form.course}
                onChange={handleChange("course")}
                placeholder="e.g. BSIT"
                disabled={isSubmitting}
              />
            </div>

            <div className="col-md-6">
              <label htmlFor={yearId} className="form-label sg-label">
                Year level
              </label>
              <input
                id={yearId}
                type="text"
                className="form-control sg-input"
                value={form.year_level}
                onChange={handleChange("year_level")}
                placeholder="e.g. 1"
                disabled={isSubmitting}
              />
            </div>

            <div className="col-md-6">
              <label htmlFor={sectionId} className="form-label sg-label">
                Section
              </label>
              <input
                id={sectionId}
                type="text"
                className="form-control sg-input"
                value={form.section}
                onChange={handleChange("section")}
                placeholder="e.g. A"
                disabled={isSubmitting}
              />
            </div>
          </div>

          {groups.length > 0 && (
            <div className="mt-3">
              <label className="form-label sg-label">Contact groups</label>
              <div className="d-flex flex-wrap gap-2">
                {groups.map((group) => {
                  const isChecked = selectedGroupIds.includes(group.id);
                  return (
                    <button
                      type="button"
                      key={group.id}
                      className="btn btn-sm"
                      onClick={() => toggleGroup(group.id)}
                      disabled={isSubmitting}
                      style={{
                        border: `1.5px solid ${isChecked ? "var(--sg-signal-500)" : "var(--sg-surface-200)"}`,
                        background: isChecked ? "var(--sg-signal-100)" : "var(--sg-surface-0)",
                        color: isChecked ? "var(--sg-signal-600)" : "var(--sg-text-500)",
                      }}
                    >
                      {isChecked && <i className="bi bi-check-lg me-1"></i>}
                      {group.name}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <div
            className="form-check form-switch mt-3 p-3"
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
              Share this contact
            </label>
            <div className="text-muted" style={{ fontSize: "0.8rem" }}>
              {form.is_shared
                ? "Visible to other authorized users."
                : "Private to you unless included in a shared group."}
            </div>
          </div>

          <div className="d-flex justify-content-end gap-2 mt-3">
            <button type="button" className="btn btn-outline-secondary btn-sm" onClick={onCancel} disabled={isSubmitting}>
              Cancel
            </button>
            <button type="submit" className="btn sg-submit-btn btn-sm" disabled={isSubmitting}>
              {isSubmitting ? (
                <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>
              ) : isEditing ? (
                "Save changes"
              ) : (
                "Add contact"
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
