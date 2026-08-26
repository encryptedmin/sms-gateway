import { useEffect, useMemo, useState } from "react";
import {
  listContacts,
  createContact,
  updateContact,
  deleteContact,
  bulkDeleteContacts,
  bulkDeactivateContacts,
  importContactsCsv,
} from "../../../api/contactsService";
import { listContactGroups } from "../../../api/contactGroupsService";
import { useToast } from "../../../context/ToastContext";
import ConfirmDialog from "../../../components/ConfirmDialog";
import ContactFormModal from "../components/ContactFormModal";
import CsvImportModal from "../components/CsvImportModal";

export default function ContactsPage() {
  const { showToast } = useToast();
  const [contacts, setContacts] = useState([]);
  const [groups, setGroups] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  const [editingContact, setEditingContact] = useState(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [contactPendingDelete, setContactPendingDelete] = useState(null);

  const [selectedIds, setSelectedIds] = useState(() => new Set());
  const [bulkAction, setBulkAction] = useState(null); // "delete" | "deactivate" | null

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setIsLoading(true);
    try {
      const [contactData, groupData] = await Promise.all([listContacts(), listContactGroups()]);
      setContacts(contactData);
      setGroups(groupData);
    } catch {
      showToast("Couldn't load contacts.", "error");
    } finally {
      setIsLoading(false);
    }
  }

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

  const allFilteredSelected =
    filteredContacts.length > 0 && filteredContacts.every((contact) => selectedIds.has(contact.id));

  function toggleSelected(id) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  function toggleSelectAllFiltered() {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (allFilteredSelected) {
        filteredContacts.forEach((contact) => next.delete(contact.id));
      } else {
        filteredContacts.forEach((contact) => next.add(contact.id));
      }
      return next;
    });
  }

  function clearSelection() {
    setSelectedIds(new Set());
  }

  async function handleBulkAction() {
    if (!bulkAction || selectedIds.size === 0) return;
    setIsSubmitting(true);
    const ids = Array.from(selectedIds);
    try {
      if (bulkAction === "delete") {
        await bulkDeleteContacts(ids);
        showToast(`${ids.length} contact${ids.length === 1 ? "" : "s"} deleted.`);
      } else {
        await bulkDeactivateContacts(ids);
        showToast(`${ids.length} contact${ids.length === 1 ? "" : "s"} deactivated.`);
      }
      clearSelection();
      setBulkAction(null);
      await loadData();
    } catch {
      showToast("Couldn't complete that action. Try again.", "error");
    } finally {
      setIsSubmitting(false);
    }
  }

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

  async function handleImport(file, groupId) {
    setIsSubmitting(true);
    try {
      const summary = await importContactsCsv(file, groupId);
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
            <h2 className="sg-panel-title">Contacts</h2>
            <div className="sg-panel-subtitle">Everyone who can receive department SMS.</div>
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

        {selectedIds.size > 0 && (
          <div
            className="d-flex align-items-center justify-content-between flex-wrap gap-2 px-3 py-2 mb-3"
            style={{
              background: "var(--sg-signal-100)",
              borderRadius: 8,
            }}
          >
            <span style={{ fontSize: "0.9rem", fontWeight: 600 }}>
              {selectedIds.size} contact{selectedIds.size === 1 ? "" : "s"} selected
            </span>
            <div className="d-flex align-items-center gap-2">
              <button className="btn btn-outline-secondary btn-sm" onClick={clearSelection}>
                Clear
              </button>
              <button className="btn btn-outline-secondary btn-sm" onClick={() => setBulkAction("deactivate")}>
                <i className="bi bi-slash-circle me-1"></i>
                Deactivate selected
              </button>
              <button className="btn btn-danger btn-sm" onClick={() => setBulkAction("delete")}>
                <i className="bi bi-trash-fill me-1"></i>
                Delete selected
              </button>
            </div>
          </div>
        )}

        {isLoading ? (
          <div className="d-flex justify-content-center py-5">
            <div className="spinner-border text-success" role="status">
              <span className="visually-hidden">Loading…</span>
            </div>
          </div>
        ) : filteredContacts.length === 0 ? (
          <div className="sg-table-empty">No contacts match your search.</div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table className="sg-table">
              <thead>
                <tr>
                  <th style={{ width: 36 }}>
                    <input
                      type="checkbox"
                      checked={allFilteredSelected}
                      onChange={toggleSelectAllFiltered}
                      aria-label="Select all contacts"
                    />
                  </th>
                  <th>Name</th>
                  <th>Mobile</th>
                  <th>Course / Year / Section</th>
                  <th>Groups</th>
                  <th>Status</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {filteredContacts.map((contact) => (
                  <tr key={contact.id}>
                    <td>
                      <input
                        type="checkbox"
                        checked={selectedIds.has(contact.id)}
                        onChange={() => toggleSelected(contact.id)}
                        aria-label={`Select ${contact.first_name} ${contact.last_name}`}
                      />
                    </td>
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
        groups={groups}
        onSave={handleSave}
        onCancel={() => setIsFormOpen(false)}
        isSubmitting={isSubmitting}
      />

      <CsvImportModal
        show={isImportOpen}
        groups={groups}
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

      <ConfirmDialog
        show={Boolean(bulkAction)}
        title={bulkAction === "delete" ? "Delete selected contacts?" : "Deactivate selected contacts?"}
        message={
          bulkAction === "delete"
            ? `${selectedIds.size} contact${selectedIds.size === 1 ? "" : "s"} will be permanently removed from the directory. This can't be undone.`
            : `${selectedIds.size} contact${selectedIds.size === 1 ? "" : "s"} will be marked inactive and stop receiving SMS. You can reactivate them later from their profile.`
        }
        confirmLabel={bulkAction === "delete" ? "Delete contacts" : "Deactivate contacts"}
        isDangerous={bulkAction === "delete"}
        isSubmitting={isSubmitting}
        onConfirm={handleBulkAction}
        onCancel={() => setBulkAction(null)}
      />
    </div>
  );
}