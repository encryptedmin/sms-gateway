import { useEffect, useMemo, useState } from "react";

import SendMessagePanel from "../components/admin/SendMessagePanel";
import AdminLayout from "../layouts/AdminLayout";
import {
    endpoints,
    toList,
} from "../services/api";

const emptySendForm = {
    target_type: "contact",
    contact: "",
    year_level: "",
    section: "",
    group: "",
    template: "",
    body: "",
};

function MessagesPage() {
    const [contacts, setContacts] = useState([]);
    const [groups, setGroups] = useState([]);
    const [templates, setTemplates] = useState([]);
    const [sendForm, setSendForm] = useState(emptySendForm);
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

    const loadMessageData = async () => {
        setLoading(true);

        try {
            const [contactResponse, groupResponse, templateResponse] =
                await Promise.all([
                    endpoints.contacts.list(),
                    endpoints.contactGroups.list(),
                    endpoints.messageTemplates.list(),
                ]);

            setContacts(toList(contactResponse.data));
            setGroups(toList(groupResponse.data));
            setTemplates(toList(templateResponse.data));
        } catch (requestError) {
            console.error(requestError);
            showError("Unable to load messaging data.");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        loadMessageData();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const yearLevels = useMemo(() => {
        const values = new Set();

        contacts.forEach((contact) => {
            if (contact.year_level) {
                values.add(contact.year_level);
            }
        });

        return Array.from(values).sort();
    }, [contacts]);

    const updateSendForm = (field, value) => {
        setSendForm((current) => ({
            ...current,
            [field]: value,
        }));
    };

    const applyTemplate = (templateId) => {
        const template = templates.find(
            (item) => item.id === Number(templateId),
        );

        if (!template) {
            return;
        }

        setSendForm((current) => ({
            ...current,
            template: template.id,
            body: template.body,
        }));
    };

    const sendMessage = async (event) => {
        event.preventDefault();

        try {
            await endpoints.departmentMessages.send(sendForm);
            setSendForm(emptySendForm);
            showMessage("Message queued for delivery.");
        } catch (requestError) {
            console.error(requestError);
            showError("Unable to send message.");
        }
    };

    return (
        <AdminLayout>
            <div className="page-header dashboard-heading">
                <div>
                    <h1>Send Message</h1>

                    <p className="muted-text">
                        Compose and dispatch SMS messages to contacts,
                        year levels, sections, groups, or everyone.
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

            <SendMessagePanel
                contacts={contacts}
                groups={groups}
                sendForm={sendForm}
                templates={templates}
                yearLevels={yearLevels}
                onApplyTemplate={applyTemplate}
                onSendMessage={sendMessage}
                onUpdateSendForm={updateSendForm}
            />

            {loading && (
                <div className="loading-overlay">
                    Loading messaging data...
                </div>
            )}
        </AdminLayout>
    );
}

export default MessagesPage;
