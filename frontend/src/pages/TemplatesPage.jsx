import { useEffect, useState } from "react";

import MessageTemplatesPanel from "../components/admin/MessageTemplatesPanel";
import AdminLayout from "../layouts/AdminLayout";
import {
    endpoints,
    toList,
} from "../services/api";

const emptyTemplate = {
    name: "",
    body: "",
};

function TemplatesPage() {
    const [templates, setTemplates] = useState([]);
    const [templateForm, setTemplateForm] = useState(emptyTemplate);
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

    const loadTemplates = async () => {
        setLoading(true);

        try {
            const response = await endpoints.messageTemplates.list();
            setTemplates(toList(response.data));
        } catch (requestError) {
            console.error(requestError);
            showError("Unable to load message templates.");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        loadTemplates();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const updateTemplateForm = (field, value) => {
        setTemplateForm((current) => ({
            ...current,
            [field]: value,
        }));
    };

    const createTemplate = async (event) => {
        event.preventDefault();

        try {
            await endpoints.messageTemplates.create(templateForm);
            setTemplateForm(emptyTemplate);
            showMessage("Message template saved.");
            loadTemplates();
        } catch (requestError) {
            console.error(requestError);
            showError("Unable to save message template.");
        }
    };

    const deleteTemplate = async (template) => {
        try {
            await endpoints.messageTemplates.remove(template.id);
            showMessage("Message template deleted.");
            loadTemplates();
        } catch (requestError) {
            console.error(requestError);
            showError("Unable to delete message template.");
        }
    };

    return (
        <AdminLayout>
            <div className="page-header dashboard-heading">
                <div>
                    <h1>Message Templates</h1>

                    <p className="muted-text">
                        Save reusable message templates for common
                        announcements.
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

            <MessageTemplatesPanel
                templateForm={templateForm}
                templates={templates}
                onCreateTemplate={createTemplate}
                onDeleteTemplate={deleteTemplate}
                onUpdateTemplateForm={updateTemplateForm}
            />

            {loading && (
                <div className="loading-overlay">
                    Loading message templates...
                </div>
            )}
        </AdminLayout>
    );
}

export default TemplatesPage;
