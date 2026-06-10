import { useLocation, useNavigate } from "react-router-dom";

function Sidebar({ user }) {
    const location = useLocation();
    const navigate = useNavigate();

    const menuItems = [
        {
            name: "Dashboard",
            path: "/administrator/dashboard",
        },
        {
            name: "Subscribers",
            path: "/administrator/subscribers",
        },
        {
            name: "Plans",
            path: "/administrator/plans",
        },
        {
            name: "API Keys",
            path: "/administrator/api-keys",
        },
    ];

    if (user?.role === "SUPER_ADMIN") {
        menuItems.push({
            name: "Admin Accounts",
            path: "/administrator/admin-accounts",
        });
    }

    const handleLogout = () => {
        localStorage.removeItem("access_token");
        localStorage.removeItem("refresh_token");
        navigate("/");
    };

    return (
        <div className="sidebar">
            <div className="sidebar-header">
                <h2 className="sidebar-title">
                    SMS Gateway
                </h2>

                <small className="sidebar-subtitle">
                    Administration
                </small>
            </div>

            <div className="sidebar-menu">
                {menuItems.map((item) => {
                    const active =
                        location.pathname === item.path;

                    return (
                        <div
                            className={
                                active
                                    ? "sidebar-item active"
                                    : "sidebar-item"
                            }
                            key={item.name}
                            onClick={() =>
                                navigate(item.path)
                            }
                        >
                            {item.name}
                        </div>
                    );
                })}

                <div
                    className="sidebar-logout"
                    onClick={handleLogout}
                >
                    Logout
                </div>
            </div>
        </div>
    );
}

export default Sidebar;
