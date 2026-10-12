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

export function initials(firstName, lastName, email) {
  const a = (firstName || "").charAt(0);
  const b = (lastName || "").charAt(0);
  return `${a}${b}`.toUpperCase() || (email || "").charAt(0).toUpperCase() || "?";
}

// Full name when the account has one, otherwise the email (the account's only identifier).
export function displayName(user) {
  const name = [user?.first_name, user?.last_name].filter(Boolean).join(" ").trim();
  return name || user?.email || "";
}

// Emails are the login, so send them trimmed and lower-cased.
export function normalizeEmail(value) {
  return (value || "").trim().toLowerCase();
}