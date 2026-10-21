import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Bell, CheckCheck, X, ExternalLink } from 'lucide-react'
import { api } from '../api'
import { getTypeMeta, getSeverityMeta } from '../utils/notificationTypes'
import './NotificationBell.css'

const POLL_INTERVAL_MS = 30000
const PREVIEW_LIMIT = 8

const NotificationBell = () => {
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [items, setItems] = useState([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [error, setError] = useState('')
  const wrapperRef = useRef(null)

  const loadNotifications = useCallback(async () => {
    try {
      const data = await api('/customer/notifications', { params: { limit: PREVIEW_LIMIT } })
      setItems(data.notifications || [])
      setError('')
    } catch (err) {
      setError(err.message || 'Could not load alerts')
    }
  }, [])

  const loadUnreadCount = useCallback(async () => {
    try {
      const data = await api('/customer/notifications/unread-count')
      setUnreadCount(data.unreadCount || 0)
    } catch {
      setUnreadCount(0)
    }
  }, [])

  useEffect(() => {
    // Deferred so the fetch (and its state updates) happens outside the effect
    // body, matching the async pattern used across the other dashboards.
    Promise.resolve().then(() => {
      loadNotifications()
      loadUnreadCount()
    })
    const timer = setInterval(() => {
      loadNotifications()
      loadUnreadCount()
    }, POLL_INTERVAL_MS)
    return () => clearInterval(timer)
  }, [loadNotifications, loadUnreadCount])

  useEffect(() => {
    if (!open) return
    const onPointerDown = (event) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
        setOpen(false)
      }
    }
    const onKeyDown = (event) => {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  const markAsRead = async (notification) => {
    try {
      await api(`/customer/notifications/${notification._id}/read`, { method: 'PUT' })
      setItems(prev => prev.map(item => (
        item._id === notification._id ? { ...item, read: true } : item
      )))
      setUnreadCount(prev => Math.max(0, prev - 1))
    } catch (err) {
      setError(err.message || 'Could not update alert')
    }
  }

  const markAllAsRead = async () => {
    try {
      await api('/customer/notifications/read-all', { method: 'PUT' })
      setItems(prev => prev.map(item => ({ ...item, read: true })))
      setUnreadCount(0)
    } catch (err) {
      setError(err.message || 'Could not update alerts')
    }
  }

  const openAlert = (notification) => {
    if (!notification.read) markAsRead(notification)
    setOpen(false)
    navigate(notification.actionUrl || '/customer/trip-alerts')
  }

  return (
    <div className="notification-bell" ref={wrapperRef}>
      <button
        type="button"
        className="icon-btn header-icon-btn notification-bell-trigger"
        onClick={() => setOpen(prev => !prev)}
        aria-label={`Notifications${unreadCount ? `, ${unreadCount} unread` : ''}`}
        title="Trip alerts"
      >
        <Bell className="h-5 w-5" />
        {unreadCount > 0 && (
          <span className="notification-bell-badge">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="notification-bell-panel" role="dialog" aria-label="Recent alerts">
          <div className="notification-bell-head">
            <div>
              <strong>Trip alerts</strong>
              <span>{unreadCount} unread</span>
            </div>
            <button
              type="button"
              className="notification-bell-close"
              onClick={() => setOpen(false)}
              aria-label="Close alerts"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {error && <div className="notification-bell-error">{error}</div>}

          <div className="notification-bell-list">
            {items.length === 0 ? (
              <p className="notification-bell-empty">No alerts yet.</p>
            ) : (
              items.map(notification => {
                const meta = getTypeMeta(notification.type)
                const severity = getSeverityMeta(notification.severity)
                const Icon = meta.Icon
                return (
                  <button
                    type="button"
                    key={notification._id}
                    className={`notification-bell-item ${notification.read ? 'read' : 'unread'}`}
                    onClick={() => openAlert(notification)}
                  >
                    <span
                      className="notification-bell-icon"
                      style={{ backgroundColor: meta.color }}
                    >
                      <Icon className="h-4 w-4" />
                    </span>
                    <span className="notification-bell-body">
                      <span className="notification-bell-title">
                        {notification.title || meta.label}
                      </span>
                      <span className="notification-bell-message">
                        {notification.message}
                      </span>
                      <span className="notification-bell-meta">
                        <span className="notification-bell-type">{meta.label}</span>
                        {notification.severity && notification.severity !== 'info' && (
                          <span className="notification-bell-severity" style={{ color: severity.color }}>
                            {severity.label}
                          </span>
                        )}
                        <span className="notification-bell-time">
                          {new Date(notification.createdAt).toLocaleDateString()}
                        </span>
                      </span>
                    </span>
                  </button>
                )
              })
            )}
          </div>

          <div className="notification-bell-foot">
            <button type="button" className="notification-bell-action" onClick={markAllAsRead}>
              <CheckCheck className="h-4 w-4" /> Mark all read
            </button>
            <button
              type="button"
              className="notification-bell-action primary"
              onClick={() => {
                setOpen(false)
                navigate('/customer/trip-alerts')
              }}
            >
              View all <ExternalLink className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default NotificationBell
