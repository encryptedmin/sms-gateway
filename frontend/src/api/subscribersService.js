import axiosClient from "./axiosClient";

export async function listSubscribers() {
  const response = await axiosClient.get("/subscribers/");
  return response.data;
}

export async function enrollSubscriber(payload) {
  const response = await axiosClient.post("/register/subscriber/", payload);
  return response.data;
}

export async function setSubscriberActive(id, active) {
  const response = await axiosClient.patch(`/subscribers/${id}/`, { active });
  return response.data;
}

export async function deleteSubscriber(id) {
  await axiosClient.delete(`/subscribers/${id}/`);
}