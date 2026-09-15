import { API_BASE } from '../../api'
import { useState } from 'react'
import { Save } from 'lucide-react'
import OperatorLayout from './OperatorLayout'
import '../Dashboard.css'

const OperatorSettingsPage = () => {
  const [settings, setSettings] = useState({
    emailNotifications: true,
    smsNotifications: false,
    pushNotifications: true,
    bookingAlerts: true,
    paymentUpdates: true,
    reviewAlerts: true,
    currency: 'INR',
    language: 'English',
    timezone: 'IST'
  })

  const [isSaving, setIsSaving] = useState(false)

  const handleSettingChange = (key, value) => {
    setSettings(prev => ({
      ...prev,
      [key]: value
    }))
  }

  const handleSaveSettings = async () => {
    setIsSaving(true)
    try {
      const token = localStorage.getItem('token')
      const response = await fetch(API_BASE + '/operator/settings', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(settings)
      })
      if (response.ok) {
        alert('Settings updated successfully!')
      } else {
        alert('Error updating settings')
      }
    } catch (error) {
      console.error('Error:', error)
      alert('Error updating settings')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <OperatorLayout active="settings" title="Settings">
      <div className="settings-container">
        <div className="settings-section">
          <h3>Notification Preferences</h3>
          <div className="settings-group">
            <div className="setting-item">
              <label>
                <input 
                  type="checkbox" 
                  checked={settings.emailNotifications}
                  onChange={(e) => handleSettingChange('emailNotifications', e.target.checked)}
                />
                <span>Email Notifications</span>
              </label>
            </div>
            <div className="setting-item">
              <label>
                <input 
                  type="checkbox" 
                  checked={settings.smsNotifications}
                  onChange={(e) => handleSettingChange('smsNotifications', e.target.checked)}
                />
                <span>SMS Notifications</span>
              </label>
            </div>
            <div className="setting-item">
              <label>
                <input 
                  type="checkbox" 
                  checked={settings.pushNotifications}
                  onChange={(e) => handleSettingChange('pushNotifications', e.target.checked)}
                />
                <span>Push Notifications</span>
              </label>
            </div>
            <div className="setting-item">
              <label>
                <input 
                  type="checkbox" 
                  checked={settings.bookingAlerts}
                  onChange={(e) => handleSettingChange('bookingAlerts', e.target.checked)}
                />
                <span>Booking Alerts</span>
              </label>
            </div>
            <div className="setting-item">
              <label>
                <input 
                  type="checkbox" 
                  checked={settings.paymentUpdates}
                  onChange={(e) => handleSettingChange('paymentUpdates', e.target.checked)}
                />
                <span>Payment Updates</span>
              </label>
            </div>
            <div className="setting-item">
              <label>
                <input 
                  type="checkbox" 
                  checked={settings.reviewAlerts}
                  onChange={(e) => handleSettingChange('reviewAlerts', e.target.checked)}
                />
                <span>Review Alerts</span>
              </label>
            </div>
          </div>
        </div>

        <div className="settings-section">
          <h3>Preferences</h3>
          <div className="settings-group">
            <div className="setting-item">
              <label>Currency</label>
              <select 
                value={settings.currency}
                onChange={(e) => handleSettingChange('currency', e.target.value)}
              >
                <option value="INR">INR (₹)</option>
                <option value="USD">USD ($)</option>
                <option value="EUR">EUR (€)</option>
              </select>
            </div>
            <div className="setting-item">
              <label>Language</label>
              <select 
                value={settings.language}
                onChange={(e) => handleSettingChange('language', e.target.value)}
              >
                <option value="English">English</option>
                <option value="Hindi">Hindi</option>
              </select>
            </div>
            <div className="setting-item">
              <label>Timezone</label>
              <select 
                value={settings.timezone}
                onChange={(e) => handleSettingChange('timezone', e.target.value)}
              >
                <option value="IST">IST (UTC +5:30)</option>
                <option value="UTC">UTC (UTC +0)</option>
              </select>
            </div>
          </div>
        </div>

        <div className="settings-actions">
          <button 
            onClick={handleSaveSettings} 
            className="btn-primary"
            disabled={isSaving}
          >
            <Save className="h-4 w-4" />
            {isSaving ? 'Saving...' : 'Save Settings'}
          </button>
        </div>
      </div>
    </OperatorLayout>
  )
}

export default OperatorSettingsPage
