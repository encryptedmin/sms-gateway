import Field from "./Field";

function MessageTemplatesPanel({
    templates,
    templateForm,
    onCreateTemplate,
    onUpdateTemplateForm,
    onDeleteTemplate,
}) {
    return (
        <section className="panel department-panel">
            <h2>Message Templates</h2>

            <form
                className="dashboard-form"
                onSubmit={onCreateTemplate}
            >
                <Field
                    onChange={(value) =>
                        onUpdateTemplateForm("title", value)
                    }
                    placeholder="Template title"
                    required
                    value={templateForm.title}
                />

                <textarea
                    className="form-textarea"
                    onChange={(event) =>
                        onUpdateTemplateForm(
                            "content",
                            event.target.value
                        )
                    }
                    placeholder="Message body"
                    required
                    rows="5"
                    value={templateForm.content}
                />

                <button className="primary-button" type="submit">
                    Save Template
                </button>
            </form>

            <div className="compact-list">
                {templates.map((template) => (
                    <div className="compact-row" key={template.id}>
                        <div>
                            <strong>{template.title}</strong>
                            <small>{template.content}</small>
                        </div>

                        <button
                            className="danger-button small-button"
                            onClick={() => onDeleteTemplate(template.id)}
                            type="button"
                        >
                            Delete
                        </button>
                    </div>
                ))}
            </div>
        </section>
    );
}

export default MessageTemplatesPanel;
