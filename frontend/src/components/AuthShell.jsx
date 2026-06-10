function AuthShell({
    brandTitle = "SMS Gateway",
    brandSubtitle = "API Integrated GSM SMS Gateway",
    formTitle,
    formSubtitle,
    wide = false,
    children,
}) {
    return (
        <div className="auth-page">
            <div className="auth-brand">
                <div className="auth-brand-inner">
                    <div className="auth-brand-badge">
                        GSM
                    </div>

                    <h1 className="auth-brand-title">
                        {brandTitle}
                    </h1>

                    <p className="auth-brand-subtitle">
                        {brandSubtitle}
                    </p>

                    <div className="auth-brand-meta">
                        <p>Colegio de Kidapawan</p>
                        <p>ITE Department</p>
                    </div>
                </div>
            </div>

            <div className="auth-panel">
                <div
                    className={
                        wide
                            ? "auth-card auth-card-wide"
                            : "auth-card"
                    }
                >
                    <div className="auth-card-header">
                        <h2 className="auth-card-title">
                            {formTitle}
                        </h2>

                        {formSubtitle && (
                            <p className="auth-card-subtitle">
                                {formSubtitle}
                            </p>
                        )}
                    </div>

                    {children}
                </div>
            </div>
        </div>
    );
}

export default AuthShell;
