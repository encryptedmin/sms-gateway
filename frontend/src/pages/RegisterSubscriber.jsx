import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import AuthShell from "../components/AuthShell";
import { endpoints } from "../services/api";
import { formatApiError } from "../utils/format";

const emptyForm = {
    username: "",
    first_name: "",
    middle_name: "",
    last_name: "",
    extension_name: "",
    email: "",
    password: "",
    confirm_password: "",
};

function RegisterSubscriber() {
    const navigate = useNavigate();
    const [formData, setFormData] = useState(emptyForm);
    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");
    const [submitting, setSubmitting] = useState(false);

    const updateFormData = (field, value) => {
        setFormData((current) => ({
            ...current,
            [field]: value,
        }));
    };

    const handleSubmit = async (event) => {
        event.preventDefault();
        setError("");
        setSuccess("");

        if (formData.password !== formData.confirm_password) {
            setError("Passwords do not match.");
            return;
        }

        setSubmitting(true);

        try {
            const { confirm_password, ...payload } = formData;

            await endpoints.auth.registerSubscriber(payload);

            setSuccess(
                "Your subscriber account was created successfully. Redirecting you to sign in..."
            );
            setFormData(emptyForm);

            window.setTimeout(() => {
                navigate("/");
            }, 2500);
        } catch (requestError) {
            setError(
                formatApiError(
                    requestError,
                    "Unable to complete registration."
                )
            );
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <AuthShell
            brandSubtitle="Subscriber registration portal"
            formSubtitle="Create an account to access SMS gateway services."
            formTitle="Register as Subscriber"
            wide
        >
            {error && (
                <div className="form-error" role="alert">
                    {error}
                </div>
            )}

            {success && (
                <div className="form-success" role="status">
                    {success}
                </div>
            )}

            <form
                className="auth-form"
                onSubmit={handleSubmit}
            >
                <div className="form-field">
                    <label htmlFor="register-username">
                        Username
                    </label>

                    <input
                        autoComplete="username"
                        className="form-input with-label"
                        id="register-username"
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

                <div className="form-row">
                    <div className="form-field">
                        <label htmlFor="register-first-name">
                            First name
                        </label>

                        <input
                            autoComplete="given-name"
                            className="form-input with-label"
                            id="register-first-name"
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
                        <label htmlFor="register-middle-name">
                            Middle name
                        </label>

                        <input
                            autoComplete="additional-name"
                            className="form-input with-label"
                            id="register-middle-name"
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
                </div>

                <div className="form-row">
                    <div className="form-field">
                        <label htmlFor="register-last-name">
                            Last name
                        </label>

                        <input
                            autoComplete="family-name"
                            className="form-input with-label"
                            id="register-last-name"
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
                        <label htmlFor="register-extension-name">
                            Extension
                        </label>

                        <input
                            className="form-input with-label"
                            id="register-extension-name"
                            onChange={(event) =>
                                updateFormData(
                                    "extension_name",
                                    event.target.value
                                )
                            }
                            placeholder="Jr., Sr., III"
                            type="text"
                            value={formData.extension_name}
                        />
                    </div>
                </div>

                <div className="form-field">
                    <label htmlFor="register-email">
                        Email
                    </label>

                    <input
                        autoComplete="email"
                        className="form-input with-label"
                        id="register-email"
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

                <div className="form-row">
                    <div className="form-field">
                        <label htmlFor="register-password">
                            Password
                        </label>

                        <input
                            autoComplete="new-password"
                            className="form-input with-label"
                            id="register-password"
                            minLength={8}
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

                    <div className="form-field">
                        <label htmlFor="register-confirm-password">
                            Confirm password
                        </label>

                        <input
                            autoComplete="new-password"
                            className="form-input with-label"
                            id="register-confirm-password"
                            minLength={8}
                            onChange={(event) =>
                                updateFormData(
                                    "confirm_password",
                                    event.target.value
                                )
                            }
                            required
                            type="password"
                            value={formData.confirm_password}
                        />
                    </div>
                </div>

                <button
                    className="auth-submit"
                    disabled={submitting}
                    type="submit"
                >
                    {submitting
                        ? "Creating account..."
                        : "Create subscriber account"}
                </button>
            </form>

            <div className="auth-footer">
                <Link
                    className="auth-link-button auth-link-button-muted"
                    to="/"
                >
                    Back to sign in
                </Link>
            </div>
        </AuthShell>
    );
}

export default RegisterSubscriber;
