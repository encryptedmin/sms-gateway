import { useMemo, useState } from "react";

export default function GroupMembersModal({ show, group, contacts, onToggleMember, onClose, busyContactId }) {
  const [searchTerm, setSearchTerm] = useState("");

  const filteredContacts = useMemo(() => {
    if (!searchTerm.trim()) return contacts;
    const term = searchTerm.trim().toLowerCase();
    return contacts.filter(
      (contact) =>
        contact.first_name.toLowerCase().includes(term) ||
        (contact.last_name || "").toLowerCase().includes(term) ||
        contact.mobile_number.includes(term)
    );
  }, [contacts, searchTerm]);

  if (!show || !group) {
    return null;
  }

  return (
    <div className="sg-modal-backdrop" onClick={onClose}>
      <div className="sg-modal-card" style={{ maxWidth: 520 }} onClick={(event) => event.stopPropagation()}>
        <h5 className="mb-1">Manage Members — {group.name}</h5>
        <p className="text-muted mb-3" style={{ fontSize: "0.88rem" }}>
          Check a contact to add them to this group, uncheck to remove.
        </p>

        <input
          type="search"
          className="form-control sg-input mb-3"
          placeholder="Search contacts…"
          value={searchTerm}
          onChange={(event) => setSearchTerm(event.target.value)}
        />

        <div style={{ maxHeight: 340, overflowY: "auto" }}>
          {filteredContacts.length === 0 ? (
            <div className="sg-table-empty">No contacts found.</div>
          ) : (
            filteredContacts.map((contact) => {
              const isMember = contact.groups.includes(group.id);
              const isBusy = busyContactId === contact.id;

              return (
                <label
                  key={contact.id}
                  className="d-flex align-items-center justify-content-between py-2 px-1"
                  style={{ borderBottom: "1px solid var(--sg-surface-200)", cursor: "pointer" }}
                >
                  <div>
                    <div className="sg-cell-primary" style={{ fontSize: "0.9rem" }}>
                      {contact.first_name} {contact.last_name}
                    </div>
                    <div className="sg-cell-muted">{contact.mobile_number}</div>
                  </div>

                  <input
                    type="checkbox"
                    className="form-check-input sg-switch"
                    checked={isMember}
                    disabled={isBusy}
                    onChange={() => onToggleMember(contact, !isMember)}
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