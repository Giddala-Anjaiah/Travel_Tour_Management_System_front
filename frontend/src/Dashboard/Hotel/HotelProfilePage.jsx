import { useState, useEffect } from 'react'
import { Save, Camera, Edit3, X, CheckCircle, AlertCircle, Building, MapPin, Hash, FileText, Lock, Star } from 'lucide-react'
import HotelLayout from './HotelLayout'
import { api } from '../../api'
import '../Dashboard.css'

const emptyProfile = (user) => ({
  hotelName: '', email: user.email || '', phone: user.phone || '',
  address: '', city: '', state: '', country: '', postalCode: '',
  website: '', description: '', starRating: '',
  checkinTime: '', checkoutTime: '', amenities: '',
  registrationNumber: '', taxId: '', logo: '',
  password: '', confirmPassword: ''
})

const HotelProfilePage = () => {
  const user = JSON.parse(localStorage.getItem('user') || '{}')
  const [isEditing, setIsEditing] = useState(false)
  const [loading, setLoading] = useState(false)
  const [fetching, setFetching] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [profileData, setProfileData] = useState(emptyProfile(user))

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      try {
        const data = await api('/hotel/profile')
        if (cancelled) return
        if (data.profile) {
          setProfileData(prev => ({
            ...prev,
            hotelName: data.profile.hotelName || '',
            email: data.user?.email || prev.email,
            phone: data.user?.phone || prev.phone,
            address: data.profile.address || '',
            city: data.profile.city || '',
            state: data.profile.state || '',
            country: data.profile.country || '',
            postalCode: data.profile.postalCode || '',
            website: data.profile.website || '',
            description: data.profile.description || '',
            starRating: data.profile.starRating ?? '',
            checkinTime: data.profile.checkinTime || '',
            checkoutTime: data.profile.checkoutTime || '',
            amenities: Array.isArray(data.profile.amenities) ? data.profile.amenities.join(', ') : '',
            registrationNumber: data.profile.registrationNumber || '',
            taxId: data.profile.taxId || '',
            logo: data.profile.logo || ''
          }))
        }
      } catch (err) {
        if (!cancelled) console.error('fetch profile error:', err)
      } finally {
        if (!cancelled) setFetching(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [])

  const validate = () => {
    if (!profileData.hotelName.trim()) return 'Hotel name is required'
    if (!profileData.email.trim()) return 'Email is required'
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(profileData.email)) return 'Please enter a valid email'
    if (!profileData.phone.trim()) return 'Phone is required'
    if (profileData.starRating !== '' && (Number(profileData.starRating) < 1 || Number(profileData.starRating) > 5)) {
      return 'Star rating must be between 1 and 5'
    }
    if (profileData.password) {
      if (profileData.password.length < 6) return 'Password must be at least 6 characters'
      if (profileData.password !== profileData.confirmPassword) return 'Passwords do not match'
    }
    return ''
  }

  const handleSave = async (e) => {
    e.preventDefault()
    setError('')
    setSuccess('')
    const validationError = validate()
    if (validationError) { setError(validationError); return }

    setLoading(true)
    try {
      const payload = { ...profileData }
      // Don't send confirmPassword to backend
      delete payload.confirmPassword
      // Don't send password if empty
      if (!payload.password) delete payload.password

      const data = await api('/hotel/profile', { method: 'PUT', body: JSON.stringify(payload) })
      setSuccess(data.message || 'Profile updated successfully!')
      setIsEditing(false)
      setTimeout(() => setSuccess(''), 4000)
    } catch (err) {
      setError(err.message || 'Failed to update profile. Please check your connection and try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleCancel = () => {
    setIsEditing(false)
    setError('')
    setSuccess('')
    setProfileData(emptyProfile(user))
  }

  const getInitials = (name) => {
    if (!name) return 'H'
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
  }

  if (fetching) {
    return (
      <HotelLayout active="profile" title="Hotel Profile & Management">
        <div className="hp-loading">Loading profile...</div>
        <style>{`.hp-loading { padding: 2rem; text-align: center; color: #64748b; font-weight: 500; }`}</style>
      </HotelLayout>
    )
  }

  return (
    <HotelLayout active="profile" title="Hotel Profile & Management">
      <div className="hp-wrap">
        {error && <div className="hp-alert error"><AlertCircle size={18} /><div><strong>Error</strong><p>{error}</p></div></div>}
        {success && <div className="hp-alert success"><CheckCircle size={18} /><div><strong>Success</strong><p>{success}</p></div></div>}

        <div className="hp-card hp-header-card">
          <div className="hp-header-left">
            <div className="hp-avatar">
              {profileData.logo ? <img src={profileData.logo} alt="Logo" /> : <span>{getInitials(profileData.hotelName)}</span>}
              {isEditing && (
                <label className="hp-avatar-upload" title="Upload logo">
                  <Camera size={16} />
                  <input type="file" accept="image/*" hidden onChange={(e) => {
                    const file = e.target.files?.[0]
                    if (!file) return
                    const reader = new FileReader()
                    reader.onload = (ev) => setProfileData({ ...profileData, logo: ev.target.result })
                    reader.readAsDataURL(file)
                  }} />
                </label>
              )}
            </div>
            <div className="hp-header-info">
              <h2>{profileData.hotelName || 'Set Your Hotel Name'}</h2>
              <p>{profileData.email}</p>
              <span className="hp-pill success"><CheckCircle size={12} /> Verified</span>
            </div>
          </div>
          <div className="hp-header-actions">
            {!isEditing ? (
              <button type="button" className="hp-btn hp-btn-primary" onClick={() => { setError(''); setSuccess(''); setIsEditing(true) }}>
                <Edit3 size={16} /> Edit Profile
              </button>
            ) : (
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button type="button" className="hp-btn hp-btn-secondary" onClick={handleCancel} disabled={loading}>
                  <X size={16} /> Cancel
                </button>
                <button type="submit" form="hp-form" className="hp-btn hp-btn-primary" disabled={loading}>
                  <Save size={16} /> {loading ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            )}
          </div>
        </div>

        <form id="hp-form" onSubmit={handleSave} className="hp-card">
          <h3 className="hp-section-title"><Building size={16} /> Basic Information</h3>
          <div className="hp-grid">
            <div className="hp-form-group full"><label>Hotel Name *</label><input value={profileData.hotelName} onChange={e => setProfileData({ ...profileData, hotelName: e.target.value })} disabled={!isEditing} required /></div>
            <div className="hp-form-group"><label>Email *</label><input type="email" value={profileData.email} onChange={e => setProfileData({ ...profileData, email: e.target.value })} disabled={!isEditing} required /></div>
            <div className="hp-form-group"><label>Phone *</label><input value={profileData.phone} onChange={e => setProfileData({ ...profileData, phone: e.target.value })} disabled={!isEditing} required /></div>
          </div>

          <h3 className="hp-section-title"><MapPin size={16} /> Hotel Address</h3>
          <div className="hp-grid">
            <div className="hp-form-group full"><label>Street Address</label><input value={profileData.address} onChange={e => setProfileData({ ...profileData, address: e.target.value })} disabled={!isEditing} /></div>
            <div className="hp-form-group"><label>City</label><input value={profileData.city} onChange={e => setProfileData({ ...profileData, city: e.target.value })} disabled={!isEditing} /></div>
            <div className="hp-form-group"><label>State</label><input value={profileData.state} onChange={e => setProfileData({ ...profileData, state: e.target.value })} disabled={!isEditing} /></div>
            <div className="hp-form-group"><label>Country</label><input value={profileData.country} onChange={e => setProfileData({ ...profileData, country: e.target.value })} disabled={!isEditing} /></div>
            <div className="hp-form-group"><label>Postal Code</label><input value={profileData.postalCode} onChange={e => setProfileData({ ...profileData, postalCode: e.target.value })} disabled={!isEditing} /></div>
          </div>

          <h3 className="hp-section-title"><Star size={16} /> Hotel Details</h3>
          <div className="hp-grid">
            <div className="hp-form-group"><label>Star Rating (1-5)</label><input type="number" min="1" max="5" value={profileData.starRating} onChange={e => setProfileData({ ...profileData, starRating: e.target.value })} disabled={!isEditing} /></div>
            <div className="hp-form-group"><label>Check-in Time</label><input type="time" value={profileData.checkinTime} onChange={e => setProfileData({ ...profileData, checkinTime: e.target.value })} disabled={!isEditing} /></div>
            <div className="hp-form-group"><label>Check-out Time</label><input type="time" value={profileData.checkoutTime} onChange={e => setProfileData({ ...profileData, checkoutTime: e.target.value })} disabled={!isEditing} /></div>
            <div className="hp-form-group"><label>Website</label><input type="url" value={profileData.website} onChange={e => setProfileData({ ...profileData, website: e.target.value })} disabled={!isEditing} placeholder="https://" /></div>
          </div>

          <h3 className="hp-section-title"><FileText size={16} /> Description & Amenities</h3>
          <div className="hp-grid">
            <div className="hp-form-group full"><label>Hotel Description</label><textarea rows={3} value={profileData.description} onChange={e => setProfileData({ ...profileData, description: e.target.value })} disabled={!isEditing} /></div>
            <div className="hp-form-group full"><label>Amenities (comma-separated)</label><textarea rows={2} value={profileData.amenities} onChange={e => setProfileData({ ...profileData, amenities: e.target.value })} disabled={!isEditing} placeholder="WiFi, Pool, Gym, Restaurant" /></div>
          </div>

          <h3 className="hp-section-title"><Hash size={16} /> Registration & Tax</h3>
          <div className="hp-grid">
            <div className="hp-form-group"><label>Registration Number</label><input value={profileData.registrationNumber} onChange={e => setProfileData({ ...profileData, registrationNumber: e.target.value })} disabled={!isEditing} /></div>
            <div className="hp-form-group"><label>Tax ID</label><input value={profileData.taxId} onChange={e => setProfileData({ ...profileData, taxId: e.target.value })} disabled={!isEditing} /></div>
          </div>

          {isEditing && (
            <>
              <h3 className="hp-section-title"><Lock size={16} /> Change Password (optional)</h3>
              <div className="hp-grid">
                <div className="hp-form-group"><label>New Password</label><input type="password" value={profileData.password} onChange={e => setProfileData({ ...profileData, password: e.target.value })} placeholder="Leave blank to keep current" autoComplete="new-password" /></div>
                <div className="hp-form-group"><label>Confirm Password</label><input type="password" value={profileData.confirmPassword} onChange={e => setProfileData({ ...profileData, confirmPassword: e.target.value })} autoComplete="new-password" /></div>
              </div>
              <div className="hp-form-actions">
                <button type="button" className="hp-btn hp-btn-secondary" onClick={handleCancel} disabled={loading}>Cancel</button>
                <button type="submit" className="hp-btn hp-btn-primary" disabled={loading}>
                  <Save size={16} /> {loading ? 'Saving...' : 'Save Profile'}
                </button>
              </div>
            </>
          )}
        </form>
      </div>

      <style>{`
        .hp-wrap { display: flex; flex-direction: column; gap: 1.25rem; }
        .hp-card { background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 1.5rem; box-shadow: 0 1px 3px rgba(0,0,0,0.04); }
        .hp-alert { display: flex; gap: 0.85rem; padding: 1rem 1.15rem; border-radius: 10px; border: 1px solid; font-weight: 500; }
        .hp-alert.error { background: #fee2e2; border-color: #f87171; color: #991b1b; }
        .hp-alert.success { background: #d1fae5; border-color: #10b981; color: #065f46; }
        .hp-alert strong { display: block; margin-bottom: 0.2rem; }
        .hp-alert p { margin: 0; font-size: 0.88rem; }

        .hp-header-card { display: flex; justify-content: space-between; align-items: center; gap: 1rem; flex-wrap: wrap; }
        .hp-header-left { display: flex; align-items: center; gap: 1.25rem; }
        .hp-avatar { width: 80px; height: 80px; border-radius: 50%; background: linear-gradient(135deg, #4f46e5, #7c3aed); color: white; display: flex; align-items: center; justify-content: center; font-size: 1.6rem; font-weight: 700; position: relative; overflow: hidden; flex-shrink: 0; }
        .hp-avatar img { width: 100%; height: 100%; object-fit: cover; }
        .hp-avatar-upload { position: absolute; bottom: 0; right: 0; width: 28px; height: 28px; background: #4f46e5; color: white; border-radius: 50%; display: flex; align-items: center; justify-content: center; cursor: pointer; border: 2px solid white; }
        .hp-header-info h2 { color: #0f172a; font-size: 1.35rem; font-weight: 700; margin: 0 0 0.25rem; }
        .hp-header-info p { color: #64748b; margin: 0 0 0.5rem; font-size: 0.9rem; }
        .hp-pill { display: inline-flex; align-items: center; gap: 0.3rem; padding: 0.25rem 0.6rem; border-radius: 999px; font-size: 0.75rem; font-weight: 600; }
        .hp-pill.success { background: #d1fae5; color: #065f46; }

        .hp-btn { display: inline-flex; align-items: center; gap: 0.5rem; padding: 0.6rem 1.1rem; border-radius: 8px; border: 1px solid transparent; font-weight: 600; cursor: pointer; font-size: 0.88rem; transition: all 0.2s; }
        .hp-btn:disabled { opacity: 0.5; cursor: not-allowed; }
        .hp-btn-primary { background: #4f46e5; color: white; }
        .hp-btn-primary:hover:not(:disabled) { background: #3730a3; }
        .hp-btn-secondary { background: #f1f5f9; color: #475569; border-color: #e2e8f0; }
        .hp-btn-secondary:hover:not(:disabled) { background: #e2e8f0; }

        .hp-section-title { color: #0f172a; font-size: 1rem; font-weight: 700; margin: 1.5rem 0 0.85rem; display: flex; align-items: center; gap: 0.5rem; padding-bottom: 0.5rem; border-bottom: 1px solid #e2e8f0; }
        .hp-section-title:first-of-type { margin-top: 0; }

        .hp-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 0.85rem; }
        .hp-form-group { display: flex; flex-direction: column; gap: 0.35rem; }
        .hp-form-group.full { grid-column: 1 / -1; }
        .hp-form-group label { color: #475569; font-size: 0.82rem; font-weight: 600; }
        .hp-form-group input, .hp-form-group textarea { padding: 0.6rem 0.85rem; border: 1px solid #e2e8f0; border-radius: 8px; font-size: 0.9rem; background: #ffffff; color: #0f172a; font-family: inherit; }
        .hp-form-group input:disabled, .hp-form-group textarea:disabled { background: #f8fafc; color: #475569; cursor: not-allowed; }
        .hp-form-group input:focus:not(:disabled), .hp-form-group textarea:focus:not(:disabled) { outline: none; border-color: #4f46e5; box-shadow: 0 0 0 3px rgba(79,70,229,0.1); }

        .hp-form-actions { display: flex; justify-content: flex-end; gap: 0.6rem; margin-top: 1.5rem; padding-top: 1.25rem; border-top: 1px solid #e2e8f0; }

        @media (max-width: 700px) {
          .hp-grid { grid-template-columns: 1fr; }
        }
      `}</style>
    </HotelLayout>
  )
}

export default HotelProfilePage