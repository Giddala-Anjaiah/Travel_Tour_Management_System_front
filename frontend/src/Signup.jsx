import { API_BASE } from './api'
import { User, Mail, Phone, Lock, Shield, Compass, Luggage, BedDouble, CalendarCheck, Route } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useState } from 'react'
import AuthLayout from './components/auth/AuthLayout'
import AuthField from './components/auth/AuthField'
import AuthRoleSelect from './components/auth/AuthRoleSelect'
import { AUTH_ROLES } from './components/auth/authRoles'
import './Auth.css'

const SIGN_UP_FEATURES = [
  { icon: Compass, title: 'Explore Destinations', text: 'Discover beautiful destinations and travel experiences.' },
  { icon: Luggage, title: 'Tour Packages', text: 'Browse and book curated tour packages.' },
  { icon: BedDouble, title: 'Hotels & Availability', text: 'Find suitable hotels and check room availability.' },
  { icon: CalendarCheck, title: 'Easy Booking Management', text: 'Manage your travel bookings from one place.' },
  { icon: Route, title: 'Trip Management', text: 'Track your upcoming and completed trips.' },
]

const Signup = () => {
  const [selectedRole, setSelectedRole] = useState('customer')
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setSuccess('')

    if (password !== confirmPassword) {
      setError('Passwords do not match')
      return
    }

    try {
      const response = await fetch(API_BASE + '/signup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ fullName, email, phone, password, role: selectedRole })
      })

      const data = await response.json()

      if (response.ok) {
        setSuccess(data.message || 'Account created successfully! Please login.')
        setFullName('')
        setEmail('')
        setPhone('')
        setPassword('')
        setConfirmPassword('')
      } else {
        setError(data.message || 'Signup failed')
      }
    } catch (err) {
      setError('Server error. Please try again.')
      console.error('Signup error:', err)
    }
  }

  const roleLabel = AUTH_ROLES.find((role) => role.value === selectedRole)?.label

  return (
    <AuthLayout
      badge="Get Started"
      heading="Start Your Journey with Us"
      description="Create your account to access destinations, tour packages, hotel bookings, and complete trip management."
      features={SIGN_UP_FEATURES}
    >
      <h2 className="auth-card-title">Create Account</h2>
      <p className="auth-card-sub">Start your journey with us.</p>

      {error && <div className="auth-alert auth-alert-error">{error}</div>}
      {success && <div className="auth-alert auth-alert-success">{success}</div>}

      <form className="auth-form" onSubmit={handleSubmit}>
        <AuthRoleSelect
          id="signup-role"
          label="Select Your Role"
          value={selectedRole}
          onChange={(e) => setSelectedRole(e.target.value)}
        />

        <AuthField
          id="signup-name"
          label="Full Name"
          icon={User}
          type="text"
          placeholder="John Doe"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          autoComplete="name"
        />

        <AuthField
          id="signup-email"
          label="Email"
          icon={Mail}
          type="email"
          placeholder="your@email.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
        />

        <AuthField
          id="signup-phone"
          label="Phone Number"
          icon={Phone}
          type="tel"
          placeholder="+91 9876543210"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          autoComplete="tel"
        />

        <AuthField
          id="signup-password"
          label="Password"
          icon={Lock}
          type="password"
          placeholder="••••••••"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          minLength={6}
          autoComplete="new-password"
        />

        <AuthField
          id="signup-confirm-password"
          label="Confirm Password"
          icon={Lock}
          type="password"
          placeholder="••••••••"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          minLength={6}
          autoComplete="new-password"
        />

        <label className="auth-check">
          <input type="checkbox" required />
          <span>I agree to the Terms of Service and Privacy Policy</span>
        </label>

        <button type="submit" className="auth-submit">
          <Shield className="h-4 w-4" aria-hidden="true" />
          Create Account as {roleLabel}
        </button>
      </form>

      <p className="auth-card-foot">
        Already have an account? <Link to="/login" className="auth-link">Sign in</Link>
      </p>
    </AuthLayout>
  )
}

export default Signup
