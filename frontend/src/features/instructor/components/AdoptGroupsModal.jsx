import { useMemo, useState } from "react";

export default function AdoptGroupsModal({ show, group, candidateGroups, onToggleAdopted, onClose, isSubmitting }) {
  const [searchTerm, setSearchTerm] = useState("");

  const filteredCandidates = useMemo(() => {
    if (!searchTerm.trim()) return candidateGroups;
    const term = searchTerm.trim().toLowerCase();
    return candidateGroups.filter((candidate) => candidate.name.toLowerCase().includes(term));
  }, [candidateGroups, searchTerm]);

  if (!show || !group) {
    return null;
  }

  return (
    <div className="sg-modal-backdrop" onClick={onClose}>
      <div className="sg-modal-card" style={{ maxWidth: 520 }} onClick={(event) => event.stopPropagation()}>
        <h5 className="mb-1">Adopt Groups — {group.name}</h5>
        <p className="text-muted mb-3" style={{ fontSize: "0.88rem" }}>
          Adopting a group folds its members into "{group.name}" whenever you message it —
          without moving them out of their original group.
        </p>

        <input
          type="search"
          className="form-control sg-input mb-3"
          placeholder="Search groups…"
          value={searchTerm}
          onChange={(event) => setSearchTerm(event.target.value)}
        />

        <div style={{ maxHeight: 340, overflowY: "auto" }}>
          {filteredCandidates.length === 0 ? (
            <div className="sg-table-empty">No other groups available to adopt.</div>
          ) : (
            filteredCandidates.map((candidate) => {
              const isAdopted = (group.adopted_groups || []).includes(candidate.id);

              return (
                <label
                  key={candidate.id}
                  className="d-flex align-items-center justify-content-between py-2 px-1"
                  style={{ borderBottom: "1px solid var(--sg-surface-200)", cursor: "pointer" }}
                >
                  <div>
                    <div className="sg-cell-primary" style={{ fontSize: "0.9rem" }}>
                      {candidate.name}
                      {!candidate.owner && (
                        <span
                          className="ms-2 px-2 py-0 rounded-pill"
                          style={{ background: "var(--sg-surface-200)", color: "var(--sg-text-500)", fontSize: "0.72rem", fontWeight: 600 }}
                        >
                          Shared
                        </span>
                      )}
                    </div>
                    <div className="sg-cell-muted">{candidate.contact_count} contact(s)</div>
                  </div>

                  <input
                    type="checkbox"
                    className="form-check-input sg-switch"
                    checked={isAdopted}
                    disabled={isSubmitting}
                    onChange={() => onToggleAdopted(candidate, !isAdopted)}
                  />
                </label>
              );
            })
          )}
        </div>

        <div className="d-flex justify-content-end mt-3">
          <button className="btn sg-submit-btn btn-sm" onClick={onClose}>
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
