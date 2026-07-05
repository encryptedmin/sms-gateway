import { useEffect, useMemo, useState } from "react";
import { listSubscribers, setSubscriberActive, deleteSubscriber } from "../../../api/subscribersService";
import { listApiKeys, createApiKey, setApiKeyEnabled } from "../../../api/apiKeysService";
import { useToast } from "../../../context/ToastContext";
import { formatDate } from "../../../utils/formatters";
import ApiKeyCell from "../components/ApiKeyCell";
import ConfirmDialog from "../../../components/ConfirmDialog";

export default function SubscribersPage() {
  const { showToast } = useToast();
  const [subscribers, setSubscribers] = useState([]);
  const [apiKeys, setApiKeys] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [busySubscriberId, setBusySubscriberId] = useState(null);
  const [subscriberPendingDelete, setSubscriberPendingDelete] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setIsLoading(true);
    try {
      const [subscriberData, apiKeyData] = await Promise.all([listSubscribers(), listApiKeys()]);
      setSubscribers(subscriberData);
      setApiKeys(apiKeyData);
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
          <div style={{ minWidth: 220 }}>
            <input
              type="search"
              className="form-control sg-input"
              placeholder="Search subscribers…"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
            />
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
                  <th>API Key</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {filteredSubscribers.map((subscriber) => {
                  const apiKey = apiKeyBySubscriberId.get(subscriber.id);
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
    </div>
  );
}