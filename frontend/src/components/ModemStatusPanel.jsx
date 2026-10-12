import { useEffect, useRef, useState } from "react";
import { getModemStatus, checkModemStatus } from "../api/modemStatusService";
import { useToast } from "../context/ToastContext";
import { formatDateTime } from "../utils/formatters";


const DEFAULT_REFRESH_SECONDS = 30;

const SIGNAL_META = {
  EXCELLENT: { label: "Excellent", bars: 3, color: "var(--sg-signal-600)" },
  GOOD: { label: "Good", bars: 2, color: "var(--sg-signal-600)" },
  WEAK: { label: "Weak", bars: 1, color: "#c9820a" },
  UNKNOWN: { label: "Unknown", bars: 0, color: "var(--sg-text-500)" },
};

function SignalBars({ bucket }) {
  const meta = SIGNAL_META[bucket] || SIGNAL_META.UNKNOWN;

  return (
    <span
      className="d-inline-flex align-items-end gap-1"
      style={{ height: 14 }}
      title={meta.label}
      aria-label={`${meta.label} signal`}
    >
      {[1, 2, 3].map((bar) => (
        <span
          key={bar}
          style={{
            width: 4,
            height: 4 * bar + 2,
            borderRadius: 1,
            background: bar <= meta.bars ? meta.color : "var(--sg-surface-200)",
          }}
        />
      ))}
    </span>
  );
}

export default function ModemStatusPanel({ compact = false }) {
  const { showToast } = useToast();
  const [data, setData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const errorShownRef = useRef(false);

  useEffect(() => {
    let isMounted = true;
    let timer;

    async function refreshSignal({ initial = false } = {}) {
      if (!initial && isMounted) setIsRefreshing(true);

      try {
        const result = await checkModemStatus();
        if (isMounted) setData(result);
        errorShownRef.current = false;
      } catch (error) {
        const payload = error?.response?.data;

        if (error?.response?.status === 429 && payload?.modems) {
          if (isMounted) setData(payload);
        } else {
          try {
            const cached = await getModemStatus();
            if (isMounted) setData(cached);
          } catch {
            if (!errorShownRef.current) {
              showToast("Couldn't refresh modem signal strength.", "error");
              errorShownRef.current = true;
            }
          }
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
          setIsRefreshing(false);
        }
      }
    }

    refreshSignal({ initial: true });
    timer = window.setInterval(
      refreshSignal,
      DEFAULT_REFRESH_SECONDS * 1000
    );

    return () => {
      isMounted = false;
      window.clearInterval(timer);
    };
  }, [showToast]);

  return (
    <div className="sg-panel p-3">
      <div className="d-flex align-items-center justify-content-between mb-3 gap-3">
        <div>
          <div className="sg-panel-title mb-0">
            {compact ? "Signal Strength" : "Modem Status"}
          </div>
          <div className="sg-panel-subtitle">
            Safe AT+CSQ refresh every {data?.refresh_interval_seconds || DEFAULT_REFRESH_SECONDS} seconds.
          </div>
        </div>
        <span
          className="badge rounded-pill"
          style={{
            background: "var(--sg-signal-100)",
            color: "var(--sg-signal-600)",
            fontSize: "0.7rem",
          }}
        >
          {isRefreshing ? "Refreshing…" : "Automatic"}
        </span>
      </div>

      {isLoading ? (
        <div className="d-flex justify-content-center py-3">
          <div className="spinner-border spinner-border-sm text-success" role="status">
            <span className="visually-hidden">Loading…</span>
          </div>
        </div>
      ) : !data?.modems?.length ? (
        <div className="sg-table-empty">
          No configured modem ports are available for signal monitoring.
        </div>
      ) : (
        <div className="d-flex flex-column gap-2">
          {data.modems.map((modem) => (
            <div
              key={modem.port}
              className="d-flex align-items-center justify-content-between px-3 py-2 gap-3"
              style={{ background: "var(--sg-surface-100, #f4f6f8)", borderRadius: 8 }}
            >
              <div className="d-flex align-items-center gap-2 min-w-0">
                <span
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: "50%",
                    flex: "0 0 auto",
                    background: modem.online ? "var(--sg-signal-600)" : "var(--sg-text-500)",
                  }}
                />
                <div>
                  <div className="sg-cell-primary" style={{ fontSize: "0.88rem" }}>
                    {modem.port}
                  </div>
                  <div
                    className="sg-cell-muted"
                    style={{ fontSize: "0.72rem" }}
                    title={modem.registration_detail || ""}
                  >
                    {modem.online ? "Responding" : "No response"}
                    {modem.last_checked && ` · ${formatDateTime(modem.last_checked)}`}
                  </div>
                </div>
              </div>
              <div className="d-flex align-items-center gap-2 text-nowrap">
                <SignalBars bucket={modem.signal_bucket} />
                <span className="sg-cell-muted" style={{ fontSize: "0.76rem", minWidth: 58, textAlign: "right" }}>
                  {SIGNAL_META[modem.signal_bucket]?.label || "Unknown"}
                  {modem.signal_csq !== null && modem.signal_csq !== undefined && (
                    <small className="d-block">CSQ {modem.signal_csq}/31</small>
                  )}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
