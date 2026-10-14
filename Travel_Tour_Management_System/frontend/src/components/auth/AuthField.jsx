import { useState } from 'react'
import { Eye, EyeOff } from 'lucide-react'

export default function AuthField({
  id,
  label,
  icon: Icon,
  type = 'text',
  value,
  onChange,
  placeholder,
  required = true,
  minLength,
  autoComplete,
  toggleable = false,
  className = '',
  hint = '',
  hintTone = 'muted',
  children,
}) {
  const [revealed, setRevealed] = useState(false)
  const isSecret = toggleable || type === 'password'
  const resolvedType = isSecret ? (revealed ? 'text' : 'password') : type

  return (
    <div className="auth-field">
      <label className="auth-label" htmlFor={id}>
        {label}
      </label>

      <div className="auth-input">
        {Icon ? (
          <span className="auth-input-icon" aria-hidden="true">
            <Icon className="h-5 w-5" />
          </span>
        ) : null}

        <input
          id={id}
          className={`auth-input-el ${className}`.trim()}
          type={resolvedType}
          placeholder={placeholder}
          value={value}
          onChange={onChange}
          required={required}
          minLength={minLength}
          autoComplete={autoComplete}
        />

        {isSecret ? (
          <button
            type="button"
            className="auth-eye"
            onClick={() => setRevealed((current) => !current)}
            aria-label={revealed ? 'Hide password' : 'Show password'}
            tabIndex={-1}
          >
            {revealed ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
          </button>
        ) : null}

        {children}
      </div>

      {hint ? (
        <span className={`auth-hint ${hintTone === 'error' ? 'auth-hint--error' : ''}`.trim()}>
          {hint}
        </span>
      ) : null}
    </div>
  )
}
