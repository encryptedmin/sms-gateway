import { useState } from "react";

import AdminLayout from "../layouts/AdminLayout";
import { endpoints } from "../services/api";

const emptyForm = {
    username: "",
    first_name: "",
    middle_name: "",
    last_name: "",
    extension_name: "",
    email: "",
    password: "",
};

function AdminAccounts() {
    const [formData, setFormData] = useState(emptyForm);
    const [message, setMessage] = useState("");
    const [error, setError] = useState("");

    const updateFormData = (field, value) => {
        setFormData((current) => ({
            ...current,
            [field]: value,
        }));
    };

    const handleSubmit = async (event) => {
        event.preventDefault();
        setMessage("");
        setError("");

        try {
            await endpoints.adminAccounts.create(formData);
            setFormData(emptyForm);
            setMessage("Admin account created.");
        } catch (requestError) {
            console.error(requestError);
            setError("Unable to create admin account.");
        }
    };

    return (
        <AdminLayout>
            <div className="page-header">
                <div>
                    <h1>Admin Accounts</h1>

                    <p className="muted-text">
                        Create an ITE department admin account.
                    </p>
                </div>
            </div>

            <div className="panel">
                {message && (
                    <div className="form-success">
                        {message}
                    </div>
                )}

                {error && (
                    <div className="form-error">
                        {error}
                    </div>
                )}

                <form onSubmit={handleSubmit}>
                    <div className="form-field">
                        <label htmlFor="admin-username">
                            Username
                        </label>

                        <input
                            className="form-input with-label"
                            id="admin-username"
                            onChange={(event) =>
                                updateFormData(
                                    "username",
                                    event.target.value
                                )
                            }
                            required
                            type="text"
                            value={formData.username}
                        />
                    </div>

                    <div className="form-field">
                        <label htmlFor="admin-first-name">
                            First Name
                        </label>

                        <input
                            className="form-input with-label"
                            id="admin-first-name"
                            onChange={(event) =>
                                updateFormData(
                                    "first_name",
                                    event.target.value
                                )
                            }
                            required
                            type="text"
                            value={formData.first_name}
                        />
                    </div>

                    <div className="form-field">
                        <label htmlFor="admin-middle-name">
                            Middle Name
                        </label>

                        <input
                            className="form-input with-label"
                            id="admin-middle-name"
                            onChange={(event) =>
                                updateFormData(
                                    "middle_name",
                                    event.target.value
                                )
                            }
                            type="text"
                            value={formData.middle_name}
                        />
                    </div>

                    <div className="form-field">
                        <label htmlFor="admin-last-name">
                            Last Name
                        </label>

                        <input
                            className="form-input with-label"
                            id="admin-last-name"
                            onChange={(event) =>
                                updateFormData(
                                    "last_name",
                                    event.target.value
                                )
                            }
                            required
                            type="text"
                            value={formData.last_name}
                        />
                    </div>

                    <div className="form-field">
                        <label htmlFor="admin-extension-name">
                            Extension Name
                        </label>

                        <input
                            className="form-input with-label"
                            id="admin-extension-name"
                            onChange={(event) =>
                                updateFormData(
                                    "extension_name",
                                    event.target.value
                                )
                            }
                            type="text"
                            value={formData.extension_name}
                        />
                    </div>

                    <div className="form-field">
                        <label htmlFor="admin-email">
                            Email
                        </label>

                        <input
                            className="form-input with-label"
                            id="admin-email"
                            onChange={(event) =>
                                updateFormData(
                                    "email",
                                    event.target.value
                                )
                            }
                            required
                            type="email"
                            value={formData.email}
                        />
                    </div>

                    <div className="form-field">
                        <label htmlFor="admin-password">
                            Password
                        </label>

                        <input
                            className="form-input with-label"
                            id="admin-password"
                            onChange={(event) =>
                                updateFormData(
                                    "password",
                                    event.target.value
                                )
                            }
                            required
                            type="password"
                            value={formData.password}
                        />
                    </div>

                    <button
                        className="primary-button"
                        type="submit"
                    >
                        Create Admin Account
                    </button>
                </form>
            </div>
        </AdminLayout>
    );
}

export default AdminAccounts;
