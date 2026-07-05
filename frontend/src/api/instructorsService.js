import axiosClient from "./axiosClient";

export async function listInstructors() {
  const response = await axiosClient.get("/instructors/");
  return response.data;
}

export async function createInstructor(payload) {
  const response = await axiosClient.post("/instructors/", payload);
  return response.data;
}

export async function updateInstructor(id, payload) {
  const response = await axiosClient.patch(`/instructors/${id}/`, payload);
  return response.data;
}

export async function deleteInstructor(id) {
  await axiosClient.delete(`/instructors/${id}/`);
}