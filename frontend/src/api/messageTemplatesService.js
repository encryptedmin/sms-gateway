import axiosClient from "./axiosClient";

export async function listMessageTemplates() {
  const response = await axiosClient.get("/message-templates/");
  return response.data;
}

export async function createMessageTemplate(payload) {
  const response = await axiosClient.post("/message-templates/", payload);
  return response.data;
}

export async function updateMessageTemplate(id, payload) {
  const response = await axiosClient.patch(`/message-templates/${id}/`, payload);
  return response.data;
}

export async function deleteMessageTemplate(id) {
  await axiosClient.delete(`/message-templates/${id}/`);
}