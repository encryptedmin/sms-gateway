import { useEffect, useMemo, useState } from "react";

import ContactsSection from "../components/admin/ContactsSection";
import AdminLayout from "../layouts/AdminLayout";
import {
    endpoints,
    toList,
} from "../services/api";

const emptyContact = {
    first_name: "",
    middle_name: "",
    last_name: "",
    extension_name: "",
    contact_number: "",
    year_level: "",
    section: "",
    group: "",
};

function ContactsPage() {
    const [contacts, setContacts] = useState([]);
    const [groups, setGroups] = useState([]);
    const [filters, setFilters] = useState({
        year_level: "",
        section: "",
        group: "",
    });
    const [contactForm, setContactForm] = useState(emptyContact);
    const [csvFile, setCsvFile] = useState(null);
    const [csvGroupId, setCsvGroupId] = useState("");
    const [notice, setNotice] = useState("");
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(true);

    const showMessage = (message) => {
        setNotice(message);
        setError("");
    };

    const showError = (message) => {
        setNotice("");
        setError(message);
    };

    const loadContacts = async () => {
        setLoading(true);

        try {
            const [contactResponse, groupResponse] = await Promise.all([
                endpoints.contacts.list(),
                endpoints.contactGroups.list(),
            ]);

            setContacts(toList(contactResponse.data));
            setGroups(toList(groupResponse.data));
        } catch (requestError) {
            console.error(requestError);
            showError("Unable to load contacts.");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        loadContacts();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const groupById = useMemo(() => {
        const map = new Map();

        groups.forEach((group) => {
            map.set(group.id, group);
        });

        return map;
    }, [groups]);

    const yearLevels = useMemo(() => {
        const values = new Set();

        contacts.forEach((contact) => {
            if (contact.year_level) {
                values.add(contact.year_level);
            }
        });

        return Array.from(values).sort();
    }, [contacts]);

    const sections = useMemo(() => {
        const values = new Set();

        contacts.forEach((contact) => {
            if (contact.section) {
                values.add(contact.section);
            }
        });

        return Array.from(values).sort();
    }, [contacts]);

    const filteredContacts = useMemo(() => {
        return contacts.filter((contact) => {
            if (
                filters.year_level &&
                contact.year_level !== filters.year_level
            ) {
                return false;
            }

            if (
                filters.section &&
                contact.section !== filters.section
            ) {
                return false;
            }

            if (filters.group) {
                const groupIds = Array.isArray(contact.groups)
                    ? contact.groups
                    : [];

                if (!groupIds.includes(Number(filters.group))) {
                    return false;
                }
            }

            return true;
        });
    }, [contacts, filters]);

    const updateContactForm = (field, value) => {
        setContactForm((current) => ({
            ...current,
            [field]: value,
        }));
    };

    const createContact = async (event) => {
        event.preventDefault();

        try {
            await endpoints.contacts.create(contactForm);
            setContactForm(emptyContact);
            showMessage("Contact added.");
            loadContacts();
        } catch (requestError) {
            console.error(requestError);
            showError("Unable to add contact.");
        }
    };

    const toggleContact = async (contact) => {
        try {
            await endpoints.contacts.update(contact.id, {
                is_active: !contact.is_active,
            });
            loadContacts();
        } catch (requestError) {
            console.error(requestError);
            showError("Unable to update contact.");
        }
    };

    const importContacts = async (event) => {
        event.preventDefault();

        if (!csvFile) {
            showError("Please choose a CSV file to import.");
            return;
        }

        const formData = new FormData();
        formData.append("file", csvFile);

        if (csvGroupId) {
            formData.append("group", csvGroupId);
        }

        try {
            await endpoints.contacts.importCsv(formData);
            setCsvFile(null);
            setCsvGroupId("");
            showMessage("Contacts imported.");
            loadContacts();
        } catch (requestError) {
            console.error(requestError);
            showError("Unable to import contacts.");
        }
    };

    return (
        <AdminLayout>
            <div className="page-header dashboard-heading">
                <div>
                    <h1>Contacts</h1>

                    <p className="muted-text">
                        Manage individual contacts, filter the roster,
                        and import contacts from CSV.
                    </p>
                </div>
            </div>

            {notice && (
                <div className="form-success dashboard-alert">
                    {notice}
                </div>
            )}

            {error && (
                <div className="form-error dashboard-alert">
                    {error}
                </div>
            )}

            <ContactsSection
                contactForm={contactForm}
                csvFile={csvFile}
                csvGroupId={csvGroupId}
                filteredContacts={filteredContacts}
                filters={filters}
                groupById={groupById}
                groups={groups}
                sections={sections}
                yearLevels={yearLevels}
                onCreateContact={createContact}
                onImportContacts={importContacts}
                onSetCsvFile={setCsvFile}
                onSetCsvGroupId={setCsvGroupId}
                onSetFilters={setFilters}
                onToggleContact={toggleContact}
                onUpdateContactForm={updateContactForm}
            />

            {loading && (
                <div className="loading-overlay">
                    Loading contacts...
                </div>
            )}
        </AdminLayout>
    );
}

export default ContactsPage;
