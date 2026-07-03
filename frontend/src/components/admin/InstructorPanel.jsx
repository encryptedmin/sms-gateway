import Field from "./Field";

function InstructorPanel({
    instructors,
    instructorForm,
    onCreateInstructor,
    onUpdateInstructorForm,
    onToggleInstructor,
}) {
    return (
        <section className="panel department-panel">
            <h2>Instructor Accounts</h2>

            <form
                className="dashboard-form"
                onSubmit={onCreateInstructor}
            >
                <div className="form-row">
                    <Field
                        onChange={(value) =>
                            onUpdateInstructorForm("username", value)
                        }
                        placeholder="Username"
                        required
                        value={instructorForm.username}
                    />

                    <Field
                        onChange={(value) =>
                            onUpdateInstructorForm("email", value)
                        }
                        placeholder="Email"
                        required
                        type="email"
                        value={instructorForm.email}
                    />
                </div>

                <div className="form-row">
                    <Field
                        onChange={(value) =>
                            onUpdateInstructorForm("first_name", value)
                        }
                        placeholder="First name"
                        required
                        value={instructorForm.first_name}
                    />

                    <Field
                        onChange={(value) =>
                            onUpdateInstructorForm("last_name", value)
                        }
                        placeholder="Last name"
                        required
                        value={instructorForm.last_name}
                    />
                </div>

                <Field
                    onChange={(value) =>
                        onUpdateInstructorForm("password", value)
                    }
                    placeholder="Temporary password"
                    required
                    type="password"
                    value={instructorForm.password}
                />

                <button className="primary-button" type="submit">
                    Create Instructor
                </button>
            </form>

            <div className="compact-list">
                {instructors.map((instructor) => (
                    <div className="compact-row" key={instructor.id}>
                        <div>
                            <strong>
                                {instructor.first_name}{" "}
                                {instructor.last_name}
                            </strong>
                            <small>{instructor.email}</small>
                        </div>

                        <button
                            className={
                                instructor.is_active
                                    ? "danger-button small-button"
                                    : "success-button small-button"
                            }
                            onClick={() => onToggleInstructor(instructor)}
                            type="button"
                        >
                            {instructor.is_active ? "Disable" : "Enable"}
                        </button>
                    </div>
                ))}
            </div>
        </section>
    );
}

export default InstructorPanel;
