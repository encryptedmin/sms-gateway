import { useEffect, useState } from "react";
import {
  listInstructors,
  createInstructor,
  updateInstructor,
  deleteInstructor,
} from "../../../api/instructorsService";
import { useToast } from "../../../context/ToastContext";
import ConfirmDialog from "../../../components/ConfirmDialog";
import InstructorFormModal from "../components/InstructorFormModal";

function extractErrorMessage(error) {
  const data = error?.response?.data;
  if (!data) return "Couldn't reach the server. Try again.";
  const firstKey = Object.keys(data)[0];
  if (firstKey && Array.isArray(data[firstKey])) {
    return `${firstKey.replace("_", " ")}: ${data[firstKey][0]}`;
  }
  return "Couldn't save this instructor. Check the fields and try again.";
}

export default function InstructorsPage() {
  const { showToast } = useToast();
  const [instructors, setInstructors] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [busyId, setBusyId] = useState(null);

  const [editingInstructor, setEditingInstructor] = useState(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [instructorPendingDelete, setInstructorPendingDelete] = useState(null);

  useEffect(() => {
    loadInstructors();
  }, []);

  async function loadInstructors() {
    setIsLoading(true);
    try {
      const data = await listInstructors();
      setInstructors(data);
    } catch {
      showToast("Couldn't load instructors.", "error");
    } finally {
      setIsLoading(false);
    }
  }

  function openCreateForm() {
    setEditingInstructor(null);
    setIsFormOpen(true);
  }

  function openEditForm(instructor) {
    setEditingInstructor(instructor);
    setIsFormOpen(true);
  }

  async function handleSave(payload) {
    setIsSubmitting(true);
    try {
      if (editingInstructor) {
        const updated = await updateInstructor(editingInstructor.id, payload);
        setInstructors((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
        showToast("Instructor updated.");
      } else {
        await createInstructor(payload);
        showToast("Instructor account created.");
        await loadInstructors();
      }
      setIsFormOpen(false);
    } catch (error) {
      showToast(extractErrorMessage(error), "error");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleToggleActive(instructor, isActive) {
    setBusyId(instructor.id);
    try {
      const updated = await updateInstructor(instructor.id, { is_active: isActive });
      setInstructors((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
      showToast(isActive ? "Instructor account enabled." : "Instructor account disabled.");
    } catch {
      showToast("Couldn't update this instructor.", "error");
    } finally {
      setBusyId(null);
    }
  }

  async function handleDelete() {
    if (!instructorPendingDelete) return;
    setIsSubmitting(true);
    try {
      await deleteInstructor(instructorPendingDelete.id);
      setInstructors((prev) => prev.filter((item) => item.id !== instructorPendingDelete.id));
      showToast("Instructor removed.");
      setInstructorPendingDelete(null);
    } catch {
      showToast("Couldn't remove this instructor.", "error");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div>
      <div className="sg-panel">
        <div className="sg-panel-header">
          <div>
            <h2 className="sg-panel-title">Instructors</h2>
            <div className="sg-panel-subtitle">Accounts that can send SMS on behalf of the department.</div>
          </div>
          <button className="btn sg-submit-btn btn-sm" onClick={openCreateForm}>
            <i className="bi bi-plus-lg me-1"></i>
            New Instructor
          </button>
        </div>

        {isLoading ? (
          <div className="d-flex justify-content-center py-5">
            <div className="spinner-border text-success" role="status">
              <span className="visually-hidden">Loading…</span>
            </div>
          </div>
        ) : instructors.length === 0 ? (
          <div className="sg-table-empty">No instructor accounts yet.</div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table className="sg-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Username</th>
                  <th>Email</th>
                  <th>Status</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {instructors.map((instructor) => {
                  const isBusy = busyId === instructor.id;
                  return (
                    <tr key={instructor.id}>
                      <td className="sg-cell-primary">
                        {instructor.first_name} {instructor.last_name}
                      </td>
                      <td>{instructor.username}</td>
                      <td className="sg-cell-muted">{instructor.email}</td>
                      <td>
                        <div className="form-check form-switch mb-0">
                          <input
                            className="form-check-input sg-switch"
                            type="checkbox"
                            role="switch"
                            checked={instructor.is_active}
                            onChange={(event) => handleToggleActive(instructor, event.target.checked)}
                            disabled={isBusy}
                            aria-label={instructor.is_active ? "Disable account" : "Enable account"}
                          />
                        </div>
                        <span className="sg-cell-muted">{instructor.is_active ? "Active" : "Disabled"}</span>
                      </td>
                      <td>
                        <div className="d-flex gap-2 justify-content-end">
                          <button className="sg-icon-btn" onClick={() => openEditForm(instructor)} aria-label="Edit instructor">
                            <i className="bi bi-pencil-fill"></i>
                          </button>
                          <button
                            className="sg-icon-btn sg-icon-btn-danger"
                            onClick={() => setInstructorPendingDelete(instructor)}
                            aria-label="Remove instructor"
                          >
                            <i className="bi bi-trash-fill"></i>
                          </button>
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

      <InstructorFormModal
        show={isFormOpen}
        instructor={editingInstructor}
        onSave={handleSave}
        onCancel={() => setIsFormOpen(false)}
        isSubmitting={isSubmitting}
      />

      <ConfirmDialog
        show={Boolean(instructorPendingDelete)}
        title="Remove this instructor?"
        message={`${instructorPendingDelete?.first_name} ${instructorPendingDelete?.last_name}'s account and login access will be permanently removed.`}
        confirmLabel="Remove instructor"
        isDangerous
        isSubmitting={isSubmitting}
        onConfirm={handleDelete}
        onCancel={() => setInstructorPendingDelete(null)}
      />
    </div>
  );
}