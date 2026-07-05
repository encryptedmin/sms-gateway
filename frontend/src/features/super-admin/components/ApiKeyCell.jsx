import { useState } from "react";
import { maskApiKey } from "../../../utils/formatters";
import { useToast } from "../../../context/ToastContext";

export default function ApiKeyCell({
  apiKey,
  onGenerate,
  onToggleEnabled,
  isBusy,
}) {
  const { showToast } = useToast();
  const [isRevealed, setIsRevealed] = useState(false);

  if (!apiKey) {
    return (
      <button className="btn btn-sm btn-outline-secondary" onClick={onGenerate} disabled={isBusy}>
        {isBusy ? (
          <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>
        ) : (
          <>
            <i className="bi bi-key-fill me-1"></i>
            Generate key
          </>
        )}
      </button>
    );
  }

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(apiKey.api_key);
      showToast("API key copied to clipboard.");
    } catch {
      showToast("Couldn't copy the key. Copy it manually instead.", "error");
    }
  }

  return (
    <div className="d-flex align-items-center gap-2 flex-wrap">
      <span className="sg-key-chip">
        {isRevealed ? apiKey.api_key : maskApiKey(apiKey.api_key)}
      </span>

      <button
        className="sg-icon-btn"
        onClick={() => setIsRevealed((prev) => !prev)}
        aria-label={isRevealed ? "Hide key" : "Reveal key"}
        title={isRevealed ? "Hide key" : "Reveal key"}
      >
        <i className={`bi ${isRevealed ? "bi-eye-slash" : "bi-eye"}`}></i>
      </button>

      <button className="sg-icon-btn" onClick={handleCopy} aria-label="Copy key" title="Copy key">
        <i className="bi bi-clipboard"></i>
      </button>

      <div className="form-check form-switch ms-1 mb-0">
        <input
          className="form-check-input sg-switch"
          type="checkbox"
          role="switch"
          checked={apiKey.enabled}
          onChange={(event) => onToggleEnabled(event.target.checked)}
          disabled={isBusy}
          aria-label={apiKey.enabled ? "Disable API key" : "Enable API key"}
        />
      </div>
      <span className="sg-cell-muted">{apiKey.enabled ? "Enabled" : "Disabled"}</span>
    </div>
  );
}