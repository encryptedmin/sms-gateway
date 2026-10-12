import axios from "axios";
import axiosClient from "./axiosClient";
import { saveTokens, clearTokens, getAccessToken, getRefreshToken } from "./tokenStorage";

function extractErrorMessage(error) {
  const data = error?.response?.data;

  if (!data) {
    return "Unable to reach the server. Check your connection and try again.";
  }

  if (typeof data.detail === "string") {
    return data.detail;
  }

  // Simple JWT often returns { detail: "..." } but validation errors can
  // arrive as { field: ["message"] }; flatten the first one we find.
  const firstKey = Object.keys(data)[0];
  if (firstKey && Array.isArray(data[firstKey])) {
    return data[firstKey][0];
  }

  return "Invalid email or password.";
}

export async function login(email, password) {
  try {
    const tokenResponse = await axiosClient.post("/token/", {
      email,
      password,
    });

    saveTokens(tokenResponse.data);

    const user = await getCurrentUser();
    return user;
  } catch (error) {
    clearTokens();
    throw new Error(extractErrorMessage(error));
  }
}

export async function getCurrentUser() {
  const response = await axiosClient.get("/me/");
  return response.data;
}

export async function changeOwnPassword(payload) {
  const response = await axiosClient.post("/change-password/", payload);
  return response.data;
}

export async function getDeviceSession() {
  const response = await axiosClient.get("/device-session/");
  return response.data;
}

export async function resumeDeviceSession() {
  await axiosClient.post("/device-session/resume/");
}

export function markBrowserClosing() {
  const baseURL = String(axiosClient.defaults.baseURL || "/api").replace(/\/$/, "");
  const endpoint = `${baseURL}/device-session/closing/`;

  if (navigator.sendBeacon) {
    return navigator.sendBeacon(
      endpoint,
      new Blob([], { type: "application/json" })
    );
  }

  void fetch(endpoint, {
    method: "POST",
    credentials: "include",
    keepalive: true,
  });
  return true;
}

export function discardLocalSession() {
  clearTokens();
}

export async function logout() {
  const refresh = getRefreshToken();
  clearTokens();

  try {
    await axios.post(
      `${axiosClient.defaults.baseURL}/logout/`,
      refresh ? { refresh } : {},
      { withCredentials: true }
    );
  } catch {
    // Local credentials are already gone. Logout stays safe and idempotent
    // even when the API is temporarily unreachable.
  }
}

export function hasStoredSession() {
  return Boolean(getAccessToken());
}
