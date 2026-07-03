import Field from "./Field";

function TargetSelector({
    sendForm,
    contacts,
    groups,
    yearLevels,
    onUpdateSendForm,
}) {
    if (sendForm.target_type === "contact") {
        return (
            <select
                className="form-input"
                onChange={(event) =>
                    onUpdateSendForm("contact_id", event.target.value)
                }
                required
                value={sendForm.contact_id}
            >
                <option value="">Choose contact</option>
                {contacts.map((contact) => (
                    <option key={contact.id} value={contact.id}>
                        {contact.first_name} {contact.last_name} -{" "}
                        {contact.mobile_number}
                    </option>
                ))}
            </select>
        );
    }

    if (sendForm.target_type === "year") {
        return (
            <select
                className="form-input"
                onChange={(event) =>
                    onUpdateSendForm("year_level", event.target.value)
                }
                required
                value={sendForm.year_level}
            >
                <option value="">Choose year level</option>
                {yearLevels.map((yearLevel) => (
                    <option key={yearLevel} value={yearLevel}>
                        {yearLevel}
                    </option>
                ))}
            </select>
        );
    }

    if (sendForm.target_type === "class") {
        return (
            <div className="form-row">
                <select
                    className="form-input"
                    onChange={(event) =>
                        onUpdateSendForm(
                            "year_level",
                            event.target.value
                        )
                    }
                    required
                    value={sendForm.year_level}
                >
                    <option value="">Year level</option>
                    {yearLevels.map((yearLevel) => (
                        <option key={yearLevel} value={yearLevel}>
                            {yearLevel}
                        </option>
                    ))}
                </select>

                <Field
                    onChange={(value) =>
                        onUpdateSendForm("section", value)
                    }
                    placeholder="Section"
                    required
                    value={sendForm.section}
                />
            </div>
        );
    }

    if (sendForm.target_type === "group") {
        return (
            <select
                className="form-input"
                onChange={(event) =>
                    onUpdateSendForm("group_id", event.target.value)
                }
                required
                value={sendForm.group_id}
            >
                <option value="">Choose group</option>
                {groups.map((group) => (
                    <option key={group.id} value={group.id}>
                        {group.name}
                    </option>
                ))}
            </select>
        );
    }

    return null;
}

function SendMessagePanel({
    sendForm,
    contacts,
    groups,
    templates,
    yearLevels,
    onSendMessage,
    onUpdateSendForm,
    onApplyTemplate,
}) {
    return (
        <section className="panel department-panel">
            <h2>Send Message</h2>

            <form className="dashboard-form" onSubmit={onSendMessage}>
                <select
                    className="form-input"
                    onChange={(event) =>
                        onUpdateSendForm(
                            "target_type",
                            event.target.value
                        )
                    }
                    value={sendForm.target_type}
                >
                    <option value="contact">Single contact</option>
                    <option value="year">Entire year level</option>
                    <option value="class">Specific class</option>
                    <option value="group">Contact group</option>
                    <option value="all">All contacts</option>
                </select>

                <TargetSelector
                    contacts={contacts}
                    groups={groups}
                    onUpdateSendForm={onUpdateSendForm}
                    sendForm={sendForm}
                    yearLevels={yearLevels}
                />

                <select
                    className="form-input"
                    onChange={(event) =>
                        onApplyTemplate(event.target.value)
                    }
                    value={sendForm.template_id}
                >
                    <option value="">No template</option>
                    {templates.map((template) => (
                        <option key={template.id} value={template.id}>
                            {template.title}
                        </option>
                    ))}
                </select>

                <textarea
                    className="form-textarea"
                    onChange={(event) =>
                        onUpdateSendForm("message", event.target.value)
                    }
                    placeholder="Message body"
                    required
                    rows="6"
                    value={sendForm.message}
                />

                <button className="success-button" type="submit">
                    Queue Message
                </button>
            </form>
        </section>
    );
}

export default SendMessagePanel;
