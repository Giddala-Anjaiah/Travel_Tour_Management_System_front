import { useEffect, useState } from 'react'
import {  Send, Search, Download, CheckCircle, Trash2 } from 'lucide-react'
import { api, downloadCsv, fetchAllPages, readPagination } from '../../api'
import Pagination from '../../components/Pagination'
import AdminLayout from './AdminLayout'

const matchesFilters = (notif, searchTerm, filterType, filterRead) => {
  const matchesSearch = notif.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    notif.message?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    notif.userId?.fullName?.toLowerCase().includes(searchTerm.toLowerCase())
  const matchesType = filterType === 'all' || notif.type === filterType
  const matchesRead = filterRead === 'all' || (filterRead === 'read' ? notif.read : !notif.read)
  return matchesSearch && matchesType && matchesRead
}

const NotificationsManagement = () => {
  const [notifications, setNotifications] = useState([])
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  const [filterType, setFilterType] = useState('all')
  const [filterRead, setFilterRead] = useState('all')
  const [showSendModal, setShowSendModal] = useState(false)
  const [sendForm, setSendForm] = useState({ title: '', message: '', type: 'system', recipient: 'all', customUserIds: '' })
  const [sending, setSending] = useState(false)
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(10)
  const [meta, setMeta] = useState({ page: 1, limit: 10, total: 0, totalPages: 1, hasNext: false, hasPrev: false })

  const notificationTypes = [
    { value: 'booking', label: 'Booking' },
    { value: 'payment', label: 'Payment' },
    { value: 'review', label: 'Review' },
    { value: 'system', label: 'System' },
    { value: 'offer', label: 'Offer' },
    { value: 'availability', label: 'Availability' }
  ]

  // /admin/notifications only honours `olderThan`, so search and the
  // type/read selects all fall back to the full set plus local filtering.
  const hasLocalFilters = searchTerm !== '' || filterType !== 'all' || filterRead !== 'all'

  const load = async (overrides = {}) => {
    const nextPage = overrides.page ?? page
    const nextLimit = overrides.limit ?? limit
    try {
      setError('')
      setLoading(true)
      const data = await api('/admin/notifications', {
        params: {
          page: hasLocalFilters ? undefined : nextPage,
          limit: hasLocalFilters ? 'all' : nextLimit
        }
      })
      setNotifications(data.notifications || [])
      setMeta(readPagination(data, (data.notifications || []).length))
      setStats(data.stats || null)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    Promise.resolve().then(() => load())
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, limit])

  useEffect(() => {
    const timer = setTimeout(() => {
      setPage(1)
      if (page === 1) Promise.resolve().then(() => load())
    }, 350)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchTerm, filterType, filterRead])

  const handlePageChange = (nextPage) => {
    setPage(nextPage)
    setLoading(true)
  }

  const handleLimitChange = (nextLimit) => {
    setLimit(nextLimit)
    setPage(1)
    setLoading(true)
  }

  const handleSend = async () => {
    if (!sendForm.title || !sendForm.message) {
      setError('Title and message are required')
      return
    }
    try {
      setSending(true)
      const body = {
        title: sendForm.title,
        message: sendForm.message,
        type: sendForm.type,
      }
      if (sendForm.recipient === 'all') {
        body.role = 'all'
      } else if (sendForm.recipient === 'custom') {
        body.userIds = sendForm.customUserIds.split(',').map(s => s.trim()).filter(Boolean)
      } else {
        body.role = sendForm.recipient
      }
      const res = await api('/admin/notifications', { method: 'POST', body: JSON.stringify(body) })
      if (res.count) {
        await load()
        setShowSendModal(false)
        setSendForm({ title: '', message: '', type: 'system', recipient: 'all', customUserIds: '' })
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setSending(false)
    }
  }

  const filteredLogs = hasLocalFilters
    ? notifications.filter((notif) => matchesFilters(notif, searchTerm, filterType, filterRead))
    : notifications

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this notification?')) return
    try {
      await api(`/admin/notifications/${id}`, { method: 'DELETE' })
      if (filteredLogs.length <= 1 && page > 1) {
        setPage(page - 1)
      } else {
        await load()
      }
    } catch (err) {
      setError(err.message)
    }
  }

  const handleReadToggle = async (id) => {
    try {
      await api(`/admin/notifications/${id}/read`, { method: 'PUT' })
      await load()
    } catch (err) {
      setError(err.message)
    }
  }

  const handleDeleteOlder = async () => {
    if (!window.confirm('Delete all notifications older than 30 days? This cannot be undone.')) return
    try {
      await api('/admin/notifications', { method: 'DELETE', params: { olderThan: 30 } })
      await load()
    } catch (err) {
      setError(err.message)
    }
  }

  const handleExport = async () => {
    const rows = await fetchAllPages('/admin/notifications', { key: 'notifications' })
    const exported = rows.filter((notif) => matchesFilters(notif, searchTerm, filterType, filterRead))
    if (exported.length > 0) {
      downloadCsv('notifications.csv',
        ['Date', 'Recipient', 'Role', 'Type', 'Title', 'Message', 'Status'],
        exported.map((n) => [
          new Date(n.createdAt).toLocaleString(),
          n.userId?.fullName || 'Unknown',
          n.userId?.role || '',
          typeLabels[n.type] || n.type,
          n.title || '',
          n.message || '',
          n.read ? 'Read' : 'Unread'
        ])
      )
    }
  }

  const typeIcons = {
    booking: '📅',
    payment: '💰',
    review: '⭐',
    system: '⚙️',
    offer: '🎁',
    availability: '🏨'
  }

  const typeLabels = {
    booking: 'Booking',
    payment: 'Payment',
    review: 'Review',
    system: 'System',
    offer: 'Offer',
    availability: 'Availability'
  }

  return (
    <AdminLayout
      active="notifications"
      title="Notification Management"
      actions={[
        <button key="delete-old" className="action-btn" onClick={handleDeleteOlder} style={{ color: '#ef4444' }}>
          <Trash2 className="h-4 w-4" /> Delete Older
        </button>,
        <button key="export" className="action-btn" onClick={handleExport}>
          <Download className="h-4 w-4" /> Export
        </button>,
        <button key="send" className="action-btn" style={{ background: '#4f46e5', color: 'white' }} onClick={() => setShowSendModal(true)}>
          <Send className="h-4 w-4" /> Send Notification
        </button>
      ]}
    >
      {error && <div className="error-message">{error}</div>}

      {stats && (
        <div className="stats-grid" style={{ marginBottom: '1.5rem' }}>
          <div className="stat-card">
            <div className="stat-value" style={{ color: '#4f46e5' }}>{stats.total || 0}</div>
            <div className="stat-label">Total Notifications</div>
          </div>
          <div className="stat-card">
            <div className="stat-value" style={{ color: '#ef4444' }}>{stats.unread || 0}</div>
            <div className="stat-label">Unread</div>
          </div>
          <div className="stat-card">
            <div className="stat-value" style={{ color: '#10b981' }}>{stats.recipients || 0}</div>
            <div className="stat-label">Active Recipients</div>
          </div>
          {notificationTypes.map((t) => (
            <div className="stat-card" key={t.value}>
              <div className="stat-value" style={{ color: '#64748b' }}>{stats.byType?.[t.value] || 0}</div>
              <div className="stat-label">{t.label}</div>
            </div>
          ))}
        </div>
      )}

      <div className="filters-section">
        <div className="search-bar">
          <Search className="search-icon" />
          <input value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} placeholder="Search by title, message, or recipient..." />
        </div>
        <div className="filter-controls">
          <select value={filterType} onChange={(e) => setFilterType(e.target.value)} className="filter-select">
            <option value="all">All Types</option>
            {notificationTypes.map((t) => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
          <select value={filterRead} onChange={(e) => setFilterRead(e.target.value)} className="filter-select">
            <option value="all">All Status</option>
            <option value="unread">Unread</option>
            <option value="read">Read</option>
          </select>
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '2rem', color: '#64748b' }}>Loading notifications...</div>
      ) : (
        <div className="section-card full-width">
          <h3>Notification Entries ({hasLocalFilters ? filteredLogs.length : meta.total})</h3>
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Date & Time</th>
                  <th>Recipient</th>
                  <th>Type</th>
                  <th>Status</th>
                  <th>Title</th>
                  <th>Message</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredLogs.length === 0 ? (
                  <tr>
                    <td colSpan="7" style={{ textAlign: 'center', padding: '2rem', color: '#64748b' }}>No notifications found</td>
                  </tr>
                ) : filteredLogs.map((notif) => (
                  <tr key={notif._id}>
                    <td style={{ whiteSpace: 'nowrap', fontSize: '0.85rem' }}>{new Date(notif.createdAt).toLocaleString()}</td>
                    <td>
                      <div style={{ fontWeight: '500' }}>{notif.userId?.fullName || 'Unknown User'}</div>
                      <div style={{ fontSize: '0.8rem', color: '#64748b' }}>{notif.userId?.email || ''}</div>
                    </td>
                    <td>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                        <span>{typeIcons[notif.type] || '🔔'}</span>
                        {typeLabels[notif.type] || notif.type}
                      </span>
                    </td>
                    <td>
                      <button
                        onClick={() => handleReadToggle(notif._id)}
                        style={{
                          padding: '0.25rem 0.75rem',
                          borderRadius: '1rem',
                          fontSize: '0.75rem',
                          fontWeight: '600',
                          border: 'none',
                          cursor: 'pointer',
                          background: notif.read ? '#f1f5f9' : '#dcfce7',
                          color: notif.read ? '#64748b' : '#166534'
                        }}
                      >
                        {notif.read ? 'Read' : 'Unread'}
                      </button>
                    </td>
                    <td style={{ fontWeight: '500' }}>{notif.title || '—'}</td>
                    <td style={{ fontSize: '0.85rem', color: '#64748b', maxWidth: '250px' }}>{notif.message || '—'}</td>
                    <td>
                      <button onClick={() => handleReadToggle(notif._id)} className="action-btn" title={notif.read ? 'Mark as unread' : 'Mark as read'}>
                        <CheckCircle className="h-4 w-4" style={{ color: notif.read ? '#94a3b8' : '#10b981' }} />
                      </button>
                      <button onClick={() => handleDelete(notif._id)} className="action-btn" title="Delete">
                        <Trash2 className="h-4 w-4" style={{ color: '#ef4444' }} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <Pagination
              page={page}
              totalPages={meta.totalPages}
              total={meta.total}
              limit={meta.limit}
              onPageChange={handlePageChange}
              onLimitChange={handleLimitChange}
              itemLabel="notifications"
              disabled={loading}
            />
          </div>
        </div>
      )}

      {showSendModal && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <div style={{
            background: 'white',
            borderRadius: '0.75rem',
            padding: '2rem',
            width: '90%',
            maxWidth: '500px',
            maxHeight: '80vh',
            overflow: 'auto'
          }}>
            <h3 style={{ margin: '0 0 1.5rem' }}>Send Notification</h3>
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', marginBottom: '0.25rem', fontWeight: '500' }}>Notification Type</label>
              <select
                value={sendForm.type}
                onChange={(e) => setSendForm({ ...sendForm, type: e.target.value })}
                className="filter-select"
              >
                {notificationTypes.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', marginBottom: '0.25rem', fontWeight: '500' }}>Title</label>
              <input
                type="text"
                value={sendForm.title}
                onChange={(e) => setSendForm({ ...sendForm, title: e.target.value })}
                placeholder="Enter notification title"
                className="form-input"
                style={{ width: '100%', padding: '0.5rem', border: '1px solid #e2e8f0', borderRadius: '0.5rem' }}
              />
            </div>
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', marginBottom: '0.25rem', fontWeight: '500' }}>Message</label>
              <textarea
                value={sendForm.message}
                onChange={(e) => setSendForm({ ...sendForm, message: e.target.value })}
                placeholder="Enter notification message"
                className="form-input"
                rows="3"
                style={{ width: '100%', padding: '0.5rem', border: '1px solid #e2e8f0', borderRadius: '0.5rem' }}
              />
            </div>
            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ display: 'block', marginBottom: '0.25rem', fontWeight: '500' }}>Recipients</label>
              <select
                value={sendForm.recipient}
                onChange={(e) => setSendForm({ ...sendForm, recipient: e.target.value })}
                className="filter-select"
              >
                <option value="all">All Users & Partners</option>
                <option value="customer">Customers Only</option>
                <option value="tour_operator">Tour Operators Only</option>
                <option value="hotel_partner">Hotel Partners Only</option>
                <option value="admin">Admins Only</option>
                <option value="custom">Specific Users (comma-separated IDs)</option>
              </select>
              {sendForm.recipient === 'custom' && (
                <input
                  type="text"
                  value={sendForm.customUserIds}
                  onChange={(e) => setSendForm({ ...sendForm, customUserIds: e.target.value })}
                  placeholder="e.g. 64a1b2c3d4e5f6a7b8c9d0e1, 64a1b2c3d4e5f6a7b8c9d0e2"
                  className="form-input"
                  style={{ width: '100%', marginTop: '0.5rem', padding: '0.5rem', border: '1px solid #e2e8f0', borderRadius: '0.5rem' }}
                />
              )}
            </div>
            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
              <button onClick={() => setShowSendModal(false)} className="action-btn" style={{ border: '1px solid #e2e8f0' }}>
                Cancel
              </button>
              <button
                onClick={handleSend}
                disabled={sending}
                style={{
                  background: '#4f46e5',
                  color: 'white',
                  border: 'none',
                  padding: '0.5rem 1.5rem',
                  borderRadius: '0.5rem',
                  cursor: sending ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem'
                }}
              >
                {sending ? 'Sending...' : <><Send className="h-4 w-4" /> Send</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  )
}

export default NotificationsManagement
