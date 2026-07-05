import { useEffect, useId, useState } from "react";
import PasswordField from "../../auth/components/PasswordField";

const EMPTY_FORM = {
  username: "",
  first_name: "",
  middle_name: "",
  last_name: "",
  extension_name: "",
  email: "",
  password: "",
};

export default function InstructorFormModal({ show, instructor, onSave, onCancel, isSubmitting }) {
  const [form, setForm] = useState(EMPTY_FORM);
  const usernameId = useId();
  const firstNameId = useId();
  const middleNameId = useId();
  const lastNameId = useId();
  const extNameId = useId();
  const emailId = useId();

  const isEditing = Boolean(instructor);

  useEffect(() => {
    if (instructor) {
      setForm({
        username: instructor.username,
        first_name: instructor.first_name,
        middle_name: instructor.middle_name || "",
        last_name: instructor.last_name,
        extension_name: instructor.extension_name || "",
        email: instructor.email,
        password: "",
      });
    } else {
      setForm(EMPTY_FORM);
    }
  }, [instructor, show]);

  if (!show) {
    return null;
  }

  function handleChange(field) {
    return (event) => setForm((prev) => ({ ...prev, [field]: event.target.value }));
  }

  function handleSubmit(event) {
    event.preventDefault();

    if (isEditing) {
      // The instructor update endpoint only accepts profile fields, not
      // password changes — trying to change credentials happens elsewhere.
      const { password, ...profileFields } = form;
      void password;
      onSave(profileFields);
    } else {
      onSave(form);
    }
  }

  return (
    <div className="sg-modal-backdrop" onClick={onCancel}>
      <div className="sg-modal-card" style={{ maxWidth: 560 }} onClick={(event) => event.stopPropagation()}>
        <h5 className="mb-1">{isEditing ? "Edit Instructor" : "New Instructor"}</h5>
        <p className="text-muted mb-3" style={{ fontSize: "0.88rem" }}>
          {isEditing
            ? "Update this instructor's profile details."
            : "Creates a login for this instructor with ITE department access."}
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
                required
                disabled={isSubmitting}
              />
            </div>

            <div className="col-md-6">
              <label htmlFor={middleNameId} className="form-label sg-label">
                Middle name <span className="text-muted fw-normal">(optional)</span>
              </label>
              <input
                id={middleNameId}
                type="text"
                className="form-control sg-input"
                value={form.middle_name}
                onChange={handleChange("middle_name")}
                disabled={isSubmitting}
              />
            </div>

            <div className="col-md-6">
              <label htmlFor={extNameId} className="form-label sg-label">
                Suffix <span className="text-muted fw-normal">(optional)</span>
              </label>
              <input
                id={extNameId}
                type="text"
                className="form-control sg-input"
                value={form.extension_name}
                onChange={handleChange("extension_name")}
                disabled={isSubmitting}
              />
            </div>

            <div className="col-md-6">
              <label htmlFor={usernameId} className="form-label sg-label">
                Username
              </label>
              <input
                id={usernameId}
                type="text"
                className="form-control sg-input"
                value={form.username}
                onChange={handleChange("username")}
                required
                disabled={isSubmitting}
              />
            </div>

            <div className="col-md-6">
              <label htmlFor={emailId} className="form-label sg-label">
                Email
              </label>
              <input
                id={emailId}
                type="email"
                className="form-control sg-input"
                value={form.email}
                onChange={handleChange("email")}
                required
                disabled={isSubmitting}
              />
            </div>

            {!isEditing && (
              <div className="col-md-6">
                <PasswordField
                  label="Temporary password"
                  value={form.password}
                  onChange={handleChange("password")}
                  autoComplete="new-password"
                  disabled={isSubmitting}
                  required
                />
              </div>
            )}
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
                "Create instructor"
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}