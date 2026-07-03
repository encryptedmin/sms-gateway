import { Routes, Route } from "react-router-dom";

import Login from "./pages/Login";
import IteLogin from "./pages/IteLogin";
import RegisterSubscriber from "./pages/RegisterSubscriber";
import AdminDashboard from "./pages/AdminDashboard";
import InstructorsPage from "./pages/InstructorsPage";
import ContactsPage from "./pages/ContactsPage";
import GroupsPage from "./pages/GroupsPage";
import TemplatesPage from "./pages/TemplatesPage";
import MessagesPage from "./pages/MessagesPage";
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
                path="/administrator/instructors"
                element={<InstructorsPage />}
            />

            <Route
                path="/administrator/contacts"
                element={<ContactsPage />}
            />

            <Route
                path="/administrator/groups"
                element={<GroupsPage />}
            />

            <Route
                path="/administrator/templates"
                element={<TemplatesPage />}
            />

            <Route
                path="/administrator/messages"
                element={<MessagesPage />}
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
