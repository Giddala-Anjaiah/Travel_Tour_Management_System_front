import { API_BASE } from './api'
import { Plane } from 'lucide-react'
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
             <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" style={{ width: '20px', height: '20px' }}>
               <path fill="#4285f4" d="M24 9.5c3.54 0 6.69 1.4 8.99-2.04L38.71 2 26.3 9.36a14.2 14.2 0 0 0 0 10.56 14.15 14.15 0 0 0 7.87-2.47l6.64-4.87c1.86 3.76 2.93 8.07 2.93 12.63 0 11.12-9.08 20.18-20.25 20.18S3.75 34.62 3.75 23.5 12.83 3.38 24 3.38v6.12Z"/><path fill="#34a853" d="M43.55 22.55c-.03-.9-.1-1.8-.28-2.68H24v5.3h10.77a7.6 7.6 0 0 1-3.28 4.8l-7.15 5.18 3.67 1.44c5.28-3.9 8.55-10.87 8.55-18.69Z"/><path fill="#f9ab00" d="M10.34 13.96a13.52 13.52 0 0 0 0 16.92l1.53 1.53A18.5 18.5 0 0 1 9.2 24c0-2.35.52-4.6 1.46-6.64a14.05 14.05 0 0 0 3.68-5.4z"/><path fill="#ea4335" d="M24 41.5c3.15 0 6.08-.92 8.53-2.5l-3.44-2.82a13.55 13.55 0 0 1-4.02.77h-.14V24.15h.28a.86.86 0 0 1 .38.08L26.77 24.7l-3.88 2.87a18.38 18.38 0 0 1-8.55 1.41 13.85 13.85 0 0 0 10.53 13.37Z"/>
             </svg>
             <span style={{ marginLeft: '10px', fontWeight: '500' }}>Sign in with Google</span>
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
