import { useState, useEffect } from 'react'
import {
  Save, Bell, Mail, MessageSquare, CreditCard, Star,
  Hotel, Globe, Clock, Moon, Shield
} from 'lucide-react'
import HotelLayout from './HotelLayout'
import { api } from '../../api'
import '../Dashboard.css'
import './HotelDashboard.css'

const HotelSettingsPage = () => {
  const [settings, setSettings] = useState({
    emailNotifications: true,
    smsNotifications: false,
    pushNotifications: true,
    bookingAlerts: true,
    paymentUpdates: true,
    reviewAlerts: true,
    guestNotifications: true,
    currency: 'INR',
    language: 'English',
    timezone: 'IST'
  })

  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    const load = async () => {
      try {
        const data = await api('/hotel/settings')
        if (data.settings) {
          const s = data.settings
          setSettings({
            emailNotifications: s.emailNotifications,
            smsNotifications: s.smsNotifications,
            pushNotifications: s.pushNotifications,
            bookingAlerts: s.bookingAlerts,
            paymentUpdates: s.paymentUpdates,
            reviewAlerts: s.reviewAlerts,
            guestNotifications: s.guestNotifications,
            currency: s.currency,
            language: s.language,
            timezone: s.timezone
          })
        }
      } catch (err) {
        console.error(err)
      }
    }
    load()
  }, [])

  const handleSettingChange = (key, value) => {
    setSettings(prev => ({ ...prev, [key]: value }))
  }

  const handleSaveSettings = async () => {
    setIsSaving(true)
    try {
      await api('/hotel/settings', { method: 'PUT', body: JSON.stringify(settings) })
      alert('Settings updated successfully!')
    } catch (error) {
      alert(error.message || 'Error updating settings')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <HotelLayout active="settings" title="Settings">
      <div className="hr-card">
        <div className="hr-card-head">
          <h2 className="hr-card-title"><SettingsIcon /> Hotel Preferences</h2>
        </div>

        <div className="hr-section-divider" />

        <div className="hr-settings-section">
          <h3 className="hr-settings-section-title"><Bell size={16} /> Notification Preferences</h3>
          <div className="hr-settings-group">
            <SettingRow
              icon={<Mail size={18} />}
              label="Email Notifications"
              desc="Receive booking confirmations and alerts via email"
            >
              <SwitchField
                checked={settings.emailNotifications}
                onChange={v => handleSettingChange('emailNotifications', v)}
              />
            </SettingRow>
            <SettingRow
              icon={<MessageSquare size={18} />}
              label="SMS Notifications"
              desc="Send text messages for urgent alerts"
            >
              <SwitchField
                checked={settings.smsNotifications}
                onChange={v => handleSettingChange('smsNotifications', v)}
              />
            </SettingRow>
            <SettingRow
              icon={<Bell size={18} />}
              label="Push Notifications"
              desc="Alerts on your device and browser"
            >
              <SwitchField
                checked={settings.pushNotifications}
                onChange={v => handleSettingChange('pushNotifications', v)}
              />
            </SettingRow>
            <SettingRow
              icon={<CreditCard size={18} />}
              label="Booking Alerts"
              desc="New reservations and cancellations"
            >
              <SwitchField
                checked={settings.bookingAlerts}
                onChange={v => handleSettingChange('bookingAlerts', v)}
              />
            </SettingRow>
            <SettingRow
              icon={<CreditCard size={18} />}
              label="Payment Updates"
              desc="Payment received and failed notifications"
            >
              <SwitchField
                checked={settings.paymentUpdates}
                onChange={v => handleSettingChange('paymentUpdates', v)}
              />
            </SettingRow>
            <SettingRow
              icon={<Star size={18} />}
              label="Review Alerts"
              desc="New guest reviews and ratings"
            >
              <SwitchField
                checked={settings.reviewAlerts}
                onChange={v => handleSettingChange('reviewAlerts', v)}
              />
            </SettingRow>
            <SettingRow
              icon={<Hotel size={18} />}
              label="Guest Notifications"
              desc="Automated guest check-in/out messages"
            >
              <SwitchField
                checked={settings.guestNotifications}
                onChange={v => handleSettingChange('guestNotifications', v)}
              />
            </SettingRow>
          </div>
        </div>

        <div className="hr-section-divider" />

        <div className="hr-settings-section">
          <h3 className="hr-settings-section-title"><Globe size={16} /> Application Preferences</h3>
          <div className="hr-settings-group">
            <SettingRow
              icon={<Globe size={18} />}
              label="Currency"
              desc="Display currency for reports"
            >
              <select
                className="hr-inline-select"
                value={settings.currency}
                onChange={e => handleSettingChange('currency', e.target.value)}
              >
                <option value="INR">INR (₹)</option>
                <option value="USD">USD ($)</option>
                <option value="EUR">EUR (€)</option>
              </select>
            </SettingRow>
            <SettingRow
              icon={<Globe size={18} />}
              label="Language"
              desc="Interface language"
            >
              <select
                className="hr-inline-select"
                value={settings.language}
                onChange={e => handleSettingChange('language', e.target.value)}
              >
                <option value="English">English</option>
                <option value="Hindi">Hindi</option>
              </select>
            </SettingRow>
            <SettingRow
              icon={<Clock size={18} />}
              label="Timezone"
              desc="Default timezone for dates"
            >
              <select
                className="hr-inline-select"
                value={settings.timezone}
                onChange={e => handleSettingChange('timezone', e.target.value)}
              >
                <option value="IST">IST (UTC +5:30)</option>
                <option value="UTC">UTC (UTC +0)</option>
              </select>
            </SettingRow>
          </div>
        </div>

        <div className="hr-section-divider" />

        <div className="hr-form-actions">
          <button
            className="hr-btn hr-btn-secondary"
            onClick={() => window.location.reload()}
            type="button"
          >
            Cancel
          </button>
          <button
            className="hr-btn hr-btn-primary"
            onClick={handleSaveSettings}
            disabled={isSaving}
          >
            <Save size={14} /> {isSaving ? 'Saving...' : 'Save Settings'}
          </button>
        </div>
      </div>
    </HotelLayout>
  )
}

const SettingsIcon = () => <Moon size={20} />

const SettingRow = ({ icon, label, desc, children }) => (
  <div className="hr-setting-row">
    <div className="hr-setting-label">
      <span className="hr-setting-icon">{icon}</span>
      <div>
        <div className="hr-setting-name">{label}</div>
        <div className="hr-setting-desc">{desc}</div>
      </div>
    </div>
    <div className="hr-setting-control">
      {children}
    </div>
  </div>
)

const SwitchField = ({ checked, onChange }) => (
  <label className="hr-switch">
    <input
      type="checkbox"
      checked={checked}
      onChange={e => onChange(e.target.checked)}
    />
    <span className="hr-switch-slider" />
  </label>
)

export default HotelSettingsPage
