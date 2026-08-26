import axiosClient from "./axiosClient";

export async function listSubscriptions() {
  const response = await axiosClient.get("/subscriptions/");
  return response.data;
}

export async function enrollSubscription(subscriberId, planId) {
  const response = await axiosClient.post("/subscriptions/", {
    subscriber: subscriberId,
    plan: planId,
    status: "ACTIVE",
  });
  return response.data;
}

export async function changeSubscriptionPlan(subscriptionId, planId) {
  const response = await axiosClient.patch(`/subscriptions/${subscriptionId}/`, {
    plan: planId,
  });
  return response.data;
}

export async function unsubscribe(subscriptionId) {
  const response = await axiosClient.post(`/subscriptions/${subscriptionId}/unsubscribe/`);
  return response.data;
}