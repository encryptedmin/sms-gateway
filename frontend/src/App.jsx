import { Routes, Route } from "react-router-dom";

import Login from "./pages/Login";
import IteLogin from "./pages/IteLogin";
import RegisterSubscriber from "./pages/RegisterSubscriber";
import AdminDashboard from "./pages/AdminDashboard";
import Plans from "./pages/Plans";
import Subscribers from "./pages/Subscribers";
import ApiKeys from "./pages/ApiKeys";
import AdminAccounts from "./pages/AdminAccounts";

function App() {

    return (

        <Routes>

            <Route
                path="/"
                element={<Login />}
            />

            <Route
                path="/ite/login"
                element={<IteLogin />}
            />

            <Route
                path="/register"
                element={<RegisterSubscriber />}
            />

            <Route
                path="/administrator/dashboard"
                element={<AdminDashboard />}
            />

            <Route
                path="/administrator/plans"
                element={<Plans />}
            />

            <Route
                path="/administrator/subscribers"
                element={<Subscribers />}
            />

            <Route
                path="/administrator/api-keys"
                element={<ApiKeys />}
            />

            <Route
                path="/administrator/admin-accounts"
                element={<AdminAccounts />}
            />

        </Routes>

    );

}

export default App;
