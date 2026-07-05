import { useState } from "react";
import { createDepartmentAdmin } from "../../../api/departmentAdminService";
import { useToast } from "../../../context/ToastContext";
import DepartmentAdminForm from "../components/DepartmentAdminForm";

function extractErrorMessage(error) {
  const data = error?.response?.data;
  if (!data) return "Couldn't create this account. Check your connection and try again.";
  const firstKey = Object.keys(data)[0];
  if (firstKey && Array.isArray(data[firstKey])) {
    return `${firstKey.replace("_", " ")}: ${data[firstKey][0]}`;
  }
  if (typeof data.detail === "string") return data.detail;
  return "Couldn't create this account. Double-check the fields and try again.";
}

export default function DepartmentAdminsPage() {
  const { showToast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [createdAdmins, setCreatedAdmins] = useState([]);

  async function handleCreate(formValues) {
    setIsSubmitting(true);
    try {
      const admin = await createDepartmentAdmin(formValues);
      setCreatedAdmins((prev) => [admin, ...prev]);
      showToast(`Department admin "${admin.username}" created.`);
      return true;
    } catch (error) {
      showToast(extractErrorMessage(error), "error");
      return false;
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
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
              <h2 className="sg-panel-title">Created this session</h2>
              <div className="sg-panel-subtitle">
                Department admin accounts you've created just now.
              </div>
            </div>
          </div>

          {createdAdmins.length === 0 ? (
            <div className="sg-table-empty">
              <i className="bi bi-person-badge d-block mb-2" style={{ fontSize: "1.6rem" }}></i>
              Accounts you create will appear here.
            </div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table className="sg-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Username</th>
                    <th>Email</th>
                  </tr>
                </thead>
                <tbody>
                  {createdAdmins.map((admin) => (
                    <tr key={admin.id}>
                      <td className="sg-cell-primary">
                        {admin.first_name} {admin.last_name}
                      </td>
                      <td>{admin.username}</td>
                      <td className="sg-cell-muted">{admin.email}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="p-3 border-top" style={{ fontSize: "0.82rem", color: "var(--sg-text-500)" }}>
            <i className="bi bi-info-circle me-1"></i>
            The API currently only supports creating department admins — a
            listing endpoint will need to be added on the backend to browse
            or edit the full roster.
          </div>
        </div>
      </div>
    </div>
  );
}