import { useEffect, useState } from 'react'
import { Send, Search, Download, CheckCircle, Trash2, Bell, Users, Calendar, DollarSign, Star, Settings, Gift, Building } from 'lucide-react'
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

  const typeIconMap = {
    booking: Calendar,
    payment: DollarSign,
    review: Star,
    system: Settings,
    offer: Gift,
    availability: Building
  }

  const typeLabels = {
    booking: 'Booking',
    payment: 'Payment',
    review: 'Review',
    system: 'System',
    offer: 'Offer',
    availability: 'Availability'
  }

  const renderTypeIcon = (type) => {
    const Icon = typeIconMap[type] || Bell
    return <Icon className="h-4 w-4" />
  }

  return (
    <AdminLayout
      active="notifications"
      title="Notification Management"
    >
      <div className="notifications-page">
        {error && <div className="error-message">{error}</div>}

        {stats && (
          <div className="stats-grid enhanced">
            <div className="stat-card"><Bell className="stat-icon" /><div className="stat-content"><h3>Total Notifications</h3><p className="stat-number">{stats.total || 0}</p></div></div>
            <div className="stat-card"><CheckCircle className="stat-icon" /><div className="stat-content"><h3>Unread</h3><p className="stat-number">{stats.unread || 0}</p></div></div>
            <div className="stat-card"><Users className="stat-icon" /><div className="stat-content"><h3>Active Recipients</h3><p className="stat-number">{stats.recipients || 0}</p></div></div>
            {notificationTypes.map((t) => {
              const Icon = typeIconMap[t.value] || Bell
              return (
                <div className="stat-card" key={t.value}>
                  <Icon className="stat-icon" />
                  <div className="stat-content"><h3>{t.label}</h3><p className="stat-number">{stats.byType?.[t.value] || 0}</p></div>
                </div>
              )
            })}
          </div>
        )}

        <div className="filters-section enhanced">
          <div className="search-bar enhanced">
            <Search className="search-icon" />
            <input value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} placeholder="Search by title, message, or recipient..." />
          </div>
          <div className="filter-controls enhanced">
            <select value={filterType} onChange={(e) => setFilterType(e.target.value)} className="filter-select enhanced">
              <option value="all">All Types</option>
              {notificationTypes.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
            <select value={filterRead} onChange={(e) => setFilterRead(e.target.value)} className="filter-select enhanced">
              <option value="all">All Status</option>
              <option value="unread">Unread</option>
              <option value="read">Read</option>
            </select>
          </div>
          <div className="page-actions">
            <button className="action-btn enhanced delete-older" onClick={handleDeleteOlder}>
              <Trash2 className="h-4 w-4" /> Delete Older
            </button>
            <button className="action-btn enhanced secondary" onClick={handleExport}>
              <Download className="h-4 w-4" /> Export
            </button>
            <button className="action-btn enhanced" onClick={() => setShowSendModal(true)}>
              <Send className="h-4 w-4" /> Send Notification
            </button>
          </div>
        </div>

        {loading ? (
          <div className="skeleton-wrap">
            {[0, 1, 2, 3, 4].map((i) => <div key={i} className="skeleton-bar" style={{ width: `${96 - i * 4}%` }} />)}
          </div>
        ) : (
          <div className="section-card enhanced full-width">
            <h3><Bell className="h-5 w-5" /> Notification Entries ({hasLocalFilters ? filteredLogs.length : meta.total})</h3>
            <div className="table-container enhanced">
              <table className="data-table enhanced">
                <thead>
                  <tr>
                    <th>Date &amp; Time</th>
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
                      <td colSpan="7">
                        <div className="empty-state enhanced">
                          <Bell className="h-8 w-8" />
                          <h3>No notifications found</h3>
                          <p>Try adjusting your search or filters.</p>
                        </div>
                      </td>
                    </tr>
                  ) : filteredLogs.map((notif) => (
                    <tr key={notif._id}>
                      <td className="cell-nowrap">{new Date(notif.createdAt).toLocaleString()}</td>
                      <td>
                        <div className="recipient-name">{notif.userId?.fullName || 'Unknown User'}</div>
                        <div className="recipient-email">{notif.userId?.email || ''}</div>
                      </td>
                      <td>
                        <span className={`notif-type ${notif.type || 'system'}`}>
                          {renderTypeIcon(notif.type)}
                          {typeLabels[notif.type] || notif.type}
                        </span>
                      </td>
                      <td>
                        <button className={`read-toggle ${notif.read ? 'read' : 'unread'}`} onClick={() => handleReadToggle(notif._id)} title={notif.read ? 'Mark as unread' : 'Mark as read'}>
                          {notif.read ? 'Read' : 'Unread'}
                        </button>
                      </td>
                      <td className="notif-title">{notif.title || '—'}</td>
                      <td className="cell-ellipsis" title={notif.message || ''}>{notif.message || '—'}</td>
                      <td>
                        <div className="action-buttons enhanced">
                          <button className="icon-btn enhanced" title={notif.read ? 'Mark as unread' : 'Mark as read'} onClick={() => handleReadToggle(notif._id)}>
                            <CheckCircle className="h-4 w-4" />
                          </button>
                          <button className="icon-btn enhanced delete" title="Delete" onClick={() => handleDelete(notif._id)}>
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
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
        <div className="modal-overlay enhanced" onClick={() => setShowSendModal(false)}>
          <div className="modal enhanced" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Send Notification</h3>
              <button className="modal-close" onClick={() => setShowSendModal(false)}>×</button>
            </div>
            <div className="modal-body">
              <div className="send-form">
                <div className="form-group">
                  <label>Notification Type</label>
                  <select value={sendForm.type} onChange={(e) => setSendForm({ ...sendForm, type: e.target.value })}>
                    {notificationTypes.map((t) => (
                      <option key={t.value} value={t.value}>{t.label}</option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label>Title</label>
                  <input
                    type="text"
                    value={sendForm.title}
                    onChange={(e) => setSendForm({ ...sendForm, title: e.target.value })}
                    placeholder="Enter notification title"
                  />
                </div>
                <div className="form-group">
                  <label>Message</label>
                  <textarea
                    value={sendForm.message}
                    onChange={(e) => setSendForm({ ...sendForm, message: e.target.value })}
                    placeholder="Enter notification message"
                    rows="3"
                  />
                </div>
                <div className="form-group">
                  <label>Recipients</label>
                  <select value={sendForm.recipient} onChange={(e) => setSendForm({ ...sendForm, recipient: e.target.value })}>
                    <option value="all">All Users &amp; Partners</option>
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
                      className="send-custom-ids"
                    />
                  )}
                </div>
                <div className="form-actions">
                  <button className="btn-secondary" onClick={() => setShowSendModal(false)}>Cancel</button>
                  <button className="btn-primary" onClick={handleSend} disabled={sending}>
                    {sending ? 'Sending...' : (<><Send className="h-4 w-4" /> Send</>)}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
      </div>
    </AdminLayout>
  )
}

export default NotificationsManagement
