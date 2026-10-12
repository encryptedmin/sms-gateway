import { useId, useMemo, useState } from "react";
import SendEstimateModal from "../../../components/SendEstimateModal";

const TARGET_TYPES = [
  { value: "contact", label: "Contacts", icon: "bi-person-fill" },
  { value: "class", label: "Contact group", icon: "bi-people-fill" },
];

export default function SendSmsForm({ contacts, groups, templates, onSend, isSubmitting }) {
  const [targetType, setTargetType] = useState("contact");
  const [contactIds, setContactIds] = useState([]);
  const [contactSearch, setContactSearch] = useState("");
  const [groupId, setGroupId] = useState("");
  const [templateId, setTemplateId] = useState("");
  const [message, setMessage] = useState("");
  const [pendingSend, setPendingSend] = useState(null);

  const messageId = useId();
  const contactSearchId = useId();
  const groupSelectId = useId();

  const filteredContacts = useMemo(() => {
    if (!contactSearch.trim()) return contacts.slice(0, 50);
    const term = contactSearch.trim().toLowerCase();
    return contacts
      .filter(
        (contact) =>
          contact.first_name.toLowerCase().includes(term) ||
          (contact.last_name || "").toLowerCase().includes(term) ||
          contact.mobile_number.includes(term)
      )
      .slice(0, 50);
  }, [contacts, contactSearch]);

  const selectedGroup = useMemo(
    () => groups.find((group) => String(group.id) === String(groupId)),
    [groups, groupId]
  );

  const selectedContacts = useMemo(
    () => contacts.filter((contact) => contactIds.includes(String(contact.id))),
    [contacts, contactIds]
  );

  function toggleContact(contactId) {
    const id = String(contactId);
    setContactIds((current) =>
      current.includes(id)
        ? current.filter((selectedId) => selectedId !== id)
        : [...current, id]
    );
  }

  function handleTemplateChange(event) {
    const id = event.target.value;
    setTemplateId(id);
    const template = templates.find((item) => String(item.id) === id);
    if (template) {
      setMessage(template.content);
    }
  }

  function buildPayload() {
    if (targetType === "contact") {
      return { target_type: "contacts", message, contact_ids: contactIds };
    }
    return { target_type: "class", message, group_id: groupId };
  }

  function isValid() {
    if (!message.trim()) return false;
    if (targetType === "contact") return contactIds.length > 0;
    return Boolean(groupId);
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (!isValid()) return;

    const recipientCount = targetType === "contact"
      ? selectedContacts.length
      : Number(selectedGroup?.active_contact_count ?? selectedGroup?.contact_count ?? 0);
    const targetLabel = targetType === "contact"
      ? selectedContacts.length === 1
        ? `${selectedContacts[0].first_name} ${selectedContacts[0].last_name}`.trim()
        : `${selectedContacts.length} selected contacts`
      : selectedGroup?.name || "Selected group";

    setPendingSend({
      payload: buildPayload(),
      recipientCount,
      targetLabel,
    });
  }

  async function confirmSend() {
    if (!pendingSend) return;

    const wasSent = await onSend(pendingSend.payload);
    if (wasSent) {
      setPendingSend(null);
      setMessage("");
      setTemplateId("");
      setContactIds([]);
      setContactSearch("");
      setGroupId("");
    }
  }

  return (
    <>
    <form onSubmit={handleSubmit}>
      <div className="mb-3">
        <label className="form-label sg-label">Send to</label>
        <div className="d-flex gap-2 flex-wrap">
          {TARGET_TYPES.map((option) => (
            <button
              type="button"
              key={option.value}
              className="btn btn-sm"
              onClick={() => setTargetType(option.value)}
              disabled={isSubmitting}
              style={{
                border: `1.5px solid ${targetType === option.value ? "var(--sg-signal-500)" : "var(--sg-surface-200)"}`,
                background: targetType === option.value ? "var(--sg-signal-100)" : "var(--sg-surface-0)",
                color: targetType === option.value ? "var(--sg-signal-600)" : "var(--sg-text-500)",
              }}
            >
              <i className={`bi ${option.icon} me-1`}></i>
              {option.label}
            </button>
          ))}
        </div>
      </div>

      {targetType === "contact" ? (
        <div className="mb-3">
          <label htmlFor={contactSearchId} className="form-label sg-label">
            Select contacts
          </label>
          <input
            id={contactSearchId}
            type="search"
            className="form-control sg-input mb-2"
            placeholder="Search by name or mobile number…"
            value={contactSearch}
            onChange={(event) => setContactSearch(event.target.value)}
            disabled={isSubmitting}
          />
          {contactIds.length > 0 && (
            <div className="d-flex align-items-center justify-content-between mb-2">
              <span className="sg-cell-muted">
                {contactIds.length} {contactIds.length === 1 ? "contact" : "contacts"} selected
              </span>
              <button
                type="button"
                className="btn btn-link btn-sm p-0"
                onClick={() => setContactIds([])}
                disabled={isSubmitting}
              >
                Clear selection
              </button>
            </div>
          )}
          <div className="sg-panel" style={{ maxHeight: 200, overflowY: "auto" }}>
            {filteredContacts.length === 0 ? (
              <div className="sg-table-empty">No contacts found.</div>
            ) : (
              filteredContacts.map((contact) => (
                <label
                  key={contact.id}
                  className="d-flex align-items-center gap-2 px-3 py-2"
                  style={{ borderBottom: "1px solid var(--sg-surface-200)", cursor: "pointer" }}
                >
                  <input
                    type="checkbox"
                    checked={contactIds.includes(String(contact.id))}
                    onChange={() => toggleContact(contact.id)}
                    disabled={isSubmitting}
                  />
                  <div>
                    <div className="sg-cell-primary" style={{ fontSize: "0.88rem" }}>
                      {contact.first_name} {contact.last_name}
                    </div>
                    <div className="sg-cell-muted">{contact.mobile_number}</div>
                  </div>
                </label>
              ))
            )}
          </div>
        </div>
      ) : (
        <div className="mb-3">
          <label htmlFor={groupSelectId} className="form-label sg-label">
            Contact group
          </label>
          <select
            id={groupSelectId}
            className="form-select sg-input"
            value={groupId}
            onChange={(event) => setGroupId(event.target.value)}
            disabled={isSubmitting}
          >
            <option value="">Select a group…</option>
            {groups.map((group) => (
              <option key={group.id} value={group.id}>
                {group.name}
              </option>
            ))}
          </select>
          {groups.length === 0 ? (
            <div className="sg-cell-muted mt-1">
              No groups yet — create one under "Contact Groups" first.
            </div>
          ) : (
            selectedGroup && (
              <div className="sg-cell-muted mt-1">
                e.g. "{selectedGroup.name}" can be a whole year ("BSIT 1") or a
                specific class ("BSIT 1A") — however you set it up.
              </div>
            )
          )}
        </div>
      )}

      {templates.length > 0 && (
        <div className="mb-3">
          <label className="form-label sg-label">Start from a template</label>
          <select className="form-select sg-input" value={templateId} onChange={handleTemplateChange} disabled={isSubmitting}>
            <option value="">No template</option>
            {templates.map((template) => (
              <option key={template.id} value={template.id}>
                {template.title}
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="mb-1">
        <label htmlFor={messageId} className="form-label sg-label">
          Message
        </label>
        <textarea
          id={messageId}
          className="form-control sg-input"
          rows={5}
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          required
          disabled={isSubmitting}
        />
      </div>
      <div className="sg-cell-muted mb-3">{message.length} characters</div>

      <button type="submit" className="btn sg-submit-btn" disabled={isSubmitting || !isValid()}>
        {isSubmitting ? (
          <>
            <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
            Sending…
          </>
        ) : (
          <>
            <i className="bi bi-send-fill me-2"></i>
            Send SMS
          </>
        )}
      </button>
    </form>

    <SendEstimateModal
      show={Boolean(pendingSend)}
      recipientCount={pendingSend?.recipientCount || 0}
      targetLabel={pendingSend?.targetLabel || ""}
      isSubmitting={isSubmitting}
      onConfirm={confirmSend}
      onCancel={() => setPendingSend(null)}
    />
    </>
  );
}
