import {
  formatScheduleTime,
  localTimeZoneName,
  maxScheduleInputValue,
  minScheduleInputValue,
  validateSchedule,
} from "../utils/schedule";

// Labelled datetime-local input with validation and a "Sends Oct 20, 3:30 PM" helper.
export default function ScheduleField({ id, label = "Send at", value, onChange, disabled }) {
  const error = value ? validateSchedule(value) : "";
  const helperId = `${id}-help`;
  const timeZone = localTimeZoneName();

  return (
    <div>
      <label htmlFor={id} className="form-label sg-label">
        {label}
      </label>
      <input
        id={id}
        type="datetime-local"
        className={`form-control sg-input ${error ? "is-invalid" : ""}`}
        value={value}
        min={minScheduleInputValue()}
        max={maxScheduleInputValue()}
        onChange={(event) => onChange(event.target.value)}
        disabled={disabled}
        aria-invalid={Boolean(error)}
        aria-describedby={helperId}
        required
      />
      <div
        id={helperId}
        className={`mt-1 ${error ? "text-danger" : "sg-cell-muted"}`}
        style={{ fontSize: "0.8rem" }}
        role={error ? "alert" : undefined}
      >
        {error ||
          (value
            ? `Sends ${formatScheduleTime(value)}${timeZone ? ` · ${timeZone}` : ""}`
            : "Choose when this message should go out.")}
      </div>
    </div>
  );
}
