import axiosClient from "./axiosClient";

export async function getModemStatus() {
  const response = await axiosClient.get("/modem-status/");
  return response.data;
}

export async function checkModemStatus() {
  const response = await axiosClient.post("/modem-status/check/");
  return response.data;
}
