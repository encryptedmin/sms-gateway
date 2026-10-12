import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  bulkCancelSmsLogs,
  bulkDeleteSmsLogs,
  bulkRetrySmsLogs,
  cancelSmsLog,
  getDashboardStats,
  listSmsLogs,
  rescheduleSmsLog,
  retrySmsLog,
  sendSmsLogNow,
} from "../api/smsLogsService";
import { useToast } from "../context/ToastContext";
import { extractApiError } from "../utils/apiErrors";
import { formatDateTime } from "../utils/formatters";
import { relativeUntil, toScheduledForISO } from "../utils/schedule";
import ConfirmDialog from "./ConfirmDialog";
import RescheduleModal from "./RescheduleModal";
import StatCard from "./StatCard";
import StatusBadge from "./StatusBadge";

const STATUS_OPTIONS = ["ALL", "PENDING", "SCHEDULED", "SENT", "FAILED", "CANCELLED"];
const AUTO_REFRESH_INTERVAL_MS = 15000;
const DELETABLE_STATUSES = new Set(["SENT", "FAILED", "CANCELLED"]);
// Scheduled rows are selectable too (for bulk cancel); they just can't be deleted.
const SELECTABLE_STATUSES = new Set([...DELETABLE_STATUSES, "SCHEDULED"]);

function isCancellable(log) {
  return log.status === "SCHEDULED" && log.can_cancel;
}

function senderName(log) {
  return log.sent_by_name || log.subscriber_name || "System";
}

