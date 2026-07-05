import { useEffect, useState } from "react";
import { listPlans, createPlan, updatePlan, deletePlan } from "../../../api/plansService";
import { useToast } from "../../../context/ToastContext";
import { formatCurrency } from "../../../utils/formatters";
import PlanFormModal from "../components/PlanFormModal";
import ConfirmDialog from "../../../components/ConfirmDialog";

export default function PlansPage() {
  const { showToast } = useToast();
  const [plans, setPlans] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [editingPlan, setEditingPlan] = useState(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [planPendingDelete, setPlanPendingDelete] = useState(null);

  useEffect(() => {
    loadPlans();
  }, []);

  async function loadPlans() {
    setIsLoading(true);
    try {
      const data = await listPlans();
      setPlans(data);
    } catch {
      showToast("Couldn't load subscription plans.", "error");
    } finally {
      setIsLoading(false);
    }
  }

  function openCreateForm() {
    setEditingPlan(null);
    setIsFormOpen(true);
  }

  function openEditForm(plan) {
    setEditingPlan(plan);
    setIsFormOpen(true);
  }

  async function handleSave(payload) {
    setIsSubmitting(true);
    try {
      if (editingPlan) {
        await updatePlan(editingPlan.id, payload);
        showToast("Plan updated.");
      } else {
        await createPlan(payload);
        showToast("Plan created.");
      }
      setIsFormOpen(false);
      await loadPlans();
    } catch {
      showToast("Couldn't save this plan. Check the fields and try again.", "error");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleDelete() {
    if (!planPendingDelete) return;
    setIsSubmitting(true);
    try {
      await deletePlan(planPendingDelete.id);
      showToast("Plan deleted.");
      setPlanPendingDelete(null);
      await loadPlans();
    } catch {
      showToast("Couldn't delete this plan.", "error");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div>
      <div className="sg-panel">
        <div className="sg-panel-header">
          <div>
            <h2 className="sg-panel-title">Subscription Plans</h2>
            <div className="sg-panel-subtitle">Plans subscribers can be placed on when they sign up.</div>
          </div>
          <button className="btn sg-submit-btn btn-sm" onClick={openCreateForm}>
            <i className="bi bi-plus-lg me-1"></i>
            New Plan
          </button>
        </div>

        {isLoading ? (
          <div className="d-flex justify-content-center py-5">
            <div className="spinner-border text-success" role="status">
              <span className="visually-hidden">Loading…</span>
            </div>
          </div>
        ) : plans.length === 0 ? (
          <div className="sg-table-empty">No subscription plans yet. Create your first one.</div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table className="sg-table">
              <thead>
                <tr>
                  <th>Plan</th>
                  <th>Description</th>
                  <th>Price</th>
                  <th>Payment type</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {plans.map((plan) => (
                  <tr key={plan.id}>
                    <td className="sg-cell-primary">{plan.plan_name}</td>
                    <td style={{ maxWidth: 320 }}>{plan.description}</td>
                    <td>{formatCurrency(plan.price)}</td>
                    <td>{plan.payment_type}</td>
                    <td>
                      <div className="d-flex gap-2 justify-content-end">
                        <button className="sg-icon-btn" onClick={() => openEditForm(plan)} aria-label="Edit plan">
                          <i className="bi bi-pencil-fill"></i>
                        </button>
                        <button
                          className="sg-icon-btn sg-icon-btn-danger"
                          onClick={() => setPlanPendingDelete(plan)}
                          aria-label="Delete plan"
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

      <PlanFormModal
        show={isFormOpen}
        plan={editingPlan}
        onSave={handleSave}
        onCancel={() => setIsFormOpen(false)}
        isSubmitting={isSubmitting}
      />

      <ConfirmDialog
        show={Boolean(planPendingDelete)}
        title="Delete this plan?"
        message={`"${planPendingDelete?.plan_name}" will be removed. Subscribers already on this plan will need to be reassigned.`}
        confirmLabel="Delete plan"
        isDangerous
        isSubmitting={isSubmitting}
        onConfirm={handleDelete}
        onCancel={() => setPlanPendingDelete(null)}
      />
    </div>
  );
}