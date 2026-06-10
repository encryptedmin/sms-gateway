import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import AdminLayout from "../layouts/AdminLayout";
import {
    endpoints,
    toList,
} from "../services/api";

function Subscribers() {
    const navigate = useNavigate();
    const [subscribers, setSubscribers] = useState([]);

    const loadSubscribers = async () => {
        try {
            const response =
                await endpoints.subscribers.list();

            setSubscribers(toList(response.data));
        } catch (error) {
            console.error(error);
        }
    };

    useEffect(() => {
        let active = true;

        endpoints.subscribers
            .list()
            .then((response) => {
                if (active) {
                    setSubscribers(toList(response.data));
                }
            })
            .catch((error) => {
                console.error(error);
            });

        return () => {
            active = false;
        };
    }, []);

    const deleteSubscriber = async (id) => {
        const confirmed = window.confirm(
            "Delete this subscriber?"
        );

        if (!confirmed) {
            return;
        }

        try {
            await endpoints.subscribers.remove(id);
            loadSubscribers();
        } catch (error) {
            console.error(error);
        }
    };

    const manageApiKey = (subscriber) => {
        navigate(
            `/administrator/api-keys?subscriber=${subscriber.id}`
        );
    };

    return (
        <AdminLayout>
            <div className="page-header">
                <div>
                    <h1>Subscribers</h1>

                    <p className="muted-text">
                        Manage subscriber accounts.
                    </p>
                </div>
            </div>

            <div className="panel no-margin">
                <table className="data-table">
                    <thead>
                        <tr>
                            <th>Username</th>
                            <th>First Name</th>
                            <th>Last Name</th>
                            <th>Email</th>
                            <th>Role</th>
                            <th>Status</th>
                            <th>Start Date</th>
                            <th>Actions</th>
                        </tr>
                    </thead>

                    <tbody>
                        {subscribers.map((subscriber) => (
                            <tr key={subscriber.id}>
                                <td>
                                    {subscriber.user?.username}
                                </td>
                                <td>
                                    {subscriber.user?.first_name}
                                </td>
                                <td>
                                    {subscriber.user?.last_name}
                                </td>
                                <td>
                                    {subscriber.user?.email}
                                </td>
                                <td>
                                    {subscriber.user?.role}
                                </td>
                                <td>
                                    {subscriber.active
                                        ? "Active"
                                        : "Inactive"}
                                </td>
                                <td>
                                    {subscriber.start_date}
                                </td>
                                <td>
                                    <button
                                        className="primary-button small-button button-gap-right"
                                        onClick={() =>
                                            manageApiKey(
                                                subscriber
                                            )
                                        }
                                        type="button"
                                    >
                                        Manage API Key
                                    </button>

                                    <button
                                        className="danger-button small-button"
                                        onClick={() =>
                                            deleteSubscriber(
                                                subscriber.id
                                            )
                                        }
                                        type="button"
                                    >
                                        Delete
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

export default Subscribers;
