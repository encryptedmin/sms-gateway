import { markBrowserClosing } from "./authService";


const OPEN_TABS_KEY = "sms_gateway_open_tabs";
const TAB_HEARTBEAT_MS = 3000;
const TAB_STALE_AFTER_MS = 12000;
const TAB_ID = globalThis.crypto?.randomUUID?.()
  || `${Date.now()}-${Math.random().toString(36).slice(2)}`;

function readTabs() {
  try {
    return JSON.parse(localStorage.getItem(OPEN_TABS_KEY) || "{}") || {};
  } catch {
    return {};
  }
}

function liveTabs() {
  const now = Date.now();
  return Object.fromEntries(
    Object.entries(readTabs()).filter(
      ([, lastSeen]) => now - Number(lastSeen) < TAB_STALE_AFTER_MS
    )
  );
}

function writeTabs(tabs) {
  localStorage.setItem(OPEN_TABS_KEY, JSON.stringify(tabs));
}

function touchTab() {
  writeTabs({ ...liveTabs(), [TAB_ID]: Date.now() });
}

function closeTab() {
  const tabs = liveTabs();
  delete tabs[TAB_ID];
  writeTabs(tabs);

  if (Object.keys(tabs).length === 0) {
    markBrowserClosing();
  }
}

export function startBrowserSessionLifecycle() {
  touchTab();

  const heartbeat = window.setInterval(touchTab, TAB_HEARTBEAT_MS);
  window.addEventListener("pagehide", closeTab);
  window.addEventListener("pageshow", touchTab);

  return () => {
    window.clearInterval(heartbeat);
    window.removeEventListener("pagehide", closeTab);
    window.removeEventListener("pageshow", touchTab);
  };
}
