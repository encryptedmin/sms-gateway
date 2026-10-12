import { useId, useState } from "react";

const CSV_TEMPLATE = [
  "first_name,last_name,mobile_number,course,year_level,section",
  "Juan,Dela Cruz,09171234567,BSIT,1,A",
  "Maria,Santos,09181234567,BSIT,2,B",
].join("\r\n");

export default function CsvImportModal({ show, groups, onImport, onClose, isSubmitting }) {
  const [file, setFile] = useState(null);
  const [groupId, setGroupId] = useState("");
  const [isShared, setIsShared] = useState(false);
  const [result, setResult] = useState(null);
  const fileId = useId();
  const groupSelectId = useId();
  const sharedId = useId();

  if (!show) return null;

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
    if (summary) setResult(summary);
  }

  function downloadTemplate() {
    const blob = new Blob(["\ufeff", CSV_TEMPLATE], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "contact-import-template.csv";
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  const created = result?.created ?? 0;
  const updated = result?.updated ?? 0;
  const skipped = result?.skipped ?? 0;
  const invalid = result?.invalid ?? 0;
  const imported = created + updated;
  const rejected = skipped + invalid;
  const nothingImported = Boolean(result) && imported === 0;
  const hasIssues = Boolean(result) && rejected > 0;

  return (
    <div className="sg-modal-backdrop">
      <div
        className="sg-modal-card"
        role="dialog"
        aria-modal="true"
        style={{ maxWidth: 680, maxHeight: "calc(100vh - 2rem)", overflowY: "auto" }}
      >
        <h5 className="mb-3">Import Contacts from CSV</h5>

        {result ? (
          <div>
            <div
              className="alert-banner"
              style={
                nothingImported || hasIssues
                  ? undefined
                  : {
                      background: "var(--sg-signal-100)",
                      color: "var(--sg-signal-600)",
                      border: "1px solid var(--sg-signal-500)",
                    }
              }
            >
              <i
                className={`bi ${
                  nothingImported || hasIssues
                    ? "bi-exclamation-triangle-fill"
                    : "bi-check-circle-fill"
                } me-2`}
              ></i>
              {nothingImported
                ? "No contacts were imported. Check the rejected rows and use the provided template."
                : hasIssues
                  ? "Import completed, but some rows need attention."
                  : "All contacts were imported successfully."}
            </div>

            <ul className="list-unstyled mb-3" style={{ fontSize: "0.9rem" }}>
              <li><i className="bi bi-person-plus-fill me-2 text-success"></i>Created: <strong>{created}</strong></li>
              <li><i className="bi bi-arrow-repeat me-2 text-primary"></i>Updated: <strong>{updated}</strong></li>
              <li><i className="bi bi-skip-forward-fill me-2 text-warning"></i>Skipped: <strong>{skipped}</strong> (missing required data or not permitted)</li>
              <li><i className="bi bi-x-circle-fill me-2 text-danger"></i>Invalid: <strong>{invalid}</strong> (phone number failed validation)</li>
            </ul>

            <div className="d-flex justify-content-end">
              <button className="btn sg-submit-btn btn-sm" onClick={handleClose}>
                Done
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <div className="p-3 mb-3" style={{ background: "var(--sg-surface-100)", borderRadius: 8 }}>
              <div className="d-flex align-items-start justify-content-between gap-3 mb-2">
                <div>
                  <div className="sg-label mb-1">Required CSV format</div>
                  <div className="text-muted" style={{ fontSize: "0.8rem" }}>
                    UTF-8, comma-delimited, with one contact per row.
                  </div>
                </div>
                <button
                  type="button"
                  className="btn btn-outline-secondary btn-sm text-nowrap"
                  onClick={downloadTemplate}
                >
                  <i className="bi bi-download me-1"></i>
                  Download template
                </button>
              </div>

              <pre
                className="mb-2 p-2"
                style={{
                  background: "var(--sg-surface-0)",
                  border: "1px solid var(--sg-surface-200)",
                  borderRadius: 6,
                  fontSize: "0.72rem",
                  overflowX: "auto",
                }}
              >
                {CSV_TEMPLATE}
              </pre>

              <ul className="mb-0 ps-3 text-muted" style={{ fontSize: "0.8rem" }}>
                <li><code>first_name</code> and <code>mobile_number</code> are required.</li>
                <li><code>last_name</code>, <code>course</code>, <code>year_level</code>, and <code>section</code> are optional.</li>
                <li>Use lowercase headers with underscores exactly as shown.</li>
                <li>Phone numbers must contain 7–15 digits and may start with <code>+</code>. Format the Excel column as Text.</li>
                <li>Existing phone numbers are updated instead of duplicated.</li>
              </ul>
            </div>

            <div className="mb-3">
              <label htmlFor={fileId} className="form-label sg-label">CSV file</label>
              <input
                id={fileId}
                type="file"
                accept=".csv,text/csv"
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
                  <option key={group.id} value={group.id}>{group.name}</option>
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
                  <><i className="bi bi-upload me-1"></i>Import</>
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
