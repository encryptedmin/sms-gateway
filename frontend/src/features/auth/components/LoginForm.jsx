import { useId, useState } from "react";
import PasswordField from "./PasswordField";
import AlertBanner from "./AlertBanner";

export default function LoginForm({ onSubmit, isSubmitting, errorMessage, onDismissError }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const emailId = useId();

  function handleSubmit(event) {
    event.preventDefault();
    onSubmit({ email: email.trim(), password });
  }

  return (
    <form className="sg-login-form" onSubmit={handleSubmit} noValidate>
      <AlertBanner message={errorMessage} onDismiss={onDismissError} />

      <div className="mb-3">
        <label htmlFor={emailId} className="form-label sg-label">
          Email
        </label>
        <div className="input-group sg-input-group">
          <span className="input-group-text sg-input-icon">
            <i className="bi bi-envelope-fill"></i>
          </span>
          <input
            id={emailId}
            type="email"
            inputMode="email"
            className="form-control sg-input"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            autoComplete="username"
            placeholder="you@school.edu"
            required
            disabled={isSubmitting}
            autoFocus
          />
        </div>
      </div>

      <PasswordField
        label="Password"
        value={password}
        onChange={(event) => setPassword(event.target.value)}
        autoComplete="current-password"
        disabled={isSubmitting}
        required
      />

      <p className="sg-cell-muted mb-4" style={{ fontSize: "0.8rem" }}>
        For your security, closing this browser signs you out.
      </p>

      <button type="submit" className="btn sg-submit-btn w-100" disabled={isSubmitting}>
        {isSubmitting ? (
          <>
            <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
            Signing in…
          </>
        ) : (
          <>
            Sign in
            <i className="bi bi-arrow-right ms-2"></i>
          </>
        )}
      </button>

      <p className="sg-form-footnote">
        Access is provisioned by your administrator. Contact the ITE
        Department office if you can't sign in.
      </p>
    </form>
  );
}
