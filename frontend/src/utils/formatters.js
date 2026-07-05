export function formatCurrency(value) {
  const amount = Number(value) || 0;
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    minimumFractionDigits: 2,
  }).format(amount);
}

export function formatDate(value) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("en-PH", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function formatDateTime(value) {
  if (!value) return "—";
  return new Date(value).toLocaleString("en-PH", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function maskApiKey(key) {
  if (!key) return "";
  if (key.length <= 12) return key;
  return `${key.slice(0, 8)}••••••••••••${key.slice(-4)}`;
}

export function initials(firstName, lastName) {
  const a = (firstName || "").charAt(0);
  const b = (lastName || "").charAt(0);
  return `${a}${b}`.toUpperCase() || "?";
}