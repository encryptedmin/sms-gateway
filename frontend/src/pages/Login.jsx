import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import AuthShell from "../components/AuthShell";
import { endpoints } from "../services/api";

function Login() {
    const navigate = useNavigate();

    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");
    const [submitting, setSubmitting] = useState(false);

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

            navigate("/administrator/dashboard");
        } catch {
            setError("Invalid username or password.");
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <AuthShell
            formSubtitle="Sign in with your administrator credentials."
            formTitle="Welcome back"
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
                    <label htmlFor="username">
                        Username
                    </label>

                    <input
                        autoComplete="username"
                        className="form-input with-label"
                        id="username"
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
                    <label htmlFor="password">
                        Password
                    </label>

                    <input
                        autoComplete="current-password"
                        className="form-input with-label"
                        id="password"
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
                    {submitting ? "Signing in..." : "Sign in"}
                </button>
            </form>

            <div className="auth-divider">
                <span>Other access options</span>
            </div>

            <div className="auth-actions">
                <Link
                    className="auth-action-button auth-action-button-primary"
                    to="/ite/login"
                >
                    <span className="auth-action-icon" aria-hidden="true">
                        ITE
                    </span>
                    <span className="auth-action-copy">
                        <strong>ITE Department</strong>
                        <small>Department admin sign in</small>
                    </span>
                </Link>

                <Link
                    className="auth-action-button"
                    to="/register"
                >
                    <span className="auth-action-icon" aria-hidden="true">
                        +
                    </span>
                    <span className="auth-action-copy">
                        <strong>Register as subscriber</strong>
                        <small>Create a new account</small>
                    </span>
                </Link>
            </div>
        </AuthShell>
    );
}

export default Login;
