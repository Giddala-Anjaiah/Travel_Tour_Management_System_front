import { API_BASE } from './api'
import { Plane, User, Mail, Phone, Lock, Shield } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useState } from 'react'
import './Auth.css'

const Signup = () => {
  const [selectedRole, setSelectedRole] = useState('customer')
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const roles = [
    { value: 'customer', label: 'Customer', icon: User, color: 'customer' },
    { value: 'tour_operator', label: 'Tour Operator', icon: Shield, color: 'tour_operator' },
    { value: 'hotel_partner', label: 'Hotel Partner', icon: Shield, color: 'hotel_partner' },
    { value: 'admin', label: 'Admin', icon: Shield, color: 'admin' }
  ]

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

  return (
    <div className="auth-page">
      <div className="auth-content">
        <div className="auth-card">
          <div className="auth-header">
            <div className="logo-icon">
              <Plane className="h-8 w-8 text-white" />
            </div>
            <h2>Create Account</h2>
            <p>Start your journey with us</p>
          </div>

          {error && <div className="error-message">{error}</div>}
          {success && <div className="success-message">{success}</div>}

          <form className="auth-form" onSubmit={handleSubmit}>
            <div className="form-group">
              <label>Select Your Role</label>
              <div className="role-cards">
                {roles.map((role) => {
                  const Icon = role.icon
                  return (
                    <div
                      key={role.value}
                      className={`role-card ${selectedRole === role.value ? 'selected' : ''}`}
                      onClick={() => setSelectedRole(role.value)}
                    >
                      <div className={`role-icon ${role.color}`}>
                        <Icon className="h-5 w-5 text-white" />
                      </div>
                      <span className="role-label">{role.label}</span>
                    </div>
                  )
                })}
              </div>
            </div>
            <div className="form-group">
              <label>Full Name</label>
              <div className="input-with-icon">
                <User className="h-5 w-5" />
                <input
                  type="text"
                  placeholder="John Doe"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  required
                />
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
              <label>Phone Number</label>
              <div className="input-with-icon">
                <Phone className="h-5 w-5" />
                <input
                  type="tel"
                  placeholder="+91 9876543210"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
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
                  minLength={6}
                />
              </div>
            </div>
            <div className="form-group">
              <label>Confirm Password</label>
              <div className="input-with-icon">
                <Lock className="h-5 w-5" />
                <input
                  type="password"
                  placeholder="••••••••"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  minLength={6}
                />
              </div>
            </div>
            <label className="checkbox-label">
              <input type="checkbox" required />
              <span>I agree to the Terms of Service and Privacy Policy</span>
            </label>
            <button type="submit" className="auth-btn">Create Account as {roles.find(r => r.value === selectedRole)?.label}</button>
          </form>
          <p className="auth-footer">
            Already have an account? <Link to="/login">Sign in</Link>
          </p>
          <div className="auth-back">
            <Link to="/">← Back to Home</Link>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Signup
