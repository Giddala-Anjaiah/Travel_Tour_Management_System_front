import { useState, useEffect } from 'react'
import { User, Mail, Save, Camera, Sparkles, Award, CheckCircle, Lock, Shield, Calendar as CalendarIcon, LogOut } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
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

  if (loading) {
    return (
      <div className="dashboard-container">
        <aside className="dashboard-sidebar">
          <div className="sidebar-header">
            <User className="h-8 w-8" />
            <h2>Customer Portal</h2>
          </div>
        </aside>
        <button onClick={handleLogout} className="logout-btn">
          <LogOut className="h-5 w-5" />
          <span>Logout</span>
        </button>
        <main className="dashboard-main">
          <header className="dashboard-header">
            <div>
              <h1>Profile Management</h1>
              <p className="header-subtitle">Manage your personal information and preferences</p>
            </div>
          </header>
          <div className="dashboard-content">
            <div className="cd-card" style={{ textAlign: 'center', padding: '3rem' }}>
              <p style={{ color: '#64748b' }}>Loading profile…</p>
            </div>
          </div>
        </main>
      </div>
    )
  }

  return (
    <div className="dashboard-container">
      <aside className="dashboard-sidebar">
        <div className="sidebar-header">
          <User className="h-8 w-8" />
          <h2>Customer Portal</h2>
        </div>
        <nav className="sidebar-nav">
          <Link to="/customer/dashboard" className="nav-item">
            <User className="h-5 w-5" />
            <span>Dashboard</span>
          </Link>
          <Link to="/customer/destinations" className="nav-item">
            <Mail className="h-5 w-5" />
            <span>Destinations</span>
          </Link>
          <Link to="/customer/packages" className="nav-item">
            <CalendarIcon className="h-5 w-5" />
            <span>Packages</span>
          </Link>
          <Link to="/customer/itineraries" className="nav-item">
            <CalendarIcon className="h-5 w-5" />
            <span>Itineraries</span>
          </Link>
          <Link to="/customer/hotels" className="nav-item">
            <CalendarIcon className="h-5 w-5" />
            <span>Hotels</span>
          </Link>
          <Link to="/customer/bookings" className="nav-item">
            <CalendarIcon className="h-5 w-5" />
            <span>Bookings</span>
          </Link>
          <Link to="/customer/invoices" className="nav-item">
            <CalendarIcon className="h-5 w-5" />
            <span>Invoices</span>
          </Link>
          <Link to="/customer/wishlist" className="nav-item">
            <CalendarIcon className="h-5 w-5" />
            <span>Wishlist</span>
          </Link>
          <Link to="/customer/profile" className="nav-item active">
            <User className="h-5 w-5" />
            <span>Profile</span>
          </Link>
        </nav>
      </aside>

      <button onClick={handleLogout} className="logout-btn">
        <LogOut className="h-5 w-5" />
        <span>Logout</span>
      </button>

      <main className="dashboard-main">
        <header className="dashboard-header">
          <div>
            <h1>Profile Management</h1>
            <p className="header-subtitle">Manage your personal information and preferences</p>
          </div>
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
        </header>

        <div className="dashboard-content">
          {message && <div className={`cd-card ${message.includes('success') ? 'cd-alert info' : 'cd-alert warning'}`} style={{ marginBottom: '1rem' }}>{message}</div>}

          <div className="profile-section enhanced">
            <div className="profile-header enhanced">
              <div className="profile-avatar enhanced">
                <div className="avatar-circle">
                  <span className="avatar-initials">{getInitials(profileData.fullName || 'U')}</span>
                </div>
                <button className="avatar-upload-btn">
                  <Camera className="h-4 w-4" />
                </button>
              </div>
              <div className="profile-info enhanced">
                <h2>{profileData.fullName || 'Customer'}</h2>
                <p className="profile-email">{profileData.email}</p>
                <div className="profile-badges">
                  <span className="profile-badge">
                    <CheckCircle className="h-3 w-3" />
                    Email Verified
                  </span>
                  <span className="profile-badge">
                    <Award className="h-3 w-3" />
                    Premium Member
                  </span>
                </div>
              </div>
              <button
                onClick={() => setIsEditing(!isEditing)}
                className={`btn-primary enhanced ${isEditing ? 'cancel' : ''}`}
                disabled={saving}
              >
                {isEditing ? <><Lock className="h-4 w-4" /> Cancel</> : <><Save className="h-4 w-4" /> Edit Profile</>}
              </button>
            </div>

            <form className="profile-form enhanced" onSubmit={handleSave}>
              <div className="form-section enhanced">
                <div className="section-header">
                  <User className="section-icon" />
                  <h3>Personal Information</h3>
                </div>
                <div className="form-row enhanced">
                  <div className="form-group enhanced">
                    <label>Full Name</label>
                    <input
                      type="text"
                      value={profileData.fullName}
                      onChange={(e) => setProfileData({...profileData, fullName: e.target.value})}
                      disabled={!isEditing}
                      placeholder="Enter your full name"
                    />
                  </div>
                  <div className="form-group enhanced">
                    <label>Email Address</label>
                    <input
                      type="email"
                      value={profileData.email}
                      onChange={(e) => setProfileData({...profileData, email: e.target.value})}
                      disabled={!isEditing}
                      placeholder="Enter your email"
                    />
                  </div>
                </div>
                <div className="form-row enhanced">
                  <div className="form-group enhanced">
                    <label>Phone Number</label>
                    <input
                      type="tel"
                      value={profileData.phone}
                      onChange={(e) => setProfileData({...profileData, phone: e.target.value})}
                      disabled={!isEditing}
                      placeholder="Enter your phone number"
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
                <Shield className="section-icon" />
                <h3>Security Settings</h3>
              </div>
              <div className="security-actions">
                <button className="security-btn enhanced" onClick={() => alert('Change password feature coming soon')}>
                  <Lock className="h-4 w-4" />
                  <div>
                    <strong>Change Password</strong>
                    <small>Update your password regularly</small>
                  </div>
                </button>
                <button className="security-btn enhanced" onClick={() => alert('2FA feature coming soon')}>
                  <Shield className="h-4 w-4" />
                  <div>
                    <strong>Two-Factor Authentication</strong>
                    <small>Add an extra layer of security</small>
                  </div>
                </button>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}

export default ProfileManagement
