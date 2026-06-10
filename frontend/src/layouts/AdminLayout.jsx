import { useEffect, useState } from "react";

import Navbar from "../components/Navbar";
import Sidebar from "../components/Sidebar";
import { endpoints } from "../services/api";

function AdminLayout({ children }) {
    const [user, setUser] = useState(null);

    useEffect(() => {
        const loadCurrentUser = async () => {
            try {
                const response =
                    await endpoints.auth.currentUser();

                setUser(response.data);
            } catch (error) {
                console.error(error);
            }
        };

        loadCurrentUser();
    }, []);

    return (
        <div className="admin-layout">
            <Sidebar user={user} />

            <div className="admin-main">
                <Navbar user={user} />

                <div className="admin-content">
                    {children}
                </div>
            </div>
        </div>
    );
}

export default AdminLayout;
