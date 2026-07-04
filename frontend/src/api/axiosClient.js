import axios from "axios";
import {
  getAccessToken,
  getRefreshToken,
  updateAccessToken,
  clearTokens,
} from "./tokenStorage";

const baseURL = import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8000/api";

const axiosClient = axios.create({
  baseURL,
  headers: {
    "Content-Type": "application/json",
  },
});

axiosClient.interceptors.request.use((config) => {
  const token = getAccessToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

let refreshInFlight = null;

async function refreshAccessToken() {
  const refresh = getRefreshToken();
  if (!refresh) {
    throw new Error("No refresh token available");
  }

  const response = await axios.post(`${baseURL}/token/refresh/`, { refresh });
  const { access } = response.data;
  updateAccessToken(access);
  return access;
}

axiosClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    const status = error.response ? error.response.status : null;
    const isAuthEndpoint =
      originalRequest?.url?.includes("/token/") ?? false;

    if (status === 401 && !originalRequest._retry && !isAuthEndpoint) {
      originalRequest._retry = true;

      try {
        refreshInFlight = refreshInFlight || refreshAccessToken();
        const access = await refreshInFlight;
        refreshInFlight = null;

        originalRequest.headers.Authorization = `Bearer ${access}`;
        return axiosClient(originalRequest);
      } catch (refreshError) {
        refreshInFlight = null;
        clearTokens();
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);

export default axiosClient;