export default function SmsLogsPageContent({ description, autoRefreshId }) {
  const { showToast } = useToast();
  const [logs, setLogs] = useState([]);
  const [stats, setStats] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [searchParams, setSearchParams] = useSearchParams();
  const [statusFilter, setStatusFilter] = useState(() => {
    const requested = (searchParams.get("status") || "").toUpperCase();
    return STATUS_OPTIONS.includes(requested) ? requested : "ALL";
  });
  const [now, setNow] = useState(() => Date.now());
  const [searchTerm, setSearchTerm] = useState("");
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [retryingIds, setRetryingIds] = useState(new Set());
  const [isBulkRetrying, setIsBulkRetrying] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  // { type: "cancel" | "send-now" | "cancel-batch", log, batchCount? }
  const [pendingAction, setPendingAction] = useState(null);
  const [rescheduleTarget, setRescheduleTarget] = useState(null);
  const [isActing, setIsActing] = useState(false);
  const [isBulkCancelling, setIsBulkCancelling] = useState(false);
  const intervalRef = useRef(null);

  useEffect(() => {
    loadLogs({ silent: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter]);

  useEffect(() => {
    if (autoRefresh) {
      intervalRef.current = window.setInterval(() => {
        loadLogs({ silent: true });
      }, AUTO_REFRESH_INTERVAL_MS);
    }

    return () => window.clearInterval(intervalRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoRefresh, statusFilter]);

  async function loadLogs({ silent }) {
    if (!silent) setIsLoading(true);

    try {
      const params = statusFilter !== "ALL" ? { status: statusFilter } : {};
      // Next message to go out first when looking at the schedule.
      if (statusFilter === "SCHEDULED") params.ordering = "scheduled_for";
      const [logData, statData] = await Promise.all([
        listSmsLogs(params),
        getDashboardStats(),
      ]);
      setLogs(logData);
      setStats(statData);
      setNow(Date.now());

      const selectableIds = new Set(
        logData
          .filter((log) => SELECTABLE_STATUSES.has(log.status))
          .map((log) => log.id)
      );
      setSelectedIds((current) =>
        new Set([...current].filter((id) => selectableIds.has(id)))
      );
    } catch {
      if (!silent) showToast("Couldn't load SMS logs.", "error");
    } finally {
      if (!silent) setIsLoading(false);
    }
  }

  async function handleRetry(id) {
    setRetryingIds((current) => new Set(current).add(id));

    try {
      const updated = await retrySmsLog(id);
      setLogs((current) =>
        current.map((log) => (log.id === id ? { ...log, ...updated } : log))
      );
      setSelectedIds((current) => {
        const next = new Set(current);
        next.delete(id);
        return next;
      });
      showToast("Message re-queued for sending.", "success");
    } catch (error) {
      const detail = error?.response?.data?.detail;
      showToast(detail || "Couldn't retry this message.", "error");
    } finally {
      setRetryingIds((current) => {
        const next = new Set(current);
        next.delete(id);
        return next;
      });
    }
  }

  const filteredLogs = useMemo(() => {
    if (!searchTerm.trim()) return logs;

    const term = searchTerm.trim().toLowerCase();
    return logs.filter(
      (log) =>
        (log.recipient_name || "").toLowerCase().includes(term) ||
        log.recipient.toLowerCase().includes(term) ||
        senderName(log).toLowerCase().includes(term) ||
        log.message.toLowerCase().includes(term)
    );
  }, [logs, searchTerm]);

  const selectableLogs = useMemo(
    () => filteredLogs.filter((log) => SELECTABLE_STATUSES.has(log.status)),
    [filteredLogs]
  );

  // How many cancellable SCHEDULED rows share each batch_id.
  const batchCounts = useMemo(() => {
    const counts = new Map();
    logs.forEach((log) => {
      if (log.batch_id && isCancellable(log)) {
        counts.set(log.batch_id, (counts.get(log.batch_id) || 0) + 1);
      }
    });
    return counts;
  }, [logs]);

  // The batch action is shown once per batch, on its first visible row.
  const batchActionRowIds = useMemo(() => {
    const seen = new Set();
    const rowIds = new Set();
    filteredLogs.forEach((log) => {
      if (
        log.batch_id &&
        isCancellable(log) &&
        batchCounts.get(log.batch_id) > 1 &&
        !seen.has(log.batch_id)
      ) {
        seen.add(log.batch_id);
        rowIds.add(log.id);
      }
    });
    return rowIds;
  }, [filteredLogs, batchCounts]);

  const selectedLogs = useMemo(
    () => logs.filter((log) => selectedIds.has(log.id)),
    [logs, selectedIds]
  );

  const retryableSelectedIds = useMemo(
    () =>
      selectedLogs
        .filter((log) => log.status === "FAILED" && log.can_retry)
        .map((log) => log.id),
    [selectedLogs]
  );

  const deletableSelectedIds = useMemo(
    () => selectedLogs.filter((log) => DELETABLE_STATUSES.has(log.status)).map((log) => log.id),
    [selectedLogs]
  );

  const cancellableSelectedIds = useMemo(
    () => selectedLogs.filter(isCancellable).map((log) => log.id),
    [selectedLogs]
  );

  const allVisibleSelected =
    selectableLogs.length > 0 && selectableLogs.every((log) => selectedIds.has(log.id));
  const someVisibleSelected = selectableLogs.some((log) => selectedIds.has(log.id));

  function toggleSelected(id) {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAllVisible() {
    setSelectedIds((current) => {
      const next = new Set(current);

      if (allVisibleSelected) {
        selectableLogs.forEach((log) => next.delete(log.id));
      } else {
        selectableLogs.forEach((log) => next.add(log.id));
      }

      return next;
    });
  }

  async function handleBulkRetry() {
    if (retryableSelectedIds.length === 0) return;

    setIsBulkRetrying(true);
    setRetryingIds((current) => new Set([...current, ...retryableSelectedIds]));

    try {
      const result = await bulkRetrySmsLogs(retryableSelectedIds);
      const updatedById = new Map(result.logs.map((log) => [log.id, log]));
      setLogs((current) =>
        current.map((log) =>
          updatedById.has(log.id) ? { ...log, ...updatedById.get(log.id) } : log
        )
      );
      setSelectedIds((current) => {
        const next = new Set(current);
        result.logs.forEach((log) => next.delete(log.id));
        return next;
      });

      if (result.failed_to_queue.length > 0) {
        showToast(
          `Re-queued ${result.retried} message(s); ${result.failed_to_queue.length} could not be queued.`,
          "error"
        );
      } else {
        showToast(`Re-queued ${result.retried} failed message(s).`, "success");
      }
    } catch (error) {
      const detail = error?.response?.data?.detail;
      showToast(detail || "Couldn't retry the selected messages.", "error");
    } finally {
      setRetryingIds((current) => {
        const next = new Set(current);
        retryableSelectedIds.forEach((id) => next.delete(id));
        return next;
      });
      setIsBulkRetrying(false);
    }
  }

  function handleStatusChange(next) {
    setStatusFilter(next);
    setSearchParams(next === "ALL" ? {} : { status: next }, { replace: true });
  }

  function cancelToastText({ cancelled, skipped }) {
    const base = `Cancelled ${cancelled} scheduled message(s).`;
    return skipped > 0 ? `${base} ${skipped} skipped (no longer scheduled).` : base;
  }

  function dropFromSelection(ids) {
    setSelectedIds((current) => {
      const next = new Set(current);
      ids.forEach((id) => next.delete(id));
      return next;
    });
  }

  async function handleConfirmAction() {
    if (!pendingAction) return;
    const { type, log } = pendingAction;

    setIsActing(true);
    try {
      if (type === "cancel") {
        await cancelSmsLog(log.id);
        dropFromSelection([log.id]);
        showToast("Scheduled message cancelled.", "success");
      } else if (type === "send-now") {
        await sendSmsLogNow(log.id);
        dropFromSelection([log.id]);
        showToast("Message released — sending now.", "success");
      } else if (type === "cancel-batch") {
        const result = await bulkCancelSmsLogs({ batchId: log.batch_id });
        const batchIds = logs.filter((item) => item.batch_id === log.batch_id).map((item) => item.id);
        dropFromSelection(batchIds);
        showToast(cancelToastText(result), result.cancelled > 0 ? "success" : "error");
      }
      setPendingAction(null);
      await loadLogs({ silent: true });
    } catch (error) {
      showToast(extractApiError(error, "Couldn't complete that action."), "error");
      setPendingAction(null);
      await loadLogs({ silent: true });
    } finally {
      setIsActing(false);
    }
  }

  async function handleReschedule(localValue) {
    if (!rescheduleTarget) return;

    setIsActing(true);
    try {
      await rescheduleSmsLog(rescheduleTarget.id, toScheduledForISO(localValue));
      setRescheduleTarget(null);
      showToast("Message rescheduled.", "success");
      await loadLogs({ silent: true });
    } catch (error) {
      // Keep the dialog open so the time can be corrected, unless the row is no longer scheduled.
      showToast(extractApiError(error, "Couldn't reschedule this message."), "error");
      if (error?.response?.status === 400 && error?.response?.data?.detail) {
        setRescheduleTarget(null);
        await loadLogs({ silent: true });
      }
    } finally {
      setIsActing(false);
    }
  }

  async function handleBulkCancel() {
    if (cancellableSelectedIds.length === 0) return;

    setIsBulkCancelling(true);
    try {
      const result = await bulkCancelSmsLogs({ ids: cancellableSelectedIds });
      dropFromSelection(cancellableSelectedIds);
      showToast(cancelToastText(result), result.cancelled > 0 ? "success" : "error");
      await loadLogs({ silent: true });
    } catch (error) {
      showToast(extractApiError(error, "Couldn't cancel the selected messages."), "error");
    } finally {
      setIsBulkCancelling(false);
    }
  }

  async function handleBulkDelete() {
    const ids = deletableSelectedIds;

    if (ids.length === 0) return;

    setIsDeleting(true);

    try {
      const result = await bulkDeleteSmsLogs(ids);
      setShowDeleteConfirm(false);
      setSelectedIds(new Set());
      await loadLogs({ silent: true });
      showToast(`Deleted ${result.deleted} message log(s).`, "success");
    } catch (error) {
      const detail = error?.response?.data?.detail;
      showToast(detail || "Couldn't delete the selected message logs.", "error");
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <div>
      {description && <p className="text-muted mb-3">{description}</p>}

      <div className="row g-3 mb-4">
        <div className="col-sm-6 col-xl-3">
          <StatCard label="Total Messages" value={stats?.total_messages ?? 0} icon="bi-chat-left-text-fill" accent="ink" />
        </div>
        <div className="col-sm-6 col-xl-3">
          <StatCard label="Sent" value={stats?.sent_messages ?? 0} icon="bi-check-circle-fill" accent="signal" />
        </div>
        <div className="col-sm-6 col-xl-3">
          <StatCard label="Pending" value={stats?.pending_messages ?? 0} icon="bi-hourglass-split" accent="amber" />
        </div>
        <div className="col-sm-6 col-xl-3">
          <StatCard label="Failed" value={stats?.failed_messages ?? 0} icon="bi-x-circle-fill" accent="danger" />
        </div>
      </div>

      <div className="sg-panel">
        <div className="sg-panel-header">
          <div>
            <h2 className="sg-panel-title">Message Log</h2>
            <div className="sg-panel-subtitle">Newest first.</div>
          </div>

          <div className="d-flex align-items-center gap-2 flex-wrap">
            <input
              type="search"
              className="form-control sg-input"
              style={{ minWidth: 200 }}
              placeholder="Search recipient, sender, message…"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
            />

            <select
              className="form-select sg-input"
              style={{ width: 150 }}
              aria-label="Filter by status"
              value={statusFilter}
              onChange={(event) => handleStatusChange(event.target.value)}
            >
              {STATUS_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option === "ALL" ? "All statuses" : option.charAt(0) + option.slice(1).toLowerCase()}
                </option>
              ))}
            </select>

            <div className="form-check form-switch mb-0 d-flex align-items-center gap-2">
              <input
                className="form-check-input sg-switch"
                type="checkbox"
                role="switch"
                id={autoRefreshId}
                checked={autoRefresh}
                onChange={(event) => setAutoRefresh(event.target.checked)}
              />
              <label htmlFor={autoRefreshId} className="sg-cell-muted mb-0">
                Auto-refresh
              </label>
            </div>

            <button className="sg-icon-btn" onClick={() => loadLogs({ silent: false })} aria-label="Refresh now">
              <i className="bi bi-arrow-clockwise"></i>
            </button>
          </div>
        </div>

        {selectedIds.size > 0 && (
          <div className="d-flex align-items-center gap-2 flex-wrap px-3 py-2" style={{ borderBottom: "1px solid var(--sg-surface-200)" }}>
            <span className="sg-cell-muted me-auto">
              {selectedIds.size} message{selectedIds.size === 1 ? "" : "s"} selected
            </span>
            <button
              type="button"
              className="btn btn-outline-secondary btn-sm"
              disabled={cancellableSelectedIds.length === 0 || isBulkCancelling || isDeleting}
              onClick={handleBulkCancel}
            >
              {isBulkCancelling ? (
                <span className="spinner-border spinner-border-sm me-1" role="status" aria-hidden="true"></span>
              ) : (
                <i className="bi bi-slash-circle me-1"></i>
              )}
              Cancel selected ({cancellableSelectedIds.length})
            </button>
            <button
              type="button"
              className="btn btn-outline-danger btn-sm"
              disabled={retryableSelectedIds.length === 0 || isBulkRetrying || isDeleting}
              onClick={handleBulkRetry}
            >
              <i className="bi bi-arrow-clockwise me-1"></i>
              Retry failed ({retryableSelectedIds.length})
            </button>
            <button
              type="button"
              className="btn btn-danger btn-sm"
              disabled={deletableSelectedIds.length === 0 || isBulkRetrying || isDeleting}
              onClick={() => setShowDeleteConfirm(true)}
            >
              <i className="bi bi-trash-fill me-1"></i>
              Delete selected ({deletableSelectedIds.length})
            </button>
          </div>
        )}

        {isLoading ? (
          <div className="d-flex justify-content-center py-5">
            <div className="spinner-border text-success" role="status">
              <span className="visually-hidden">Loading…</span>
            </div>
          </div>
        ) : filteredLogs.length === 0 ? (
          <div className="sg-table-empty">No messages match your filters.</div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table className="sg-table">
              <thead>
                <tr>
                  <th style={{ width: 40 }}>
                    <input
                      type="checkbox"
                      aria-label="Select all completed message logs"
                      checked={allVisibleSelected}
                      ref={(input) => {
                        if (input) input.indeterminate = someVisibleSelected && !allVisibleSelected;
                      }}
                      onChange={toggleAllVisible}
                      disabled={selectableLogs.length === 0}
                    />
                  </th>
                  <th>Recipient</th>
                  <th>Sender</th>
                  <th>Message</th>
                  <th>Status</th>
                  <th>Modem</th>
                  <th>Queued</th>
                  <th>Scheduled for</th>
                  <th>Sent</th>
                  <th className="sg-sticky-end"><span className="visually-hidden">Actions</span></th>
                </tr>
              </thead>
              <tbody>
                {filteredLogs.map((log) => {
                  const isSelectable = SELECTABLE_STATUSES.has(log.status);

                  return (
                    <tr key={log.id}>
                      <td>
                        <input
                          type="checkbox"
                          checked={selectedIds.has(log.id)}
                          disabled={!isSelectable}
                          title={isSelectable ? "Select message" : "Pending messages cannot be selected"}
                          aria-label={`Select message for ${log.recipient_name || log.recipient}`}
                          onChange={() => toggleSelected(log.id)}
                        />
                      </td>
                      <td className="sg-cell-primary" title={log.recipient}>
                        {log.recipient_name || log.recipient}
                      </td>
                      <td className="sg-cell-muted">{senderName(log)}</td>
                      <td style={{ maxWidth: 280 }} title={log.message}>
                        {log.message.length > 60 ? `${log.message.slice(0, 60)}…` : log.message}
                        {log.status === "FAILED" && log.error_message && (
                          <div className="text-danger" style={{ fontSize: "0.76rem" }}>
                            {log.failure_category_label && <strong>{log.failure_category_label}: </strong>}
                            {log.error_message}
                          </div>
                        )}
                        {log.status === "FAILED" && (
                          log.can_retry ? (
                            <button
                              type="button"
                              className="btn btn-sm btn-outline-danger mt-1 py-0 px-2"
                              style={{ fontSize: "0.72rem" }}
                              disabled={retryingIds.has(log.id)}
                              onClick={() => handleRetry(log.id)}
                            >
                              {retryingIds.has(log.id) ? (
                                <>
                                  <span className="spinner-border spinner-border-sm me-1" style={{ width: 10, height: 10 }} />
                                  Retrying…
                                </>
                              ) : (
                                <>
                                  <i className="bi bi-arrow-clockwise me-1"></i>
                                  Retry
                                </>
                              )}
                            </button>
                          ) : (
                            <div className="sg-cell-muted" style={{ fontSize: "0.7rem" }}>
                              No retry attempts left
                            </div>
                          )
                        )}
                      </td>
                      <td><StatusBadge status={log.status} /></td>
                      <td className="sg-cell-muted">{log.modem_port || "—"}</td>
                      <td className="sg-cell-muted">{formatDateTime(log.created_at)}</td>
                      <td className="sg-cell-muted">
                        {log.scheduled_for ? (
                          <>
                            {formatDateTime(log.scheduled_for)}
                            {log.status === "SCHEDULED" && (
                              <div style={{ fontSize: "0.72rem", color: "var(--sg-info-500)", fontWeight: 600 }}>
                                {relativeUntil(log.scheduled_for, now)}
                              </div>
                            )}
                          </>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="sg-cell-muted">{formatDateTime(log.sent_at)}</td>
                      <td className="sg-sticky-end">
                        {isCancellable(log) && (
                          <div className="d-flex flex-column align-items-end gap-1">
                            {batchActionRowIds.has(log.id) && (
                              <button
                                type="button"
                                className="btn btn-sm btn-outline-secondary text-nowrap py-0 px-2"
                                style={{ fontSize: "0.72rem" }}
                                onClick={() =>
                                  setPendingAction({
                                    type: "cancel-batch",
                                    log,
                                    batchCount: batchCounts.get(log.batch_id),
                                  })
                                }
                              >
                                Cancel whole batch ({batchCounts.get(log.batch_id)})
                              </button>
                            )}
                            <div className="d-flex gap-2 flex-nowrap">
                            <button
                              type="button"
                              className="sg-icon-btn"
                              title="Send now"
                              aria-label={`Send now to ${log.recipient_name || log.recipient}`}
                              onClick={() => setPendingAction({ type: "send-now", log })}
                            >
                              <i className="bi bi-send-fill"></i>
                            </button>
                            <button
                              type="button"
                              className="sg-icon-btn"
                              title="Reschedule"
                              aria-label={`Reschedule message to ${log.recipient_name || log.recipient}`}
                              onClick={() => setRescheduleTarget(log)}
                            >
                              <i className="bi bi-calendar-event"></i>
                            </button>
                            <button
                              type="button"
                              className="sg-icon-btn sg-icon-btn-danger"
                              title="Cancel"
                              aria-label={`Cancel message to ${log.recipient_name || log.recipient}`}
                              onClick={() => setPendingAction({ type: "cancel", log })}
                            >
                              <i className="bi bi-x-circle"></i>
                            </button>
                            </div>
                          </div>
                        )}
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
        show={showDeleteConfirm}
        title="Delete selected message history?"
        message={`${deletableSelectedIds.length} completed, failed or cancelled message log${deletableSelectedIds.length === 1 ? "" : "s"} will be permanently deleted. This cannot be undone.`}
        confirmLabel="Delete message history"
        isDangerous
        isSubmitting={isDeleting}
        onConfirm={handleBulkDelete}
        onCancel={() => setShowDeleteConfirm(false)}
      />
      <ConfirmDialog
        show={pendingAction?.type === "cancel"}
        title="Cancel this scheduled message?"
        message={`The message to ${pendingAction?.log?.recipient_name || pendingAction?.log?.recipient || "this recipient"} will not be sent.`}
        confirmLabel="Cancel message"
        cancelLabel="Keep scheduled"
        isDangerous
        isSubmitting={isActing}
        onConfirm={handleConfirmAction}
        onCancel={() => setPendingAction(null)}
      />

      <ConfirmDialog
        show={pendingAction?.type === "cancel-batch"}
        title="Cancel the whole batch?"
        message={`${pendingAction?.batchCount ?? 0} scheduled messages sent together will be cancelled. Messages that already went out are not affected.`}
        confirmLabel="Cancel whole batch"
        cancelLabel="Keep scheduled"
        isDangerous
        isSubmitting={isActing}
        onConfirm={handleConfirmAction}
        onCancel={() => setPendingAction(null)}
      />

      <ConfirmDialog
        show={pendingAction?.type === "send-now"}
        title="Send this message now?"
        message={`The message to ${pendingAction?.log?.recipient_name || pendingAction?.log?.recipient || "this recipient"} will be released immediately instead of waiting for its scheduled time.`}
        confirmLabel="Send now"
        isSubmitting={isActing}
        onConfirm={handleConfirmAction}
        onCancel={() => setPendingAction(null)}
      />

      <RescheduleModal
        show={Boolean(rescheduleTarget)}
        log={rescheduleTarget}
        isSubmitting={isActing}
        onSubmit={handleReschedule}
        onCancel={() => setRescheduleTarget(null)}
      />
    </div>
  );
}
