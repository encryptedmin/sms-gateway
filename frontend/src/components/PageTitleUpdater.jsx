import { useEffect } from "react";
import { useLocation } from "react-router-dom";

// Keeps the browser tab title honest — without this, every page showed
// "SMS Gateway | Sign In" regardless of where you actually were, which
// was actively misleading with multiple tabs open.
const PAGE_TITLES = {
  "/login": "Sign In",

  "/super-admin": "Overview",
  "/super-admin/plans": "Plans",
  "/super-admin/department-admins": "Department Admins",
  "/super-admin/subscribers": "Subscribers",
  "/super-admin/logs": "SMS Logs",

  "/department-admin": "Overview",
  "/department-admin/instructors": "Instructors",
  "/department-admin/contacts": "Contacts",
  "/department-admin/groups": "Contact Groups",
  "/department-admin/templates": "Message Templates",
  "/department-admin/send": "Send SMS",
  "/department-admin/logs": "SMS Logs",

  "/instructor": "Overview",
  "/instructor/contacts": "Contacts",
  "/instructor/groups": "Contact Groups",
  "/instructor/templates": "Message Templates",
  "/instructor/send": "Send SMS",
  "/instructor/logs": "SMS Logs",

  "/subscriber": "Dashboard",
  "/unauthorized": "Unauthorized",
};

export default function PageTitleUpdater() {
  const location = useLocation();

  useEffect(() => {
    const label = PAGE_TITLES[location.pathname];
    document.title = label ? `SMS Gateway | ${label}` : "SMS Gateway";
  }, [location.pathname]);

  return null;
}
