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

export async function bulkRetrySmsLogs(ids) {
  const response = await axiosClient.post("/logs/bulk-retry/", { ids });
  return response.data;
}

export async function bulkDeleteSmsLogs(ids) {
  const response = await axiosClient.post("/logs/bulk-delete/", { ids });
  return response.data;
}

export async function cancelSmsLog(id) {
  const response = await axiosClient.post(`/logs/${id}/cancel/`);
  return response.data;
}

export async function rescheduleSmsLog(id, scheduledFor) {
  const response = await axiosClient.post(`/logs/${id}/reschedule/`, {
    scheduled_for: scheduledFor,
  });
  return response.data;
}

export async function sendSmsLogNow(id) {
  const response = await axiosClient.post(`/logs/${id}/send-now/`);
  return response.data;
}

// Pass either { ids: [...] } or { batchId }. Rows that are no longer SCHEDULED
// are skipped by the server rather than treated as errors.
export async function bulkCancelSmsLogs({ ids, batchId } = {}) {
  const payload = batchId ? { batch_id: batchId } : { ids };
  const response = await axiosClient.post("/logs/bulk-cancel/", payload);
  return response.data;
}
