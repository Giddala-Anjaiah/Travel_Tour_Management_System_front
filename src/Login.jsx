import { API_BASE } from './api'
import { Plane } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import { useState } from 'react'
import { showToast } from './components/toastEvents'
import './Auth.css'

const Login = () => {
  const navigate = useNavigate()
  const [selectedRole, setSelectedRole] = useState('customer')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const roles = [
    { value: 'admin', label: 'Admin' },
    { value: 'customer', label: 'Customer' },
    { value: 'tour_operator', label: 'Tour Operator' },
    { value: 'hotel_partner', label: 'Hotel Partner' }
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
        
        // Redirect to role-based dashboard
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
            <Plane className="h-10 w-10" style={{ color: '#4f46e5' }} />
            <h2>Welcome Back</h2>
            <p>Sign in to your account</p>
          </div>
          
          {error && <div className="error-message">{error}</div>}
          {success && <div className="success-message">{success}</div>}
          
          <form className="auth-form" onSubmit={handleSubmit}>
            <div className="form-group">
              <label>Select Your Role</label>
              <select 
                className="role-select"
                value={selectedRole}
                onChange={(e) => setSelectedRole(e.target.value)}
              >
                {roles.map((role) => (
                  <option key={role.value} value={role.value}>
                    {role.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label>Email</label>
              <input 
                type="email" 
                placeholder="your@email.com" 
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="form-group">
              <label>Password</label>
              <input 
                type="password" 
                placeholder="••••••••" 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            <div className="form-options">
              <label className="checkbox-label">
                <input type="checkbox" />
                <span>Remember me</span>
              </label>
              <a href="#" className="forgot-link" onClick={(e) => { e.preventDefault(); navigate('/forgot-password'); }}>Forgot password?</a>
            </div>
            <button type="submit" className="auth-btn">Sign In as {roles.find(r => r.value === selectedRole)?.label}</button>
          </form>
          
          <div className="google-divider">
            <span>or sign in with</span>
          </div>
          <button type="button" className="google-btn" onClick={handleGoogleLogin}>
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" style={{ width: '18px', height: '18px', marginRight: '8px' }} fill="currentColor">
              <path fill="#ffc107" d="M43.611 20.083H42V20H24V28h11.303c-1.649 4.657-6.08 8-11.303 8-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z" />
            </svg>
            Sign in with Google
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
