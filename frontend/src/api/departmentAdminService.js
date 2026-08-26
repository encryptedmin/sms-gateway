import axiosClient from "./axiosClient";

export async function listDepartmentAdmins() {
  const response = await axiosClient.get("/admin-accounts/");
  return response.data;
}

export async function createDepartmentAdmin(payload) {
  const response = await axiosClient.post("/admin-accounts/", payload);
  return response.data;
}

export async function updateDepartmentAdmin(id, payload) {
  const response = await axiosClient.patch(`/admin-accounts/${id}/`, payload);
  return response.data;
}

export async function deleteDepartmentAdmin(id) {
  await axiosClient.delete(`/admin-accounts/${id}/`);
}
