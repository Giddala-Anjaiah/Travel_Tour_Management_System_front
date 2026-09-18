import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { Plane, Mail, Shield, Eye, EyeOff } from 'lucide-react'
import { API_BASE } from './api'
import { showToast } from './components/toastEvents'
import './Auth.css'
import './ForgotPassword.css'

const ForgotPassword = () => {
  const navigate = useNavigate()

  const [step, setStep] = useState('email')
  const [email, setEmail] = useState('')
  const [otp, setOtp] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [loading, setLoading] = useState(false)

  const isOtpValid = otp.length === 6 && /^\d{6}$/.test(otp)
  const isPasswordValid = newPassword.length >= 6
  const isConfirmValid = confirmPassword === newPassword && isPasswordValid

  const handleSendOtp = async (e) => {
    e.preventDefault()
    setError('')
    setSuccess('')
    if (!email) {
      setError('Please enter your email address')
      return
    }
    setLoading(true)
    try {
      const res = await fetch(API_BASE + '/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      })
      const data = await res.json()
      if (res.ok) {
        setSuccess(data.message)
        showToast(data.message)
        setStep('otp')
      } else {
        // Server returns 500 when Brevo isn't configured — OTP is in the message for testing
        const otpMatch = data.message && data.message.match(/\d{6}/)
        if (otpMatch) {
          setSuccess(data.message + ' (use this OTP to proceed)')
          setOtp(otpMatch[0])
          showToast(data.message + ' (test OTP provided)', 'error')
          setStep('otp')
        } else {
          setError(data.message || 'Failed to send OTP')
          showToast(data.message || 'Failed to send OTP', 'error')
        }
      }
    } catch (err) {
      setError('Server error. Please try again.')
      showToast('Server error. Please try again.', 'error')
    } finally {
      setLoading(false)
    }
  }

  const handleVerifyOtp = async (e) => {
    e.preventDefault()
    setError('')
    setSuccess('')
    if (!isOtpValid) {
      setError('Please enter a valid 6-digit OTP')
      return
    }
    setLoading(true)
    try {
      const res = await fetch(API_BASE + '/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, otp })
      })
      const data = await res.json()
      if (res.ok) {
        setSuccess(data.message)
        showToast(data.message)
        setStep('reset')
      } else {
        setError(data.message || 'OTP verification failed')
        showToast(data.message || 'OTP verification failed', 'error')
      }
    } catch {
      setError('Server error. Please try again.')
      showToast('Server error. Please try again.', 'error')
    } finally {
      setLoading(false)
    }
  }

  const handleResetPassword = async (e) => {
    e.preventDefault()
    setError('')
    setSuccess('')
    if (!isPasswordValid) {
      setError('Password must be at least 6 characters')
      return
    }
    if (!isConfirmValid) {
      setError('Passwords do not match')
      return
    }
    setLoading(true)
    try {
      const res = await fetch(API_BASE + '/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, otp, newPassword })
      })
      const data = await res.json()
      if (res.ok) {
        showToast('Password reset successfully!')
        setTimeout(() => {
          navigate('/login')
        }, 1000)
      } else {
        setError(data.message || 'Password reset failed')
        showToast(data.message || 'Password reset failed', 'error')
      }
    } catch {
      setError('Server error. Please try again.')
      showToast('Server error. Please try again.', 'error')
    } finally {
      setLoading(false)
    }
  }

  const handleOtpChange = (e) => {
    const value = e.target.value.replace(/\D/g, '').slice(0, 6)
    setOtp(value)
  }

  const handleResend = () => {
    setStep('email')
    setOtp('')
    setSuccess('')
    setError('')
  }

  return (
    <div className="auth-page">
      <div className="auth-content">
        <div className="auth-card">
          <div className="auth-header">
            <Plane className="h-10 w-10" style={{ color: '#4f46e5' }} />
            <h2>Forgot Password</h2>
            <p>{step === 'email' ? 'Enter your email to receive an OTP' : step === 'otp' ? 'Enter the 6-digit OTP sent to your email' : 'Create a new password'}</p>
          </div>

          {error && <div className="error-message">{error}</div>}
          {success && <div className="success-message">{success}</div>}

          {step === 'email' && (
            <form className="auth-form" onSubmit={handleSendOtp}>
              <div className="form-group">
                <label>Email Address</label>
                <div className="input-with-icon">
                  <Mail className="h-5 w-5" />
                  <input
                    type="email"
                    placeholder="your@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    autoComplete="email"
                  />
                </div>
              </div>
              <button type="submit" className="auth-btn" disabled={loading}>
                {loading ? 'Sending...' : 'Send OTP'}
              </button>
            </form>
          )}

          {step === 'otp' && (
            <form className="auth-form" onSubmit={handleVerifyOtp}>
              <div className="form-group">
                <label>Enter 6-digit OTP</label>
                <div className="input-with-icon">
                  <Shield className="h-5 w-5" />
                  <input
                    type="text"
                    placeholder="123456"
                    value={otp}
                    onChange={handleOtpChange}
                    maxLength={6}
                    required
                  />
                </div>
              </div>
              <button type="submit" className="auth-btn" disabled={loading || !isOtpValid}>
                {loading ? 'Verifying...' : 'Verify OTP'}
              </button>
              <button type="button" className="auth-btn-secondary" onClick={handleResend}>
                Resend OTP
              </button>
            </form>
          )}

          {step === 'reset' && (
            <form className="auth-form" onSubmit={handleResetPassword}>
              <div className="form-group">
                <label>New Password</label>
                <div className="input-with-icon">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    placeholder="••••••••"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    required
                    minLength={6}
                    autoComplete="new-password"
                  />
                  <button
                    type="button"
                    className="password-toggle"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {!isPasswordValid && newPassword && (
                  <span className="input-help">Password must be at least 6 characters</span>
                )}
              </div>

              <div className="form-group">
                <label>Confirm Password</label>
                <div className="input-with-icon">
                  <input
                    type={showConfirm ? 'text' : 'password'}
                    placeholder="••••••••"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    autoComplete="new-password"
                  />
                  <button
                    type="button"
                    className="password-toggle"
                    onClick={() => setShowConfirm(!showConfirm)}
                  >
                    {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {!isPasswordValid && confirmPassword && (
                  <span className="input-help">Passwords do not match</span>
                )}
              </div>

              <button type="submit" className="auth-btn" disabled={loading || !isConfirmValid}>
                {loading ? 'Resetting...' : 'Reset Password'}
              </button>
            </form>
          )}

          <p className="auth-footer">
            Remember your password? <Link to="/login">Back to Login</Link>
          </p>
          <div className="auth-back">
            <Link to="/">← Back to Home</Link>
          </div>
        </div>
      </div>
    </div>
  )
}

export default ForgotPassword
