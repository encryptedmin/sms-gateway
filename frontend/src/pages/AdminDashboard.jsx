import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import AdminLayout from "../layouts/AdminLayout";
import {
    endpoints,
    toList,
} from "../services/api";

function AdminDashboard() {
    const navigate = useNavigate();
    const [subscribers, setSubscribers] = useState([]);
    const [plans, setPlans] = useState([]);
    const [apiKeys, setApiKeys] = useState([]);

    useEffect(() => {
        const loadDashboardData = async () => {
            try {
                const [
                    subscribersResponse,
                    plansResponse,
                    apiKeysResponse,
                ] = await Promise.all([
                    endpoints.subscribers.list(),
                    endpoints.plans.list(),
                    endpoints.apiKeys.list(),
                ]);

                setSubscribers(
                    toList(subscribersResponse.data)
                );
                setPlans(toList(plansResponse.data));
                setApiKeys(toList(apiKeysResponse.data));
            } catch (error) {
                console.error(error);
            }
        };

        loadDashboardData();
    }, []);

    const cards = useMemo(
        () => [
            {
                title: "Total Subscribers",
                value: subscribers.length,
                path: "/administrator/subscribers",
            },
            {
                title: "Active Subscribers",
                value: subscribers.filter(
                    (subscriber) => subscriber.active
                ).length,
                path: "/administrator/subscribers",
            },
            {
                title: "Total Plans",
                value: plans.length,
                path: "/administrator/plans",
            },
            {
                title: "Active API Keys",
                value: apiKeys.filter((key) => key.enabled)
                    .length,
                path: "/administrator/api-keys",
            },
        ],
        [apiKeys, plans, subscribers]
    );

    return (
        <AdminLayout>
            <div>
                <h1 className="page-title-block">
                    Dashboard
                </h1>

                <p className="muted-text">
                    SMS Gateway Administration Overview
                </p>
            </div>

            <div className="stats-grid">
                {cards.map((card) => (
                    <button
                        className="stat-card"
                        key={card.title}
                        onClick={() => navigate(card.path)}
                        type="button"
                    >
                        <div className="stat-label">
                            {card.title}
                        </div>

                        <div className="stat-value">
                            {card.value}
                        </div>
                    </button>
                ))}
            </div>

            <div className="panel">
                <h2>Quick Actions</h2>

                <div className="quick-actions">
                    <button
                        className="primary-button"
                        onClick={() =>
                            navigate(
                                "/administrator/subscribers"
                            )
                        }
                        type="button"
                    >
                        Manage Subscribers
                    </button>

                    <button
                        className="primary-button"
                        onClick={() =>
                            navigate("/administrator/plans")
                        }
                        type="button"
                    >
                        Manage Plans
                    </button>

                    <button
                        className="primary-button"
                        onClick={() =>
                            navigate(
                                "/administrator/api-keys"
                            )
                        }
                        type="button"
                    >
                        Manage API Keys
                    </button>
                </div>
            </div>
        </AdminLayout>
    );
}

export default AdminDashboard;
