import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";

import AdminLayout from "../layouts/AdminLayout";
import {
    endpoints,
    toList,
} from "../services/api";
import { formatDate } from "../utils/format";

function ApiKeys() {
    const [searchParams] = useSearchParams();
    const subscriberFilter =
        searchParams.get("subscriber");
    const [apiKeys, setApiKeys] = useState([]);

    const loadApiKeys = async () => {
        try {
            const response = await endpoints.apiKeys.list();
            setApiKeys(toList(response.data));
        } catch (error) {
            console.error(error);
        }
    };

    useEffect(() => {
        let active = true;

        endpoints.apiKeys
            .list()
            .then((response) => {
                if (active) {
                    setApiKeys(toList(response.data));
                }
            })
            .catch((error) => {
                console.error(error);
            });

        return () => {
            active = false;
        };
    }, []);

    const visibleApiKeys = useMemo(() => {
        if (!subscriberFilter) {
            return apiKeys;
        }

        return apiKeys.filter(
            (key) =>
                String(key.subscriber) ===
                String(subscriberFilter)
        );
    }, [apiKeys, subscriberFilter]);

    const toggleApiKey = async (key) => {
        try {
            await endpoints.apiKeys.update(key.id, {
                enabled: !key.enabled,
            });

            loadApiKeys();
        } catch (error) {
            console.error(error);
        }
    };

    return (
        <AdminLayout>
            <div className="page-header">
                <div>
                    <h1>API Keys</h1>

                    <p className="muted-text">
                        Activate or deactivate subscriber API
                        access.
                    </p>
                </div>
            </div>

            <div className="panel no-margin">
                <table className="data-table">
                    <thead>
                        <tr>
                            <th>Subscriber</th>
                            <th>API Key</th>
                            <th>Status</th>
                            <th>Created</th>
                            <th>Actions</th>
                        </tr>
                    </thead>

                    <tbody>
                        {visibleApiKeys.map((key) => (
                            <tr key={key.id}>
                                <td>{key.subscriber_name}</td>

                                <td className="mono-cell">
                                    {key.api_key}
                                </td>

                                <td>
                                    <span
                                        className={
                                            key.enabled
                                                ? "status-pill active"
                                                : "status-pill disabled"
                                        }
                                    >
                                        {key.enabled
                                            ? "ACTIVE"
                                            : "DISABLED"}
                                    </span>
                                </td>

                                <td>
                                    {formatDate(key.created_at)}
                                </td>

                                <td>
                                    <button
                                        className={
                                            key.enabled
                                                ? "danger-button small-button"
                                                : "success-button small-button"
                                        }
                                        onClick={() =>
                                            toggleApiKey(key)
                                        }
                                        type="button"
                                    >
                                        {key.enabled
                                            ? "Deactivate"
                                            : "Activate"}
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </AdminLayout>
    );
}

export default ApiKeys;
