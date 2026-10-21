import { useState, useEffect } from 'react'
import { User, Mail, Save, Camera, Sparkles, Award, CheckCircle, Shield, Phone, MapPin } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import CustomerLayout from './CustomerLayout'
import AccountSecurityPanel from '../../components/AccountSecurityPanel'
import { api } from '../../api'
import '../Dashboard.css'

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/
const PHONE_PATTERN = /^[+]?[\d][\d\s-]{7,19}$/

const emptyProfile = {
  fullName: '',
  email: '',
  phone: '',
  alternatePhone: '',
  address: '',
  avatar: ''
}

const ProfileManagement = () => {
  const navigate = useNavigate()
  const [isEditing, setIsEditing] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [messageType, setMessageType] = useState('info')
  const [profileData, setProfileData] = useState(emptyProfile)

  const notify = (text, type = 'info') => {
    setMessage(text)
    setMessageType(type)
  }

  useEffect(() => {
    const load = async () => {
      try {
        const data = await api('/customer/profile')
        const p = data.profile || {}
        setProfileData({
          fullName: p.fullName || '',
          email: p.email || '',
          phone: p.phone || '',
          alternatePhone: p.alternatePhone || '',
          address: p.address || '',
          avatar: p.avatar || ''
        })
      } catch (err) {
        notify(err.message || 'Failed to load profile', 'warning')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const validate = () => {
    if (!profileData.fullName.trim()) return 'Full name is required'
    if (!EMAIL_PATTERN.test(profileData.email.trim())) return 'Enter a valid email address'
    if (!PHONE_PATTERN.test(profileData.phone.trim())) return 'Enter a valid phone number'
    if (profileData.alternatePhone && !PHONE_PATTERN.test(profileData.alternatePhone.trim())) {
      return 'Enter a valid alternate phone number'
    }
    return null
  }

  const handleSave = async (e) => {
    e.preventDefault()
    const validationError = validate()
    if (validationError) {
      notify(validationError, 'warning')
      return
    }

    setSaving(true)
    setMessage('')
    try {
      const previousEmail = JSON.parse(localStorage.getItem('user') || '{}').email
      const data = await api('/customer/profile', {
        method: 'PUT',
        body: JSON.stringify({
          fullName: profileData.fullName.trim(),
          email: profileData.email.trim(),
          phone: profileData.phone.trim(),
          alternatePhone: profileData.alternatePhone.trim(),
          address: profileData.address.trim(),
          avatar: profileData.avatar || ''
        })
      })
      const updated = data.profile || {}
      setProfileData(prev => ({
        ...prev,
        fullName: updated.fullName || prev.fullName,
        email: updated.email || prev.email,
        phone: updated.phone || prev.phone,
        alternatePhone: updated.alternatePhone || '',
        address: updated.address || '',
        avatar: updated.avatar || ''
      }))

      const stored = JSON.parse(localStorage.getItem('user') || '{}')
      stored.fullName = updated.fullName || stored.fullName
      stored.email = updated.email || stored.email
      stored.phone = updated.phone || stored.phone
      localStorage.setItem('user', JSON.stringify(stored))

      setIsEditing(false)
      if (previousEmail && updated.email && previousEmail !== updated.email) {
        notify('Profile updated. Your other devices have been signed out.', 'info')
      } else {
        notify('Profile updated successfully!', 'info')
      }
    } catch (err) {
      notify(err.message || 'Failed to update profile', 'warning')
    } finally {
      setSaving(false)
    }
  }

  const handleAvatarUpload = (event) => {
    const file = event.target.files?.[0]
    if (!file) return
    if (file.size > 1024 * 512) {
      notify('Pick an image smaller than 500 KB', 'warning')
      return
    }
    const reader = new FileReader()
    reader.onload = () => {
      setProfileData(prev => ({ ...prev, avatar: String(reader.result) }))
      notify('Avatar selected. Save your profile to apply it.', 'info')
    }
    reader.readAsDataURL(file)
  }

  const getInitials = (name) => {
    return String(name || 'U')
      .split(' ')
      .filter(Boolean)
      .map(n => n[0])
      .slice(0, 2)
      .join('')
      .toUpperCase()
  }

  return (
    <CustomerLayout active="profile">
      {loading && <div className="cd-skeleton-grid"><div className="cd-skeleton-card" /><div className="cd-skeleton-card" /></div>}

      <div className="page-head">
        <div className="page-head-row">
          <div>
            <h1>Profile Management</h1>
            <p>Manage your contact details, password and signed-in devices</p>
          </div>
          <div className="page-status-badges">
            <div className="stat-badge">
              <Sparkles className="h-4 w-4" />
              <span>Verified Account</span>
            </div>
            <div className="stat-badge">
              <Shield className="h-4 w-4" />
              <span>Secure Profile</span>
            </div>
          </div>
        </div>
      </div>

      {message && (
        <div
          className={`cd-card ${messageType === 'warning' ? 'cd-alert warning' : 'cd-alert info'}`}
          style={{ marginBottom: '1rem' }}
        >
          {message}
        </div>
      )}

      <div className="profile-section enhanced">
        <div className="profile-header enhanced">
          <div className="profile-avatar enhanced">
            <div className="avatar-circle" style={{ background: 'var(--cp-accent)' }}>
              {profileData.avatar
                ? <img src={profileData.avatar} alt="" className="avatar-image" />
                : <span className="avatar-initials">{getInitials(profileData.fullName)}</span>}
            </div>
            <label className="avatar-upload-btn" style={{ background: 'var(--cp-card)', borderColor: 'var(--cp-line)' }}>
              <Camera className="h-4 w-4" />
              <input
                type="file"
                accept="image/*"
                hidden
                onChange={handleAvatarUpload}
                disabled={!isEditing}
              />
            </label>
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
            onClick={() => {
              setIsEditing(!isEditing)
              setMessage('')
            }}
            className={`btn-primary enhanced ${isEditing ? 'cancel' : ''}`}
            disabled={saving}
            style={{ '--accent': isEditing ? 'var(--cp-danger)' : 'var(--cp-accent)' }}
          >
            {isEditing ? 'Cancel' : <><Save className="h-4 w-4" /> Edit Profile</>}
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
                  onChange={(e) => setProfileData({ ...profileData, fullName: e.target.value })}
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
                  onChange={(e) => setProfileData({ ...profileData, email: e.target.value })}
                  disabled={!isEditing}
                  placeholder="Enter your email"
                  style={{ background: 'var(--cp-surface)', borderColor: 'var(--cp-line)', color: 'var(--cp-ink)' }}
                />
                {isEditing && (
                  <small style={{ color: 'var(--cp-muted)' }}>
                    <Mail className="h-3 w-3" /> Changing this signs out your other devices
                  </small>
                )}
              </div>
            </div>
            <div className="form-row enhanced">
              <div className="form-group enhanced">
                <label style={{ color: 'var(--cp-ink)' }}>Phone Number</label>
                <input
                  type="tel"
                  value={profileData.phone}
                  onChange={(e) => setProfileData({ ...profileData, phone: e.target.value })}
                  disabled={!isEditing}
                  placeholder="Enter your phone number"
                  style={{ background: 'var(--cp-surface)', borderColor: 'var(--cp-line)', color: 'var(--cp-ink)' }}
                />
              </div>
              <div className="form-group enhanced">
                <label style={{ color: 'var(--cp-ink)' }}>Alternate Phone</label>
                <input
                  type="tel"
                  value={profileData.alternatePhone}
                  onChange={(e) => setProfileData({ ...profileData, alternatePhone: e.target.value })}
                  disabled={!isEditing}
                  placeholder="Optional second number"
                  style={{ background: 'var(--cp-surface)', borderColor: 'var(--cp-line)', color: 'var(--cp-ink)' }}
                />
                {isEditing && (
                  <small style={{ color: 'var(--cp-muted)' }}>
                    <Phone className="h-3 w-3" /> Used only for urgent trip updates
                  </small>
                )}
              </div>
            </div>
            <div className="form-row enhanced">
              <div className="form-group enhanced">
                <label style={{ color: 'var(--cp-ink)' }}>Address</label>
                <input
                  type="text"
                  value={profileData.address}
                  onChange={(e) => setProfileData({ ...profileData, address: e.target.value })}
                  disabled={!isEditing}
                  placeholder="Optional mailing address"
                  style={{ background: 'var(--cp-surface)', borderColor: 'var(--cp-line)', color: 'var(--cp-ink)' }}
                />
                {isEditing && (
                  <small style={{ color: 'var(--cp-muted)' }}>
                    <MapPin className="h-3 w-3" /> Used for invoices and pickup paperwork
                  </small>
                )}
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
      </div>

      <AccountSecurityPanel basePath="/customer" onSignedOut={() => navigate('/login')} />
    </CustomerLayout>
  )
}

export default ProfileManagement
