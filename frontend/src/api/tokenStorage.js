// Centralizes where auth tokens live so the rest of the app never touches
// localStorage / sessionStorage directly.

const ACCESS_KEY = "sms_gateway_access";
const REFRESH_KEY = "sms_gateway_refresh";
const REMEMBER_KEY = "sms_gateway_remember";

function activeStorage() {
  const remembered = localStorage.getItem(REMEMBER_KEY) === "true";
  return remembered ? localStorage : sessionStorage;
}

export function saveTokens({ access, refresh }, rememberMe) {
  localStorage.setItem(REMEMBER_KEY, rememberMe ? "true" : "false");
  const storage = rememberMe ? localStorage : sessionStorage;
  const other = rememberMe ? sessionStorage : localStorage;

  storage.setItem(ACCESS_KEY, access);
  if (refresh) {
    storage.setItem(REFRESH_KEY, refresh);
  }

  // Make sure a stale copy in the other storage never wins.
  other.removeItem(ACCESS_KEY);
  other.removeItem(REFRESH_KEY);
}

export function getAccessToken() {
  return activeStorage().getItem(ACCESS_KEY);
}

export function getRefreshToken() {
  return activeStorage().getItem(REFRESH_KEY);
}

export function updateAccessToken(access) {
  activeStorage().setItem(ACCESS_KEY, access);
}

export function clearTokens() {
  localStorage.removeItem(ACCESS_KEY);
  localStorage.removeItem(REFRESH_KEY);
  localStorage.removeItem(REMEMBER_KEY);
  sessionStorage.removeItem(ACCESS_KEY);
  sessionStorage.removeItem(REFRESH_KEY);
}