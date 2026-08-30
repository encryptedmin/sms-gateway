import { useEffect, useMemo, useState } from "react";
import {
  listContacts,
  createContact,
  updateContact,
  deleteContact,
  importContactsCsv,
} from "../../../api/contactsService";
import { listContactGroups } from "../../../api/contactGroupsService";
import { useToast } from "../../../context/ToastContext";
import { useAuth } from "../../../context/AuthContext";
import ConfirmDialog from "../../../components/ConfirmDialog";
import ContactFormModal from "../../department-admin/components/ContactFormModal";
import CsvImportModal from "../../department-admin/components/CsvImportModal";

export default function ContactsPage() {
  const { showToast } = useToast();
  const { user } = useAuth();
  const [contacts, setContacts] = useState([]);
  const [groups, setGroups] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  const [editingContact, setEditingContact] = useState(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [contactPendingDelete, setContactPendingDelete] = useState(null);

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadData() {
    setIsLoading(true);
    try {
      const [contactData, groupData] = await Promise.all([
        listContacts({ mine: true }),
        listContactGroups(),
      ]);
      setContacts(contactData);
      setGroups(groupData);
    } catch {
      showToast("Couldn't load your contacts.", "error");
    } finally {
      setIsLoading(false);
    }
  }

  // Only groups the instructor owns can be offered as membership options —
  // shared/department-wide groups are managed elsewhere.
  const myGroups = useMemo(
    () => groups.filter((group) => group.owner === user?.id),
    [groups, user]
  );

  const groupNameById = useMemo(() => {
    const map = new Map();
    groups.forEach((group) => map.set(group.id, group.name));
    return map;
  }, [groups]);

  const filteredContacts = useMemo(() => {
    if (!searchTerm.trim()) return contacts;
    const term = searchTerm.trim().toLowerCase();
    return contacts.filter(
      (contact) =>
        contact.first_name.toLowerCase().includes(term) ||
        (contact.last_name || "").toLowerCase().includes(term) ||
        contact.mobile_number.includes(term) ||
        (contact.course || "").toLowerCase().includes(term) ||
        (contact.year_level || "").toLowerCase().includes(term) ||
        (contact.section || "").toLowerCase().includes(term)
    );
  }, [contacts, searchTerm]);

  function openCreateForm() {
    setEditingContact(null);
    setIsFormOpen(true);
  }

  function openEditForm(contact) {
    setEditingContact(contact);
    setIsFormOpen(true);
  }

  async function handleSave(payload) {
    setIsSubmitting(true);
    try {
      if (editingContact) {
        const updated = await updateContact(editingContact.id, payload);
        setContacts((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
        showToast("Contact updated.");
      } else {
        await createContact(payload);
        showToast("Contact added.");
        await loadData();
      }
      setIsFormOpen(false);
    } catch {
      showToast("Couldn't save this contact. Check the mobile number isn't already used.", "error");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleImport(file, groupId, isShared) {
    setIsSubmitting(true);
    try {
      const summary = await importContactsCsv(file, groupId, isShared);
      await loadData();
      showToast("CSV imported.");
      return summary;
    } catch {
      showToast("Couldn't import that file. Check its formatting and try again.", "error");
      return null;
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleDelete() {
    if (!contactPendingDelete) return;
    setIsSubmitting(true);
    try {
      await deleteContact(contactPendingDelete.id);
      setContacts((prev) => prev.filter((item) => item.id !== contactPendingDelete.id));
      showToast("Contact removed.");
      setContactPendingDelete(null);
    } catch {
      showToast("Couldn't remove this contact.", "error");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div>
      <div className="sg-panel">
        <div className="sg-panel-header">
          <div>
            <h2 className="sg-panel-title">My Contacts</h2>
            <div className="sg-panel-subtitle">Contacts that belong to one of your groups.</div>
          </div>

          <div className="d-flex align-items-center gap-2 flex-wrap">
            <input
              type="search"
              className="form-control sg-input"
              style={{ minWidth: 200 }}
              placeholder="Search contacts…"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
            />
            <button className="btn btn-outline-secondary btn-sm" onClick={() => setIsImportOpen(true)}>
              <i className="bi bi-upload me-1"></i>
              Import CSV
            </button>
            <button className="btn sg-submit-btn btn-sm" onClick={openCreateForm}>
              <i className="bi bi-plus-lg me-1"></i>
              New Contact
            </button>
          </div>
        </div>

        {isLoading ? (
          <div className="d-flex justify-content-center py-5">
            <div className="spinner-border text-success" role="status">
              <span className="visually-hidden">Loading…</span>
            </div>
          </div>
        ) : filteredContacts.length === 0 ? (
          <div className="sg-table-empty">
            {contacts.length === 0
              ? "No contacts yet. Add one, or create a group first under \"My Groups\"."
              : "No contacts match your search."}
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table className="sg-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Mobile</th>
                  <th>Course / Year / Section</th>
                  <th>Groups</th>
                  <th>Visibility</th>
                  <th>Status</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {filteredContacts.map((contact) => (
                  <tr key={contact.id}>
                    <td className="sg-cell-primary">
                      {contact.first_name} {contact.last_name}
                    </td>
                    <td>{contact.mobile_number}</td>
                    <td className="sg-cell-muted">
                      {[contact.course, contact.year_level, contact.section].filter(Boolean).join(" · ") || "—"}
                    </td>
                    <td className="sg-cell-muted">
                      {contact.groups.length > 0
                        ? contact.groups.map((id) => groupNameById.get(id) || "—").join(", ")
                        : "—"}
                    </td>
                    <td>
                      <span
                        className="d-inline-flex align-items-center gap-1 px-2 py-1 rounded-pill"
                        style={{
                          background: contact.is_shared ? "var(--sg-signal-100)" : "var(--sg-surface-200)",
                          color: contact.is_shared ? "var(--sg-signal-600)" : "var(--sg-text-500)",
                          fontSize: "0.78rem",
                          fontWeight: 600,
                        }}
                      >
                        <i className={`bi ${contact.is_shared ? "bi-people-fill" : "bi-lock-fill"}`}></i>
                        {contact.is_shared ? "Shared" : "Private"}
                      </span>
                    </td>
                    <td>
                      <span
                        className="d-inline-flex align-items-center gap-1 px-2 py-1 rounded-pill"
                        style={{
                          background: contact.active ? "var(--sg-signal-100)" : "var(--sg-surface-200)",
                          color: contact.active ? "var(--sg-signal-600)" : "var(--sg-text-500)",
                          fontSize: "0.78rem",
                          fontWeight: 600,
                        }}
                      >
                        {contact.active ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td>
                      <div className="d-flex gap-2 justify-content-end">
                        {contact.can_manage !== false && (
                          <>
                            <button className="sg-icon-btn" onClick={() => openEditForm(contact)} aria-label="Edit contact">
                              <i className="bi bi-pencil-fill"></i>
                            </button>
                            <button
                              className="sg-icon-btn sg-icon-btn-danger"
                              onClick={() => setContactPendingDelete(contact)}
                              aria-label="Delete contact"
                            >
                              <i className="bi bi-trash-fill"></i>
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <ContactFormModal
        show={isFormOpen}
        contact={editingContact}
        groups={myGroups}
        onSave={handleSave}
        onCancel={() => setIsFormOpen(false)}
        isSubmitting={isSubmitting}
      />

      <CsvImportModal
        show={isImportOpen}
        groups={myGroups}
        onImport={handleImport}
        onClose={() => setIsImportOpen(false)}
        isSubmitting={isSubmitting}
      />

      <ConfirmDialog
        show={Boolean(contactPendingDelete)}
        title="Delete this contact?"
        message={`${contactPendingDelete?.first_name} ${contactPendingDelete?.last_name} will be permanently removed from the directory.`}
        confirmLabel="Delete contact"
        isDangerous
        isSubmitting={isSubmitting}
        onConfirm={handleDelete}
        onCancel={() => setContactPendingDelete(null)}
      />
    </div>
  );
}
