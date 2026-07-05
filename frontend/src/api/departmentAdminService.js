import axiosClient from "./axiosClient";

export async function createDepartmentAdmin(payload) {
  const response = await axiosClient.post("/admin-accounts/", payload);
  return response.data;
}