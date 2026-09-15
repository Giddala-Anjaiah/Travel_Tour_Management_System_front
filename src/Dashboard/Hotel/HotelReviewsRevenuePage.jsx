import { useState, useEffect, useCallback } from 'react'
import { Star, TrendingUp, Bell, Reply, CheckCircle, XCircle, Trash2, Send, Search, X } from 'lucide-react'
import HotelLayout from './HotelLayout'
import { api, formatCurrency, formatDate } from '../../api'
import '../Dashboard.css'

const HotelReviewsRevenuePage = () => {
  const [activeTab, setActiveTab] = useState('reviews')
  const [reviews, setReviews] = useState([])
  const [revenue, setRevenue] = useState(null)
  const [notifications, setNotifications] = useState([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [responding, setResponding] = useState(null)
  const [responseText, setResponseText] = useState('')
  const [filterRating, setFilterRating] = useState('all')
  const [filterStatus, setFilterStatus] = useState('all')
  const [search, setSearch] = useState('')
  const [range, setRange] = useState('month')
  const [refreshKey, setRefreshKey] = useState(0)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      setError('')
      if (activeTab === 'reviews') {
        const data = await api('/hotel/reviews')
        setReviews(data.reviews || [])
      } else if (activeTab === 'revenue') {
        const data = await api(`/hotel/revenue?range=${range}`)
        setRevenue(data)
      } else if (activeTab === 'notifications') {
        const data = await api('/hotel/notifications')
        setNotifications(data.notifications || [])
        setUnreadCount(data.unreadCount || 0)
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [activeTab, range])

  useEffect(() => {
    Promise.resolve().then(() => load())
  }, [load, refreshKey])

  useEffect(() => {
    const id = setInterval(() => setRefreshKey(k => k + 1), 30000)
    return () => clearInterval(id)
  }, [])

  const markAllRead = async () => {
    try {
      await api('/hotel/notifications/read-all', { method: 'PUT' })
      setNotifications(prev => prev.map(n => ({ ...n, read: true })))
      setUnreadCount(0)
    } catch (err) { alert(err.message) }
  }

  const markRead = async (id) => {
    try {
      await api(`/hotel/notifications/${id}/read`, { method: 'PUT' })
      setNotifications(prev => prev.map(n => n._id === id ? { ...n, read: true } : n))
      setUnreadCount(prev => Math.max(0, prev - 1))
    } catch (err) { alert(err.message) }
  }

  const sendResponse = async () => {
    if (!responding || !responseText.trim()) return
    try {
      const data = await api(`/hotel/reviews/${responding._id}/respond`, { method: 'PUT', body: JSON.stringify({ response: responseText }) })
      setReviews(prev => prev.map(r => r._id === responding._id ? data.review : r))
      setResponding(null)
      setResponseText('')
    } catch (err) { alert(err.message) }
  }

  const updateReviewStatus = async (id, status) => {
    try {
      const data = await api(`/hotel/reviews/${id}/status`, { method: 'PUT', body: JSON.stringify({ status }) })
      setReviews(prev => prev.map(r => r._id === id ? data.review : r))
    } catch (err) { alert(err.message) }
  }

  const deleteReview = async (r) => {
    if (!confirm('Delete this review?')) return
    try {
      await api(`/hotel/reviews/${r._id}`, { method: 'DELETE' })
      setReviews(prev => prev.filter(x => x._id !== r._id))
    } catch (err) { alert(err.message) }
  }

  const filteredReviews = reviews.filter(r => {
    if (filterRating !== 'all' && r.rating !== Number(filterRating)) return false
    if (filterStatus !== 'all' && r.status !== filterStatus) return false
    if (search && !(r.customer || '').toLowerCase().includes(search.toLowerCase()) && !(r.comment || '').toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  const reviewStats = {
    total: reviews.length,
    approved: reviews.filter(r => r.status === 'approved').length,
    pending: reviews.filter(r => r.status === 'pending').length,
    avg: reviews.length > 0 ? (reviews.reduce((s, r) => s + r.rating, 0) / reviews.length).toFixed(1) : 0
  }

  return (
    <HotelLayout active="reviews" title="Reviews, Revenue & Notifications">
      {activeTab === 'reviews' && (
        <div className="stats-grid" style={{ marginBottom: '1rem' }}>
          <div className="stat-card"><Star className="stat-icon" /><div className="stat-content"><h3>Total Reviews</h3><p className="stat-number">{reviewStats.total}</p></div></div>
          <div className="stat-card"><CheckCircle className="stat-icon" /><div className="stat-content"><h3>Approved</h3><p className="stat-number" style={{ color: '#4ade80' }}>{reviewStats.approved}</p></div></div>
          <div className="stat-card"><div className="stat-content"><h3>Pending</h3><p className="stat-number" style={{ color: '#fbbf24' }}>{reviewStats.pending}</p></div></div>
          <div className="stat-card"><div className="stat-content"><h3>Average</h3><p className="stat-number">{reviewStats.avg}</p></div></div>
        </div>
      )}

      <div className="section-card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
          <h3 style={{ margin: 0 }}>{activeTab === 'reviews' ? 'Reviews' : activeTab === 'revenue' ? 'Revenue Analytics' : 'Notifications'}</h3>
          {activeTab === 'notifications' && unreadCount > 0 && <button className="btn-secondary" onClick={markAllRead}>Mark all as read</button>}
        </div>

        <div className="tabs-container" style={{ marginBottom: '1rem' }}>
          <div className="tabs">
            <button className={`tab ${activeTab === 'reviews' ? 'active' : ''}`} onClick={() => setActiveTab('reviews')}><Star size={14} /> Reviews</button>
            <button className={`tab ${activeTab === 'revenue' ? 'active' : ''}`} onClick={() => setActiveTab('revenue')}><TrendingUp size={14} /> Revenue</button>
            <button className={`tab ${activeTab === 'notifications' ? 'active' : ''}`} onClick={() => setActiveTab('notifications')}>
              <Bell size={14} /> Notifications {unreadCount > 0 && <span className="badge-dot">{unreadCount}</span>}
            </button>
          </div>
        </div>

        {loading && <p>Loading...</p>}
        {error && <p style={{ color: '#ef4444' }}>{error}</p>}

        {activeTab === 'reviews' && (
          <>
            <div className="filters-section enhanced">
              <div className="search-bar enhanced">
                <Search className="search-icon" />
                <input type="text" placeholder="Search by customer or comment..." value={search} onChange={e => setSearch(e.target.value)} />
              </div>
              <div className="filter-controls enhanced">
                <div className="filter-group">
                  <label>Rating</label>
                  <select value={filterRating} onChange={e => setFilterRating(e.target.value)} className="filter-select">
                    <option value="all">All</option>
                    {[5, 4, 3, 2, 1].map(n => <option key={n} value={n}>{n} stars</option>)}
                  </select>
                </div>
                <div className="filter-group">
                  <label>Status</label>
                  <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="filter-select">
                    <option value="all">All</option>
                    <option value="approved">approved</option>
                    <option value="pending">pending</option>
                    <option value="rejected">rejected</option>
                  </select>
                </div>
              </div>
            </div>

            {filteredReviews.length === 0 && !loading && <p style={{ color: '#64748b', textAlign: 'center', padding: '2rem' }}>No reviews match your filters.</p>}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {filteredReviews.map(r => (
                <div key={r._id} className="review-card">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                    <div>
                      <strong>{r.customer}</strong> · <span style={{ color: '#fbbf24' }}>{'★'.repeat(r.rating)}{'☆'.repeat(5 - r.rating)}</span>
                      <div style={{ color: '#64748b', fontSize: '0.8rem' }}>{r.package} · {formatDate(r.date)}</div>
                    </div>
                    <div style={{ display: 'flex', gap: '0.25rem' }}>
                      <span className={`status-pill status-${r.status}`}>{r.status}</span>
                      {r.status !== 'approved' && <button className="icon-btn" title="Approve" onClick={() => updateReviewStatus(r._id, 'approved')}><CheckCircle size={14} /></button>}
                      {r.status !== 'rejected' && <button className="icon-btn" title="Reject" onClick={() => updateReviewStatus(r._id, 'rejected')}><XCircle size={14} /></button>}
                      <button className="icon-btn danger" title="Delete" onClick={() => deleteReview(r)}><Trash2 size={14} /></button>
                    </div>
                  </div>
                  <p style={{ color: '#cbd5e1', margin: '0.5rem 0' }}>{r.comment}</p>
                  {r.response?.text ? (
                    <div style={{ background: 'rgba(99,102,241,0.1)', borderLeft: '3px solid #6366f1', padding: '0.75rem', borderRadius: '6px', marginTop: '0.5rem' }}>
                      <small style={{ color: '#a5b4fc', display: 'block', marginBottom: '0.25rem' }}>Your Response · {formatDate(r.response.date)}</small>
                      <em style={{ color: '#cbd5e1' }}>{r.response.text}</em>
                    </div>
                  ) : (
                    <button className="btn-secondary" onClick={() => { setResponding(r); setResponseText('') }} style={{ marginTop: '0.5rem' }}>
                      <Reply size={14} /> Reply
                    </button>
                  )}
                </div>
              ))}
            </div>
          </>
        )}

        {activeTab === 'revenue' && (
          <>
            <div className="filters-section enhanced" style={{ marginBottom: '1rem' }}>
              <div className="filter-controls enhanced">
                <div className="filter-group">
                  <label>Range</label>
                  <select value={range} onChange={e => setRange(e.target.value)} className="filter-select">
                    <option value="week">Last 7 days</option>
                    <option value="month">Last 30 days</option>
                    <option value="quarter">Last 90 days</option>
                    <option value="year">Last 12 months</option>
                  </select>
                </div>
              </div>
            </div>
            {revenue && (
              <>
                <div className="stats-grid" style={{ marginBottom: '1rem' }}>
                  <div className="stat-card"><div className="stat-content"><h3>Total Revenue</h3><p className="stat-number">{formatCurrency(revenue.totalRevenue || 0)}</p></div></div>
                  <div className="stat-card"><div className="stat-content"><h3>Range Revenue</h3><p className="stat-number">{formatCurrency(revenue.rangeRevenue || 0)}</p></div></div>
                  <div className="stat-card"><div className="stat-content"><h3>Paid Bookings</h3><p className="stat-number">{revenue.totalBookings || 0}</p></div></div>
                </div>
                <h4>Monthly Trend</h4>
                <table className="data-table">
                  <thead><tr><th>Month</th><th>Revenue</th></tr></thead>
                  <tbody>
                    {(revenue.monthlyRevenue || []).map((amt, i) => (
                      <tr key={i}>
                        <td>{i === 0 ? 'This month' : `${i} month${i > 1 ? 's' : ''} ago`}</td>
                        <td>{formatCurrency(amt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </>
            )}
          </>
        )}

        {activeTab === 'notifications' && (
          notifications.length === 0 && !loading ? <p style={{ color: '#64748b', textAlign: 'center', padding: '2rem' }}>No notifications yet.</p> : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {notifications.map(n => (
                <div key={n._id} className={`notification-card ${n.read ? 'read' : 'unread'}`} onClick={() => !n.read && markRead(n._id)} style={{ cursor: !n.read ? 'pointer' : 'default' }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
                    <Bell size={16} style={{ color: n.read ? '#64748b' : '#6366f1', marginTop: '0.2rem' }} />
                    <div style={{ flex: 1 }}>
                      <strong>{n.title}</strong>
                      <p style={{ color: '#cbd5e1', margin: '0.25rem 0 0' }}>{n.message}</p>
                      <small style={{ color: '#64748b' }}>{formatDate(n.createdAt)}</small>
                    </div>
                    {!n.read && <span className="badge-dot">{n.type}</span>}
                  </div>
                </div>
              ))}
            </div>
          )
        )}
      </div>

      {responding && (
        <div className="modal-overlay" onClick={() => setResponding(null)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '520px' }}>
            <div className="modal-header">
              <h3>Respond to Review</h3>
              <button className="modal-close" onClick={() => setResponding(null)}><X size={18} /></button>
            </div>
            <div className="modal-body">
              <div style={{ padding: '0.75rem', background: 'rgba(99,102,241,0.08)', borderRadius: '8px', marginBottom: '1rem' }}>
                <div><strong>{responding.customer}</strong> · <span style={{ color: '#fbbf24' }}>{'★'.repeat(responding.rating)}{'☆'.repeat(5 - responding.rating)}</span></div>
                <em style={{ color: '#cbd5e1' }}>"{responding.comment}"</em>
              </div>
              <div className="form-group">
                <label>Your Response</label>
                <textarea rows={4} value={responseText} onChange={e => setResponseText(e.target.value)} placeholder="Thank the guest and address their feedback..." style={{ width: '100%', padding: '0.5rem', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.05)', color: 'white' }} />
              </div>
              <div className="form-actions">
                <button type="button" className="btn-secondary" onClick={() => setResponding(null)}>Cancel</button>
                <button type="button" className="btn-primary" onClick={sendResponse} disabled={!responseText.trim()}><Send size={14} /> Send Response</button>
              </div>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .review-card { padding: 1rem; background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.06); border-radius: 10px; }
        .notification-card { padding: 1rem; background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.06); border-radius: 10px; transition: background 0.2s; }
        .notification-card.unread { background: rgba(99,102,241,0.08); border-color: rgba(99,102,241,0.3); }
        .notification-card:hover { background: rgba(99,102,241,0.12); }
        .badge-dot { display: inline-block; padding: 0.15rem 0.5rem; border-radius: 12px; background: #6366f1; color: white; font-size: 0.7rem; font-weight: 600; text-transform: capitalize; }
        .icon-btn.danger:hover { color: #f87171; }
        .status-pill { display: inline-block; padding: 0.2rem 0.55rem; border-radius: 6px; font-size: 0.75rem; font-weight: 600; text-transform: capitalize; }
        .status-pill.status-approved { background: rgba(34,197,94,0.2); color: #4ade80; }
        .status-pill.status-pending { background: rgba(245,158,11,0.2); color: #fbbf24; }
        .status-pill.status-rejected { background: rgba(239,68,68,0.2); color: #f87171; }
      `}</style>
    </HotelLayout>
  )
}

export default HotelReviewsRevenuePage