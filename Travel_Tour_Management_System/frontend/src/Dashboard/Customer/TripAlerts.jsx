import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  BellRing,
  Check,
  CheckCheck,
  Trash2,
  CalendarClock,
  ChevronRight,
  Settings2,
  MapPin,
  Users,
  AlertTriangle
} from 'lucide-react'
import CustomerLayout from './CustomerLayout'
import Pagination from '../../components/Pagination'
import { api, readPagination } from '../../api'
import { getTypeMeta, getSeverityMeta, TRIP_ALERT_TYPES } from '../../utils/notificationTypes'
import '../Dashboard.css'

const emptyMeta = { page: 1, limit: 10, total: 0, totalPages: 1, hasNext: false, hasPrev: false }

const PREFERENCE_TOGGLES = [
  { key: 'booking', label: 'Booking updates' },
  { key: 'payment', label: 'Payment updates' },
  { key: 'itinerary_change', label: 'Itinerary changes' },
  { key: 'departure_reminder', label: 'Departure reminders' },
  { key: 'disruption', label: 'Disruption alerts' },
  { key: 'email', label: 'Send alerts to my email' }
]

const TripAlerts = () => {
  const navigate = useNavigate()
  const [alerts, setAlerts] = useState([])
  const [trips, setTrips] = useState([])
  const [byType, setByType] = useState({})
  const [unreadTotal, setUnreadTotal] = useState(0)
  const [meta, setMeta] = useState(emptyMeta)
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(10)
  const [typeFilter, setTypeFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [preferences, setPreferences] = useState(null)
  const [savingPreferences, setSavingPreferences] = useState(false)

  const loadAlerts = useCallback(async () => {
    try {
      setLoading(true)
      const params = { page, limit }
      if (typeFilter !== 'all') params.type = typeFilter
      if (statusFilter !== 'all') params.status = statusFilter
      const data = await api('/customer/trip-alerts', { params })
      const rows = data.alerts || []
      setAlerts(rows)
      setMeta(readPagination(data, rows.length))
      setTrips(data.trips || [])
      setByType(data.byType || {})
      setUnreadTotal(data.unreadCount || 0)
      setError('')
    } catch (err) {
      setError(err.message || 'Could not load trip alerts')
    } finally {
      setLoading(false)
    }
  }, [page, limit, typeFilter, statusFilter])

  const loadPreferences = useCallback(async () => {
    try {
      const data = await api('/customer/notification-preferences')
      setPreferences(data.preferences || null)
    } catch {
      setPreferences(null)
    }
  }, [])

  useEffect(() => {
    // Deferred so the fetch (and its state updates) happens outside the effect
    // body, matching the async pattern used across the other dashboards.
    Promise.resolve().then(() => loadAlerts())
  }, [loadAlerts])

  useEffect(() => {
    Promise.resolve().then(() => loadPreferences())
  }, [loadPreferences])

  const unreadCount = unreadTotal

  const markAsRead = async (alert) => {
    try {
      await api(`/customer/notifications/${alert._id}/read`, { method: 'PUT' })
      setAlerts(prev => prev.map(item => (
        item._id === alert._id ? { ...item, read: true } : item
      )))
      setUnreadTotal(prev => Math.max(0, prev - 1))
    } catch (err) {
      setError(err.message || 'Could not update alert')
    }
  }

  const acknowledge = async (alert) => {
    try {
      await api(`/customer/notifications/${alert._id}/acknowledge`, { method: 'PUT' })
      setAlerts(prev => prev.map(item => (
        item._id === alert._id
          ? { ...item, read: true, acknowledged: true }
          : item
      )))
    } catch (err) {
      setError(err.message || 'Could not acknowledge alert')
    }
  }

  const removeAlert = async (alert) => {
    try {
      await api(`/customer/notifications/${alert._id}`, { method: 'DELETE' })
      setAlerts(prev => prev.filter(item => item._id !== alert._id))
      if (alerts.length === 1 && page > 1) setPage(page - 1)
    } catch (err) {
      setError(err.message || 'Could not delete alert')
    }
  }

  const markAllAsRead = async () => {
    try {
      await api('/customer/notifications/read-all', { method: 'PUT' })
      setAlerts(prev => prev.map(item => ({ ...item, read: true })))
      setUnreadTotal(0)
    } catch (err) {
      setError(err.message || 'Could not update alerts')
    }
  }

  const togglePreference = async (key) => {
    if (!preferences) return
    const nextValue = !preferences[key]
    setSavingPreferences(true)
    setPreferences(prev => ({ ...prev, [key]: nextValue }))
    try {
      await api('/customer/notification-preferences', {
        method: 'PUT',
        body: JSON.stringify({ [key]: nextValue })
      })
    } catch (err) {
      setError(err.message || 'Could not update preferences')
      setPreferences(prev => ({ ...prev, [key]: !nextValue }))
    } finally {
      setSavingPreferences(false)
    }
  }

  const upcomingTrips = useMemo(
    () => trips
      .filter(trip => trip.daysToGo !== null && trip.daysToGo >= 0)
      .sort((a, b) => a.daysToGo - b.daysToGo)
      .slice(0, 4),
    [trips]
  )

  return (
    <CustomerLayout active="trip-alerts">
      <div className="page-head">
        <div className="page-head-row">
          <div>
            <h1>Trip alerts</h1>
            <p>Booking, payment, itinerary, departure and disruption updates for your trips</p>
          </div>
          <div className="page-status-badges">
            <div className="stat-badge">
              <BellRing className="h-4 w-4" />
              <span>{unreadCount} new</span>
            </div>
          </div>
        </div>
      </div>

      {error && <div className="cd-card cd-alert warning" style={{ marginBottom: '1rem' }}>{error}</div>}

      {upcomingTrips.length > 0 && (
        <div className="trip-alert-trips">
          <h3 className="trip-alert-section-title">Upcoming departures</h3>
          <div className="trip-alert-trip-grid">
            {upcomingTrips.map(trip => (
              <div key={trip._id} className="trip-alert-trip-card">
                <div className="trip-alert-trip-head">
                  <strong>{trip.package || 'Your trip'}</strong>
                  <span className="trip-alert-countdown">
                    {trip.daysToGo === 0 ? 'Today' : `In ${trip.daysToGo} day${trip.daysToGo === 1 ? '' : 's'}`}
                  </span>
                </div>
                <div className="trip-alert-trip-meta">
                  <span><CalendarClock className="h-3.5 w-3.5" /> {trip.tripStart ? new Date(trip.tripStart).toLocaleDateString() : trip.dates || 'Date TBD'}</span>
                  <span><Users className="h-3.5 w-3.5" /> {trip.travelers || 1} traveller{trip.travelers === 1 ? '' : 's'}</span>
                </div>
                <button
                  type="button"
                  className="trip-alert-link"
                  onClick={() => navigate(`/customer/bookings/${trip._id}/tracker`)}
                >
                  Track trip <ChevronRight className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="tabs enhanced">
        <button
          className={`tab-btn ${statusFilter === 'all' ? 'active' : ''}`}
          onClick={() => { setStatusFilter('all'); setPage(1) }}
        >
          All alerts
        </button>
        <button
          className={`tab-btn ${statusFilter === 'unread' ? 'active' : ''}`}
          onClick={() => { setStatusFilter('unread'); setPage(1) }}
        >
          Unread
        </button>
      </div>

      <div className="filters-section enhanced">
        <div className="trip-alert-filter-row">
          <select
            className="trip-alert-select"
            value={typeFilter}
            onChange={(e) => { setTypeFilter(e.target.value); setPage(1) }}
            aria-label="Filter by alert type"
          >
            <option value="all">All types</option>
            {TRIP_ALERT_TYPES.map(type => (
              <option key={type} value={type}>
                {getTypeMeta(type).label} ({byType[type] || 0})
              </option>
            ))}
          </select>
          <button type="button" className="btn-secondary enhanced" onClick={markAllAsRead}>
            <CheckCheck className="h-4 w-4" /> Mark all as read
          </button>
        </div>
      </div>

      <div className="trip-alert-list">
        {loading ? (
          <div className="cd-empty">Loading alerts…</div>
        ) : alerts.length === 0 ? (
          <div className="cd-empty">
            <MapPin className="h-5 w-5" /> No trip alerts to show yet.
          </div>
        ) : (
          alerts.map(alert => {
            const meta = getTypeMeta(alert.type)
            const severity = getSeverityMeta(alert.severity)
            const Icon = meta.Icon
            return (
              <div
                key={alert._id}
                className={`trip-alert-card ${alert.read ? 'read' : 'unread'} severity-${alert.severity || 'info'}`}
              >
                <div className="trip-alert-icon" style={{ backgroundColor: meta.color }}>
                  <Icon className="h-4 w-4" />
                </div>
                <div className="trip-alert-body">
                  <div className="trip-alert-head">
                    <strong>{alert.title || meta.label}</strong>
                    {alert.severity && alert.severity !== 'info' && (
                      <span className="trip-alert-severity" style={{ color: severity.color }}>
                        <AlertTriangle className="h-3 w-3" /> {severity.label}
                      </span>
                    )}
                    <span className="trip-alert-type">{meta.label}</span>
                  </div>
                  <p className="trip-alert-message">{alert.message}</p>
                  {alert.trip && (
                    <div className="trip-alert-context">
                      <span><MapPin className="h-3.5 w-3.5" /> {alert.trip.package || 'Trip'}</span>
                      <span>
                        <CalendarClock className="h-3.5 w-3.5" />
                        {alert.trip.tripStart
                          ? new Date(alert.trip.tripStart).toLocaleDateString()
                          : alert.trip.dates || 'Date TBD'}
                      </span>
                      {alert.trip.daysToGo !== null && alert.trip.daysToGo >= 0 && (
                        <span>
                          {alert.trip.daysToGo === 0
                            ? 'Departs today'
                            : `Departs in ${alert.trip.daysToGo} day${alert.trip.daysToGo === 1 ? '' : 's'}`}
                        </span>
                      )}
                    </div>
                  )}
                  <div className="trip-alert-footer">
                    <span className="trip-alert-time">
                      {new Date(alert.createdAt).toLocaleString()}
                    </span>
                    {alert.actionUrl && (
                      <button
                        type="button"
                        className="trip-alert-link"
                        onClick={() => navigate(alert.actionUrl)}
                      >
                        View trip <ChevronRight className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </div>
                <div className="trip-alert-actions">
                  {!alert.read && (
                    <button type="button" className="icon-btn" onClick={() => markAsRead(alert)} title="Mark as read">
                      <Check className="h-4 w-4" />
                    </button>
                  )}
                  {alert.type === 'disruption' && !alert.acknowledged && (
                    <button type="button" className="icon-btn" onClick={() => acknowledge(alert)} title="Acknowledge">
                      <CheckCheck className="h-4 w-4" />
                    </button>
                  )}
                  <button type="button" className="icon-btn delete" onClick={() => removeAlert(alert)} title="Delete">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            )
          })
        )}
      </div>

      <Pagination
        page={meta.page}
        totalPages={meta.totalPages}
        total={meta.total}
        limit={meta.limit}
        onPageChange={setPage}
        onLimitChange={(next) => { setLimit(next); setPage(1) }}
        itemLabel="alerts"
        disabled={loading}
      />

      <div className="trip-alert-prefs cd-card">
        <div className="trip-alert-prefs-head">
          <Settings2 className="h-4 w-4" />
          <strong>Alert preferences</strong>
          {savingPreferences && <span className="trip-alert-saving">Saving…</span>}
        </div>
        <p className="trip-alert-prefs-hint">
          Choose which trip alerts you want to receive. Disruption and departure alerts are always
          shown in this feed so you never miss a change that affects a trip.
        </p>
        <div className="trip-alert-pref-grid">
          {PREFERENCE_TOGGLES.map(toggle => (
            <label key={toggle.key} className="trip-alert-pref">
              <input
                type="checkbox"
                checked={Boolean(preferences?.[toggle.key])}
                onChange={() => togglePreference(toggle.key)}
                disabled={!preferences}
              />
              <span>{toggle.label}</span>
            </label>
          ))}
        </div>
      </div>
    </CustomerLayout>
  )
}

export default TripAlerts
