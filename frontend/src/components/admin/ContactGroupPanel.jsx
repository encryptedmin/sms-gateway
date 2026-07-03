import Field from "./Field";

function ContactGroupPanel({
    groups,
    groupForm,
    onCreateGroup,
    onUpdateGroupForm,
}) {
    return (
        <section className="panel department-panel">
            <h2>Contact Groups</h2>

            <form className="dashboard-form" onSubmit={onCreateGroup}>
                <Field
                    onChange={(value) =>
                        onUpdateGroupForm("name", value)
                    }
                    placeholder="Group name, e.g. BSIT 2A"
                    required
                    value={groupForm.name}
                />

                <textarea
                    className="form-textarea"
                    onChange={(event) =>
                        onUpdateGroupForm(
                            "description",
                            event.target.value
                        )
                    }
                    placeholder="Description"
                    value={groupForm.description}
                />

                <button className="primary-button" type="submit">
                    Create Group
                </button>
            </form>

            <div className="group-chips">
                {groups.map((group) => (
                    <span className="group-chip" key={group.id}>
                        {group.name}
                    </span>
                ))}
            </div>
        </section>
    );
}

export default ContactGroupPanel;
