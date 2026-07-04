import axiosClient from "./axiosClient";
import { saveTokens, clearTokens, getAccessToken } from "./tokenStorage";

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

  return "Invalid username or password.";
}

export async function login(username, password, rememberMe) {
  try {
    const tokenResponse = await axiosClient.post("/token/", {
      username,
      password,
    });

    saveTokens(tokenResponse.data, rememberMe);

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

export function logout() {
  clearTokens();
}

export function hasStoredSession() {
  return Boolean(getAccessToken());
}