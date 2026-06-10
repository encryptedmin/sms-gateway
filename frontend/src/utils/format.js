export const formatRole = (role) =>
    role
        ? role.replaceAll("_", " ")
        : "";

export const formatUserName = (user) => {
    if (!user) {
        return "Administrator";
    }

    const name = [
        user.first_name,
        user.last_name,
    ]
        .filter(Boolean)
        .join(" ");

    return name || user.username || "Administrator";
};

export const formatDate = (value) => {
    if (!value) {
        return "";
    }

    return new Date(value).toLocaleDateString();
};

export const formatApiError = (
    error,
    fallback = "Something went wrong."
) => {
    const data = error?.response?.data;

    if (!data) {
        return fallback;
    }

    if (typeof data === "string") {
        return data;
    }

    if (data.detail) {
        return data.detail;
    }

    return Object.entries(data)
        .map(([key, value]) => {
            const label = key.replaceAll("_", " ");
            const message = Array.isArray(value)
                ? value.join(" ")
                : value;

            return `${label}: ${message}`;
        })
        .join(" ");
};
