import { useId, useState } from "react";

export default function PasswordField({
  label,
  value,
  onChange,
  autoComplete,
  disabled,
  required,
}) {
  const [isVisible, setIsVisible] = useState(false);
  const inputId = useId();

  return (
    <div className="mb-3">
      <label htmlFor={inputId} className="form-label sg-label">
        {label}
      </label>
      <div className="input-group sg-input-group">
        <span className="input-group-text sg-input-icon">
          <i className="bi bi-lock-fill"></i>
        </span>
        <input
          id={inputId}
          type={isVisible ? "text" : "password"}
          className="form-control sg-input"
          value={value}
          onChange={onChange}
          autoComplete={autoComplete}
          disabled={disabled}
          required={required}
          placeholder="••••••••"
        />
        <button
          type="button"
          className="input-group-text sg-input-icon sg-toggle-visibility"
          onClick={() => setIsVisible((prev) => !prev)}
          tabIndex={-1}
          aria-label={isVisible ? "Hide password" : "Show password"}
        >
          <i className={isVisible ? "bi bi-eye-slash" : "bi bi-eye"}></i>
        </button>
      </div>
    </div>
  );
}