import { API_BASE } from '../../api'
import { useState, useEffect } from 'react'
import usePolling from '../../hooks/usePolling'
import { Save, Camera, CheckCircle, Pencil as Edit, X, Clock, XCircle } from 'lucide-react'
import '../Dashboard.css'

const OperatorProfileContent = () => {
  const user = JSON.parse(localStorage.getItem('user') || '{}')
  const [isEditing, setIsEditing] = useState(false)
  const [loading, setLoading] = useState(false)
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
    taxId: '',
    password: '',
    confirmPassword: ''
  })
  const [profile, setProfile] = useState(null)

  const fetchProfile = async () => {
    try {
      const token = localStorage.getItem('token')
      const response = await fetch(API_BASE + '/operator/profile', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })
      const data = await response.json()
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
    } catch (error) {
      console.error('Error fetching profile:', error)
    }
  }

  useEffect(() => {
    Promise.resolve().then(() => fetchProfile())
  }, [])

  usePolling(() => {
    if (!isEditing) {
      fetchProfile()
    }
  }, 15000)

  const handleSave = async (e) => {
    e.preventDefault()
    setLoading(true)
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
        alert('Profile updated successfully!')
        setIsEditing(false)
        fetchProfile()
      } else {
        alert(data.message || 'Error updating profile')
      }
    } catch (error) {
      console.error('Error updating profile:', error)
      alert('Error updating profile')
    } finally {
      setLoading(false)
    }
  }

  const getInitials = (name) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase()
  }

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

  return (
    <div className="profile-section enhanced">
      <div className="profile-header enhanced">
        <div className="profile-avatar">
          {profileData.logo ? (
            <img src={profileData.logo} alt="Logo" />
          ) : (
            <span>{getInitials(profileData.companyName || profileData.fullName)}</span>
          )}
          {isEditing && (
            <button className="avatar-upload">
              <Camera className="h-4 w-4" />
            </button>
          )}
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
      </div>

      <form onSubmit={handleSave} className="profile-form enhanced">
        <div className="profile-actions-inline">
          {!isEditing ? (
            <button type="button" onClick={() => setIsEditing(true)} className="btn-primary enhanced">
              <Edit className="h-4 w-4" />
              Edit Profile
            </button>
          ) : (
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
          )}
        </div>

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

        {isEditing && (
          <div className="form-section">
            <h3>Security</h3>
            <div className="form-grid">
              <div className="form-group">
                <label>New Password</label>
                <input
                  type="password"
                  value={profileData.password}
                  onChange={(e) => setProfileData({ ...profileData, password: e.target.value })}
                  placeholder="Leave blank to keep current password"
                />
              </div>
              <div className="form-group">
                <label>Confirm Password</label>
                <input
                  type="password"
                  value={profileData.confirmPassword}
                  onChange={(e) => setProfileData({ ...profileData, confirmPassword: e.target.value })}
                  placeholder="Confirm new password"
                />
              </div>
            </div>
          </div>
        )}
      </form>
    </div>
  )
}

export default OperatorProfileContent
