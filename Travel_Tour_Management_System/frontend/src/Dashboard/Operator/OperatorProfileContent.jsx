import { api, API_BASE, API_HOST } from '../../api'
import { useState, useEffect } from 'react'
import usePolling from '../../hooks/usePolling'
import AccountSecurityPanel from '../../components/AccountSecurityPanel'
import { Save, Camera, CheckCircle, Pencil as Edit, X, Clock, XCircle, Trash2 } from 'lucide-react'
import '../Dashboard.css'

const MAX_FILE_SIZE = 5 * 1024 * 1024 // 5 MB
const ALLOWED_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp']

const OperatorProfileContent = () => {
  const user = JSON.parse(localStorage.getItem('user') || '{}')
  const [isEditing, setIsEditing] = useState(false)
  const [loading, setLoading] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [removeConfirm, setRemoveConfirm] = useState(false)
  const [message, setMessage] = useState('')
  const [messageType, setMessageType] = useState('info')
  const [profileData, setProfileData] = useState({
    fullName: user.fullName || '',
    email: user.email || '',
    phone: user.phone || '',
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
    alternatePhone: '',
    licenseNumber: '',
    taxId: ''
  })
  const [profile, setProfile] = useState(null)

  const notify = (text, type = 'info') => {
    setMessage(text)
    setMessageType(type)
  }

  const fetchProfile = async () => {
    try {
      const data = await api('/operator/profile')
      if (data.profile) {
        setProfile(data.profile)
        setProfileData(prev => ({
          ...prev,
          companyName: data.profile.companyName || '',
          logo: data.profile.logo || '',
          businessAddress: data.profile.businessAddress || '',
          city: data.profile.city || '',
          state: data.profile.state || '',
          country: data.profile.country || '',
          postalCode: data.profile.postalCode || '',
          website: data.profile.website || '',
          description: data.profile.description || '',
          businessRegNumber: data.profile.businessRegNumber || '',
          alternatePhone: data.profile.alternatePhone || '',
          licenseNumber: data.profile.licenseNumber || '',
          taxId: data.profile.taxId || ''
        }))
      }
      if (data.user) {
        setProfileData(prev => ({
          ...prev,
          fullName: data.user.fullName || '',
          email: data.user.email || '',
          phone: data.user.phone || ''
        }))
      }

      const stored = JSON.parse(localStorage.getItem('user') || '{}')
      stored.avatar = data.profile?.logo || ''
      localStorage.setItem('user', JSON.stringify(stored))
      window.dispatchEvent(new Event('user-updated'))
    } catch (error) {
      console.error('Error fetching profile:', error)
    }
  }

  useEffect(() => {
    Promise.resolve().then(() => fetchProfile())
  }, [])

  useEffect(() => {
    const handleUserUpdate = () => {
      const next = JSON.parse(localStorage.getItem('user') || '{}')
      setProfileData(prev => ({
        ...prev,
        fullName: next.fullName || prev.fullName,
        email: next.email || prev.email,
        phone: next.phone || prev.phone,
        logo: next.avatar || prev.logo
      }))
    }
    window.addEventListener('user-updated', handleUserUpdate)
    return () => window.removeEventListener('user-updated', handleUserUpdate)
  }, [])

  usePolling(() => {
    if (!isEditing) {
      fetchProfile()
    }
  }, 15000)

  const handleSave = async (e) => {
    e.preventDefault()
    setLoading(true)
    setMessage('')
    try {
      const token = localStorage.getItem('token')
      const response = await fetch(API_BASE + '/operator/profile', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(profileData)
      })
      const data = await response.json()
      if (response.ok) {
        notify('Profile updated successfully!', 'info')
        setIsEditing(false)
        const updatedProfile = data.profile || {}
        setProfileData(prev => ({
          ...prev,
          logo: updatedProfile.logo || prev.logo,
          companyName: updatedProfile.companyName || prev.companyName
        }))
        const stored = JSON.parse(localStorage.getItem('user') || '{}')
        stored.avatar = updatedProfile.logo || stored.avatar
        localStorage.setItem('user', JSON.stringify(stored))
        window.dispatchEvent(new Event('user-updated'))
      } else {
        notify(data.message || 'Error updating profile', 'warning')
      }
    } catch (error) {
      console.error('Error updating profile:', error)
      notify('Error updating profile', 'warning')
    } finally {
      setLoading(false)
    }
  }

  const getInitials = (name) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase()
  }

  const hasLogo = Boolean(profileData.logo && !profileData.logo.startsWith('data:'))

  const getVerificationBadge = () => {
    if (!profile) return null
    const status = profile.verificationStatus
    const badges = {
      pending: { icon: <Clock className="h-4 w-4" />, label: 'Pending', color: '#f59e0b' },
      verified: { icon: <CheckCircle className="h-4 w-4" />, label: 'Verified', color: '#22c55e' },
      rejected: { icon: <XCircle className="h-4 w-4" />, label: 'Rejected', color: '#ef4444' }
    }
    return badges[status] || badges.pending
  }

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

  return (
    <div className="profile-section enhanced">
      {message && (
        <div
          className={`cd-card ${messageType === 'warning' ? 'cd-alert warning' : 'cd-alert info'}`}
          style={{ marginBottom: '1rem' }}
        >
          {message}
        </div>
      )}
      <div className="profile-header enhanced">
        <div className="avatar-section">
          <div className="operator-profile-avatar">
            {hasLogo ? (
              <img
                src={`${API_HOST}${profileData.logo}`}
                alt="Profile"
                className="operator-profile-avatar-img"
                onError={(e) => {
                  e.target.style.display = 'none'
                  e.target.parentElement?.querySelector('.operator-avatar-initials')?.classList.remove('hidden')
                }}
              />
            ) : null}
            <span className={`operator-avatar-initials${hasLogo ? ' hidden' : ''}`}>{getInitials(profileData.companyName || profileData.fullName)}</span>
          </div>

          <div className="avatar-actions row">
            <label className="operator-camera-btn" htmlFor="operator-avatar-upload" aria-label="Change profile photo">
              <Camera className="h-4 w-4" />
              <span>Change Photo</span>
              <input
                id="operator-avatar-upload"
                type="file"
                accept="image/*"
                onChange={handleUploadImage}
                disabled={uploading || loading}
                className="sr-only"
              />
            </label>
            {hasLogo && (
              <button
                type="button"
                onClick={() => setRemoveConfirm(true)}
                className="operator-remove-btn"
                aria-label="Remove profile photo"
              >
                <Trash2 className="h-4 w-4" />
                <span>Remove Photo</span>
              </button>
            )}
          </div>
        </div>
        <div className="profile-info">
          <h2>{profileData.companyName || profileData.fullName}</h2>
          <p>{profileData.email}</p>
          {profile && (
            <div className="verification-badge" style={{ backgroundColor: getVerificationBadge()?.color }}>
              {getVerificationBadge()?.icon}
              <span>{getVerificationBadge()?.label}</span>
            </div>
          )}
        </div>
        {isEditing ? null : (
          <button
            type="button"
            onClick={() => setIsEditing(true)}
            className="btn-primary enhanced"
          >
            <Edit className="h-4 w-4" />
            Edit Profile
          </button>
        )}
      </div>

      <form onSubmit={handleSave} className="profile-form enhanced">
        {isEditing ? (
          <div className="profile-actions-inline">
            <div className="edit-actions">
              <button type="button" onClick={() => setIsEditing(false)} className="btn-secondary">
                <X className="h-4 w-4" />
                Cancel
              </button>
              <button type="submit" className="btn-primary enhanced" disabled={loading}>
                <Save className="h-4 w-4" />
                {loading ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        ) : null}

        <div className="form-section">
          <h3>Personal Information</h3>
          <div className="form-grid">
            <div className="form-group">
              <label>Full Name</label>
              <input
                type="text"
                value={profileData.fullName}
                onChange={(e) => setProfileData({ ...profileData, fullName: e.target.value })}
                disabled={!isEditing}
              />
            </div>
            <div className="form-group">
              <label>Email</label>
              <input
                type="email"
                value={profileData.email}
                onChange={(e) => setProfileData({ ...profileData, email: e.target.value })}
                disabled={!isEditing}
              />
            </div>
            <div className="form-group">
              <label>Phone</label>
              <input
                type="tel"
                value={profileData.phone}
                onChange={(e) => setProfileData({ ...profileData, phone: e.target.value })}
                disabled={!isEditing}
              />
            </div>
            <div className="form-group">
              <label>Alternate Phone</label>
              <input
                type="tel"
                value={profileData.alternatePhone}
                onChange={(e) => setProfileData({ ...profileData, alternatePhone: e.target.value })}
                disabled={!isEditing}
              />
            </div>
          </div>
        </div>

        <div className="form-section">
          <h3>Business Information</h3>
          <div className="form-grid">
            <div className="form-group">
              <label>Company Name</label>
              <input
                type="text"
                value={profileData.companyName}
                onChange={(e) => setProfileData({ ...profileData, companyName: e.target.value })}
                disabled={!isEditing}
              />
            </div>
            <div className="form-group">
              <label>Website</label>
              <input
                type="url"
                value={profileData.website}
                onChange={(e) => setProfileData({ ...profileData, website: e.target.value })}
                disabled={!isEditing}
                placeholder="https://"
              />
            </div>
            <div className="form-group full-width">
              <label>Business Address</label>
              <input
                type="text"
                value={profileData.businessAddress}
                onChange={(e) => setProfileData({ ...profileData, businessAddress: e.target.value })}
                disabled={!isEditing}
              />
            </div>
            <div className="form-group">
              <label>City</label>
              <input
                type="text"
                value={profileData.city}
                onChange={(e) => setProfileData({ ...profileData, city: e.target.value })}
                disabled={!isEditing}
              />
            </div>
            <div className="form-group">
              <label>State</label>
              <input
                type="text"
                value={profileData.state}
                onChange={(e) => setProfileData({ ...profileData, state: e.target.value })}
                disabled={!isEditing}
              />
            </div>
            <div className="form-group">
              <label>Country</label>
              <input
                type="text"
                value={profileData.country}
                onChange={(e) => setProfileData({ ...profileData, country: e.target.value })}
                disabled={!isEditing}
              />
            </div>
            <div className="form-group">
              <label>Postal Code</label>
              <input
                type="text"
                value={profileData.postalCode}
                onChange={(e) => setProfileData({ ...profileData, postalCode: e.target.value })}
                disabled={!isEditing}
              />
            </div>
          </div>
        </div>

        <div className="form-section">
          <h3>Business Registration</h3>
          <div className="form-grid">
            <div className="form-group">
              <label>Business Registration Number</label>
              <input
                type="text"
                value={profileData.businessRegNumber}
                onChange={(e) => setProfileData({ ...profileData, businessRegNumber: e.target.value })}
                disabled={!isEditing}
              />
            </div>
            <div className="form-group">
              <label>License Number</label>
              <input
                type="text"
                value={profileData.licenseNumber}
                onChange={(e) => setProfileData({ ...profileData, licenseNumber: e.target.value })}
                disabled={!isEditing}
              />
            </div>
            <div className="form-group">
              <label>Tax ID</label>
              <input
                type="text"
                value={profileData.taxId}
                onChange={(e) => setProfileData({ ...profileData, taxId: e.target.value })}
                disabled={!isEditing}
              />
            </div>
          </div>
        </div>

        <div className="form-section">
          <h3>Description</h3>
          <div className="form-group full-width">
            <label>Business Description</label>
            <textarea
              value={profileData.description}
              onChange={(e) => setProfileData({ ...profileData, description: e.target.value })}
              disabled={!isEditing}
              rows={4}
              placeholder="Tell customers about your tour operator business..."
            />
          </div>
        </div>
      </form>

      <AccountSecurityPanel basePath="/operator" />
    </div>
  )
}

export default OperatorProfileContent
