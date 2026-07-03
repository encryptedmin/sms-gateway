import { useEffect, useState } from "react";

import ContactGroupPanel from "../components/admin/ContactGroupPanel";
import AdminLayout from "../layouts/AdminLayout";
import {
    endpoints,
    toList,
} from "../services/api";

const emptyGroup = {
    name: "",
    description: "",
};

function GroupsPage() {
    const [groups, setGroups] = useState([]);
    const [groupForm, setGroupForm] = useState(emptyGroup);
    const [notice, setNotice] = useState("");
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(true);

    const showMessage = (message) => {
        setNotice(message);
        setError("");
    };

    const showError = (message) => {
        setNotice("");
        setError(message);
    };

    const loadGroups = async () => {
        setLoading(true);

        try {
            const response = await endpoints.contactGroups.list();
            setGroups(toList(response.data));
        } catch (requestError) {
            console.error(requestError);
            showError("Unable to load contact groups.");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        loadGroups();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const updateGroupForm = (field, value) => {
        setGroupForm((current) => ({
            ...current,
            [field]: value,
        }));
    };

    const createGroup = async (event) => {
        event.preventDefault();

        try {
            await endpoints.contactGroups.create(groupForm);
            setGroupForm(emptyGroup);
            showMessage("Contact group created.");
            loadGroups();
        } catch (requestError) {
            console.error(requestError);
            showError("Unable to create contact group.");
        }
    };

    return (
        <AdminLayout>
            <div className="page-header dashboard-heading">
                <div>
                    <h1>Contact Groups</h1>

                    <p className="muted-text">
                        Group contacts together for easier message
                        targeting.
                    </p>
                </div>
            </div>

            {notice && (
                <div className="form-success dashboard-alert">
                    {notice}
                </div>
            )}

            {error && (
                <div className="form-error dashboard-alert">
                    {error}
                </div>
            )}

            <ContactGroupPanel
                groupForm={groupForm}
                groups={groups}
                onCreateGroup={createGroup}
                onUpdateGroupForm={updateGroupForm}
            />

            {loading && (
                <div className="loading-overlay">
                    Loading contact groups...
                </div>
            )}
        </AdminLayout>
    );
}

export default GroupsPage;
