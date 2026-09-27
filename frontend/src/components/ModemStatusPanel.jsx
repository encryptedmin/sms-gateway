import { useEffect, useRef, useState } from "react";
import { getModemStatus, checkModemStatus } from "../api/modemStatusService";
import { useToast } from "../context/ToastContext";
import { formatDateTime } from "../utils/formatters";

const SIGNAL_META = {
  EXCELLENT: { label: "Excellent", bars: 3, color: "var(--sg-signal-600)" },
  GOOD: { label: "Good", bars: 2, color: "var(--sg-signal-600)" },
  WEAK: { label: "Weak", bars: 1, color: "#c9820a" },
  UNKNOWN: { label: "Unknown", bars: 0, color: "var(--sg-text-500)" },
};

function SignalBars({ bucket }) {
  const meta = SIGNAL_META[bucket] || SIGNAL_META.UNKNOWN;
  return (
    <span className="d-inline-flex align-items-end gap-1" style={{ height: 14 }} title={meta.label}>
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

export default function ModemStatusPanel() {
  const { showToast } = useToast();
  const [data, setData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isChecking, setIsChecking] = useState(false);
  const [cooldownRemaining, setCooldownRemaining] = useState(0);
  const countdownRef = useRef(null);

  useEffect(() => {
    loadStatus();
    return () => clearInterval(countdownRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function startCountdown(seconds) {
    clearInterval(countdownRef.current);
    setCooldownRemaining(seconds);
    countdownRef.current = setInterval(() => {
      setCooldownRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(countdownRef.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }

  async function loadStatus() {
    setIsLoading(true);
    try {
      const result = await getModemStatus();
      setData(result);
    } catch {
      showToast("Couldn't load modem status.", "error");
    } finally {
      setIsLoading(false);
    }
  }

  async function handleCheckNow() {
    setIsChecking(true);
    try {
      const result = await checkModemStatus();
      setData(result);
      startCountdown(result.cooldown_seconds);
    } catch (error) {
      const payload = error?.response?.data;
      if (error?.response?.status === 429 && payload) {
        setData(payload);
        startCountdown(payload.retry_after_seconds || payload.cooldown_seconds || 30);
      } else {
        showToast("Couldn't check modem status.", "error");
      }
    } finally {
      setIsChecking(false);
    }
  }

  const isOnCooldown = cooldownRemaining > 0;

  return (
    <div className="sg-panel p-3">
      <div className="d-flex align-items-center justify-content-between mb-3">
        <div>
          <div className="sg-panel-title mb-0">Modem Status</div>
          <div className="sg-panel-subtitle">Online/offline and signal per SMS module.</div>
        </div>
        <button
          className="btn sg-submit-btn btn-sm text-nowrap"
          onClick={handleCheckNow}
          disabled={isChecking || isOnCooldown}
        >
          {isChecking ? (
            <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>
          ) : isOnCooldown ? (
            `Check again in ${cooldownRemaining}s`
          ) : (
            <>
              <i className="bi bi-arrow-clockwise me-1"></i>
              Check now
            </>
          )}
        </button>
      </div>

      {isLoading ? (
        <div className="d-flex justify-content-center py-3">
          <div className="spinner-border spinner-border-sm text-success" role="status">
            <span className="visually-hidden">Loading…</span>
          </div>
        </div>
      ) : !data?.modems?.length ? (
        <div className="sg-table-empty">
          No modems detected yet. Plug in a SIM800 module (any USB port) and click "Check now".
        </div>
      ) : (
        <div className="d-flex flex-column gap-2">
          {data.modems.map((modem) => (
            <div
              key={modem.port}
              className="d-flex align-items-center justify-content-between px-3 py-2"
              style={{ background: "var(--sg-surface-100, #f4f6f8)", borderRadius: 8 }}
            >
              <div className="d-flex align-items-center gap-2">
                <span
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: "50%",
                    background: modem.online ? "var(--sg-signal-600)" : "var(--sg-text-500)",
                    display: "inline-block",
                  }}
                />
                <div>
                  <div className="sg-cell-primary" style={{ fontSize: "0.88rem" }}>
                    {modem.port}
                  </div>
                  <div
                    className="sg-cell-muted"
                    style={{ fontSize: "0.75rem" }}
                    title={modem.registration_detail || ""}
                  >
                    {modem.online === null ? "Not checked yet" : modem.online ? "Online" : "Offline"}
                    {modem.last_checked && ` · checked ${formatDateTime(modem.last_checked)}`}
                  </div>
                  {/* A modem can show real signal bars while still being
                      offline — CSQ (signal) and CREG (network
                      registration) are independent, so that combination
                      isn't a bug. Surface *why* here instead of leaving
                      someone to wonder. */}
                  {!modem.online && modem.registration_detail && (
                    <div className="sg-cell-muted" style={{ fontSize: "0.72rem", color: "#c9820a", maxWidth: 320 }}>
                      {modem.registration_detail}
                    </div>
                  )}
                </div>
              </div>
              <div className="d-flex align-items-center gap-2">
                <SignalBars bucket={modem.signal_bucket} />
                <span className="sg-cell-muted" style={{ fontSize: "0.78rem", minWidth: 60, textAlign: "right" }}>
                  {SIGNAL_META[modem.signal_bucket]?.label || "Unknown"}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
