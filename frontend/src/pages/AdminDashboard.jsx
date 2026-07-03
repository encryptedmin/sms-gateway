import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

import StatsGrid from "../components/admin/StatsGrid";
import AdminLayout from "../layouts/AdminLayout";
import {
    endpoints,
    toList,
} from "../services/api";

const navCards = [
    {
        to: "/administrator/instructors",
        title: "Instructor Accounts",
        description:
            "Create ITE instructor accounts and toggle their access.",
    },
    {
        to: "/administrator/contacts",
        title: "Contacts",
        description:
            "Manage individual contacts, filter the roster, and import from CSV.",
    },
    {
        to: "/administrator/groups",
        title: "Contact Groups",
        description:
            "Group contacts together for easier message targeting.",
    },
    {
        to: "/administrator/templates",
        title: "Message Templates",
        description:
            "Save reusable message templates for common announcements.",
    },
    {
        to: "/administrator/messages",
        title: "Send Message",
        description:
            "Compose and dispatch SMS messages to contacts, year levels, sections, groups, or everyone.",
    },
];

function AdminDashboard() {
    const [counts, setCounts] = useState({
        instructors: 0,
        contacts: 0,
        groups: 0,
        templates: 0,
    });
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(true);

    const loadDashboard = async () => {
        setLoading(true);

        try {
            const [
                instructorResponse,
                contactResponse,
                groupResponse,
                templateResponse,
            ] = await Promise.all([
                endpoints.instructors.list(),
                endpoints.contacts.list(),
                endpoints.contactGroups.list(),
                endpoints.messageTemplates.list(),
            ]);

            setCounts({
                instructors: toList(instructorResponse.data).length,
                contacts: toList(contactResponse.data).length,
                groups: toList(groupResponse.data).length,
                templates: toList(templateResponse.data).length,
            });
        } catch (requestError) {
            console.error(requestError);
            setError("Unable to load the department dashboard.");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        loadDashboard();
    }, []);

    const stats = useMemo(
        () => [
            {
                label: "Instructors",
                value: counts.instructors,
            },
            {
                label: "Contacts",
                value: counts.contacts,
            },
            {
                label: "Class Groups",
                value: counts.groups,
            },
            {
                label: "Templates",
                value: counts.templates,
            },
        ],
        [counts.contacts, counts.groups, counts.instructors, counts.templates]
    );

    return (
        <AdminLayout>
            <div className="page-header dashboard-heading">
                <div>
                    <h1>ITE Department Dashboard</h1>

                    <p className="muted-text">
                        Manage instructors, class contacts, templates, and
                        outbound messages.
                    </p>
                </div>
            </div>

            {error && (
                <div className="form-error dashboard-alert">
                    {error}
                </div>
            )}

            <StatsGrid stats={stats} />

            <div className="department-grid">
                {navCards.map((card) => (
                    <Link
                        className="panel department-panel"
                        key={card.to}
                        to={card.to}
                    >
                        <h2>{card.title}</h2>

                        <p className="muted-text">{card.description}</p>
                    </Link>
                ))}
            </div>

            {loading && (
                <div className="loading-overlay">
                    Loading department workspace...
                </div>
            )}
        </AdminLayout>
    );
}

export default AdminDashboard;
