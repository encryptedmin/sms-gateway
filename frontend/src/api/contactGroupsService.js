import axiosClient from "./axiosClient";

export async function listContactGroups() {
  const response = await axiosClient.get("/contact-groups/");
  return response.data;
}

export async function createContactGroup(payload) {
  const response = await axiosClient.post("/contact-groups/", payload);
  return response.data;
}

export async function updateContactGroup(id, payload) {
  const response = await axiosClient.patch(`/contact-groups/${id}/`, payload);
  return response.data;
}

export async function deleteContactGroup(id) {
  await axiosClient.delete(`/contact-groups/${id}/`);
}