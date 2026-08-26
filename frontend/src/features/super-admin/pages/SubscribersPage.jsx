import { useEffect, useMemo, useState } from "react";
import { listSubscribers, enrollSubscriber, setSubscriberActive, deleteSubscriber } from "../../../api/subscribersService";
import { listApiKeys, createApiKey, setApiKeyEnabled } from "../../../api/apiKeysService";
import { listSubscriptions, enrollSubscription, changeSubscriptionPlan } from "../../../api/subscriptionsService";
import { listPlans } from "../../../api/plansService";
import { useToast } from "../../../context/ToastContext";
import { formatDate } from "../../../utils/formatters";
import ApiKeyCell from "../components/ApiKeyCell";
import SubscriptionCell from "../components/SubscriptionCell";
import PlanPickerModal from "../components/PlanPickerModal";
import EnrollSubscriberModal from "../components/EnrollSubscriberModal";
import ConfirmDialog from "../../../components/ConfirmDialog";

export default function SubscribersPage() {
  const { showToast } = useToast();
  const [subscribers, setSubscribers] = useState([]);
  const [apiKeys, setApiKeys] = useState([]);
  const [subscriptions, setSubscriptions] = useState([]);
  const [plans, setPlans] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [busySubscriberId, setBusySubscriberId] = useState(null);
  const [subscriberPendingDelete, setSubscriberPendingDelete] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isEnrollOpen, setIsEnrollOpen] = useState(false);
  const [planPickerTarget, setPlanPickerTarget] = useState(null); // { subscriber, mode: "enroll" | "change" }
  const [isPlanSubmitting, setIsPlanSubmitting] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setIsLoading(true);
    try {
      const [subscriberData, apiKeyData, subscriptionData, planData] = await Promise.all([
        listSubscribers(),
        listApiKeys(),
        listSubscriptions(),
        listPlans(),
      ]);
      setSubscribers(subscriberData);
      setApiKeys(apiKeyData);
      setSubscriptions(subscriptionData);
      setPlans(planData);
    } catch {
      showToast("Couldn't load subscribers.", "error");
    } finally {
      setIsLoading(false);
    }
  }

  const apiKeyBySubscriberId = useMemo(() => {
    const map = new Map();
    apiKeys.forEach((key) => map.set(key.subscriber, key));
    return map;
  }, [apiKeys]);

  const activeSubscriptionBySubscriberId = useMemo(() => {
    const map = new Map();
    subscriptions.forEach((subscription) => {
      if (subscription.status === "ACTIVE") {
        map.set(subscription.subscriber, subscription);
      }
    });
    return map;
  }, [subscriptions]);

  const filteredSubscribers = useMemo(() => {
    if (!searchTerm.trim()) return subscribers;
    const term = searchTerm.trim().toLowerCase();
    return subscribers.filter((subscriber) => {
      const { user } = subscriber;
      return (
        user.username.toLowerCase().includes(term) ||
        user.first_name.toLowerCase().includes(term) ||
        user.last_name.toLowerCase().includes(term) ||
        user.email.toLowerCase().includes(term)
      );
    });
  }, [subscribers, searchTerm]);

  async function handleToggleActive(subscriber, active) {
    setBusySubscriberId(subscriber.id);
    try {
      const updated = await setSubscriberActive(subscriber.id, active);
      setSubscribers((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
      showToast(active ? "Subscriber reactivated." : "Subscriber deactivated.");
    } catch {
      showToast("Couldn't update this subscriber.", "error");
    } finally {
      setBusySubscriberId(null);
    }
  }

  async function handleGenerateKey(subscriber) {
    setBusySubscriberId(subscriber.id);
    try {
      const newKey = await createApiKey(subscriber.id);
      setApiKeys((prev) => [...prev, newKey]);
      showToast("API key generated.");
    } catch {
      showToast("Couldn't generate an API key for this subscriber.", "error");
    } finally {
      setBusySubscriberId(null);
    }
  }

  async function handleToggleKeyEnabled(subscriber, apiKey, enabled) {
    setBusySubscriberId(subscriber.id);
    try {
      const updated = await setApiKeyEnabled(apiKey.id, enabled);
      setApiKeys((prev) => prev.map((key) => (key.id === updated.id ? updated : key)));
      showToast(enabled ? "API key enabled." : "API key disabled.");
    } catch {
      showToast("Couldn't update this API key.", "error");
    } finally {
      setBusySubscriberId(null);
    }
  }

  async function handleDeleteSubscriber() {
    if (!subscriberPendingDelete) return;
    setIsDeleting(true);
    try {
      await deleteSubscriber(subscriberPendingDelete.id);
      setSubscribers((prev) => prev.filter((item) => item.id !== subscriberPendingDelete.id));
      showToast("Subscriber removed.");
      setSubscriberPendingDelete(null);
    } catch {
      showToast("Couldn't remove this subscriber.", "error");
    } finally {
      setIsDeleting(false);
    }
  }

  async function handleEnrollSubscriber(payload) {
    const newSubscriber = await enrollSubscriber(payload);
    setSubscribers((prev) => [...prev, newSubscriber].sort((a, b) => a.user.username.localeCompare(b.user.username)));
    showToast(`${newSubscriber.user.username} enrolled. Share their username and temporary password directly.`);
    setIsEnrollOpen(false);
  }

  async function handlePlanConfirm(planId) {
    if (!planPickerTarget) return;
    const { subscriber, mode, subscription } = planPickerTarget;

    setIsPlanSubmitting(true);
    try {
      if (mode === "change" && subscription) {
        const updated = await changeSubscriptionPlan(subscription.id, planId);
        setSubscriptions((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
        showToast(`Switched ${subscriber.user.username} to ${updated.plan_name}.`);
      } else {
        const created = await enrollSubscription(subscriber.id, planId);
        setSubscriptions((prev) => [...prev, created]);
        showToast(`${subscriber.user.username} enrolled in ${created.plan_name}.`);
      }
      setPlanPickerTarget(null);
    } catch {
      showToast("Couldn't save this subscription. Try again.", "error");
    } finally {
      setIsPlanSubmitting(false);
    }
  }

  return (
    <div>
      <div className="sg-panel">
        <div className="sg-panel-header">
          <div>
            <h2 className="sg-panel-title">Subscribers</h2>
            <div className="sg-panel-subtitle">
              Manage subscriber accounts and their gateway API keys. Since billing is
              handled cash-to-cash, enable or disable a key directly here.
            </div>
          </div>
          <div className="d-flex align-items-center gap-2" style={{ minWidth: 220 }}>
            <input
              type="search"
              className="form-control sg-input"
              placeholder="Search subscribers…"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
            />
            <button className="btn sg-submit-btn btn-sm text-nowrap" onClick={() => setIsEnrollOpen(true)}>
              <i className="bi bi-person-plus-fill me-1"></i>
              Enroll
            </button>
          </div>
        </div>

        {isLoading ? (
          <div className="d-flex justify-content-center py-5">
            <div className="spinner-border text-success" role="status">
              <span className="visually-hidden">Loading…</span>
            </div>
          </div>
        ) : filteredSubscribers.length === 0 ? (
          <div className="sg-table-empty">No subscribers match your search.</div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table className="sg-table">
              <thead>
                <tr>
                  <th>Subscriber</th>
                  <th>Joined</th>
                  <th>Status</th>
                  <th>Subscription</th>
                  <th>API Key</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {filteredSubscribers.map((subscriber) => {
                  const apiKey = apiKeyBySubscriberId.get(subscriber.id);
                  const activeSubscription = activeSubscriptionBySubscriberId.get(subscriber.id);
                  const isBusy = busySubscriberId === subscriber.id;

                  return (
                    <tr key={subscriber.id}>
                      <td>
                        <div className="sg-cell-primary">
                          {subscriber.user.first_name} {subscriber.user.last_name}
                        </div>
                        <div className="sg-cell-muted">
                          @{subscriber.user.username} · {subscriber.user.email}
                        </div>
                      </td>
                      <td className="sg-cell-muted">{formatDate(subscriber.start_date)}</td>
                      <td>
                        <div className="form-check form-switch mb-0">
                          <input
                            className="form-check-input sg-switch"
                            type="checkbox"
                            role="switch"
                            checked={subscriber.active}
                            onChange={(event) => handleToggleActive(subscriber, event.target.checked)}
                            disabled={isBusy}
                            aria-label={subscriber.active ? "Deactivate subscriber" : "Activate subscriber"}
                          />
                        </div>
                        <span className="sg-cell-muted">{subscriber.active ? "Active" : "Inactive"}</span>
                      </td>
                      <td>
                        <SubscriptionCell
                          subscription={activeSubscription}
                          isBusy={isBusy}
                          onEnroll={() =>
                            setPlanPickerTarget({ subscriber, mode: "enroll", subscription: null })
                          }
                          onChangePlan={() =>
                            setPlanPickerTarget({ subscriber, mode: "change", subscription: activeSubscription })
                          }
                        />
                      </td>
                      <td>
                        <ApiKeyCell
                          apiKey={apiKey}
                          isBusy={isBusy}
                          onGenerate={() => handleGenerateKey(subscriber)}
                          onToggleEnabled={(enabled) => handleToggleKeyEnabled(subscriber, apiKey, enabled)}
                        />
                      </td>
                      <td>
                        <button
                          className="sg-icon-btn sg-icon-btn-danger"
                          onClick={() => setSubscriberPendingDelete(subscriber)}
                          aria-label="Remove subscriber"
                        >
                          <i className="bi bi-trash-fill"></i>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <ConfirmDialog
        show={Boolean(subscriberPendingDelete)}
        title="Remove this subscriber?"
        message={`${subscriberPendingDelete?.user?.first_name} ${subscriberPendingDelete?.user?.last_name}'s account and API key will be permanently removed.`}
        confirmLabel="Remove subscriber"
        isDangerous
        isSubmitting={isDeleting}
        onConfirm={handleDeleteSubscriber}
        onCancel={() => setSubscriberPendingDelete(null)}
      />

      <EnrollSubscriberModal
        show={isEnrollOpen}
        onEnroll={handleEnrollSubscriber}
        onCancel={() => setIsEnrollOpen(false)}
      />

      <PlanPickerModal
        show={Boolean(planPickerTarget)}
        mode={planPickerTarget?.mode}
        subscriber={planPickerTarget?.subscriber}
        plans={plans}
        currentPlanId={planPickerTarget?.subscription?.plan}
        isSubmitting={isPlanSubmitting}
        onConfirm={handlePlanConfirm}
        onCancel={() => setPlanPickerTarget(null)}
      />
    </div>
  );
}