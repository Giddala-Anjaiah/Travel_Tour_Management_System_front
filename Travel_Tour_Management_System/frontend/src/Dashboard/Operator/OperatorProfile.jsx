import { useState, useEffect } from 'react'
import { User, Mail, Save, Camera, CheckCircle, Shield, Phone, MapPin, Building } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import OperatorLayout from './OperatorLayout'
import AccountSecurityPanel from '../../components/AccountSecurityPanel'
import { api, API_BASE, API_HOST } from '../../api'
import '../Dashboard.css'

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/
const PHONE_PATTERN = /^[+]?[\d][\d\s-]{7,19}$/

const emptyProfile = {
  fullName: '',
  email: '',
  phone: '',
  alternatePhone: '',
  companyName: '',
  logo: '',
  businessAddress: '',
  city: '',
  state: '',
  country: '',
  postalCode: '',
  website: '',
  description: '',
  businessRegNumber: '',
  licenseNumber: '',
  taxId: ''
}

const OperatorProfile = () => {
  const navigate = useNavigate()
  const [isEditing, setIsEditing] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [removeConfirm, setRemoveConfirm] = useState(false)
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
        const data = await api('/operator/profile')
        const p = data.profile || {}
        setProfileData({
          fullName: p.fullName || '',
          email: p.email || '',
          phone: p.phone || '',
          alternatePhone: p.alternatePhone || '',
          companyName: p.companyName || '',
          logo: p.logo || '',
          businessAddress: p.businessAddress || '',
          city: p.city || '',
          state: p.state || '',
          country: p.country || '',
          postalCode: p.postalCode || '',
          website: p.website || '',
          description: p.description || '',
          businessRegNumber: p.businessRegNumber || '',
          licenseNumber: p.licenseNumber || '',
          taxId: p.taxId || ''
        })

        const stored = JSON.parse(localStorage.getItem('user') || '{}')
        stored.avatar = p.logo || ''
        localStorage.setItem('user', JSON.stringify(stored))
        window.dispatchEvent(new Event('user-updated'))
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
      const data = await api('/operator/profile', {
        method: 'PUT',
        body: JSON.stringify({
          fullName: profileData.fullName.trim(),
          email: profileData.email.trim(),
          phone: profileData.phone.trim(),
          alternatePhone: profileData.alternatePhone.trim(),
          companyName: profileData.companyName.trim(),
          businessAddress: profileData.businessAddress.trim(),
          city: profileData.city.trim(),
          state: profileData.state.trim(),
          country: profileData.country.trim(),
          postalCode: profileData.postalCode.trim(),
          website: profileData.website.trim(),
          description: profileData.description.trim(),
          businessRegNumber: profileData.businessRegNumber.trim(),
          licenseNumber: profileData.licenseNumber.trim(),
          taxId: profileData.taxId.trim(),
          logo: profileData.logo || ''
        })
      })
      const updated = data.profile || {}
      setProfileData(prev => ({
        ...prev,
        fullName: updated.fullName || prev.fullName,
        email: updated.email || prev.email,
        phone: updated.phone || prev.phone,
        alternatePhone: updated.alternatePhone || prev.alternatePhone,
        companyName: updated.companyName || prev.companyName,
        businessAddress: updated.businessAddress || prev.businessAddress,
        city: updated.city || prev.city,
        state: updated.state || prev.state,
        country: updated.country || prev.country,
        postalCode: updated.postalCode || prev.postalCode,
        website: updated.website || prev.website,
        description: updated.description || prev.description,
        businessRegNumber: updated.businessRegNumber || prev.businessRegNumber,
        licenseNumber: updated.licenseNumber || prev.licenseNumber,
        taxId: updated.taxId || prev.taxId,
        logo: updated.logo || prev.logo
      }))

      const stored = JSON.parse(localStorage.getItem('user') || '{}')
      stored.fullName = updated.fullName || stored.fullName
      stored.email = updated.email || stored.email
      stored.phone = updated.phone || stored.phone
      stored.avatar = updated.logo || stored.avatar
      localStorage.setItem('user', JSON.stringify(stored))
      window.dispatchEvent(new Event('user-updated'))

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

  const MAX_FILE_SIZE = 5 * 1024 * 1024 // 5 MB
  const ALLOWED_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp']

  const handleImageSelect = (event) => {
    const file = event.target.files?.[0]
    if (!file) return

    if (!ALLOWED_TYPES.includes(file.type)) {
      notify('Only JPEG, JPG, PNG and WEBP images are allowed', 'warning')
      event.target.value = ''
      return
    }

    if (file.size > MAX_FILE_SIZE) {
      notify('Image must be smaller than 5 MB', 'warning')
      event.target.value = ''
      return
    }

    const reader = new FileReader()
    reader.onload = () => {
      setProfileData(prev => ({ ...prev, logo: String(reader.result) }))
      notify('Preview updated. Upload to apply the change.', 'info')
    }
    reader.readAsDataURL(file)
  }

  const handleUploadImage = async (event) => {
    const input = event.target
    const file = input.files?.[0]
    if (!file) return

    if (!ALLOWED_TYPES.includes(file.type)) {
      notify('Only JPEG, JPG, PNG and WEBP images are allowed', 'warning')
      input.value = ''
      return
    }
    if (file.size > MAX_FILE_SIZE) {
      notify('Image must be smaller than 5 MB', 'warning')
      input.value = ''
      return
    }

    setUploading(true)
    setMessage('')
    try {
      const formData = new FormData()
      formData.append('avatar', file)

      const token = localStorage.getItem('token')
      const response = await fetch(`${API_BASE}/operator/profile/image`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      })

      const data = await response.json().catch(() => ({}))
      if (!response.ok) {
        throw new Error(data.message || 'Upload failed')
      }

      const updated = data.profile || {}
      setProfileData(prev => ({ ...prev, logo: updated.logo || '' }))

      const stored = JSON.parse(localStorage.getItem('user') || '{}')
      stored.avatar = updated.logo || ''
      localStorage.setItem('user', JSON.stringify(stored))
      window.dispatchEvent(new Event('user-updated'))

      input.value = ''
      notify('Profile image uploaded successfully!', 'info')
    } catch (err) {
      notify(err.message || 'Failed to upload image', 'warning')
    } finally {
      setUploading(false)
    }
  }

  const handleRemoveImage = async () => {
    setRemoveConfirm(false)
    setUploading(true)
    setMessage('')
    try {
      const token = localStorage.getItem('token')
      const response = await fetch(`${API_BASE}/operator/profile/image`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      })

      const data = await response.json().catch(() => ({}))
      if (!response.ok) {
        throw new Error(data.message || 'Remove failed')
      }

      const updated = data.profile || {}
      setProfileData(prev => ({ ...prev, logo: updated.logo || '' }))

      const stored = JSON.parse(localStorage.getItem('user') || '{}')
      stored.avatar = updated.logo || ''
      localStorage.setItem('user', JSON.stringify(stored))
      window.dispatchEvent(new Event('user-updated'))

      notify('Profile image removed.', 'info')
    } catch (err) {
      notify(err.message || 'Failed to remove image', 'warning')
    } finally {
      setUploading(false)
    }
  }

  const getInitials = (name) => {
    return String(name || 'O')
      .split(' ')
      .filter(Boolean)
      .map(n => n[0])
      .slice(0, 2)
      .join('')
      .toUpperCase()
  }

  const hasAvatar = Boolean(profileData.logo && !profileData.logo.startsWith('data:'))

  return (
    <OperatorLayout active="profile">
      {loading && <div className="cd-skeleton-grid"><div className="cd-skeleton-card" /><div className="cd-skeleton-card" /></div>}

      <div className="page-head">
        <div className="page-head-row">
          <div>
            <h1>Operator Profile Management</h1>
            <p>Manage your tour operator contact details, logo and signed-in devices</p>
          </div>
          <div className="page-status-badges">
            <div className="stat-badge verified-badge">
              <CheckCircle className="h-4 w-4" />
              <span>Verified Account</span>
            </div>
            <div className="stat-badge secure-badge">
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
          <div className="profile-avatar-wrapper">
            <div className="avatar-circle">
              {hasAvatar ? (
                <img
                  src={`${API_HOST}${profileData.logo}`}
                  alt="Profile"
                  className="avatar-image"
                  onError={(e) => {
                    e.target.style.display = 'none'
                    e.target.parentElement?.querySelector('.avatar-initials')?.classList.remove('hidden')
                  }}
                />
              ) : null}
              <span className={`avatar-initials${hasAvatar ? ' hidden' : ''}`}>{getInitials(profileData.companyName || profileData.fullName)}</span>
            </div>

            {!hasAvatar ? (
              <label className="avatar-upload-label" htmlFor="avatar-upload" aria-label="Upload operator logo">
                <Camera className="h-5 w-5" />
                <input
                  id="avatar-upload"
                  type="file"
                  accept="image/*"
                  onChange={handleUploadImage}
                  disabled={uploading || saving}
                  className="sr-only"
                />
                <span className="upload-btn-text">Upload Logo</span>
              </label>
            ) : (
              <div className="avatar-actions">
                <label className="avatar-upload-label" htmlFor="avatar-upload" aria-label="Change operator logo">
                  <Camera className="h-4 w-4" />
                  <input
                    id="avatar-upload"
                    type="file"
                    accept="image/*"
                    onChange={handleUploadImage}
                    disabled={uploading || saving}
                    className="sr-only"
                  />
                  <span className="upload-btn-text">Change Logo</span>
                </label>
                <button
                  type="button"
                  onClick={() => setRemoveConfirm(true)}
                  className="avatar-remove-btn"
                  aria-label="Remove operator logo"
                >
                  Remove
                </button>
              </div>
            )}

            {removeConfirm && (
              <div className="avatar-remove-confirm">
                <p>Remove this logo?</p>
                <button
                  type="button"
                  onClick={handleRemoveImage}
                  disabled={uploading}
                  className="btn-danger-sm"
                >
                  Remove
                </button>
                <button
                  type="button"
                  onClick={() => setRemoveConfirm(false)}
                  className="btn-cancel-sm"
                >
                  Cancel
                </button>
              </div>
            )}
          </div>

          <div className="profile-info enhanced">
            <h2 style={{ color: 'var(--cp-ink)' }}>{profileData.companyName || profileData.fullName || 'Operator'}</h2>
            <p className="profile-email" style={{ color: 'var(--cp-muted)' }}>{profileData.email}</p>
            <div className="profile-badges">
              <span className="profile-badge" style={{ background: 'rgba(16, 185, 129, 0.1)', color: 'var(--cp-success)', borderColor: 'rgba(16, 185, 129, 0.3)' }}>
                <CheckCircle className="h-3 w-3" />
                Email Verified
              </span>
              <span className="profile-badge" style={{ background: 'rgba(16, 185, 129, 0.1)', color: 'var(--cp-success)', borderColor: 'rgba(16, 185, 129, 0.3)' }}>
                <Shield className="h-3 w-3" />
                Tour Operator
              </span>
            </div>
          </div>

          <div className="profile-actions">
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
        </div>

        <form className="profile-form enhanced" onSubmit={handleSave}>
          <div className="form-section enhanced" style={{ background: 'var(--cp-card)', borderColor: 'var(--cp-line)' }}>
            <div className="section-header">
              <Building className="section-icon" style={{ background: 'var(--cp-accent)' }} />
              <h3 style={{ color: 'var(--cp-ink)' }}>Operator Information</h3>
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
                <label style={{ color: 'var(--cp-ink)' }}>Company Name</label>
                <input
                  type="text"
                  value={profileData.companyName}
                  onChange={(e) => setProfileData({ ...profileData, companyName: e.target.value })}
                  disabled={!isEditing}
                  placeholder="Enter your company name"
                  style={{ background: 'var(--cp-surface)', borderColor: 'var(--cp-line)', color: 'var(--cp-ink)' }}
                />
              </div>
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
            </div>
            <div className="form-row enhanced">
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
                    <Phone className="h-3 w-3" /> Used only for urgent platform updates
                  </small>
                )}
              </div>
            </div>
            <div className="form-row enhanced">
              <div className="form-group enhanced">
                <label style={{ color: 'var(--cp-ink)' }}>Business Address</label>
                <input
                  type="text"
                  value={profileData.businessAddress}
                  onChange={(e) => setProfileData({ ...profileData, businessAddress: e.target.value })}
                  disabled={!isEditing}
                  placeholder="Enter business address"
                  style={{ background: 'var(--cp-surface)', borderColor: 'var(--cp-line)', color: 'var(--cp-ink)' }}
                />
                {isEditing && (
                  <small style={{ color: 'var(--cp-muted)' }}>
                    <MapPin className="h-3 w-3" /> Used for invoices and guest correspondence
                  </small>
                )}
              </div>
            </div>
            <div className="form-row enhanced">
              <div className="form-group enhanced">
                <label style={{ color: 'var(--cp-ink)' }}>City</label>
                <input
                  type="text"
                  value={profileData.city}
                  onChange={(e) => setProfileData({ ...profileData, city: e.target.value })}
                  disabled={!isEditing}
                  placeholder="City"
                  style={{ background: 'var(--cp-surface)', borderColor: 'var(--cp-line)', color: 'var(--cp-ink)' }}
                />
              </div>
              <div className="form-group enhanced">
                <label style={{ color: 'var(--cp-ink)' }}>State</label>
                <input
                  type="text"
                  value={profileData.state}
                  onChange={(e) => setProfileData({ ...profileData, state: e.target.value })}
                  disabled={!isEditing}
                  placeholder="State"
                  style={{ background: 'var(--cp-surface)', borderColor: 'var(--cp-line)', color: 'var(--cp-ink)' }}
                />
              </div>
            </div>
            <div className="form-row enhanced">
              <div className="form-group enhanced">
                <label style={{ color: 'var(--cp-ink)' }}>Country</label>
                <input
                  type="text"
                  value={profileData.country}
                  onChange={(e) => setProfileData({ ...profileData, country: e.target.value })}
                  disabled={!isEditing}
                  placeholder="Country"
                  style={{ background: 'var(--cp-surface)', borderColor: 'var(--cp-line)', color: 'var(--cp-ink)' }}
                />
              </div>
              <div className="form-group enhanced">
                <label style={{ color: 'var(--cp-ink)' }}>Postal Code</label>
                <input
                  type="text"
                  value={profileData.postalCode}
                  onChange={(e) => setProfileData({ ...profileData, postalCode: e.target.value })}
                  disabled={!isEditing}
                  placeholder="Postal code"
                  style={{ background: 'var(--cp-surface)', borderColor: 'var(--cp-line)', color: 'var(--cp-ink)' }}
                />
              </div>
            </div>
            <div className="form-row enhanced">
              <div className="form-group enhanced">
                <label style={{ color: 'var(--cp-ink)' }}>Website</label>
                <input
                  type="url"
                  value={profileData.website}
                  onChange={(e) => setProfileData({ ...profileData, website: e.target.value })}
                  disabled={!isEditing}
                  placeholder="https://"
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
      </div>

      <AccountSecurityPanel basePath="/operator" onSignedOut={() => navigate('/login')} />
    </OperatorLayout>
  )
}

export default OperatorProfile
