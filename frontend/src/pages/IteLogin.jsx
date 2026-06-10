import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import AuthShell from "../components/AuthShell";
import { endpoints } from "../services/api";

function IteLogin() {
    const navigate = useNavigate();

    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");
    const [submitting, setSubmitting] = useState(false);

    const clearTokens = () => {
        localStorage.removeItem("access_token");
        localStorage.removeItem("refresh_token");
    };

    const handleLogin = async (event) => {
        event.preventDefault();
        setError("");
        setSubmitting(true);

        try {
            const response = await endpoints.auth.login({
                username,
                password,
            });

            localStorage.setItem(
                "access_token",
                response.data.access
            );

            localStorage.setItem(
                "refresh_token",
                response.data.refresh
            );

            const userResponse =
                await endpoints.auth.currentUser();

            if (
                userResponse.data.role !==
                "DEPARTMENT_ADMIN"
            ) {
                clearTokens();
                setError(
                    "This login is exclusive to ITE department admins."
                );
                return;
            }

            navigate("/administrator/dashboard");
        } catch {
            clearTokens();
            setError("Invalid username or password.");
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <AuthShell
            brandSubtitle="ITE Department administrator access"
            formSubtitle="Restricted to ITE department administrators."
            formTitle="ITE Department sign in"
        >
            {error && (
                <div className="form-error" role="alert">
                    {error}
                </div>
            )}

            <form
                className="auth-form"
                onSubmit={handleLogin}
            >
                <div className="form-field">
                    <label htmlFor="ite-username">
                        Username
                    </label>

                    <input
                        autoComplete="username"
                        className="form-input with-label"
                        id="ite-username"
                        onChange={(event) =>
                            setUsername(
                                event.target.value
                            )
                        }
                        required
                        type="text"
                        value={username}
                    />
                </div>

                <div className="form-field">
                    <label htmlFor="ite-password">
                        Password
                    </label>

                    <input
                        autoComplete="current-password"
                        className="form-input with-label"
                        id="ite-password"
                        onChange={(event) =>
                            setPassword(
                                event.target.value
                            )
                        }
                        required
                        type="password"
                        value={password}
                    />
                </div>

                <button
                    className="auth-submit"
                    disabled={submitting}
                    type="submit"
                >
                    {submitting
                        ? "Signing in..."
                        : "Sign in to ITE portal"}
                </button>
            </form>

            <div className="auth-footer">
                <Link
                    className="auth-link-button auth-link-button-muted"
                    to="/"
                >
                    Back to main sign in
                </Link>
            </div>
        </AuthShell>
    );
}

export default IteLogin;
