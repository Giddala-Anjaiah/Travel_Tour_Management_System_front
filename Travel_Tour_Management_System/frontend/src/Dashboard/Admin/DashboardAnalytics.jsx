import { useEffect, useState } from 'react'
import { BarChart3, Users, MapPin, Building, Ticket, DollarSign, Star, TrendingUp, Download, FileText, Tag, ChevronLeft, ChevronRight, Clock, ShoppingBag, Award, AlertCircle, RefreshCw, LogIn, PieChart } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import { api, downloadCsv, formatCurrency } from '../../api'
import AdminLayout from './AdminLayout'
import ChartBar from './ChartBar'

const DashboardAnalytics = () => {
  const navigate = useNavigate()
  const [analytics, setAnalytics] = useState(null)
  const [timeRange, setTimeRange] = useState('month')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [recentActivityPage, setRecentActivityPage] = useState(1)
  const [upcomingBookingsPage, setUpcomingBookingsPage] = useState(1)
  const ITEMS_PER_PAGE = 5

  const loadAnalytics = async () => {
    try {
      setLoading(true)
      setError('')
      const token = localStorage.getItem('token')
      if (!token) {
        setError('Authentication required. Please log in as admin.')
        return
      }
      console.log('Fetching analytics for range:', timeRange)
      const data = await api(`/admin/analytics?range=${timeRange}`)
      console.log('Analytics data received:', data)
      setAnalytics(data)
    } catch (err) {
      console.error('Analytics fetch error:', err)
      const msg = err.message || 'Failed to load analytics'
      if (msg.includes('Unauthorized') || msg.includes('401') || msg.includes('403')) {
        setError('Session expired or unauthorized. Please log in again.')
      } else {
        setError(msg)
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadAnalytics()
  }, [timeRange])

  const exportReport = () => {
    if (!analytics) return
    const data = safeAnalytics
    downloadCsv(
      'analytics-report.csv',
      ['Metric', 'Value'],
      [
        ['Total Users', data.totalUsers || 0],
        ['Active Tours', data.activeTours || 0],
        ['Partner Hotels', data.partnerHotels || 0],
        ['Total Bookings', data.totalBookings || 0],
        ['Total Revenue', data.totalRevenue || 0],
        ['Average Rating', data.avgRating || 0],
        ['Confirmed Bookings', bookingStats.confirmed || 0],
        ['Pending Bookings', bookingStats.pending || 0],
        ['Cancelled Bookings', bookingStats.cancelled || 0]
      ]
    )
  }

  const recentActivity = Array.isArray(analytics?.recentActivity) ? analytics.recentActivity : []
  const upcomingBookings = Array.isArray(analytics?.upcomingBookings) ? analytics.upcomingBookings : []
  const paginatedActivity = recentActivity.slice((recentActivityPage - 1) * ITEMS_PER_PAGE, recentActivityPage * ITEMS_PER_PAGE)
  const paginatedBookings = upcomingBookings.slice((upcomingBookingsPage - 1) * ITEMS_PER_PAGE, upcomingBookingsPage * ITEMS_PER_PAGE)

  const getActivityIcon = (type) => {
    switch (type) {
      case 'user': return <Users className="activity-icon" />
      case 'booking': return <Ticket className="activity-icon" />
      case 'review': return <Star className="activity-icon" />
      case 'invoice': return <FileText className="activity-icon" />
      default: return <Clock className="activity-icon" />
    }
  }

  // Safe data accessors with defaults
  const safeAnalytics = analytics || {}
  const monthlyRevenue = Array.isArray(safeAnalytics.monthlyRevenue) ? safeAnalytics.monthlyRevenue : []
  const userGrowth = Array.isArray(safeAnalytics.userGrowth) ? safeAnalytics.userGrowth : []
  const bookingStats = safeAnalytics.bookingStats || { confirmed: 0, pending: 0, cancelled: 0 }
  const topTours = Array.isArray(safeAnalytics.topTours) ? safeAnalytics.topTours : []
  const rooms = safeAnalytics.rooms || { total: 0, available: 0, booked: 0 }
  const range = safeAnalytics.range || { bookings: 0, users: 0, revenue: 0 }
  const availabilityPct = rooms.total ? Math.round(((rooms.available || 0) / rooms.total) * 100) : 0

  return (
    <AdminLayout
      active="dashboard"
      title="Dashboard Analytics"
      actions={
        <select value={timeRange} onChange={(e) => setTimeRange(e.target.value)} className="filter-select enhanced" disabled={loading}>
          <option value="week">This Week</option>
          <option value="month">This Month</option>
          <option value="quarter">This Quarter</option>
          <option value="year">This Year</option>
        </select>
      }
    >
      {error && (
        <div className="error-message" style={{padding: '1.5rem', background: 'var(--danger-light)', color: 'var(--danger)', borderRadius: 'var(--radius-lg)', marginBottom: '1.5rem', border: '2px solid var(--danger)', display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap'}}>
          <AlertCircle className="h-6 w-6 flex-shrink-0" />
          <div style={{flex: 1, minWidth: '200px'}}>{error}</div>
          <button onClick={loadAnalytics} className="action-btn enhanced secondary" style={{padding: '0.5rem 1rem', whiteSpace: 'nowrap'}} disabled={loading}>
            <RefreshCw className="h-4 w-4" style={{marginRight: '0.5rem'}} /> Retry
          </button>
          {error.includes('log in') && (
            <button onClick={() => navigate('/login')} className="action-btn enhanced" style={{padding: '0.5rem 1rem', whiteSpace: 'nowrap'}}>
              <LogIn className="h-4 w-4" style={{marginRight: '0.5rem'}} /> Go to Login
            </button>
          )}
        </div>
      )}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-tertiary)' }}>
          <div className="spinner" style={{display: 'inline-block', width: '2rem', height: '2rem', border: '3px solid var(--primary)', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite', marginBottom: '1rem'}}></div>
          Loading analytics...
        </div>
      ) : !analytics ? (
        <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-tertiary)' }}>
          <AlertCircle className="h-12 w-12" style={{margin: '0 auto 1rem', color: 'var(--text-tertiary)'}} />
          No data available
        </div>
      ) : (
        <>
          <div className="stats-grid enhanced">
            <div className="stat-card">
              <div className="stat-icon"><Users /></div>
              <div className="stat-content">
                <h3>Total Users</h3>
                <p className="stat-number">{safeAnalytics.totalUsers?.toLocaleString() || 0}</p>
                <span className="stat-change positive">
                  <TrendingUp className="h-3 w-3" /> +{range.users || 0} in range
                </span>
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-icon"><MapPin /></div>
              <div className="stat-content">
                <h3>Active Tours</h3>
                <p className="stat-number">{safeAnalytics.activeTours || 0}</p>
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-icon"><Building /></div>
              <div className="stat-content">
                <h3>Partner Hotels</h3>
                <p className="stat-number">{safeAnalytics.partnerHotels || 0}</p>
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-icon"><Ticket /></div>
              <div className="stat-content">
                <h3>Total Bookings</h3>
                <p className="stat-number">{(safeAnalytics.totalBookings || 0).toLocaleString()}</p>
                <span className="stat-change positive">
                  <TrendingUp className="h-3 w-3" /> {range.bookings || 0} in range
                </span>
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-icon"><DollarSign /></div>
              <div className="stat-content">
                <h3>Total Revenue</h3>
                <p className="stat-number">{formatCurrency(safeAnalytics.totalRevenue || 0)}</p>
                <span className="stat-change positive">
                  <TrendingUp className="h-3 w-3" /> {formatCurrency(range.revenue || 0)} in range
                </span>
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-icon"><Star /></div>
              <div className="stat-content">
                <h3>Avg Rating</h3>
                <p className="stat-number">{safeAnalytics.avgRating || 0}</p>
              </div>
            </div>
          </div>

          <div className="dashboard-sections analytics-sections">
            <div className="section-card enhanced full-width">
              <h3><BarChart3 className="h-5 w-5" /> Revenue Trend (last 6 months)</h3>
              <ChartBar
                type="line"
                data={monthlyRevenue.map((value, index) => {
                  const date = new Date()
                  date.setMonth(date.getMonth() - ((monthlyRevenue.length || 1) - 1 - index))
                  return { label: date.toLocaleString('en-US', { month: 'short' }), value, format: 'currency' }
                })}
                height={280}
              />
            </div>

            <div className="section-card enhanced">
              <h3><Users className="h-5 w-5" /> User Growth</h3>
              <ChartBar
                type="line"
                data={userGrowth.map((value, index) => {
                  const date = new Date()
                  date.setMonth(date.getMonth() - ((userGrowth.length || 1) - 1 - index))
                  return { label: date.toLocaleString('en-US', { month: 'short' }), value }
                })}
                height={220}
              />
            </div>

            <div className="section-card enhanced">
              <h3><PieChart className="h-5 w-5" /> Booking Status</h3>
              <ChartBar type="pie" data={bookingStats} height={220} />
            </div>

            <div className="section-card enhanced">
              <h3><Award className="h-5 w-5" /> Top Performing Tours</h3>
              <ChartBar type="bar" data={topTours.map(t => ({ label: t.name, value: t.bookings }))} height={220} />
            </div>

            <div className="section-card enhanced full-width">
              <h3><Clock className="h-5 w-5" /> Recent Activity</h3>
              <ul className="activity-list enhanced">
                {recentActivity.length === 0 ? (
                  <li className="empty-state enhanced"><Clock className="h-8 w-8" /><h3>No recent activity</h3></li>
                ) : (
                  paginatedActivity.map((item, index) => (
                    <li key={`${item.type}-${index}`}>
                      {getActivityIcon(item.type)}
                      <span>{item.text}</span>
                    </li>
                  ))
                )}
              </ul>
              {recentActivity.length > ITEMS_PER_PAGE && (
                <div className="pagination-controls analytics-pagination">
                  <button onClick={() => setRecentActivityPage(p => Math.max(1, p - 1))} disabled={recentActivityPage === 1} className="action-btn enhanced secondary" style={{ padding: '0.5rem 1rem' }}>
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <span style={{ display: 'flex', alignItems: 'center', color: 'var(--text-secondary)' }}>
                    Page {recentActivityPage} of {Math.ceil(recentActivity.length / ITEMS_PER_PAGE)}
                  </span>
                  <button onClick={() => setRecentActivityPage(p => Math.min(Math.ceil(recentActivity.length / ITEMS_PER_PAGE), p + 1))} disabled={recentActivityPage >= Math.ceil(recentActivity.length / ITEMS_PER_PAGE)} className="action-btn enhanced secondary" style={{ padding: '0.5rem 1rem' }}>
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              )}
            </div>

            <div className="section-card enhanced full-width">
              <h3><ShoppingBag className="h-5 w-5" /> Upcoming Bookings</h3>
              <ul className="booking-list enhanced">
                {upcomingBookings.length === 0 ? (
                  <li className="empty-state enhanced"><ShoppingBag className="h-8 w-8" /><h3>No upcoming bookings</h3></li>
                ) : (
                  <>
                    <li className="booking-head"><span>Customer</span><span>Package</span><span>Dates</span><span>Status</span></li>
                    {paginatedBookings.map((booking, index) => (
                      <li key={`${booking.customer}-${index}`}>
                        <span className="booking-customer">{booking.customer}</span>
                        <span className="booking-package">{booking.package}</span>
                        <span className="booking-dates">{booking.dates}</span>
                        <span className={`status-badge enhanced ${booking.status}`}>{booking.status}</span>
                      </li>
                    ))}
                  </>
                )}
              </ul>
              {upcomingBookings.length > ITEMS_PER_PAGE && (
                <div className="pagination-controls analytics-pagination">
                  <button onClick={() => setUpcomingBookingsPage(p => Math.max(1, p - 1))} disabled={upcomingBookingsPage === 1} className="action-btn enhanced secondary" style={{ padding: '0.5rem 1rem' }}>
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <span style={{ display: 'flex', alignItems: 'center', color: 'var(--text-secondary)' }}>
                    Page {upcomingBookingsPage} of {Math.ceil(upcomingBookings.length / ITEMS_PER_PAGE)}
                  </span>
                  <button onClick={() => setUpcomingBookingsPage(p => Math.min(Math.ceil(upcomingBookings.length / ITEMS_PER_PAGE), p + 1))} disabled={upcomingBookingsPage >= Math.ceil(upcomingBookings.length / ITEMS_PER_PAGE)} className="action-btn enhanced secondary" style={{ padding: '0.5rem 1rem' }}>
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              )}
            </div>

            <div className="section-card enhanced">
              <h3><Building className="h-5 w-5" /> Room Availability</h3>
              <div className="room-grid">
                <div className="room-card">
                  <div className="room-type">
                    <span>Inventory</span>
                    <span className="room-pct">{availabilityPct}% free</span>
                  </div>
                  <div className="room-details">
                    <span>Available: {rooms.available || 0}</span>
                    <span>Booked: {rooms.booked || 0}</span>
                  </div>
                  <div className="availability-bar" role="progressbar" aria-valuenow={availabilityPct} aria-valuemin="0" aria-valuemax="100" aria-label="Room availability">
                    <div className="availability-fill" style={{ width: `${availabilityPct}%` }} />
                  </div>
                  <span className="room-price">Total rooms: {rooms.total || 0}</span>
                </div>
              </div>
            </div>

            <div className="section-card enhanced">
              <h3><Tag className="h-5 w-5" /> Quick Actions</h3>
              <div className="quick-actions">
                <button onClick={exportReport} className="action-btn enhanced" disabled={!analytics || loading}>
                  <Download className="h-4 w-4" /> Export Report
                </button>
                <Link to="/admin/users" className="action-btn enhanced"><Users className="h-4 w-4" /> Manage Users</Link>
                <Link to="/admin/destinations" className="action-btn enhanced"><MapPin className="h-4 w-4" /> Manage Packages</Link>
                <Link to="/admin/bookings" className="action-btn enhanced"><Ticket className="h-4 w-4" /> Manage Bookings</Link>
                <Link to="/admin/reports?tab=coupons" className="action-btn enhanced"><Tag className="h-4 w-4" /> Coupons</Link>
                <Link to="/admin/reports" className="action-btn enhanced"><BarChart3 className="h-4 w-4" /> View Reports</Link>
              </div>
            </div>
          </div>
        </>
      )}
    </AdminLayout>
  )
}

export default DashboardAnalytics
