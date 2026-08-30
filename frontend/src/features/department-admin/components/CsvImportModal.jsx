import { useId, useState } from "react";

export default function CsvImportModal({ show, groups, onImport, onClose, isSubmitting }) {
  const [file, setFile] = useState(null);
  const [groupId, setGroupId] = useState("");
  const [isShared, setIsShared] = useState(false);
  const [result, setResult] = useState(null);
  const fileId = useId();
  const groupSelectId = useId();
  const sharedId = useId();

  if (!show) {
    return null;
  }

  function handleClose() {
    setFile(null);
    setGroupId("");
    setIsShared(false);
    setResult(null);
    onClose();
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (!file) return;

    const summary = await onImport(file, groupId || null, isShared);
    if (summary) {
      setResult(summary);
    }
  }

  return (
    <div className="sg-modal-backdrop">
      <div className="sg-modal-card" role="dialog" aria-modal="true">
        <h5 className="mb-1">Import Contacts from CSV</h5>
        <p className="text-muted mb-3" style={{ fontSize: "0.88rem" }}>
          Columns recognized: <code>first_name</code>, <code>last_name</code>,{" "}
          <code>mobile_number</code>, <code>course</code>, <code>year_level</code>,{" "}
          <code>section</code>. Existing contacts are matched and updated by mobile number.
        </p>

        {result ? (
          <div>
            <div className="alert-banner" style={{ background: "var(--sg-signal-100)", color: "var(--sg-signal-600)", border: "1px solid var(--sg-signal-500)" }}>
              <i className="bi bi-check-circle-fill me-2"></i>
              Imported successfully.
            </div>
            <ul className="list-unstyled mb-3" style={{ fontSize: "0.9rem" }}>
              <li>✅ Created: <strong>{result.created}</strong></li>
              <li>🔄 Updated: <strong>{result.updated}</strong></li>
              <li>⏭️ Skipped: <strong>{result.skipped}</strong> (missing name or number)</li>
            </ul>
            <div className="d-flex justify-content-end">
              <button className="btn sg-submit-btn btn-sm" onClick={handleClose}>
                Done
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <div className="mb-3">
              <label htmlFor={fileId} className="form-label sg-label">
                CSV file
              </label>
              <input
                id={fileId}
                type="file"
                accept=".csv"
                className="form-control sg-input"
                onChange={(event) => setFile(event.target.files?.[0] || null)}
                required
                disabled={isSubmitting}
              />
            </div>

            <div className="mb-3">
              <label htmlFor={groupSelectId} className="form-label sg-label">
                Add all imported contacts to a group <span className="text-muted fw-normal">(optional)</span>
              </label>
              <select
                id={groupSelectId}
                className="form-select sg-input"
                value={groupId}
                onChange={(event) => setGroupId(event.target.value)}
                disabled={isSubmitting}
              >
                <option value="">No group</option>
                {groups.map((group) => (
                  <option key={group.id} value={group.id}>
                    {group.name}
                  </option>
                ))}
              </select>
            </div>

            <div
              className="form-check form-switch mb-3 p-3"
              style={{ border: "1px solid var(--sg-surface-200)", borderRadius: 8 }}
            >
              <input
                id={sharedId}
                type="checkbox"
                className="form-check-input"
                checked={isShared}
                onChange={(event) => setIsShared(event.target.checked)}
                disabled={isSubmitting}
              />
              <label htmlFor={sharedId} className="form-check-label sg-label">
                Share imported contacts
              </label>
              <div className="text-muted" style={{ fontSize: "0.8rem" }}>
                {isShared
                  ? "Every created or updated contact in this import will be shared."
                  : "Imported contacts remain private to you by default."}
              </div>
            </div>

            <div className="d-flex justify-content-end gap-2 mt-2">
              <button type="button" className="btn btn-outline-secondary btn-sm" onClick={handleClose} disabled={isSubmitting}>
                Cancel
              </button>
              <button type="submit" className="btn sg-submit-btn btn-sm" disabled={isSubmitting || !file}>
                {isSubmitting ? (
                  <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>
                ) : (
                  <>
                    <i className="bi bi-upload me-1"></i>
                    Import
                  </>
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
