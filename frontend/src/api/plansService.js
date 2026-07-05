import axiosClient from "./axiosClient";

export async function listPlans() {
  const response = await axiosClient.get("/plans/");
  return response.data;
}

export async function createPlan(payload) {
  const response = await axiosClient.post("/plans/", payload);
  return response.data;
}

export async function updatePlan(id, payload) {
  const response = await axiosClient.patch(`/plans/${id}/`, payload);
  return response.data;
}

export async function deletePlan(id) {
  await axiosClient.delete(`/plans/${id}/`);
}