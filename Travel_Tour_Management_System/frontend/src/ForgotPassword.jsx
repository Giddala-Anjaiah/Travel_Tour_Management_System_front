import { Fragment, useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { Compass, Luggage, BedDouble, CalendarCheck, ShieldCheck, Mail, Lock, CheckCircle2 } from 'lucide-react'
import { API_BASE } from './api'
import { showToast } from './components/toastEvents'
import AuthLayout from './components/auth/AuthLayout'
import AuthField from './components/auth/AuthField'
import './Auth.css'

const RECOVERY_FEATURES = [
  { icon: Compass, title: 'Explore Destinations', text: 'Discover destinations and travel experiences.' },
  { icon: Luggage, title: 'Tour Packages', text: 'Browse curated tour packages for your next journey.' },
  { icon: BedDouble, title: 'Hotels & Availability', text: 'Find hotels and check room availability.' },
  { icon: CalendarCheck, title: 'Easy Booking Management', text: 'Manage your travel bookings in one place.' },
  { icon: ShieldCheck, title: 'Secure Account Recovery', text: 'Safely recover your account and continue your journey.' },
]

const STEPS = [
  { value: 'email', label: 'Email' },
  { value: 'otp', label: 'Verify OTP' },
  { value: 'reset', label: 'Reset Password' },
]

const ForgotPassword = () => {
  const navigate = useNavigate()

  const [step, setStep] = useState('email')
  const [email, setEmail] = useState('')
  const [otp, setOtp] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
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
        const otpMatch = data.message && data.message.match(/\d{6}/)
        if (otpMatch) {
          setOtp(otpMatch[0])
          showToast(data.message + ' (OTP auto-filled)', 'error')
        } else {
          showToast(data.message)
        }
        setSuccess(data.message)
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
    } catch {
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
        setSuccess(data.message || 'Your password has been updated successfully.')
        setStep('done')
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

  const activeIndex = STEPS.findIndex((item) => item.value === step)

  const stepIndicator = (
    <div className="auth-steps">
      {STEPS.map((item, index) => {
        const state = index === activeIndex ? 'active' : index < activeIndex ? 'done' : ''
        return (
          <Fragment key={item.value}>
            <div className={`auth-step ${state ? `auth-step--${state}` : ''}`.trim()}>
              <span className="auth-step-num">{index + 1}</span>
              <span className="auth-step-label">{item.label}</span>
            </div>
            {index < STEPS.length - 1 ? (
              <span
                className={`auth-step-line ${index < activeIndex ? 'auth-step-line--done' : ''}`.trim()}
              />
            ) : null}
          </Fragment>
        )
      })}
    </div>
  )

  const cardCopy = {
    email: { title: 'Forgot Password', sub: 'Enter your email address to receive an OTP code.' },
    otp: { title: 'Verify OTP', sub: "We've sent a verification code to your registered email." },
    reset: { title: 'Create New Password', sub: 'Enter your new password below.' },
    done: { title: 'Password Reset Successfully', sub: 'Your password has been updated successfully.' },
  }[step]

  return (
    <AuthLayout
      badge="Password Recovery"
      headingBefore="Forgot your"
      heading="Password?"
      description="Don't worry! Enter your registered email address and we'll send you a One-Time Password (OTP) to reset it."
      features={RECOVERY_FEATURES}
      backLabel="Back to Login"
      backTo="/login"
    >
      {error && <div className="auth-alert auth-alert-error">{error}</div>}
      {success && step !== 'done' && <div className="auth-alert auth-alert-success">{success}</div>}

      {step === 'done' ? (
        <div className="auth-success">
          <span className="auth-success-icon">
            <CheckCircle2 className="h-8 w-8" aria-hidden="true" />
          </span>
          <h2 className="auth-success-title">{cardCopy.title}</h2>
          <p className="auth-success-text">{success || cardCopy.sub}</p>
          <button type="button" className="auth-submit" onClick={() => navigate('/login')}>
            Back to Login
          </button>
        </div>
      ) : (
        <>
          <h2 className="auth-card-title">{cardCopy.title}</h2>
          <p className="auth-card-sub">{cardCopy.sub}</p>

          {stepIndicator}

          {step === 'email' && (
            <form className="auth-form" onSubmit={handleSendOtp}>
              <AuthField
                id="forgot-email"
                label="Email Address"
                icon={Mail}
                type="email"
                placeholder="Enter your registered email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
              />
              <button type="submit" className="auth-submit" disabled={loading}>
                {loading ? 'Sending...' : 'Send OTP'}
              </button>
            </form>
          )}

          {step === 'otp' && (
            <form className="auth-form" onSubmit={handleVerifyOtp}>
              <AuthField
                id="forgot-otp"
                label="OTP"
                icon={ShieldCheck}
                type="text"
                className="auth-otp"
                placeholder="000000"
                value={otp}
                onChange={handleOtpChange}
                hint={email ? `Code sent to ${email}` : ''}
                autoComplete="one-time-code"
              />
              <button type="submit" className="auth-submit" disabled={loading || !isOtpValid}>
                {loading ? 'Verifying...' : 'Verify OTP'}
              </button>
              <button type="button" className="auth-submit-secondary" onClick={handleResend}>
                Resend OTP
              </button>
            </form>
          )}

          {step === 'reset' && (
            <form className="auth-form" onSubmit={handleResetPassword}>
              <AuthField
                id="forgot-new-password"
                label="New Password"
                icon={Lock}
                type="password"
                placeholder="Enter new password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                autoComplete="new-password"
                minLength={6}
                hint={!isPasswordValid && newPassword ? 'Password must be at least 6 characters' : ''}
                hintTone="error"
              />

              <AuthField
                id="forgot-confirm-password"
                label="Confirm Password"
                icon={Lock}
                type="password"
                placeholder="Confirm new password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                autoComplete="new-password"
                hint={confirmPassword && !isConfirmValid ? 'Passwords do not match' : ''}
                hintTone="error"
              />

              <button type="submit" className="auth-submit" disabled={loading || !isConfirmValid}>
                {loading ? 'Resetting...' : 'Reset Password'}
              </button>
            </form>
          )}
        </>
      )}

      <p className="auth-card-foot">
        {step === 'otp' ? "Didn't receive the code? " : 'Remember your password? '}
        {step === 'otp' ? (
          <button type="button" className="auth-link" onClick={handleResend}>
            Resend OTP
          </button>
        ) : (
          <Link to="/login" className="auth-link">
            Return to Sign In
          </Link>
        )}
      </p>
    </AuthLayout>
  )
}

export default ForgotPassword
