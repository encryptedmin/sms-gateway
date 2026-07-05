import axiosClient from "./axiosClient";

export async function listContacts(params = {}) {
  const response = await axiosClient.get("/contacts/", { params });
  return response.data;
}

export async function createContact(payload) {
  const response = await axiosClient.post("/contacts/", payload);
  return response.data;
}

export async function updateContact(id, payload) {
  const response = await axiosClient.patch(`/contacts/${id}/`, payload);
  return response.data;
}

export async function deleteContact(id) {
  await axiosClient.delete(`/contacts/${id}/`);
}

export async function importContactsCsv(file, groupId) {
  const formData = new FormData();
  formData.append("file", file);
  if (groupId) {
    formData.append("group_id", groupId);
  }

  const response = await axiosClient.post("/contacts/import-csv/", formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return response.data;
}