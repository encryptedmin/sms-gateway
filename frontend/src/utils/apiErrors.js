// First DRF field error for `field` (e.g. "email"), or "" when there is none.
export function extractFieldError(error, field) {
  const value = error?.response?.data?.[field];
  if (Array.isArray(value) && value.length) return String(value[0]);
  if (typeof value === "string") return value;
  return "";
}

export function extractApiError(error, fallback = "The request could not be completed.") {
  const data = error?.response?.data;
  if (!data) return fallback;
  if (typeof data.detail === "string") return data.detail;
  if (typeof data.error === "string") return data.error;

  const firstKey = Object.keys(data)[0];
  const firstValue = firstKey ? data[firstKey] : null;
  if (Array.isArray(firstValue) && firstValue.length) {
    return String(firstValue[0]);
  }
  if (typeof firstValue === "string") return firstValue;
  return fallback;
}
