// Tokens use localStorage so every tab in the same browser sees one account.
// They are usable only with the matching non-persistent server session cookie;
// bootstrap removes them after the browser has been closed.

const ACCESS_KEY = "sms_gateway_access";
const REFRESH_KEY = "sms_gateway_refresh";
const REMEMBER_KEY = "sms_gateway_remember";
export const SESSION_SYNC_KEY = "sms_gateway_session_sync";

function announceSession(active) {
  localStorage.setItem(
    SESSION_SYNC_KEY,
    JSON.stringify({ active, changedAt: Date.now() })
  );
}

export function saveTokens({ access, refresh }) {
  localStorage.setItem(ACCESS_KEY, access);
  if (refresh) {
    localStorage.setItem(REFRESH_KEY, refresh);
  }

  sessionStorage.removeItem(ACCESS_KEY);
  sessionStorage.removeItem(REFRESH_KEY);
  localStorage.removeItem(REMEMBER_KEY);
  announceSession(true);
}

export function getAccessToken() {
  return localStorage.getItem(ACCESS_KEY);
}

export function getRefreshToken() {
  return localStorage.getItem(REFRESH_KEY);
}

export function updateAccessToken(access) {
  localStorage.setItem(ACCESS_KEY, access);
}

export function clearTokens() {
  localStorage.removeItem(ACCESS_KEY);
  localStorage.removeItem(REFRESH_KEY);
  localStorage.removeItem(REMEMBER_KEY);
  sessionStorage.removeItem(ACCESS_KEY);
  sessionStorage.removeItem(REFRESH_KEY);
  announceSession(false);
}
