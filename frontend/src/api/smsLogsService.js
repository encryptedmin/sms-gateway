import axiosClient from "./axiosClient";

export async function getDashboardStats() {
  const response = await axiosClient.get("/dashboard/stats/");
  return response.data;
}

export async function listSmsLogs(params = {}) {
  const response = await axiosClient.get("/logs/", { params });
  return response.data;
}

export async function retrySmsLog(id) {
  const response = await axiosClient.post(`/logs/${id}/retry/`);
  return response.data;
}