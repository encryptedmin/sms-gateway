import { useEffect, useMemo, useRef, useState } from "react";
import { listSmsLogs, getDashboardStats } from "../../../api/smsLogsService";
import { useToast } from "../../../context/ToastContext";
import { formatDateTime } from "../../../utils/formatters";
import StatCard from "../../../components/StatCard";
import StatusBadge from "../../../components/StatusBadge";

const STATUS_OPTIONS = ["ALL", "PENDING", "SENT", "FAILED"];
const AUTO_REFRESH_INTERVAL_MS = 15000;

export default function SmsLogsPage() {
  const { showToast } = useToast();
  const [logs, setLogs] = useState([]);
  const [stats, setStats] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [searchTerm, setSearchTerm] = useState("");
  const [autoRefresh, setAutoRefresh] = useState(true);
  const intervalRef = useRef(null);

  useEffect(() => {
    loadLogs({ silent: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter]);

  useEffect(() => {
    if (autoRefresh) {
      intervalRef.current = setInterval(() => {
        loadLogs({ silent: true });
      }, AUTO_REFRESH_INTERVAL_MS);
    }
    return () => clearInterval(intervalRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoRefresh, statusFilter]);

  async function loadLogs({ silent }) {
    if (!silent) setIsLoading(true);
    try {
      const params = statusFilter !== "ALL" ? { status: statusFilter } : {};
      const [logData, statData] = await Promise.all([listSmsLogs(params), getDashboardStats()]);
      setLogs(logData);
      setStats(statData);
    } catch {
      if (!silent) showToast("Couldn't load SMS logs.", "error");
    } finally {
      if (!silent) setIsLoading(false);
    }
  }

  const filteredLogs = useMemo(() => {
    if (!searchTerm.trim()) return logs;
    const term = searchTerm.trim().toLowerCase();
    return logs.filter(
      (log) =>
        log.recipient.toLowerCase().includes(term) ||
        log.message.toLowerCase().includes(term)
    );
  }, [logs, searchTerm]);

  return (
    <div>
      <p className="text-muted mb-3">Every SMS you've sent through the gateway.</p>

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
              placeholder="Search recipient or message…"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
            />

            <select
              className="form-select sg-input"
              style={{ width: 140 }}
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
            >
              {STATUS_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option === "ALL" ? "All statuses" : option}
                </option>
              ))}
            </select>

            <div className="form-check form-switch mb-0 d-flex align-items-center gap-2">
              <input
                className="form-check-input sg-switch"
                type="checkbox"
                role="switch"
                id="instructor-auto-refresh-toggle"
                checked={autoRefresh}
                onChange={(event) => setAutoRefresh(event.target.checked)}
              />
              <label htmlFor="instructor-auto-refresh-toggle" className="sg-cell-muted mb-0">
                Auto-refresh
              </label>
            </div>

            <button className="sg-icon-btn" onClick={() => loadLogs({ silent: false })} aria-label="Refresh now">
              <i className="bi bi-arrow-clockwise"></i>
            </button>
          </div>
        </div>

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
                  <th>Recipient</th>
                  <th>Message</th>
                  <th>Status</th>
                  <th>Queued</th>
                  <th>Sent</th>
                </tr>
              </thead>
              <tbody>
                {filteredLogs.map((log) => (
                  <tr key={log.id}>
                    <td className="sg-cell-primary">{log.recipient}</td>
                    <td style={{ maxWidth: 320 }} title={log.message}>
                      {log.message.length > 70 ? `${log.message.slice(0, 70)}…` : log.message}
                      {log.status === "FAILED" && log.error_message && (
                        <div className="text-danger" style={{ fontSize: "0.76rem" }}>
                          {log.error_message}
                        </div>
                      )}
                    </td>
                    <td>
                      <StatusBadge status={log.status} />
                    </td>
                    <td className="sg-cell-muted">{formatDateTime(log.created_at)}</td>
                    <td className="sg-cell-muted">{formatDateTime(log.sent_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
