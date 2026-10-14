import { useState, useEffect } from 'react'
import { User, Mail, Save, Camera, Sparkles, Award, CheckCircle, Lock, Shield, Calendar as CalendarIcon, LogOut, Phone } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import CustomerLayout from './CustomerLayout'
import { api } from '../../api'
import '../Dashboard.css'

const ProfileManagement = () => {
  const navigate = useNavigate()
  const [isEditing, setIsEditing] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [profileData, setProfileData] = useState({
    fullName: '',
    email: '',
    phone: ''
  })

  const handleLogout = () => {
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    navigate('/login')
  }

  useEffect(() => {
    const load = async () => {
      try {
        const data = await api('/customer/profile')
        const p = data.profile || {}
        setProfileData({
          fullName: p.fullName || '',
          email: p.email || '',
          phone: p.phone || ''
        })
      } catch (err) {
        setMessage(err.message || 'Failed to load profile')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const handleSave = async (e) => {
    e.preventDefault()
    setSaving(true)
    setMessage('')
    try {
      const data = await api('/customer/profile', {
        method: 'PUT',
        body: JSON.stringify(profileData)
      })
      const updated = data.profile || {}
      setProfileData({
        fullName: updated.fullName || profileData.fullName,
        email: updated.email || profileData.email,
        phone: updated.phone || profileData.phone
      })
      const stored = JSON.parse(localStorage.getItem('user') || '{}')
      stored.fullName = updated.fullName || stored.fullName
      stored.email = updated.email || stored.email
      stored.phone = updated.phone || stored.phone
      localStorage.setItem('user', JSON.stringify(stored))
      setIsEditing(false)
      setMessage('Profile updated successfully!')
      setTimeout(() => setMessage(''), 3000)
    } catch (err) {
      setMessage(err.message || 'Failed to update profile')
    } finally {
      setSaving(false)
    }
  }

  const getInitials = (name) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase()
  }

  return (
    <CustomerLayout
      active="profile"
      title="Profile Management"
      subtitle="Manage your personal information and preferences"
      actions={
        <div className="header-stats">
          <div className="stat-badge">
            <Sparkles className="h-4 w-4" />
            <span>Verified Account</span>
          </div>
          <div className="stat-badge">
            <Shield className="h-4 w-4" />
            <span>Secure Profile</span>
          </div>
        </div>
      }
    >
      {loading && <div className="cd-skeleton-grid"><div className="cd-skeleton-card" /><div className="cd-skeleton-card" /></div>}

      {message && <div className={`cd-card ${message.includes('success') ? 'cd-alert info' : 'cd-alert warning'}`} style={{ marginBottom: '1rem' }}>{message}</div>}

      <div className="profile-section enhanced">
        <div className="profile-header enhanced">
          <div className="profile-avatar enhanced">
            <div className="avatar-circle" style={{ background: 'var(--cp-accent)' }}>
              <span className="avatar-initials">{getInitials(profileData.fullName || 'U')}</span>
            </div>
            <button className="avatar-upload-btn" style={{ background: 'var(--cp-card)', borderColor: 'var(--cp-line)' }}>
              <Camera className="h-4 w-4" />
            </button>
          </div>
          <div className="profile-info enhanced">
            <h2 style={{ color: 'var(--cp-ink)' }}>{profileData.fullName || 'Customer'}</h2>
            <p className="profile-email" style={{ color: 'var(--cp-muted)' }}>{profileData.email}</p>
            <div className="profile-badges">
              <span className="profile-badge" style={{ background: 'rgba(16, 185, 129, 0.1)', color: 'var(--cp-success)', borderColor: 'rgba(16, 185, 129, 0.3)' }}>
                <CheckCircle className="h-3 w-3" />
                Email Verified
              </span>
              <span className="profile-badge" style={{ background: 'rgba(196, 163, 90, 0.1)', color: 'var(--cp-gold)', borderColor: 'rgba(196, 163, 90, 0.3)' }}>
                <Award className="h-3 w-3" />
                Premium Member
              </span>
            </div>
          </div>
          <button
            onClick={() => setIsEditing(!isEditing)}
            className={`btn-primary enhanced ${isEditing ? 'cancel' : ''}`}
            disabled={saving}
            style={{ '--accent': isEditing ? 'var(--cp-danger)' : 'var(--cp-accent)' }}
          >
            {isEditing ? <><Lock className="h-4 w-4" /> Cancel</> : <><Save className="h-4 w-4" /> Edit Profile</>}
          </button>
        </div>

        <form className="profile-form enhanced" onSubmit={handleSave}>
          <div className="form-section enhanced" style={{ background: 'var(--cp-card)', borderColor: 'var(--cp-line)' }}>
            <div className="section-header">
              <User className="section-icon" style={{ background: 'var(--cp-accent)' }} />
              <h3 style={{ color: 'var(--cp-ink)' }}>Personal Information</h3>
            </div>
            <div className="form-row enhanced">
              <div className="form-group enhanced">
                <label style={{ color: 'var(--cp-ink)' }}>Full Name</label>
                <input
                  type="text"
                  value={profileData.fullName}
                  onChange={(e) => setProfileData({...profileData, fullName: e.target.value})}
                  disabled={!isEditing}
                  placeholder="Enter your full name"
                  style={{ background: 'var(--cp-surface)', borderColor: 'var(--cp-line)', color: 'var(--cp-ink)' }}
                />
              </div>
              <div className="form-group enhanced">
                <label style={{ color: 'var(--cp-ink)' }}>Email Address</label>
                <input
                  type="email"
                  value={profileData.email}
                  onChange={(e) => setProfileData({...profileData, email: e.target.value})}
                  disabled={!isEditing}
                  placeholder="Enter your email"
                  style={{ background: 'var(--cp-surface)', borderColor: 'var(--cp-line)', color: 'var(--cp-ink)' }}
                />
              </div>
            </div>
            <div className="form-row enhanced">
              <div className="form-group enhanced">
                <label style={{ color: 'var(--cp-ink)' }}>Phone Number</label>
                <input
                  type="tel"
                  value={profileData.phone}
                  onChange={(e) => setProfileData({...profileData, phone: e.target.value})}
                  disabled={!isEditing}
                  placeholder="Enter your phone number"
                  style={{ background: 'var(--cp-surface)', borderColor: 'var(--cp-line)', color: 'var(--cp-ink)' }}
                />
              </div>
            </div>
          </div>

          {isEditing && (
            <div className="form-actions enhanced">
              <button type="button" onClick={() => setIsEditing(false)} className="btn-secondary enhanced" disabled={saving}>
                Cancel Changes
              </button>
              <button type="submit" className="btn-primary enhanced" disabled={saving}>
                <Save className="h-4 w-4" /> {saving ? 'Saving...' : 'Save Profile'}
              </button>
            </div>
          )}
        </form>

        <div className="profile-security-section enhanced">
          <div className="section-header">
            <Shield className="section-icon" style={{ background: 'var(--cp-purple)' }} />
            <h3 style={{ color: 'var(--cp-ink)' }}>Security Settings</h3>
          </div>
          <div className="security-actions">
            <button className="security-btn enhanced" onClick={() => alert('Change password feature coming soon')} style={{ background: 'var(--cp-card)', borderColor: 'var(--cp-line)' }}>
              <Lock className="h-4 w-4" style={{ color: 'var(--cp-accent)' }} />
              <div>
                <strong style={{ color: 'var(--cp-ink)' }}>Change Password</strong>
                <small style={{ color: 'var(--cp-muted)' }}>Update your password regularly</small>
              </div>
            </button>
            <button className="security-btn enhanced" onClick={() => alert('2FA feature coming soon')} style={{ background: 'var(--cp-card)', borderColor: 'var(--cp-line)' }}>
              <Shield className="h-4 w-4" style={{ color: 'var(--cp-purple)' }} />
              <div>
                <strong style={{ color: 'var(--cp-ink)' }}>Two-Factor Authentication</strong>
                <small style={{ color: 'var(--cp-muted)' }}>Add an extra layer of security</small>
              </div>
            </button>
          </div>
        </div>
      </div>
    </CustomerLayout>
  )
}

export default ProfileManagement