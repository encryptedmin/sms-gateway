import { useId, useState } from "react";
import PasswordField from "./PasswordField";
import AlertBanner from "./AlertBanner";

export default function LoginForm({ onSubmit, isSubmitting, errorMessage, onDismissError }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(true);
  const usernameId = useId();
  const rememberId = useId();

  function handleSubmit(event) {
    event.preventDefault();
    onSubmit({ username, password, rememberMe });
  }

  return (
    <form className="sg-login-form" onSubmit={handleSubmit} noValidate>
      <AlertBanner message={errorMessage} onDismiss={onDismissError} />

      <div className="mb-3">
        <label htmlFor={usernameId} className="form-label sg-label">
          Username
        </label>
        <div className="input-group sg-input-group">
          <span className="input-group-text sg-input-icon">
            <i className="bi bi-person-fill"></i>
          </span>
          <input
            id={usernameId}
            type="text"
            className="form-control sg-input"
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            autoComplete="username"
            placeholder="e.g. jdelacruz"
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

      <div className="d-flex align-items-center justify-content-between mb-4">
        <div className="form-check">
          <input
            id={rememberId}
            type="checkbox"
            className="form-check-input sg-checkbox"
            checked={rememberMe}
            onChange={(event) => setRememberMe(event.target.checked)}
            disabled={isSubmitting}
          />
          <label htmlFor={rememberId} className="form-check-label sg-checkbox-label">
            Keep me signed in
          </label>
        </div>
      </div>

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