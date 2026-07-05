import axiosClient from "./axiosClient";

export async function listApiKeys() {
  const response = await axiosClient.get("/api-keys/");
  return response.data;
}

export async function createApiKey(subscriberId) {
  const response = await axiosClient.post("/api-keys/", {
    subscriber: subscriberId,
  });
  return response.data;
}

export async function setApiKeyEnabled(id, enabled) {
  const response = await axiosClient.patch(`/api-keys/${id}/`, { enabled });
  return response.data;
}