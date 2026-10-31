interface FormFieldProps {
  id: string
  label: string
  type?: string
  value: string
  placeholder: string
  error?: string
  onChange: (value: string) => void
}

export function FormField({
  id,
  label,
  type = 'text',
  value,
  placeholder,
  error,
  onChange,
}: FormFieldProps) {
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <input
        id={id}
        type={type}
        value={value}
        placeholder={placeholder}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${id}-error` : undefined}
        onChange={(event) => onChange(event.target.value)}
      />
      {error && (
        <span id={`${id}-error`} className="field-error">
          {error}
        </span>
      )}
    </div>
  )
}
