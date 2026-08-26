import { useEffect, useId, useState } from "react";

const EMPTY_FORM = {
  username: "",
  password: "",
  first_name: "",
  middle_name: "",
  last_name: "",
  extension_name: "",
  email: "",
};

function extractErrorMessage(error) {
  const data = error?.response?.data;

  if (!data) {
    return "Couldn't enroll this subscriber. Try again.";
  }

  if (typeof data === "string") {
    return data;
  }

  const firstField = Object.keys(data)[0];
  const firstMessage = Array.isArray(data[firstField]) ? data[firstField][0] : data[firstField];

  if (firstField && firstMessage) {
    const label = firstField === "non_field_errors" ? "" : `${firstField}: `;
    return `${label}${firstMessage}`;
  }

  return "Couldn't enroll this subscriber. Try again.";
}

export default function EnrollSubscriberModal({ show, onEnroll, onCancel }) {
  const [form, setForm] = useState(EMPTY_FORM);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const usernameId = useId();
  const passwordId = useId();
  const firstNameId = useId();
  const middleNameId = useId();
  const lastNameId = useId();
  const extensionNameId = useId();
  const emailId = useId();

  useEffect(() => {
    if (show) {
      setForm(EMPTY_FORM);
      setErrorMessage("");
    }
  }, [show]);

  if (!show) {
    return null;
  }

  function handleChange(field) {
    return (event) => setForm((prev) => ({ ...prev, [field]: event.target.value }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setErrorMessage("");

    if (form.password.length < 8) {
      setErrorMessage("Password must be at least 8 characters.");
      return;
    }

    setIsSubmitting(true);

    try {
      await onEnroll({
        username: form.username.trim(),
        password: form.password,
        first_name: form.first_name.trim(),
        middle_name: form.middle_name.trim(),
        last_name: form.last_name.trim(),
        extension_name: form.extension_name.trim(),
        email: form.email.trim(),
      });
    } catch (error) {
      setErrorMessage(extractErrorMessage(error));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="sg-modal-backdrop" onClick={onCancel}>
      <div className="sg-modal-card" style={{ maxWidth: 560 }} onClick={(event) => event.stopPropagation()}>
        <h5 className="mb-1">Enroll a subscriber</h5>
        <p className="text-muted mb-3" style={{ fontSize: "0.88rem" }}>
          Creates the subscriber's login and account. Since this is LAN-only with no public
          sign-up, give them the username and password directly after this.
        </p>

        {errorMessage && (
          <div className="alert alert-danger py-2" style={{ fontSize: "0.85rem" }}>
            {errorMessage}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="row g-3">
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
                autoComplete="off"
              />
            </div>

            <div className="col-md-6">
              <label htmlFor={passwordId} className="form-label sg-label">
                Temporary password
              </label>
              <input
                id={passwordId}
                type="text"
                className="form-control sg-input"
                value={form.password}
                onChange={handleChange("password")}
                placeholder="At least 8 characters"
                required
                minLength={8}
                disabled={isSubmitting}
                autoComplete="off"
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

            <div className="col-md-4">
              <label htmlFor={middleNameId} className="form-label sg-label">
                Middle name <span className="text-muted">(optional)</span>
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

            <div className="col-md-4">
              <label htmlFor={extensionNameId} className="form-label sg-label">
                Suffix <span className="text-muted">(optional)</span>
              </label>
              <input
                id={extensionNameId}
                type="text"
                className="form-control sg-input"
                value={form.extension_name}
                onChange={handleChange("extension_name")}
                placeholder="e.g. Jr."
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
                "Enroll subscriber"
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
