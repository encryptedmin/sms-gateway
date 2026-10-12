import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import ScheduleField from "./ScheduleField";
import {
  nextFullHourInputValue,
  toLocalInputValue,
  validateSchedule,
} from "../utils/schedule";
import { formatDateTime } from "../utils/formatters";

const FOCUSABLE =
  "button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [href]";

function RescheduleDialog({ log, isSubmitting, onSubmit, onCancel }) {
  const cardRef = useRef(null);
  const fieldId = useId();
  const titleId = useId();
  const [value, setValue] = useState(() => {
    const current = log.scheduled_for ? new Date(log.scheduled_for) : null;
    return current && current.getTime() > Date.now()
      ? toLocalInputValue(current)
      : nextFullHourInputValue();
  });

  const isValid = validateSchedule(value) === "";

  // Focus the date field on open and hand focus back to whatever opened the dialog.
  useEffect(() => {
    const previouslyFocused = document.activeElement;
    cardRef.current?.querySelector("input")?.focus();
    return () => previouslyFocused?.focus?.();
  }, []);

  function handleKeyDown(event) {
    if (event.key === "Escape" && !isSubmitting) {
      onCancel();
      return;
    }

    if (event.key !== "Tab") return;

    const items = [...cardRef.current.querySelectorAll(FOCUSABLE)];
    if (items.length === 0) return;
    const first = items[0];
    const last = items[items.length - 1];

    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  function handleSubmit(event) {
    event.preventDefault();
    if (isValid) onSubmit(value);
  }

  return (
    <div className="sg-modal-backdrop" onClick={isSubmitting ? undefined : onCancel}>
      <div
        ref={cardRef}
        className="sg-modal-card"
        style={{ maxWidth: 420 }}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(event) => event.stopPropagation()}
        onKeyDown={handleKeyDown}
      >
        <h5 id={titleId} className="mb-1">Reschedule message</h5>
        <p className="text-muted mb-3" style={{ fontSize: "0.88rem" }}>
          To {log.recipient_name || log.recipient}. Currently scheduled for{" "}
          {formatDateTime(log.scheduled_for)}.
        </p>

        <form onSubmit={handleSubmit}>
          <div className="mb-3">
            <ScheduleField
              id={fieldId}
              label="New send time"
              value={value}
              onChange={setValue}
              disabled={isSubmitting}
            />
          </div>

          <div className="d-flex justify-content-end gap-2">
            <button type="button" className="btn btn-outline-secondary btn-sm" onClick={onCancel} disabled={isSubmitting}>
              Cancel
            </button>
            <button type="submit" className="btn sg-submit-btn btn-sm" disabled={isSubmitting || !isValid}>
              {isSubmitting ? (
                <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>
              ) : (
                "Save new time"
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function RescheduleModal({ show, log, isSubmitting = false, onSubmit, onCancel }) {
  if (!show || !log) return null;

  return createPortal(
    <RescheduleDialog log={log} isSubmitting={isSubmitting} onSubmit={onSubmit} onCancel={onCancel} />,
    document.body
  );
}
