import { useEffect, useState } from "react";

import InstructorPanel from "../components/admin/InstructorPanel";
import AdminLayout from "../layouts/AdminLayout";
import {
    endpoints,
    toList,
} from "../services/api";

const emptyInstructor = {
    username: "",
    first_name: "",
    middle_name: "",
    last_name: "",
    extension_name: "",
    email: "",
    password: "",
};

function InstructorsPage() {
    const [instructors, setInstructors] = useState([]);
    const [instructorForm, setInstructorForm] =
        useState(emptyInstructor);
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

    const loadInstructors = async () => {
        setLoading(true);

        try {
            const response = await endpoints.instructors.list();
            setInstructors(toList(response.data));
        } catch (requestError) {
            console.error(requestError);
            showError("Unable to load instructor accounts.");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        loadInstructors();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const updateInstructorForm = (field, value) => {
        setInstructorForm((current) => ({
            ...current,
            [field]: value,
        }));
    };

    const createInstructor = async (event) => {
        event.preventDefault();

        try {
            await endpoints.instructors.create(instructorForm);
            setInstructorForm(emptyInstructor);
            showMessage("ITE instructor account created.");
            loadInstructors();
        } catch (requestError) {
            console.error(requestError);
            showError("Unable to create instructor account.");
        }
    };

    const toggleInstructor = async (instructor) => {
        try {
            await endpoints.instructors.update(instructor.id, {
                is_active: !instructor.is_active,
            });
            loadInstructors();
        } catch (requestError) {
            console.error(requestError);
            showError("Unable to update instructor account.");
        }
    };

    return (
        <AdminLayout>
            <div className="page-header dashboard-heading">
                <div>
                    <h1>Instructor Accounts</h1>

                    <p className="muted-text">
                        Create ITE instructor accounts and toggle their
                        access.
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

            <InstructorPanel
                instructorForm={instructorForm}
                instructors={instructors}
                onCreateInstructor={createInstructor}
                onToggleInstructor={toggleInstructor}
                onUpdateInstructorForm={updateInstructorForm}
            />

            {loading && (
                <div className="loading-overlay">
                    Loading instructor accounts...
                </div>
            )}
        </AdminLayout>
    );
}

export default InstructorsPage;
