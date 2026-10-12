// Helpers for scheduled SMS. The backend wants ISO 8601 with a UTC offset, while
// <input type="datetime-local"> works in the user's local time with no offset.

export const MAX_SCHEDULE_DAYS = 365;

const DAY_MS = 24 * 60 * 60 * 1000;

function pad(value) {
  return String(value).padStart(2, "0");
}

// Date -> "YYYY-MM-DDTHH:mm" in local time (minute precision).
export function toLocalInputValue(date) {
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
    `T${pad(date.getHours())}:${pad(date.getMinutes())}`
  );
}

export function nextFullHourInputValue() {
  const next = new Date();
  next.setMinutes(0, 0, 0);
  next.setHours(next.getHours() + 1);
  return toLocalInputValue(next);
}

export function minScheduleInputValue() {
  return toLocalInputValue(new Date());
}

export function maxScheduleInputValue() {
  return toLocalInputValue(new Date(Date.now() + MAX_SCHEDULE_DAYS * DAY_MS));
}

// Returns an error message, or "" when the value is a valid schedule time.
export function validateSchedule(localValue) {
  if (!localValue) return "Choose a date and time.";

  const when = new Date(localValue);
  if (Number.isNaN(when.getTime())) return "Enter a valid date and time.";

  const now = Date.now();
  if (when.getTime() <= now) return "Pick a time in the future.";
  if (when.getTime() > now + MAX_SCHEDULE_DAYS * DAY_MS) {
    return `Schedule at most ${MAX_SCHEDULE_DAYS} days ahead.`;
  }
  return "";
}

export function toScheduledForISO(localValue) {
  return new Date(localValue).toISOString();
}

// "Oct 20, 3:30 PM" (the year is added only when it isn't the current one).
export function formatScheduleTime(value) {
  if (!value) return "";
  const when = new Date(value);
  if (Number.isNaN(when.getTime())) return "";

  const options = { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" };
  if (when.getFullYear() !== new Date().getFullYear()) options.year = "numeric";
  return when.toLocaleString("en-US", options);
}

export function localTimeZoneName() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "";
  } catch {
    return "";
  }
}

// "in 2 h 15 min", "in 3 d 4 h", "due now" — relative to `now` (ms).
export function relativeUntil(value, now = Date.now()) {
  if (!value) return "";
  const diffMs = new Date(value).getTime() - now;
  if (Number.isNaN(diffMs)) return "";
  if (diffMs <= 0) return "due now";

  const totalMinutes = Math.ceil(diffMs / 60000);
  if (totalMinutes < 60) return `in ${totalMinutes} min`;

  const days = Math.floor(totalMinutes / 1440);
  const hours = Math.floor((totalMinutes % 1440) / 60);
  const minutes = totalMinutes % 60;

  if (days >= 1) {
    return hours ? `in ${days} d ${hours} h` : `in ${days} d`;
  }
  return minutes ? `in ${hours} h ${minutes} min` : `in ${hours} h`;
}
