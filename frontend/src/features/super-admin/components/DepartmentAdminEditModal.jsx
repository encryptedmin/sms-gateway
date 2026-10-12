import { useEffect, useId, useState } from "react";
import EmailField from "../../../components/EmailField";
import { normalizeEmail } from "../../../utils/formatters";

const EMPTY_FORM = {
  first_name: "",
  middle_name: "",
  last_name: "",
  extension_name: "",
  email: "",
};

export default function DepartmentAdminEditModal({
  show,
  admin,
  onSave,
  onCancel,
  isSubmitting,
  emailError = "",
  onClearEmailError,
}) {
  const [form, setForm] = useState(EMPTY_FORM);
  const firstNameId = useId();
  const middleNameId = useId();
  const lastNameId = useId();
  const extNameId = useId();
  const emailId = useId();

  useEffect(() => {
    if (admin) {
      setForm({
        first_name: admin.first_name,
        middle_name: admin.middle_name || "",
        last_name: admin.last_name,
        extension_name: admin.extension_name || "",
        email: admin.email,
      });
    } else {
      setForm(EMPTY_FORM);
    }
  }, [admin, show]);

  if (!show) {
    return null;
  }

  function handleChange(field) {
    return (event) => setForm((prev) => ({ ...prev, [field]: event.target.value }));
  }

  function handleEmailChange(event) {
    onClearEmailError?.();
    handleChange("email")(event);
  }

  function handleSubmit(event) {
    event.preventDefault();
    onSave({ ...form, email: normalizeEmail(form.email) });
  }

  return (
    <div className="sg-modal-backdrop" onClick={onCancel}>
      <div className="sg-modal-card" style={{ maxWidth: 560 }} onClick={(event) => event.stopPropagation()}>
        <h5 className="mb-1">Edit Department Admin</h5>
        <p className="text-muted mb-3" style={{ fontSize: "0.88rem" }}>
          Update this department admin's profile details.
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
              <EmailField
                id={emailId}
                value={form.email}
                onChange={handleEmailChange}
                error={emailError}
                hint="Changing the email changes how this person signs in."
                disabled={isSubmitting}
              />
            </div>
          </div>

          <div className="d-flex justify-content-end gap-2 mt-3">
            <button type="button" className="btn btn-outline-secondary btn-sm" onClick={onCancel} disabled={isSubmitting}>
              Cancel
            </button>
            <button type="submit" className="btn sg-submit-btn btn-sm" disabled={isSubmitting}>
              {isSubmitting ? (
                <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>
              ) : (
                "Save changes"
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
