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
