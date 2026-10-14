import { useState, useEffect, useCallback } from 'react'
import { Star, TrendingUp, Bell, Reply, CheckCircle, XCircle, Trash2, Send, Search, DollarSign } from 'lucide-react'
import HotelLayout from './HotelLayout'
import { api, formatCurrency, formatDate, readPagination } from '../../api'
import Pagination from '../../components/Pagination'
import '../Dashboard.css'
import './HotelDashboard.css'

const emptyMeta = { page: 1, limit: 10, total: 0, totalPages: 1, hasNext: false, hasPrev: false }

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
  // Reviews and notifications page independently; the revenue tab renders
  // aggregates only, so it has no pager.
  const [pages, setPages] = useState({ reviews: 1, notifications: 1 })
  const [limits, setLimits] = useState({ reviews: 10, notifications: 10 })
  const [metas, setMetas] = useState({ reviews: emptyMeta, notifications: emptyMeta })

  // `/hotel/reviews` filters server-side on `search` (customer/comment/package)
  // only. Rating and status are not supported, so when either is active we load
  // the full set and filter the rendered rows locally.
  const hasLocalReviews = filterRating !== 'all' || filterStatus !== 'all'

  const load = useCallback(async () => {
    setLoading(true)
    try {
      setError('')
      if (activeTab === 'reviews') {
        const data = await api('/hotel/reviews', {
          params: {
            page: hasLocalReviews ? undefined : pages.reviews,
            limit: hasLocalReviews ? 'all' : limits.reviews,
            search
          }
        })
        const rows = data.reviews || []
        setReviews(rows)
        const next = readPagination(data, rows.length)
        setMetas(prev => ({ ...prev, reviews: next }))
        if (!hasLocalReviews && next.totalPages > 0 && pages.reviews > next.totalPages) {
          setPages(prev => ({ ...prev, reviews: next.totalPages }))
        }
      } else if (activeTab === 'revenue') {
        const data = await api('/hotel/revenue', { params: { range } })
        setRevenue(data)
      } else if (activeTab === 'notifications') {
        const data = await api('/hotel/notifications', {
          params: { page: pages.notifications, limit: limits.notifications }
        })
        const rows = data.notifications || []
        setNotifications(rows)
        setUnreadCount(data.unreadCount || 0)
        const next = readPagination(data, rows.length)
        setMetas(prev => ({ ...prev, notifications: next }))
        if (next.totalPages > 0 && pages.notifications > next.totalPages) {
          setPages(prev => ({ ...prev, notifications: next.totalPages }))
        }
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [activeTab, range, pages, limits, search, hasLocalReviews])

  useEffect(() => {
    Promise.resolve().then(() => load())
  }, [load, refreshKey])

  useEffect(() => {
    const id = setInterval(() => setRefreshKey(k => k + 1), 30000)
    return () => clearInterval(id)
  }, [])

  const handlePageChange = (tab) => (nextPage) => {
    setPages(prev => ({ ...prev, [tab]: nextPage }))
    setLoading(true)
  }

  const handleLimitChange = (tab) => (nextLimit) => {
    setLimits(prev => ({ ...prev, [tab]: nextLimit }))
    setPages(prev => ({ ...prev, [tab]: 1 }))
    setLoading(true)
  }

  // Deleting the only row on a page steps back one page instead of showing nothing.
  const stepBackAfterDelete = (tab, rows) => {
    if (pages[tab] > 1 && !hasLocalReviews && rows.length <= 1) {
      setLoading(true)
      setPages(prev => ({ ...prev, [tab]: prev[tab] - 1 }))
      return true
    }
    return false
  }

  const markAllRead = async () => {
    try {
      await api('/hotel/notifications/read-all', { method: 'PUT' })
      await load()
    } catch (err) { alert(err.message) }
  }

  const markRead = async (id) => {
    try {
      await api(`/hotel/notifications/${id}/read`, { method: 'PUT' })
      await load()
    } catch (err) { alert(err.message) }
  }

  const sendResponse = async () => {
    if (!responding || !responseText.trim()) return
    try {
      await api(`/hotel/reviews/${responding._id}/respond`, { method: 'PUT', body: JSON.stringify({ response: responseText }) })
      setResponding(null)
      setResponseText('')
      await load()
    } catch (err) { alert(err.message) }
  }

  const updateReviewStatus = async (id, status) => {
    try {
      await api(`/hotel/reviews/${id}/status`, { method: 'PUT', body: JSON.stringify({ status }) })
      await load()
    } catch (err) { alert(err.message) }
  }

  const deleteReview = async (r) => {
    if (!confirm('Delete this review?')) return
    try {
      await api(`/hotel/reviews/${r._id}`, { method: 'DELETE' })
      if (!stepBackAfterDelete('reviews', reviews)) await load()
    } catch (err) { alert(err.message) }
  }

  // `search` is applied server-side; only the unsupported rating/status bands
  // are resolved here, over the full set fetched while they are active.
  const filteredReviews = reviews.filter(r => {
    if (filterRating !== 'all' && r.rating !== Number(filterRating)) return false
    if (filterStatus !== 'all' && r.status !== filterStatus) return false
    return true
  })

  const reviewStats = {
    total: reviews.length,
    approved: reviews.filter(r => r.status === 'approved').length,
    pending: reviews.filter(r => r.status === 'pending').length,
    avg: reviews.length > 0 ? (reviews.reduce((s, r) => s + r.rating, 0) / reviews.length).toFixed(1) : 0
  }

  const renderStars = (rating) => {
    const full = '★'.repeat(rating)
    const empty = '☆'.repeat(5 - rating)
    return <span className="hr-rating">{full}{empty}</span>
  }

  return (
    <HotelLayout active="reviews" title="Reviews, Revenue & Notifications">
      {activeTab === 'reviews' && (
        <div className="hr-stats">
          <div className="hr-stat-card">
            <div className="hr-stat-icon bg-blue"><Star size={20} /></div>
            <div>
              <div className="hr-stat-label">Total Reviews</div>
              <div className="hr-stat-value">{reviewStats.total}</div>
            </div>
          </div>
          <div className="hr-stat-card">
            <div className="hr-stat-icon bg-emerald"><CheckCircle size={20} /></div>
            <div>
              <div className="hr-stat-label">Approved</div>
              <div className="hr-stat-value">{reviewStats.approved}</div>
            </div>
          </div>
          <div className="hr-stat-card">
            <div className="hr-stat-icon bg-amber"><Star size={20} /></div>
            <div>
              <div className="hr-stat-label">Pending</div>
              <div className="hr-stat-value">{reviewStats.pending}</div>
            </div>
          </div>
          <div className="hr-stat-card">
            <div className="hr-stat-icon bg-purple"><Star size={20} /></div>
            <div>
              <div className="hr-stat-label">Average Rating</div>
              <div className="hr-stat-value">{reviewStats.avg}</div>
            </div>
          </div>
        </div>
      )}

      <div className="hr-card">
        <div className="hr-card-head">
          <h3 className="hr-card-title">
            {activeTab === 'reviews' ? 'Reviews' : activeTab === 'revenue' ? 'Revenue Analytics' : 'Notifications'}
          </h3>
          {activeTab === 'notifications' && unreadCount > 0 && (
            <button className="hr-btn hr-btn-secondary hr-btn-sm" onClick={markAllRead}>Mark all as read</button>
          )}
        </div>

        <div className="hr-tabs">
          <button className={'hr-tab ' + (activeTab === 'reviews' ? 'active' : '')} onClick={() => setActiveTab('reviews')}>
            <Star size={14} /> Reviews
          </button>
          <button className={'hr-tab ' + (activeTab === 'revenue' ? 'active' : '')} onClick={() => setActiveTab('revenue')}>
            <TrendingUp size={14} /> Revenue
          </button>
          <button className={'hr-tab ' + (activeTab === 'notifications' ? 'active' : '')} onClick={() => setActiveTab('notifications')}>
            <Bell size={14} /> Notifications {' '}
            {unreadCount > 0 && <span className="hr-badge-dot">{unreadCount}</span>}
          </button>
        </div>

        {loading && <p className="hr-text-muted">Loading...</p>}
        {error && <p className="hr-error">{error}</p>}

        {activeTab === 'reviews' && (
          <>
            <div className="hr-filters">
              <div className="hr-search">
                <Search className="hr-search-icon" />
                <input type="text" placeholder="Search by customer or comment..." value={search} onChange={e => setSearch(e.target.value)} />
              </div>
              <div className="hr-filter-group">
                <label>Rating</label>
                <select value={filterRating} onChange={e => setFilterRating(e.target.value)} className="hr-inline-select">
                  <option value="all">All</option>
                  {[5, 4, 3, 2, 1].map(n => <option key={n} value={n}>{n} stars</option>)}
                </select>
              </div>
              <div className="hr-filter-group">
                <label>Status</label>
                <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="hr-inline-select">
                  <option value="all">All</option>
                  <option value="approved">approved</option>
                  <option value="pending">pending</option>
                  <option value="rejected">rejected</option>
                </select>
              </div>
            </div>

            {filteredReviews.length === 0 && !loading && (
              <div className="hr-placeholder">
                <p>No reviews match your filters.</p>
              </div>
            )}

            <div className="hr-review-list">
              {filteredReviews.map(r => (
                <div key={r._id} className="hr-review-card">
                  <div className="hr-review-card-head">
                    <div className="hr-review-author">
                      <strong>{r.customer}</strong>
                      {renderStars(r.rating)}
                      <div className="hr-review-meta">{r.package} · {formatDate(r.date)}</div>
                    </div>
                    <div className="hr-actions">
                      <span className={'hr-status-pill status-' + r.status}>{r.status}</span>
                      {r.status !== 'approved' && (
                        <button className="hr-icon-btn hr-btn-sm" title="Approve" onClick={() => updateReviewStatus(r._id, 'approved')}>
                          <CheckCircle size={14} />
                        </button>
                      )}
                      {r.status !== 'rejected' && (
                        <button className="hr-icon-btn hr-btn-sm" title="Reject" onClick={() => updateReviewStatus(r._id, 'rejected')}>
                          <XCircle size={14} />
                        </button>
                      )}
                      <button className="hr-icon-btn hr-btn-sm hr-danger" title="Delete" onClick={() => deleteReview(r)}>
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                  <p className="hr-review-comment">{r.comment}</p>
                  {r.response?.text ? (
                    <div className="hr-response">
                      <small className="hr-response-meta">Your Response · {formatDate(r.response.date)}</small>
                      <em className="hr-response-text">{r.response.text}</em>
                    </div>
                  ) : (
                    <button className="hr-btn hr-btn-secondary hr-btn-sm" onClick={() => { setResponding(r); setResponseText('') }}>
                      <Reply size={14} /> Reply
                    </button>
                  )}
                </div>
              ))}
            </div>

            <Pagination
              page={pages.reviews}
              totalPages={metas.reviews.totalPages}
              total={hasLocalReviews ? filteredReviews.length : metas.reviews.total}
              limit={metas.reviews.limit}
              onPageChange={handlePageChange('reviews')}
              onLimitChange={handleLimitChange('reviews')}
              itemLabel="reviews"
              disabled={loading || hasLocalReviews}
            />
          </>
        )}

        {activeTab === 'revenue' && (
          <>
            <div className="hr-filters">
              <div className="hr-filter-group">
                <label>Range</label>
                <select value={range} onChange={e => setRange(e.target.value)} className="hr-inline-select">
                  <option value="week">Last 7 days</option>
                  <option value="month">Last 30 days</option>
                  <option value="quarter">Last 90 days</option>
                  <option value="year">Last 12 months</option>
                </select>
              </div>
            </div>
            {revenue && (
              <>
                <div className="hr-stats">
                  <div className="hr-stat-card">
                    <div className="hr-stat-icon bg-emerald"><DollarSign size={20} /></div>
                    <div>
                      <div className="hr-stat-label">Total Revenue</div>
                      <div className="hr-stat-value">{formatCurrency(revenue.totalRevenue || 0)}</div>
                    </div>
                  </div>
                  <div className="hr-stat-card">
                    <div className="hr-stat-icon bg-blue"><DollarSign size={20} /></div>
                    <div>
                      <div className="hr-stat-label">Range Revenue</div>
                      <div className="hr-stat-value">{formatCurrency(revenue.rangeRevenue || 0)}</div>
                    </div>
                  </div>
                  <div className="hr-stat-card">
                    <div className="hr-stat-icon bg-purple"><DollarSign size={20} /></div>
                    <div>
                      <div className="hr-stat-label">Paid Bookings</div>
                      <div className="hr-stat-value">{revenue.totalBookings || 0}</div>
                    </div>
                  </div>
                </div>
                <h4 className="hr-section-subtitle">Monthly Trend</h4>
                <div className="hr-table-wrap">
                  <table className="hr-table">
                    <thead><tr><th>Month</th><th>Revenue</th></tr></thead>
                    <tbody>
                      {(revenue.monthlyRevenue || []).map((amt, i) => (
                        <tr key={i}>
                          <td>{i === 0 ? 'This month' : (i + ' month' + (i > 1 ? 's' : '') + ' ago')}</td>
                          <td>{formatCurrency(amt)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </>
        )}

        {activeTab === 'notifications' && (
          <>
            {notifications.length === 0 && !loading ? (
              <div className="hr-placeholder">
                <p>No notifications yet.</p>
              </div>
            ) : (
              <div className="hr-notification-list">
                {notifications.map(n => (
                  <div
                    key={n._id}
                    className={'hr-notification-card ' + (n.read ? 'read' : 'unread')}
                    onClick={() => !n.read && markRead(n._id)}
                  >
                    <div className="hr-notification-icon">
                      <Bell size={16} />
                    </div>
                    <div className="hr-notification-content">
                      <strong>{n.title}</strong>
                      <p>{n.message}</p>
                      <small>{formatDate(n.createdAt)}</small>
                    </div>
                    {!n.read && <span className="hr-badge-dot">{n.type}</span>}
                  </div>
                ))}
              </div>
            )}
            <Pagination
              page={pages.notifications}
              totalPages={metas.notifications.totalPages}
              total={metas.notifications.total}
              limit={metas.notifications.limit}
              onPageChange={handlePageChange('notifications')}
              onLimitChange={handleLimitChange('notifications')}
              itemLabel="notifications"
              disabled={loading}
            />
          </>
        )}
      </div>

      {responding && (
        <div className="hr-modal-overlay" onClick={() => setResponding(null)}>
          <div className="hr-modal" onClick={e => e.stopPropagation()}>
            <div className="hr-modal-head">
              <h3 className="hr-modal-title">Respond to Review</h3>
              <button className="hr-modal-close" onClick={() => setResponding(null)}><X size={18} /></button>
            </div>
            <div className="hr-modal-body">
              <div className="hr-review-summary">
                <div className="hr-review-summary-name">
                  <strong>{responding.customer}</strong> {renderStars(responding.rating)}
                </div>
                <em className="hr-review-summary-comment">"{responding.comment}"</em>
              </div>
              <div className="hr-form-group">
                <label>Your Response</label>
                <textarea
                  rows={4}
                  value={responseText}
                  onChange={e => setResponseText(e.target.value)}
                  placeholder="Thank the guest and address their feedback..."
                />
              </div>
              <div className="hr-form-actions">
                <button type="button" className="hr-btn hr-btn-secondary" onClick={() => setResponding(null)}>Cancel</button>
                <button type="button" className="hr-btn hr-btn-primary" onClick={sendResponse} disabled={!responseText.trim()}>
                  <Send size={14} /> Send Response
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </HotelLayout>
  )
}

export default HotelReviewsRevenuePage
