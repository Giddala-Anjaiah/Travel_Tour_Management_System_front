import { useState, useEffect } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { Mail, Lock, Compass, Luggage, BedDouble, CalendarCheck, Route } from 'lucide-react'
import { API_BASE } from './api'
import AuthLayout from './components/auth/AuthLayout'
import AuthField from './components/auth/AuthField'
import AuthRoleSelect from './components/auth/AuthRoleSelect'
import { showToast } from './components/toastEvents'
import './Auth.css'

const SIGN_IN_FEATURES = [
  { icon: Compass, title: 'Explore Destinations', text: 'Discover beautiful destinations and travel experiences.' },
  { icon: Luggage, title: 'Tour Packages', text: 'Browse and book curated tour packages.' },
  { icon: BedDouble, title: 'Hotels & Availability', text: 'Find suitable hotels and check room availability.' },
  { icon: CalendarCheck, title: 'Easy Booking Management', text: 'Manage your travel bookings from one place.' },
  { icon: Route, title: 'Trip Management', text: 'Track your upcoming and completed trips.' },
]

const PROD_API_BASE = 'https://travel-tour-management-system-backend.onrender.com/api'

// In local development the Vite dev server proxies to the local backend, but a
// deployed build without VITE_API_URL must not send Google traffic to localhost.
function getGoogleAuthBase() {
  const hostname = window.location.hostname
  const isLocal = hostname === 'localhost' || hostname === '127.0.0.1'
  if (!import.meta.env.VITE_API_URL && !isLocal) {
    return PROD_API_BASE
  }
  return API_BASE
}

const Login = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const [selectedRole, setSelectedRole] = useState('customer')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const params = new URLSearchParams(location.search)
    const token = params.get('token')
    const role = params.get('role')
    if (token && role) {
      localStorage.setItem('token', token)
      const payload = JSON.parse(atob(token.split('.')[1]))
      localStorage.setItem('user', JSON.stringify({
        id: payload.userId,
        email: payload.email,
        role: payload.role,
        fullName: payload.email.split('@')[0],
      }))
      showToast('Login successful!')
      const redirectMap = {
        admin: '/admin/dashboard',
        customer: '/customer/dashboard',
        tour_operator: '/tour-operator/dashboard',
        hotel_partner: '/hotel-partner/dashboard',
      }
      const target = redirectMap[role] || '/'
      window.history.replaceState({}, document.title, target)
      window.location.href = target
    }
  }, [location, navigate])

  const roleRedirects = {
    admin: '/admin/dashboard',
    customer: '/customer/dashboard',
    tour_operator: '/tour-operator/dashboard',
    hotel_partner: '/hotel-partner/dashboard',
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setSuccess('')
    setLoading(true)

    try {
      const response = await fetch(API_BASE + '/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, role: selectedRole }),
      })

      const data = await response.json()

      if (response.ok) {
        setSuccess('Login successful!')
        showToast('Login successful!')
        localStorage.setItem('token', data.token)
        localStorage.setItem('user', JSON.stringify(data.user))
        setTimeout(() => { navigate(roleRedirects[selectedRole]) }, 1000)
      } else {
        setError(data.message || 'Login failed')
        showToast(data.message || 'Login failed', 'error')
      }
    } catch (err) {
      setError('Server error. Please try again.')
      console.error('Login error:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleGoogleLogin = () => {
    const frontendOrigin = window.location.origin
    window.location.href = `${getGoogleAuthBase()}/auth/google?state=${encodeURIComponent(frontendOrigin)}`
  }

  return (
    <AuthLayout
      badge="Welcome Back"
      heading="Welcome to Travel & Tour"
      description="Your complete platform for discovering destinations, managing tours, booking hotels, and planning unforgettable journeys."
      features={SIGN_IN_FEATURES}
    >
      <h2 className="auth-card-title">Sign in to your account</h2>
      <p className="auth-card-sub">Enter your credentials to access your account.</p>

      {error && <div className="auth-alert auth-alert-error">{error}</div>}
      {success && <div className="auth-alert auth-alert-success">{success}</div>}

      <form className="auth-form" onSubmit={handleSubmit}>
        <AuthRoleSelect value={selectedRole} onChange={(e) => setSelectedRole(e.target.value)} />

        <AuthField
          id="login-email"
          label="Email Address"
          icon={Mail}
          type="email"
          placeholder="Enter your email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
        />

        <AuthField
          id="login-password"
          label="Password"
          icon={Lock}
          type="password"
          placeholder="Enter your password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
        />

        <div className="auth-options">
          <label className="auth-check">
            <input type="checkbox" />
            <span>Remember me</span>
          </label>
          <Link to="/forgot-password" className="auth-link">Forgot password?</Link>
        </div>

        <button type="submit" className="auth-submit" disabled={loading}>
          {loading ? 'Signing In...' : 'Sign In'}
        </button>
      </form>

      <div className="auth-divider"><span>or sign in with</span></div>

      <button type="button" className="auth-google" onClick={handleGoogleLogin}>
        <img src="/static/Google.jpg" alt="Google" />
        <span>Sign in with Google</span>
      </button>

      <p className="auth-card-foot">
        Don't have an account? <Link to="/signup" className="auth-link">Create an account</Link>
      </p>
    </AuthLayout>
  )
}

export default Login
