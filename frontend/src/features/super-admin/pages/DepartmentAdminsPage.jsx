import { useCallback, useEffect, useState } from "react";
import {
  createDepartmentAdmin,
  deleteDepartmentAdmin,
  listDepartmentAdmins,
  updateDepartmentAdmin,
} from "../../../api/departmentAdminService";
import ConfirmDialog from "../../../components/ConfirmDialog";
import { useToast } from "../../../context/ToastContext";
import DepartmentAdminEditModal from "../components/DepartmentAdminEditModal";
import DepartmentAdminForm from "../components/DepartmentAdminForm";

function extractErrorMessage(error) {
  const data = error?.response?.data;
  if (!data) return "Couldn't save this account. Check your connection and try again.";
  const firstKey = Object.keys(data)[0];
  if (firstKey && Array.isArray(data[firstKey])) {
    return `${firstKey.replace("_", " ")}: ${data[firstKey][0]}`;
  }
  if (typeof data.detail === "string") return data.detail;
  return "Couldn't save this account. Double-check the fields and try again.";
}

export default function DepartmentAdminsPage() {
  const { showToast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [departmentAdmins, setDepartmentAdmins] = useState([]);
  const [editingAdmin, setEditingAdmin] = useState(null);
  const [adminPendingDelete, setAdminPendingDelete] = useState(null);

  const loadDepartmentAdmins = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await listDepartmentAdmins();
      setDepartmentAdmins(data);
    } catch {
      showToast("Couldn't load department admins.", "error");
    } finally {
      setIsLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    loadDepartmentAdmins();
  }, [loadDepartmentAdmins]);

  async function handleCreate(formValues) {
    setIsSubmitting(true);
    try {
      const admin = await createDepartmentAdmin(formValues);
      setDepartmentAdmins((prev) => [admin, ...prev.filter((item) => item.id !== admin.id)]);
      showToast(`Department admin "${admin.username}" created.`);
      return true;
    } catch (error) {
      showToast(extractErrorMessage(error), "error");
      return false;
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleSave(payload) {
    if (!editingAdmin) return;

    setIsSubmitting(true);
    try {
      const updated = await updateDepartmentAdmin(editingAdmin.id, payload);
      setDepartmentAdmins((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
      showToast("Department admin updated.");
      setEditingAdmin(null);
    } catch (error) {
      showToast(extractErrorMessage(error), "error");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleDelete() {
    if (!adminPendingDelete) return;

    setIsSubmitting(true);
    try {
      await deleteDepartmentAdmin(adminPendingDelete.id);
      setDepartmentAdmins((prev) => prev.filter((item) => item.id !== adminPendingDelete.id));
      showToast("Department admin removed.");
      setAdminPendingDelete(null);
    } catch {
      showToast("Couldn't remove this department admin.", "error");
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleRowKeyDown(event, admin) {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      setEditingAdmin(admin);
    }
  }

  return (
    <>
      <div className="row g-3">
        <div className="col-lg-6">
          <div className="sg-panel">
            <div className="sg-panel-header">
              <div>
                <h2 className="sg-panel-title">New Department Admin</h2>
                <div className="sg-panel-subtitle">Grants full ITE admin access to the account.</div>
              </div>
            </div>
            <div className="p-4">
              <DepartmentAdminForm onSubmit={handleCreate} isSubmitting={isSubmitting} />
            </div>
          </div>
        </div>

        <div className="col-lg-6">
          <div className="sg-panel h-100">
            <div className="sg-panel-header">
              <div>
                <h2 className="sg-panel-title">Department Admin Accounts</h2>
                <div className="sg-panel-subtitle">
                  ITE department admin accounts from the database.
                </div>
              </div>
            </div>

            {isLoading ? (
              <div className="d-flex justify-content-center py-5">
                <div className="spinner-border text-success" role="status">
                  <span className="visually-hidden">Loading...</span>
                </div>
              </div>
            ) : departmentAdmins.length === 0 ? (
              <div className="sg-table-empty">
                <i className="bi bi-person-badge d-block mb-2" style={{ fontSize: "1.6rem" }}></i>
                No department admin accounts yet.
              </div>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table className="sg-table">
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Username</th>
                      <th>Email</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {departmentAdmins.map((admin) => (
                      <tr
                        key={admin.id}
                        role="button"
                        tabIndex={0}
                        style={{ cursor: "pointer" }}
                        onClick={() => setEditingAdmin(admin)}
                        onKeyDown={(event) => handleRowKeyDown(event, admin)}
                      >
                        <td className="sg-cell-primary">
                          {admin.first_name} {admin.last_name}
                        </td>
                        <td>{admin.username}</td>
                        <td className="sg-cell-muted">{admin.email}</td>
                        <td>
                          <div className="d-flex gap-2 justify-content-end">
                            <button
                              className="sg-icon-btn"
                              onClick={(event) => {
                                event.stopPropagation();
                                setEditingAdmin(admin);
                              }}
                              aria-label="Edit department admin"
                            >
                              <i className="bi bi-pencil-fill"></i>
                            </button>
                            <button
                              className="sg-icon-btn sg-icon-btn-danger"
                              onClick={(event) => {
                                event.stopPropagation();
                                setAdminPendingDelete(admin);
                              }}
                              aria-label="Remove department admin"
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

            <div className="p-3 border-top" style={{ fontSize: "0.82rem", color: "var(--sg-text-500)" }}>
              <i className="bi bi-info-circle me-1"></i>
              Department admin accounts are loaded from the database for the current roster.
            </div>
          </div>
        </div>
      </div>

      <DepartmentAdminEditModal
        show={Boolean(editingAdmin)}
        admin={editingAdmin}
        onSave={handleSave}
        onCancel={() => setEditingAdmin(null)}
        isSubmitting={isSubmitting}
      />

      <ConfirmDialog
        show={Boolean(adminPendingDelete)}
        title="Remove this department admin?"
        message={`${adminPendingDelete?.first_name} ${adminPendingDelete?.last_name}'s account and login access will be permanently removed.`}
        confirmLabel="Remove account"
        isDangerous
        isSubmitting={isSubmitting}
        onConfirm={handleDelete}
        onCancel={() => setAdminPendingDelete(null)}
      />
    </>
  );
}
