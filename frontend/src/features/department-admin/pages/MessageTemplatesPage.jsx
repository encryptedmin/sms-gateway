import { useEffect, useState } from "react";
import {
  listMessageTemplates,
  createMessageTemplate,
  updateMessageTemplate,
  deleteMessageTemplate,
} from "../../../api/messageTemplatesService";
import { useToast } from "../../../context/ToastContext";
import { formatDateTime } from "../../../utils/formatters";
import ConfirmDialog from "../../../components/ConfirmDialog";
import MessageTemplateFormModal from "../components/MessageTemplateFormModal";

export default function MessageTemplatesPage() {
  const { showToast } = useToast();
  const [templates, setTemplates] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [editingTemplate, setEditingTemplate] = useState(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [templatePendingDelete, setTemplatePendingDelete] = useState(null);

  useEffect(() => {
    loadTemplates();
  }, []);

  async function loadTemplates() {
    setIsLoading(true);
    try {
      const data = await listMessageTemplates();
      setTemplates(data);
    } catch {
      showToast("Couldn't load message templates.", "error");
    } finally {
      setIsLoading(false);
    }
  }

  function openCreateForm() {
    setEditingTemplate(null);
    setIsFormOpen(true);
  }

  function openEditForm(template) {
    setEditingTemplate(template);
    setIsFormOpen(true);
  }

  async function handleSave(payload) {
    setIsSubmitting(true);
    try {
      if (editingTemplate) {
        const updated = await updateMessageTemplate(editingTemplate.id, payload);
        setTemplates((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
        showToast("Template updated.");
      } else {
        await createMessageTemplate(payload);
        showToast("Template created.");
        await loadTemplates();
      }
      setIsFormOpen(false);
    } catch {
      showToast("Couldn't save this template.", "error");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleDelete() {
    if (!templatePendingDelete) return;
    setIsSubmitting(true);
    try {
      await deleteMessageTemplate(templatePendingDelete.id);
      setTemplates((prev) => prev.filter((item) => item.id !== templatePendingDelete.id));
      showToast("Template deleted.");
      setTemplatePendingDelete(null);
    } catch {
      showToast("Couldn't delete this template.", "error");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div>
      <div className="sg-panel">
        <div className="sg-panel-header">
          <div>
            <h2 className="sg-panel-title">Message Templates</h2>
            <div className="sg-panel-subtitle">Reusable messages your team can pick when sending SMS.</div>
          </div>
          <button className="btn sg-submit-btn btn-sm" onClick={openCreateForm}>
            <i className="bi bi-plus-lg me-1"></i>
            New Template
          </button>
        </div>

        {isLoading ? (
          <div className="d-flex justify-content-center py-5">
            <div className="spinner-border text-success" role="status">
              <span className="visually-hidden">Loading…</span>
            </div>
          </div>
        ) : templates.length === 0 ? (
          <div className="sg-table-empty">No templates yet. Create your first one.</div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table className="sg-table">
              <thead>
                <tr>
                  <th>Title</th>
                  <th>Message</th>
                  <th>Created by</th>
                  <th>Last updated</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {templates.map((template) => (
                  <tr key={template.id}>
                    <td className="sg-cell-primary">{template.title}</td>
                    <td style={{ maxWidth: 320 }} title={template.content}>
                      {template.content.length > 70 ? `${template.content.slice(0, 70)}…` : template.content}
                    </td>
                    <td className="sg-cell-muted">{template.created_by_name || "—"}</td>
                    <td className="sg-cell-muted">{formatDateTime(template.updated_at)}</td>
                    <td>
                      <div className="d-flex gap-2 justify-content-end">
                        <button className="sg-icon-btn" onClick={() => openEditForm(template)} aria-label="Edit template">
                          <i className="bi bi-pencil-fill"></i>
                        </button>
                        <button
                          className="sg-icon-btn sg-icon-btn-danger"
                          onClick={() => setTemplatePendingDelete(template)}
                          aria-label="Delete template"
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

      <MessageTemplateFormModal
        show={isFormOpen}
        template={editingTemplate}
        onSave={handleSave}
        onCancel={() => setIsFormOpen(false)}
        isSubmitting={isSubmitting}
      />

      <ConfirmDialog
        show={Boolean(templatePendingDelete)}
        title="Delete this template?"
        message={`"${templatePendingDelete?.title}" will be permanently removed.`}
        confirmLabel="Delete template"
        isDangerous
        isSubmitting={isSubmitting}
        onConfirm={handleDelete}
        onCancel={() => setTemplatePendingDelete(null)}
      />
    </div>
  );
}