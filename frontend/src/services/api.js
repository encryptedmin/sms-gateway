import axios from "axios";

const api = axios.create({
    baseURL:
        import.meta.env.VITE_API_BASE_URL ||
        "http://127.0.0.1:8000",
});

api.interceptors.request.use((config) => {
    const token = localStorage.getItem("access_token");

    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }

    return config;
});

export const toList = (data) => {
    if (Array.isArray(data)) {
        return data;
    }

    return data?.results || [];
};

export const endpoints = {
    auth: {
        login: (credentials) =>
            api.post("/api/token/", credentials),
        currentUser: () =>
            api.get("/api/me/"),
        registerSubscriber: (payload) =>
            api.post("/api/register/subscriber/", payload),
    },
    adminAccounts: {
        create: (payload) =>
            api.post("/api/admin-accounts/", payload),
    },
    dashboard: {
        stats: () =>
            api.get("/api/dashboard/stats/"),
    },
    plans: {
        list: () =>
            api.get("/api/plans/"),
        create: (payload) =>
            api.post("/api/plans/", payload),
        update: (id, payload) =>
            api.put(`/api/plans/${id}/`, payload),
        remove: (id) =>
            api.delete(`/api/plans/${id}/`),
    },
    subscribers: {
        list: () =>
            api.get("/api/subscribers/"),
        update: (id, payload) =>
            api.patch(`/api/subscribers/${id}/`, payload),
        remove: (id) =>
            api.delete(`/api/subscribers/${id}/`),
    },
    apiKeys: {
        list: () =>
            api.get("/api/api-keys/"),
        create: (payload) =>
            api.post("/api/api-keys/", payload),
        update: (id, payload) =>
            api.patch(`/api/api-keys/${id}/`, payload),
    },
    smsLogs: {
        list: (params) =>
            api.get("/api/logs/", { params }),
    },
};

export default api;
