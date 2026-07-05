import { useEffect, useMemo, useState } from "react";
import {
  listContactGroups,
  createContactGroup,
  updateContactGroup,
  deleteContactGroup,
} from "../../../api/contactGroupsService";
import { listContacts, updateContact } from "../../../api/contactsService";
import { useToast } from "../../../context/ToastContext";
import { formatDate } from "../../../utils/formatters";
import ConfirmDialog from "../../../components/ConfirmDialog";
import ContactGroupFormModal from "../components/ContactGroupFormModal";
import GroupMembersModal from "../components/GroupMembersModal";

export default function ContactGroupsPage() {
  const { showToast } = useToast();
  const [groups, setGroups] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [busyContactId, setBusyContactId] = useState(null);

  const [editingGroup, setEditingGroup] = useState(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [groupPendingDelete, setGroupPendingDelete] = useState(null);
  const [groupForMembers, setGroupForMembers] = useState(null);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setIsLoading(true);
    try {
      const [groupData, contactData] = await Promise.all([listContactGroups(), listContacts()]);
      setGroups(groupData);
      setContacts(contactData);
    } catch {
      showToast("Couldn't load contact groups.", "error");
    } finally {
      setIsLoading(false);
    }
  }

  const memberCountByGroupId = useMemo(() => {
    const map = new Map();
    contacts.forEach((contact) => {
      contact.groups.forEach((groupId) => {
        map.set(groupId, (map.get(groupId) || 0) + 1);
      });
    });
    return map;
  }, [contacts]);

  function openCreateForm() {
    setEditingGroup(null);
    setIsFormOpen(true);
  }

  function openEditForm(group) {
    setEditingGroup(group);
    setIsFormOpen(true);
  }

  async function handleSave(payload) {
    setIsSubmitting(true);
    try {
      if (editingGroup) {
        const updated = await updateContactGroup(editingGroup.id, payload);
        setGroups((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
        showToast("Group updated.");
      } else {
        await createContactGroup(payload);
        showToast("Group created.");
        await loadData();
      }
      setIsFormOpen(false);
    } catch {
      showToast("Couldn't save this group. The name may already be in use.", "error");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleDelete() {
    if (!groupPendingDelete) return;
    setIsSubmitting(true);
    try {
      await deleteContactGroup(groupPendingDelete.id);
      setGroups((prev) => prev.filter((item) => item.id !== groupPendingDelete.id));
      showToast("Group deleted.");
      setGroupPendingDelete(null);
    } catch {
      showToast("Couldn't delete this group.", "error");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleToggleMember(contact, shouldBeMember) {
    if (!groupForMembers) return;
    setBusyContactId(contact.id);
    try {
      const nextGroups = shouldBeMember
        ? [...contact.groups, groupForMembers.id]
        : contact.groups.filter((id) => id !== groupForMembers.id);

      const updated = await updateContact(contact.id, { groups: nextGroups });
      setContacts((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
    } catch {
      showToast("Couldn't update group membership for this contact.", "error");
    } finally {
      setBusyContactId(null);
    }
  }

  return (
    <div>
      <div className="sg-panel">
        <div className="sg-panel-header">
          <div>
            <h2 className="sg-panel-title">Contact Groups</h2>
            <div className="sg-panel-subtitle">
              Organize contacts into classes or sections, e.g. "BSIT 1A", "BSIT 1B".
            </div>
          </div>
          <button className="btn sg-submit-btn btn-sm" onClick={openCreateForm}>
            <i className="bi bi-plus-lg me-1"></i>
            New Group
          </button>
        </div>

        {isLoading ? (
          <div className="d-flex justify-content-center py-5">
            <div className="spinner-border text-success" role="status">
              <span className="visually-hidden">Loading…</span>
            </div>
          </div>
        ) : groups.length === 0 ? (
          <div className="sg-table-empty">No contact groups yet. Create your first class or section.</div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table className="sg-table">
              <thead>
                <tr>
                  <th>Group</th>
                  <th>Description</th>
                  <th>Members</th>
                  <th>Created</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {groups.map((group) => (
                  <tr key={group.id}>
                    <td className="sg-cell-primary">{group.name}</td>
                    <td className="sg-cell-muted">{group.description || "—"}</td>
                    <td>{memberCountByGroupId.get(group.id) || 0}</td>
                    <td className="sg-cell-muted">{formatDate(group.created_at)}</td>
                    <td>
                      <div className="d-flex gap-2 justify-content-end">
                        <button className="btn btn-sm btn-outline-secondary" onClick={() => setGroupForMembers(group)}>
                          <i className="bi bi-people me-1"></i>
                          Members
                        </button>
                        <button className="sg-icon-btn" onClick={() => openEditForm(group)} aria-label="Edit group">
                          <i className="bi bi-pencil-fill"></i>
                        </button>
                        <button
                          className="sg-icon-btn sg-icon-btn-danger"
                          onClick={() => setGroupPendingDelete(group)}
                          aria-label="Delete group"
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

      <ContactGroupFormModal
        show={isFormOpen}
        group={editingGroup}
        onSave={handleSave}
        onCancel={() => setIsFormOpen(false)}
        isSubmitting={isSubmitting}
      />

      <GroupMembersModal
        show={Boolean(groupForMembers)}
        group={groupForMembers}
        contacts={contacts}
        onToggleMember={handleToggleMember}
        onClose={() => setGroupForMembers(null)}
        busyContactId={busyContactId}
      />

      <ConfirmDialog
        show={Boolean(groupPendingDelete)}
        title="Delete this group?"
        message={`"${groupPendingDelete?.name}" will be removed. Contacts stay, but lose their membership in this group.`}
        confirmLabel="Delete group"
        isDangerous
        isSubmitting={isSubmitting}
        onConfirm={handleDelete}
        onCancel={() => setGroupPendingDelete(null)}
      />
    </div>
  );
}