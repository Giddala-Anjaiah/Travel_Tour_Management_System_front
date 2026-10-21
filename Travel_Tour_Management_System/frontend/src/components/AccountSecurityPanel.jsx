import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Lock,
  Shield,
  Monitor,
  Smartphone,
  LogOut,
  Trash2,
  Check,
  Loader,
  KeyRound
} from 'lucide-react'
import { api } from '../api'
import './AccountSecurityPanel.css'

const PASSWORD_RULES = [
  { label: 'At least 8 characters', test: value => value.length >= 8 },
  { label: 'An uppercase letter', test: value => /[A-Z]/.test(value) },
  { label: 'A lowercase letter', test: value => /[a-z]/.test(value) },
  { label: 'A number', test: value => /\d/.test(value) }
]

function strengthOf(value) {
  if (!value) return { score: 0, label: 'Empty' }
  const passed = PASSWORD_RULES.filter(rule => rule.test(value)).length
  if (passed <= 1) return { score: 1, label: 'Weak' }
  if (passed === 2) return { score: 2, label: 'Fair' }
  if (passed === 3) return { score: 3, label: 'Good' }
  return { score: 4, label: 'Strong' }
}

// Account security panel: change password, review the devices signed in to the
// account and sign them out. Shared by the customer, operator and hotel
// dashboards.
const AccountSecurityPanel = ({ basePath = '/customer', onSignedOut }) => {
  const navigate = useNavigate()
  const [sessions, setSessions] = useState([])
  const [loadingSessions, setLoadingSessions] = useState(true)
  const [sessionError, setSessionError] = useState('')
  const [busySessionId, setBusySessionId] = useState('')
  const [revokingOthers, setRevokingOthers] = useState(false)

  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  })
  const [passwordError, setPasswordError] = useState('')
  const [passwordSuccess, setPasswordSuccess] = useState('')
  const [changingPassword, setChangingPassword] = useState(false)

  const loadSessions = useCallback(async () => {
    try {
      const data = await api(`${basePath}/account/sessions`)
      setSessions(data.sessions || [])
      setSessionError('')
    } catch (err) {
      setSessionError(err.message || 'Could not load active sessions')
    } finally {
      setLoadingSessions(false)
    }
  }, [basePath])

  useEffect(() => {
    Promise.resolve().then(() => loadSessions())
  }, [loadSessions])

  const strength = strengthOf(passwordForm.newPassword)
  const canSubmitPassword =
    passwordForm.currentPassword &&
    passwordForm.newPassword &&
    passwordForm.confirmPassword &&
    passwordForm.newPassword === passwordForm.confirmPassword &&
    strength.score === PASSWORD_RULES.length

  const changePassword = async (event) => {
    event.preventDefault()
    setPasswordError('')
    setPasswordSuccess('')

    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setPasswordError('New password and confirmation do not match')
      return
    }
    if (strength.score !== PASSWORD_RULES.length) {
      setPasswordError('Password does not meet all the requirements below')
      return
    }

    setChangingPassword(true)
    try {
      const data = await api(`${basePath}/account/password`, {
        method: 'POST',
        body: JSON.stringify({
          currentPassword: passwordForm.currentPassword,
          newPassword: passwordForm.newPassword,
          confirmPassword: passwordForm.confirmPassword
        })
      })
      setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' })
      setPasswordSuccess(
        data.revokedSessions
          ? `Password changed. ${data.revokedSessions} other session(s) were signed out.`
          : 'Password changed successfully.'
      )
      loadSessions()
    } catch (err) {
      setPasswordError(err.message || 'Could not change your password')
    } finally {
      setChangingPassword(false)
    }
  }

  const revokeSession = async (session) => {
    setBusySessionId(session.id)
    setSessionError('')
    try {
      await api(`${basePath}/account/sessions/${session.id}`, { method: 'DELETE' })
      setSessions(prev => prev.filter(item => item.id !== session.id))
    } catch (err) {
      setSessionError(err.message || 'Could not sign out that device')
    } finally {
      setBusySessionId('')
    }
  }

  const revokeOtherSessions = async () => {
    setRevokingOthers(true)
    setSessionError('')
    try {
      const data = await api(`${basePath}/account/sessions/revoke-others`, { method: 'POST' })
      await loadSessions()
      setSessionError('')
      if (!data.revokedSessions) {
        setSessionError('No other sessions were active.')
      }
    } catch (err) {
      setSessionError(err.message || 'Could not sign out other devices')
    } finally {
      setRevokingOthers(false)
    }
  }

  const signOut = async () => {
    try {
      await api(`${basePath}/account/logout`, { method: 'POST' })
    } catch {
      // Signing out locally matters more than the server acknowledging it.
    }
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    if (onSignedOut) {
      onSignedOut()
    }
    navigate('/login')
  }

  const otherSessions = sessions.filter(session => !session.current)

  return (
    <div className="account-security">
      <div className="account-security-card">
        <div className="account-security-head">
          <span className="account-security-icon"><KeyRound className="h-4 w-4" /></span>
          <div>
            <h3>Change password</h3>
            <p>Your password signs you in everywhere. Use a strong, unique password.</p>
          </div>
        </div>

        {passwordError && <div className="account-security-error">{passwordError}</div>}
        {passwordSuccess && <div className="account-security-success">{passwordSuccess}</div>}

        <form className="account-security-form" onSubmit={changePassword}>
          <label>
            <span>Current password</span>
            <input
              type="password"
              value={passwordForm.currentPassword}
              onChange={e => setPasswordForm(prev => ({ ...prev, currentPassword: e.target.value }))}
              placeholder="Your current password"
              autoComplete="current-password"
            />
          </label>
          <label>
            <span>New password</span>
            <input
              type="password"
              value={passwordForm.newPassword}
              onChange={e => setPasswordForm(prev => ({ ...prev, newPassword: e.target.value }))}
              placeholder="Choose a new password"
              autoComplete="new-password"
            />
          </label>
          <label>
            <span>Confirm new password</span>
            <input
              type="password"
              value={passwordForm.confirmPassword}
              onChange={e => setPasswordForm(prev => ({ ...prev, confirmPassword: e.target.value }))}
              placeholder="Repeat the new password"
              autoComplete="new-password"
            />
          </label>

          <div className="account-security-strength">
            <div className="account-security-strength-bar">
              {[1, 2, 3, 4].map(level => (
                <span
                  key={level}
                  className={`account-security-strength-step ${strength.score >= level ? `filled level-${strength.score}` : ''}`}
                />
              ))}
            </div>
            <span className={`account-security-strength-label score-${strength.score}`}>{strength.label}</span>
          </div>

          <ul className="account-security-rules">
            {PASSWORD_RULES.map(rule => {
              const passed = rule.test(passwordForm.newPassword)
              return (
                <li key={rule.label} className={passed ? 'passed' : ''}>
                  {passed ? <Check className="h-3 w-3" /> : <span className="rule-dot" />}
                  {rule.label}
                </li>
              )
            })}
          </ul>

          <button type="submit" className="btn-primary enhanced" disabled={!canSubmitPassword || changingPassword}>
            {changingPassword ? <Loader className="h-4 w-4" /> : <Lock className="h-4 w-4" />}
            {changingPassword ? 'Updating...' : 'Update password'}
          </button>
        </form>
      </div>

      <div className="account-security-card">
        <div className="account-security-head">
          <span className="account-security-icon"><Shield className="h-4 w-4" /></span>
          <div>
            <h3>Active sessions</h3>
            <p>Devices currently signed in to your account. Sign out anything you do not recognise.</p>
          </div>
        </div>

        {sessionError && <div className="account-security-error">{sessionError}</div>}

        {loadingSessions ? (
          <div className="account-security-empty"><Loader className="h-4 w-4" /> Loading sessions...</div>
        ) : sessions.length === 0 ? (
          <div className="account-security-empty"><Shield className="h-4 w-4" /> No active sessions found.</div>
        ) : (
          <div className="session-list">
            {sessions.map(session => {
              const DeviceIcon = session.type === 'mobile' ? Smartphone : Monitor
              return (
                <div key={session.id} className={`session-item ${session.current ? 'current' : ''}`}>
                  <span className="session-icon"><DeviceIcon className="h-4 w-4" /></span>
                  <div className="session-info">
                    <div className="session-title">
                      <strong>{session.device}</strong>
                      {session.current && <span className="session-current-badge">This device</span>}
                    </div>
                    <div className="session-meta">
                      <span>IP {session.ip}</span>
                      <span>Signed in {new Date(session.createdAt).toLocaleString()}</span>
                      <span>Last active {new Date(session.lastSeenAt).toLocaleString()}</span>
                    </div>
                  </div>
                  {!session.current && (
                    <button
                      type="button"
                      className="icon-btn delete"
                      onClick={() => revokeSession(session)}
                      disabled={busySessionId === session.id}
                      title="Sign out this device"
                    >
                      {busySessionId === session.id
                        ? <Loader className="h-4 w-4" />
                        : <Trash2 className="h-4 w-4" />}
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        )}

        <div className="account-security-footer">
          <button
            type="button"
            className="btn-secondary enhanced"
            onClick={revokeOtherSessions}
            disabled={revokingOthers || otherSessions.length === 0}
          >
            {revokingOthers ? <Loader className="h-4 w-4" /> : <LogOut className="h-4 w-4" />}
            {otherSessions.length > 0
              ? `Sign out ${otherSessions.length} other device${otherSessions.length === 1 ? '' : 's'}`
              : 'No other devices signed in'}
          </button>
          <button type="button" className="btn-secondary enhanced danger" onClick={signOut}>
            <LogOut className="h-4 w-4" /> Sign out of this device
          </button>
        </div>
      </div>
    </div>
  )
}

export default AccountSecurityPanel
