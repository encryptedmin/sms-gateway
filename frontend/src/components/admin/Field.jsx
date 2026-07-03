function Field({
    label,
    value,
    onChange,
    className = "form-input",
    ...inputProps
}) {
    const input = (
        <input
            className={className}
            onChange={(event) => onChange(event.target.value, event)}
            value={value}
            {...inputProps}
        />
    );

    if (!label) {
        return input;
    }

    return (
        <label>
            <span>{label}</span>
            {input}
        </label>
    );
}

export default Field;
