import { useEffect, useMemo, useState } from "react";
import {
  listContactGroups,
  createContactGroup,
  updateContactGroup,
  deleteContactGroup,
} from "../../../api/contactGroupsService";
import { listContacts, updateContact } from "../../../api/contactsService";
import { useToast } from "../../../context/ToastContext";
import { useAuth } from "../../../context/AuthContext";
import { formatDate } from "../../../utils/formatters";
import ConfirmDialog from "../../../components/ConfirmDialog";
import ContactGroupFormModal from "../../department-admin/components/ContactGroupFormModal";
import GroupMembersModal from "../../department-admin/components/GroupMembersModal";
import AdoptGroupsModal from "../components/AdoptGroupsModal";

export default function ContactGroupsPage() {
  const { showToast } = useToast();
  const { user } = useAuth();
  const [groups, setGroups] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [busyContactId, setBusyContactId] = useState(null);

  const [editingGroup, setEditingGroup] = useState(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [groupPendingDelete, setGroupPendingDelete] = useState(null);
  const [groupForMembers, setGroupForMembers] = useState(null);
  const [groupForAdoption, setGroupForAdoption] = useState(null);

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  const directMemberCountByGroupId = useMemo(() => {
    const map = new Map();
    contacts.forEach((contact) => {
      contact.groups.forEach((groupId) => {
        map.set(groupId, (map.get(groupId) || 0) + 1);
      });
    });
    return map;
  }, [contacts]);

  // Mirrors ContactGroup.get_all_contacts() on the backend: a group's real
  // membership (the one actually used when sending) is its own direct
  // contacts UNION every adopted group's contacts, deduplicated — not
  // just what was added directly to this group.
  const totalMembersByGroupId = useMemo(() => {
    const map = new Map();

    groups.forEach((group) => {
      const memberIds = new Set();

      contacts.forEach((contact) => {
        if (contact.groups.includes(group.id)) {
          memberIds.add(contact.id);
        }
      });

      (group.adopted_groups || []).forEach((adoptedId) => {
        contacts.forEach((contact) => {
          if (contact.groups.includes(adoptedId)) {
            memberIds.add(contact.id);
          }
        });
      });

      map.set(group.id, memberIds);
    });

    return map;
  }, [groups, contacts]);

  const groupNameById = useMemo(() => {
    const map = new Map();
    groups.forEach((group) => map.set(group.id, group.name));
    return map;
  }, [groups]);

  const adoptedContactsForMembersModal = useMemo(() => {
    if (!groupForMembers) return [];

    const rows = [];
    const seenContactIds = new Set();

    (groupForMembers.adopted_groups || []).forEach((adoptedId) => {
      const sourceGroupName = groupNameById.get(adoptedId) || "Adopted group";

      contacts.forEach((contact) => {
        if (contact.groups.includes(adoptedId) && !seenContactIds.has(contact.id)) {
          seenContactIds.add(contact.id);
          rows.push({ contact, sourceGroupName });
        }
      });
    });

    return rows;
  }, [groupForMembers, contacts, groupNameById]);

  function isOwnedByMe(group) {
    return group.owner === user?.id;
  }

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
      showToast("Couldn't save this group. You may already have a group with this name.", "error");
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

  // A group can adopt any other group it doesn't already own recursively —
  // in practice, shared department groups (no owner) plus any other class
  // this instructor owns.
  const adoptionCandidates = useMemo(() => {
    if (!groupForAdoption) return [];
    return groups.filter(
      (group) =>
        group.id !== groupForAdoption.id &&
        (group.owner === null || group.owner === user?.id)
    );
  }, [groups, groupForAdoption, user]);

  async function handleToggleAdopted(candidate, shouldAdopt) {
    if (!groupForAdoption) return;
    setIsSubmitting(true);
    try {
      const currentAdopted = groupForAdoption.adopted_groups || [];
      const nextAdopted = shouldAdopt
        ? [...currentAdopted, candidate.id]
        : currentAdopted.filter((id) => id !== candidate.id);

      const updated = await updateContactGroup(groupForAdoption.id, { adopted_groups: nextAdopted });
      setGroups((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
      setGroupForAdoption(updated);
    } catch {
      showToast("Couldn't update adopted groups.", "error");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div>
      <div className="sg-panel">
        <div className="sg-panel-header">
          <div>
            <h2 className="sg-panel-title">My Groups</h2>
            <div className="sg-panel-subtitle">
              Your classes, plus any department-wide groups shared with you.
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
          <div className="sg-table-empty">No contact groups yet. Create your first class.</div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table className="sg-table">
              <thead>
                <tr>
                  <th>Group</th>
                  <th>Owner</th>
                  <th>Members</th>
                  <th>Adopted groups</th>
                  <th>Created</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {groups.map((group) => {
                  const mine = isOwnedByMe(group);
                  const adoptedNames = (group.adopted_groups || [])
                    .map((id) => groupNameById.get(id))
                    .filter(Boolean);

                  return (
                    <tr key={group.id}>
                      <td className="sg-cell-primary">{group.name}</td>
                      <td>
                        <span
                          className="d-inline-flex align-items-center gap-1 px-2 py-1 rounded-pill"
                          style={{
                            background: mine ? "var(--sg-signal-100)" : "var(--sg-surface-200)",
                            color: mine ? "var(--sg-signal-600)" : "var(--sg-text-500)",
                            fontSize: "0.78rem",
                            fontWeight: 600,
                          }}
                        >
                          {mine ? "Mine" : "Shared"}
                        </span>
                      </td>
                      <td>
                        {(() => {
                          const totalCount = totalMembersByGroupId.get(group.id)?.size || 0;
                          const directCount = directMemberCountByGroupId.get(group.id) || 0;
                          const adoptedCount = totalCount - directCount;

                          return (
                            <div>
                              <div className="sg-cell-primary" style={{ fontSize: "0.9rem" }}>
                                {totalCount}
                              </div>
                              {adoptedCount > 0 && (
                                <div className="sg-cell-muted" style={{ fontSize: "0.75rem" }}>
                                  {directCount} added, {adoptedCount} via adopted
                                </div>
                              )}
                            </div>
                          );
                        })()}
                      </td>
                      <td className="sg-cell-muted">
                        {adoptedNames.length > 0 ? adoptedNames.join(", ") : "—"}
                      </td>
                      <td className="sg-cell-muted">{formatDate(group.created_at)}</td>
                      <td>
                        <div className="d-flex gap-2 justify-content-end">
                          {mine && (
                            <>
                              <button className="btn btn-sm btn-outline-secondary" onClick={() => setGroupForMembers(group)}>
                                <i className="bi bi-people me-1"></i>
                                Members
                              </button>
                              <button className="btn btn-sm btn-outline-secondary" onClick={() => setGroupForAdoption(group)}>
                                <i className="bi bi-diagram-3 me-1"></i>
                                Adopt
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
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
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
        adoptedContacts={adoptedContactsForMembersModal}
      />

      <AdoptGroupsModal
        show={Boolean(groupForAdoption)}
        group={groupForAdoption}
        candidateGroups={adoptionCandidates}
        onToggleAdopted={handleToggleAdopted}
        onClose={() => setGroupForAdoption(null)}
        isSubmitting={isSubmitting}
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
