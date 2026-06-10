import {
    formatRole,
    formatUserName,
} from "../utils/format";

function Navbar({ user }) {
    return (
        <div className="navbar">
            <div>
                <h2 className="navbar-title">
                    SMS Gateway Administration
                </h2>
            </div>

            <div className="navbar-user">
                <span>
                    {formatUserName(user)}
                </span>

                <span className="role-pill">
                    {formatRole(user?.role) || "ADMIN"}
                </span>
            </div>
        </div>
    );
}

export default Navbar;
