import axiosClient from "./axiosClient";

export async function sendDepartmentSms(payload) {
  const response = await axiosClient.post("/department/send-sms/", payload);
  return response.data;
}