import { API_BASE } from './api'
import { Plane, User, Mail, Lock, Shield } from 'lucide-react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { showToast } from './components/toastEvents'
import './Auth.css'

const Login = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const [selectedRole, setSelectedRole] = useState('customer')

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
      window.history.replaceState({}, document.title, '/')
      showToast('Login successful!')
      const redirectMap = {
        admin: '/admin/dashboard',
        customer: '/customer/dashboard',
        tour_operator: '/tour-operator/dashboard',
        hotel_partner: '/hotel-partner/dashboard',
      }
      navigate(redirectMap[role] || '/')
    }
  }, [location, navigate])
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [loading, setLoading] = useState(false)

  const roles = [
    { value: 'customer', label: 'Customer', icon: User, color: 'customer' },
    { value: 'tour_operator', label: 'Tour Operator', icon: Shield, color: 'tour_operator' },
    { value: 'hotel_partner', label: 'Hotel Partner', icon: Shield, color: 'hotel_partner' },
    { value: 'admin', label: 'Admin', icon: Shield, color: 'admin' }
  ]

  const roleRedirects = {
    admin: '/admin/dashboard',
    customer: '/customer/dashboard',
    tour_operator: '/tour-operator/dashboard',
    hotel_partner: '/hotel-partner/dashboard'
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setSuccess('')
    setLoading(true)

    try {
      const response = await fetch(API_BASE + '/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ email, password, role: selectedRole })
      })

      const data = await response.json()

      if (response.ok) {
        setSuccess('Login successful!')
        showToast('Login successful!')
        localStorage.setItem('token', data.token)
        localStorage.setItem('user', JSON.stringify(data.user))

        setTimeout(() => {
          navigate(roleRedirects[selectedRole])
        }, 1000)
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
    window.location.href = API_BASE + '/auth/google'
  }

  return (
    <div className="auth-page">
      <div className="auth-content">
        <div className="auth-card">
          <div className="auth-header">
            <div className="logo-icon">
              <Plane className="h-8 w-8 text-white" />
            </div>
            <h2>Welcome Back</h2>
            <p>Sign in to your account</p>
          </div>

          {error && <div className="error-message">{error}</div>}
          {success && <div className="success-message">{success}</div>}

          <form className="auth-form" onSubmit={handleSubmit}>
            <div className="form-group">
              <label>Select Your Role</label>
              <div className="role-select-wrap">
                <select
                  className="role-select"
                  value={selectedRole}
                  onChange={(e) => setSelectedRole(e.target.value)}
                >
                  <option value="customer">Customer</option>
                  <option value="tour_operator">Tour Operator</option>
                  <option value="hotel_partner">Hotel Partner</option>
                  <option value="admin">Admin</option>
                </select>
                <svg className="role-select-arrow" width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M2 4L6 8L10 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
            </div>
            <div className="form-group">
              <label>Email</label>
              <div className="input-with-icon">
                <Mail className="h-5 w-5" />
                <input
                  type="email"
                  placeholder="your@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
            </div>
            <div className="form-group">
              <label>Password</label>
              <div className="input-with-icon">
                <Lock className="h-5 w-5" />
                <input
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
            </div>
            <div className="form-options">
              <label className="checkbox-label">
                <input type="checkbox" />
                <span>Remember me</span>
              </label>
              <a href="#" className="forgot-link" onClick={(e) => { e.preventDefault(); navigate('/forgot-password'); }}>Forgot password?</a>
            </div>
            <button type="submit" className="auth-btn" disabled={loading}>
              {loading ? 'Signing In...' : 'Sign In as ' + roles.find(r => r.value === selectedRole)?.label}
            </button>
          </form>

          <div className="google-divider">
            <span>or sign in with</span>
          </div>
          <button type="button" className="google-btn" onClick={handleGoogleLogin}>
            <img src="/static/Google.jpg" alt="Google" style={{ width: '20px', height: '20px', marginRight: '10px' }} />
            <span style={{ fontWeight: '500' }}>Sign in with Google</span>
          </button>

          <p className="auth-footer">
            Don't have an account? <Link to="/signup">Sign up</Link>
          </p>
          <div className="auth-back">
            <Link to="/">← Back to Home</Link>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Login
