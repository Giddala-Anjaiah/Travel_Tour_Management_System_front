import { API_BASE } from '../../api'
import { useState, useEffect } from 'react'
import usePolling from '../../hooks/usePolling'
import { Bell, Search, Check, Trash2, Clock, DollarSign, Star, Settings, AlertCircle, Sparkles } from 'lucide-react'
import '../Dashboard.css'

const OperatorNotifications = () => {
  const [notifications, setNotifications] = useState([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [filterType, setFilterType] = useState('all')

  const fetchNotifications = async () => {
    try {
      const token = localStorage.getItem('token')
      const response = await fetch(API_BASE + '/operator/notifications', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })
      const data = await response.json()
      if (data.notifications) {
        setNotifications(data.notifications)
        setUnreadCount(data.unreadCount || 0)
      }
    } catch (error) {
      console.error('Error fetching notifications:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    Promise.resolve().then(() => fetchNotifications())
  }, [])

  usePolling(fetchNotifications, 15000)

  const handleMarkAsRead = async (id) => {
    try {
      const token = localStorage.getItem('token')
      const response = await fetch(`${API_BASE}/operator/notifications/${id}/read`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })
      if (response.ok) {
        setNotifications(notifications.map(n => 
          n._id === id ? { ...n, read: true } : n
        ))
        setUnreadCount(Math.max(0, unreadCount - 1))
      }
    } catch (error) {
      console.error('Error marking as read:', error)
    }
  }

  const handleDelete = async (id) => {
    try {
      const token = localStorage.getItem('token')
      const response = await fetch(`${API_BASE}/operator/notifications/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })
      if (response.ok) {
        setNotifications(notifications.filter(n => n._id !== id))
        if (!notifications.find(n => n._id === id)?.read) {
          setUnreadCount(Math.max(0, unreadCount - 1))
        }
      }
    } catch (error) {
      console.error('Error deleting notification:', error)
    }
  }

  const filteredNotifications = notifications.filter(notification => {
    const matchesSearch = notification.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         notification.message?.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesType = filterType === 'all' || notification.type === filterType
    return matchesSearch && matchesType
  })

  const getNotificationIcon = (type) => {
    const icons = {
      booking: <Clock className="h-5 w-5" />,
      payment: <DollarSign className="h-5 w-5" />,
      review: <Star className="h-5 w-5" />,
      system: <Settings className="h-5 w-5" />,
      offer: <Sparkles className="h-5 w-5" />,
      availability: <AlertCircle className="h-5 w-5" />
    }
    return icons[type] || icons.system
  }

  const getNotificationColor = (type) => {
    const colors = {
      booking: '#3b82f6',
      payment: '#22c55e',
      review: '#f59e0b',
      system: '#64748b',
      offer: '#8b5cf6',
      availability: '#ef4444'
    }
    return colors[type] || colors.system
  }

  return (
    <>
          <div className="filters-section enhanced">
            <div className="search-bar enhanced">
              <Search className="search-icon" />
              <input
                type="text"
                placeholder="Search notifications..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <div className="filter-controls enhanced">
              <div className="filter-group">
                <label>Type</label>
                <select
                  value={filterType}
                  onChange={(e) => setFilterType(e.target.value)}
                  className="filter-select"
                >
                  <option value="all">All Types</option>
                  <option value="booking">Bookings</option>
                  <option value="payment">Payments</option>
                  <option value="review">Reviews</option>
                  <option value="system">System</option>
                  <option value="offer">Offers</option>
                  <option value="availability">Availability</option>
                </select>
              </div>
            </div>
          </div>

          {loading ? (
            <div className="loading-state">Loading notifications...</div>
          ) : filteredNotifications.length === 0 ? (
            <div className="empty-state">
              <Bell className="h-12 w-12" />
              <h3>No notifications found</h3>
              <p>You're all caught up!</p>
            </div>
          ) : (
            <div className="notifications-list enhanced">
              {filteredNotifications.map(notification => (
                <div 
                  key={notification._id} 
                  className={`notification-item ${!notification.read ? 'unread' : ''}`}
                >
                  <div 
                    className="notification-icon" 
                    style={{ backgroundColor: getNotificationColor(notification.type) }}
                  >
                    {getNotificationIcon(notification.type)}
                  </div>
                  <div className="notification-content">
                    <h4>{notification.title}</h4>
                    <p>{notification.message}</p>
                    <small>{new Date(notification.createdAt).toLocaleString()}</small>
                  </div>
                  <div className="notification-actions">
                    {!notification.read && (
                      <button 
                        onClick={() => handleMarkAsRead(notification._id)} 
                        className="icon-btn"
                        title="Mark as read"
                      >
                        <Check className="h-4 w-4" />
                      </button>
                    )}
                    <button 
                      onClick={() => handleDelete(notification._id)} 
                      className="icon-btn delete"
                      title="Delete"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
      </>
  )
}

export default OperatorNotifications
