import { useId, useState } from "react";
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

export default function DepartmentAdminForm({ onSubmit, isSubmitting }) {
  const [form, setForm] = useState(EMPTY_FORM);
  const usernameId = useId();
  const firstNameId = useId();
  const middleNameId = useId();
  const lastNameId = useId();
  const extNameId = useId();
  const emailId = useId();

  function handleChange(field) {
    return (event) => setForm((prev) => ({ ...prev, [field]: event.target.value }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    const wasCreated = await onSubmit(form);
    if (wasCreated) {
      setForm(EMPTY_FORM);
    }
  }

  return (
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
            Suffix <span className="text-muted fw-normal">(optional, e.g. Jr.)</span>
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
      </div>

      <button type="submit" className="btn sg-submit-btn mt-2" disabled={isSubmitting}>
        {isSubmitting ? (
          <>
            <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
            Creating…
          </>
        ) : (
          <>
            <i className="bi bi-person-plus-fill me-2"></i>
            Create department admin
          </>
        )}
      </button>
    </form>
  );
}