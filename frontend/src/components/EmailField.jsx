// Labelled email input with an optional hint and an inline server/validation error.
export default function EmailField({
  id,
  value,
  onChange,
  error = "",
  hint = "",
  disabled,
  label = "Email",
  autoComplete = "off",
}) {
  const describedBy = [error ? `${id}-error` : null, hint ? `${id}-hint` : null]
    .filter(Boolean)
    .join(" ");

  return (
    <>
      <label htmlFor={id} className="form-label sg-label">
        {label}
      </label>
      <input
        id={id}
        type="email"
        inputMode="email"
        className={`form-control sg-input ${error ? "is-invalid" : ""}`}
        value={value}
        onChange={onChange}
        required
        disabled={disabled}
        autoComplete={autoComplete}
        aria-invalid={Boolean(error)}
        aria-describedby={describedBy || undefined}
      />
      {error && (
        <div id={`${id}-error`} className="invalid-feedback">
          {error}
        </div>
      )}
      {hint && (
        <div id={`${id}-hint`} className="form-text">
          {hint}
        </div>
      )}
    </>
  );
}
