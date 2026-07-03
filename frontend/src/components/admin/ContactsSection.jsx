import Field from "./Field";

function ContactsSection({
    contactForm,
    groups,
    filteredContacts,
    filters,
    yearLevels,
    sections,
    groupById,
    csvGroupId,
    onCreateContact,
    onUpdateContactForm,
    onImportContacts,
    onSetCsvFile,
    onSetCsvGroupId,
    onSetFilters,
    onSetSendForm,
    onToggleContact,
}) {
    return (
        <section className="panel">
            <div className="section-heading">
                <div>
                    <h2>Contacts</h2>
                    <p className="muted-text">
                        Register students manually or import a CSV file.
                    </p>
                </div>
            </div>

            <div className="department-grid">
                <form
                    className="dashboard-form"
                    onSubmit={onCreateContact}
                >
                    <div className="form-row">
                        <Field
                            onChange={(value) =>
                                onUpdateContactForm("first_name", value)
                            }
                            placeholder="First name"
                            required
                            value={contactForm.first_name}
                        />

                        <Field
                            onChange={(value) =>
                                onUpdateContactForm("last_name", value)
                            }
                            placeholder="Last name"
                            value={contactForm.last_name}
                        />
                    </div>

                    <div className="form-row">
                        <Field
                            onChange={(value) =>
                                onUpdateContactForm(
                                    "mobile_number",
                                    value
                                )
                            }
                            placeholder="Mobile number"
                            required
                            value={contactForm.mobile_number}
                        />

                        <Field
                            onChange={(value) =>
                                onUpdateContactForm("course", value)
                            }
                            placeholder="Course"
                            value={contactForm.course}
                        />
                    </div>

                    <div className="form-row">
                        <Field
                            onChange={(value) =>
                                onUpdateContactForm("year_level", value)
                            }
                            placeholder="Year level"
                            value={contactForm.year_level}
                        />

                        <Field
                            onChange={(value) =>
                                onUpdateContactForm("section", value)
                            }
                            placeholder="Section"
                            value={contactForm.section}
                        />
                    </div>

                    <select
                        className="form-input"
                        multiple
                        onChange={(event) =>
                            onUpdateContactForm(
                                "groups",
                                Array.from(
                                    event.target.selectedOptions,
                                    (option) => Number(option.value)
                                )
                            )
                        }
                        value={contactForm.groups.map(String)}
                    >
                        {groups.map((group) => (
                            <option key={group.id} value={group.id}>
                                {group.name}
                            </option>
                        ))}
                    </select>

                    <button className="primary-button" type="submit">
                        Register Contact
                    </button>
                </form>

                <form
                    className="dashboard-form"
                    onSubmit={onImportContacts}
                >
                    <Field
                        accept=".csv,text/csv"
                        onChange={(value, event) =>
                            onSetCsvFile(event.target.files?.[0] || null)
                        }
                        type="file"
                    />

                    <select
                        className="form-input"
                        onChange={(event) =>
                            onSetCsvGroupId(event.target.value)
                        }
                        value={csvGroupId}
                    >
                        <option value="">No group assignment</option>
                        {groups.map((group) => (
                            <option key={group.id} value={group.id}>
                                {group.name}
                            </option>
                        ))}
                    </select>

                    <button className="primary-button" type="submit">
                        Upload CSV
                    </button>
                </form>
            </div>

            <div className="filter-bar">
                <select
                    className="form-input"
                    onChange={(event) =>
                        onSetFilters((current) => ({
                            ...current,
                            year_level: event.target.value,
                            section: "",
                        }))
                    }
                    value={filters.year_level}
                >
                    <option value="">All year levels</option>
                    {yearLevels.map((yearLevel) => (
                        <option key={yearLevel} value={yearLevel}>
                            {yearLevel}
                        </option>
                    ))}
                </select>

                <select
                    className="form-input"
                    onChange={(event) =>
                        onSetFilters((current) => ({
                            ...current,
                            section: event.target.value,
                        }))
                    }
                    value={filters.section}
                >
                    <option value="">All sections</option>
                    {sections.map((section) => (
                        <option key={section} value={section}>
                            {section}
                        </option>
                    ))}
                </select>

                <select
                    className="form-input"
                    onChange={(event) =>
                        onSetFilters((current) => ({
                            ...current,
                            group_id: event.target.value,
                        }))
                    }
                    value={filters.group_id}
                >
                    <option value="">All groups</option>
                    {groups.map((group) => (
                        <option key={group.id} value={group.id}>
                            {group.name}
                        </option>
                    ))}
                </select>
            </div>

            <div className="table-scroll">
                <table className="data-table">
                    <thead>
                        <tr>
                            <th>Name</th>
                            <th>Mobile</th>
                            <th>Year</th>
                            <th>Section</th>
                            <th>Groups</th>
                            <th>Status</th>
                            <th>Action</th>
                        </tr>
                    </thead>

                    <tbody>
                        {filteredContacts.map((contact) => (
                            <tr key={contact.id}>
                                <td>
                                    {contact.first_name}{" "}
                                    {contact.last_name}
                                </td>
                                <td>{contact.mobile_number}</td>
                                <td>{contact.year_level}</td>
                                <td>{contact.section}</td>
                                <td>
                                    {contact.groups
                                        ?.map(
                                            (groupId) =>
                                                groupById[groupId]?.name
                                        )
                                        .filter(Boolean)
                                        .join(", ")}
                                </td>
                                <td>
                                    {contact.active
                                        ? "Active"
                                        : "Inactive"}
                                </td>
                                <td>
                                    <button
                                        className="primary-button small-button"
                                        onClick={() => {
                                            onSetSendForm((current) => ({
                                                ...current,
                                                target_type: "contact",
                                                contact_id: String(
                                                    contact.id
                                                ),
                                            }));
                                        }}
                                        type="button"
                                    >
                                        Message
                                    </button>

                                    <button
                                        className="button-gap small-button"
                                        onClick={() =>
                                            onToggleContact(contact)
                                        }
                                        type="button"
                                    >
                                        {contact.active
                                            ? "Disable"
                                            : "Enable"}
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </section>
    );
}

export default ContactsSection;
