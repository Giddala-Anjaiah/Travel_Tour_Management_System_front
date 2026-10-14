import { ChevronDown } from 'lucide-react'
import { AUTH_ROLES } from './authRoles'

export default function AuthRoleSelect({ id = 'auth-role', label = 'Role', value, onChange }) {
  return (
    <div className="auth-field">
      <label className="auth-label" htmlFor={id}>
        {label}
      </label>

      <div className="auth-select-wrap">
        <select id={id} className="auth-select" value={value} onChange={onChange}>
          {AUTH_ROLES.map((role) => (
            <option key={role.value} value={role.value}>
              {role.label}
            </option>
          ))}
        </select>
        <ChevronDown className="auth-select-chevron h-4 w-4" aria-hidden="true" />
      </div>
    </div>
  )
}
