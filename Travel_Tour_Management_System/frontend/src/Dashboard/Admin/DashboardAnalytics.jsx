import { useEffect, useState } from 'react'
import { BarChart3, Users, MapPin, Building, Ticket, DollarSign, Star, TrendingUp, TrendingDown, Download, FileText, Tag, ChevronLeft, ChevronRight, Clock, ShoppingBag, Award, AlertCircle, PieChart, Activity, CreditCard, ShieldCheck } from 'lucide-react'
import { Link } from 'react-router-dom'
import { api, downloadCsv, formatCurrency } from '../../api'
import AdminLayout from './AdminLayout'
import ChartBar from './ChartBar'

const DashboardAnalytics = () => {
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
      const data = await api(`/admin/analytics?range=${timeRange}`)
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
    Promise.resolve().then(() => loadAnalytics())
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
        ['Gross Revenue', data.grossRevenue || 0],
        ['Total Discount', data.totalDiscount || 0],
        ['Total Refunded Amount', data.refundStats?.totalRefundedAmount || 0],
        ['Pending Refunds', data.refundStats?.pending || 0],
        ['Completed Refunds', data.refundStats?.completed || 0],
        ['Failed Refunds', data.refundStats?.failed || 0],
        ['Total Commissions', data.totalCommissions || 0],
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

  const safeAnalytics = analytics || {}
  const monthlyRevenue = Array.isArray(safeAnalytics.monthlyRevenue) ? safeAnalytics.monthlyRevenue : []
  const userGrowth = Array.isArray(safeAnalytics.userGrowth) ? safeAnalytics.userGrowth : []
  const bookingStats = safeAnalytics.bookingStats || { confirmed: 0, pending: 0, cancelled: 0 }
  const refundStats = safeAnalytics.refundStats || { pending: 0, completed: 0, failed: 0, notApplicable: 0, totalRefundedAmount: 0 }
  const topTours = Array.isArray(safeAnalytics.topTours) ? safeAnalytics.topTours : []
  const rooms = safeAnalytics.rooms || { total: 0, available: 0, booked: 0 }
  const range = safeAnalytics.range || { bookings: 0, users: 0, revenue: 0 }
  const availabilityPct = rooms.total ? Math.round(((rooms.available || 0) / rooms.total) * 100) : 0
  const totalCommissions = safeAnalytics.totalCommissions || 0
  const commissionBreakdown = Array.isArray(safeAnalytics.commissionBreakdown) ? safeAnalytics.commissionBreakdown : []
  const packagePerformance = Array.isArray(safeAnalytics.packagePerformance) ? safeAnalytics.packagePerformance : []
  const destinationPerformance = Array.isArray(safeAnalytics.destinationPerformance) ? safeAnalytics.destinationPerformance : []

  const totalRefunds = refundStats.pending + refundStats.completed + refundStats.failed

  return (
    <AdminLayout
      active="dashboard"
      actions={
        <div className="filter-controls">
          <span className="filter-label">Time Range</span>
          <select value={timeRange} onChange={(e) => setTimeRange(e.target.value)} className="filter-select enhanced" disabled={loading}>
            <option value="week">This Week</option>
            <option value="month">This Month</option>
            <option value="quarter">This Quarter</option>
            <option value="year">This Year</option>
          </select>
          <button onClick={exportReport} className="btn-primary enhanced" disabled={!analytics || loading}>
            <Download className="h-4 w-4" /> Export Report
          </button>
        </div>
      }
    >
      {error && (
        <div className="error-message enhanced">
          <div className="error-message-content">
            <AlertCircle className="h-5 w-5" />
            <div>
              <strong>Unable to load analytics</strong>
              <p style={{ margin: '0.25rem 0 0', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>{error}</p>
            </div>
            <button onClick={loadAnalytics} className="btn-primary enhanced" disabled={loading}>
              {loading ? 'Retrying...' : 'Retry'}
            </button>
          </div>
        </div>
      )}
      {loading ? (
        <div className="loading-state">
          <div className="spinner"></div>
          <p>Loading analytics...</p>
        </div>
      ) : !analytics ? (
        <div className="empty-state">
          <AlertCircle className="h-12 w-12" />
          <h3>No data available</h3>
          <p>Analytics data could not be loaded. Please try again.</p>
        </div>
      ) : (
        <>
          <div className="stats-grid enhanced">
            <div className="stat-card revenue-card">
              <div className="stat-icon revenue"><DollarSign /></div>
              <div className="stat-content">
                <h3>Gross Revenue</h3>
                <p className="stat-number">{formatCurrency(safeAnalytics.grossRevenue || 0)}</p>
                <span className={`stat-change ${range.revenue >= 0 ? 'positive' : 'negative'}`}>
                  <TrendingUp className="h-3 w-3" />
                  +{formatCurrency(range.revenue || 0)} in range
                </span>
              </div>
            </div>
            <div className="stat-card bookings-card">
              <div className="stat-icon bookings"><Ticket /></div>
              <div className="stat-content">
                <h3>Total Bookings</h3>
                <p className="stat-number">{safeAnalytics.totalBookings?.toLocaleString() || 0}</p>
                <span className={`stat-change ${range.bookings >= 0 ? 'positive' : 'negative'}`}>
                  <TrendingUp className="h-3 w-3" />
                  +{range.bookings || 0} in range
                </span>
              </div>
            </div>
            <div className="stat-card users-card">
              <div className="stat-icon users"><Users /></div>
              <div className="stat-content">
                <h3>Total Users</h3>
                <p className="stat-number">{safeAnalytics.totalUsers?.toLocaleString() || 0}</p>
                <span className={`stat-change ${range.users >= 0 ? 'positive' : 'negative'}`}>
                  <TrendingUp className="h-3 w-3" />
                  +{range.users || 0} in range
                </span>
              </div>
            </div>
            <div className="stat-card refunds-card">
              <div className="stat-icon refunds"><AlertCircle /></div>
              <div className="stat-content">
                <h3>Refunds</h3>
                <p className="stat-number">{totalRefunds}</p>
                <span className={`stat-change ${totalRefunds > 0 ? 'negative' : 'positive'}`}>
                  {totalRefunds > 0 ? <TrendingDown className="h-3 w-3" /> : <TrendingUp className="h-3 w-3" />}
                  ${formatCurrency(refundStats.totalRefundedAmount || 0)} refunded
                </span>
              </div>
            </div>
            <div className="stat-card commissions-card">
              <div className="stat-icon commissions"><CreditCard /></div>
              <div className="stat-content">
                <h3>Commissions</h3>
                <p className="stat-number">{formatCurrency(totalCommissions)}</p>
                <span className="stat-change positive">
                  <TrendingUp className="h-3 w-3" />
                  {commissionBreakdown.length} operators
                </span>
              </div>
            </div>
            <div className="stat-card rating-card">
              <div className="stat-icon rating"><Star /></div>
              <div className="stat-content">
                <h3>Average Rating</h3>
                <p className="stat-number">{safeAnalytics.avgRating || 0} / 5</p>
              </div>
            </div>
          </div>

          <div className="dashboard-sections analytics-sections">
            <div className="section-card enhanced full-width">
              <div className="section-header">
                <div className="header-left">
                  <BarChart3 className="h-5 w-5" />
                  <div>
                    <h3>Revenue Trend</h3>
                    <p>Gross revenue over the last 6 months</p>
                  </div>
                </div>
              </div>
              <div className="chart-container">
                <ChartBar
                  type="line"
                  data={monthlyRevenue.map((value, index) => {
                    const date = new Date()
                    date.setMonth(date.getMonth() - ((monthlyRevenue.length || 1) - 1 - index))
                    return { label: date.toLocaleString('en-US', { month: 'short' }), value, format: 'currency' }
                  })}
                  title="Revenue by Month"
                  height={300}
                />
              </div>
            </div>

            <div className="section-card enhanced">
              <div className="section-header">
                <div className="header-left">
                  <Activity className="h-5 w-5" />
                  <div>
                    <h3>User Growth</h3>
                    <p>New user signups over time</p>
                  </div>
                </div>
              </div>
              <div className="chart-container">
                <ChartBar
                  type="line"
                  data={userGrowth.map((value, index) => {
                    const date = new Date()
                    date.setMonth(date.getMonth() - ((userGrowth.length || 1) - 1 - index))
                    return { label: date.toLocaleString('en-US', { month: 'short' }), value }
                  })}
                  title="New Users by Month"
                  height={260}
                />
              </div>
            </div>

            <div className="section-card enhanced">
              <div className="section-header">
                <div className="header-left">
                  <PieChart className="h-5 w-5" />
                  <div>
                    <h3>Booking Status</h3>
                    <p>Distribution of bookings by status</p>
                  </div>
                </div>
              </div>
              <div className="chart-container">
                <ChartBar type="pie" data={bookingStats} title="Booking Status Breakdown" height={260} />
              </div>
            </div>

            <div className="section-card enhanced">
              <div className="section-header">
                <div className="header-left">
                  <Award className="h-5 w-5" />
                  <div>
                    <h3>Top Performing Packages</h3>
                    <p>Packages ranked by booking count</p>
                  </div>
                </div>
              </div>
              <div className="chart-container">
                <ChartBar
                  type="bar"
                  data={topTours.map(t => ({ label: t.name, value: t.bookings }))}
                  title="Top Packages by Bookings"
                  height={260}
                />
              </div>
            </div>

            <div className="section-card enhanced full-width">
              <div className="section-header">
                <div className="header-left">
                  <Clock className="h-5 w-5" />
                  <div>
                    <h3>Recent Activity</h3>
                    <p>Latest user signups, bookings, reviews, and invoices</p>
                  </div>
                </div>
              </div>
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
                  <button onClick={() => setRecentActivityPage(p => Math.max(1, p - 1))} disabled={recentActivityPage === 1} className="btn-secondary enhanced" style={{ padding: '0.5rem 1rem' }}>
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <span style={{ display: 'flex', alignItems: 'center', color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
                    Page {recentActivityPage} of {Math.ceil(recentActivity.length / ITEMS_PER_PAGE)}
                  </span>
                  <button onClick={() => setRecentActivityPage(p => Math.min(Math.ceil(recentActivity.length / ITEMS_PER_PAGE), p + 1))} disabled={recentActivityPage >= Math.ceil(recentActivity.length / ITEMS_PER_PAGE)} className="btn-secondary enhanced" style={{ padding: '0.5rem 1rem' }}>
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              )}
            </div>

            <div className="section-card enhanced full-width">
              <div className="section-header">
                <div className="header-left">
                  <ShoppingBag className="h-5 w-5" />
                  <div>
                    <h3>Upcoming Bookings</h3>
                    <p>Confirmed and pending bookings scheduled ahead</p>
                  </div>
                </div>
              </div>
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
                  <button onClick={() => setUpcomingBookingsPage(p => Math.max(1, p - 1))} disabled={upcomingBookingsPage === 1} className="btn-secondary enhanced" style={{ padding: '0.5rem 1rem' }}>
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <span style={{ display: 'flex', alignItems: 'center', color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
                    Page {upcomingBookingsPage} of {Math.ceil(upcomingBookings.length / ITEMS_PER_PAGE)}
                  </span>
                  <button onClick={() => setUpcomingBookingsPage(p => Math.min(Math.ceil(upcomingBookings.length / ITEMS_PER_PAGE), p + 1))} disabled={upcomingBookingsPage >= Math.ceil(upcomingBookings.length / ITEMS_PER_PAGE)} className="btn-secondary enhanced" style={{ padding: '0.5rem 1rem' }}>
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              )}
            </div>

            <div className="section-card enhanced">
              <div className="section-header">
                <div className="header-left">
                  <Building className="h-5 w-5" />
                  <div>
                    <h3>Room Availability</h3>
                    <p>Current room inventory utilization</p>
                  </div>
                </div>
              </div>
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

            <div className="section-card enhanced full-width">
              <div className="section-header">
                <div className="header-left">
                  <MapPin className="h-5 w-5" />
                  <div>
                    <h3>Package Performance</h3>
                    <p>Top packages by bookings and revenue</p>
                  </div>
                </div>
              </div>
              <div className="table-container enhanced">
                <table className="data-table enhanced">
                  <thead>
                    <tr><th>Package</th><th>Destination</th><th>Bookings</th><th>Revenue</th></tr>
                  </thead>
                  <tbody>
                    {packagePerformance.length === 0 ? (
                      <tr><td colSpan="4" style={{ textAlign: 'center', padding: '2rem' }}>No package data</td></tr>
                    ) : packagePerformance.map((p) => (
                      <tr key={p.packageName}>
                        <td>{p.packageName}</td>
                        <td>{p.destination}</td>
                        <td>{p.bookings}</td>
                        <td>{formatCurrency(p.revenue)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="section-card enhanced full-width">
              <div className="section-header">
                <div className="header-left">
                  <ShieldCheck className="h-5 w-5" />
                  <div>
                    <h3>Destination Performance</h3>
                    <p>Bookings and revenue by destination</p>
                  </div>
                </div>
              </div>
              <div className="table-container enhanced">
                <table className="data-table enhanced">
                  <thead>
                    <tr><th>Destination</th><th>Bookings</th><th>Revenue</th></tr>
                  </thead>
                  <tbody>
                    {destinationPerformance.length === 0 ? (
                      <tr><td colSpan="3" style={{ textAlign: 'center', padding: '2rem' }}>No destination data</td></tr>
                    ) : destinationPerformance.map((d) => (
                      <tr key={d.destination}>
                        <td>{d.destination}</td>
                        <td>{d.bookings}</td>
                        <td>{formatCurrency(d.revenue)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="section-card enhanced full-width">
              <div className="section-header">
                <div className="header-left">
                  <ShieldCheck className="h-5 w-5" />
                  <div>
                    <h3>Commission Breakdown by Operator</h3>
                    <p>Commissions earned by tour operators</p>
                  </div>
                </div>
              </div>
              <div className="table-container enhanced">
                <table className="data-table enhanced">
                  <thead>
                    <tr><th>Operator</th><th>Bookings</th><th>Revenue</th><th>Commission Rate</th><th>Commission Amount</th></tr>
                  </thead>
                  <tbody>
                    {commissionBreakdown.length === 0 ? (
                      <tr><td colSpan="5" style={{ textAlign: 'center', padding: '2rem' }}>No commission data</td></tr>
                    ) : commissionBreakdown.map((c) => (
                      <tr key={c.operatorId}>
                        <td>{c.operatorName}</td>
                        <td>{c.totalBookings}</td>
                        <td>{formatCurrency(c.totalRevenue)}</td>
                        <td>{c.commissionRate}% {c.commissionType}</td>
                        <td>{formatCurrency(c.commissionAmount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="section-card enhanced">
              <div className="section-header">
                <div className="header-left">
                  <Tag className="h-5 w-5" />
                  <div>
                    <h3>Quick Actions</h3>
                    <p>Common admin tasks</p>
                  </div>
                </div>
              </div>
              <div className="quick-actions enhanced">
                <button onClick={exportReport} className="action-btn enhanced" disabled={!analytics || loading}>
                  <Download className="h-4 w-4" /> Export Report
                </button>
                <Link to="/admin/users" className="action-btn enhanced"><Users className="h-4 w-4" /> Manage Users</Link>
                <Link to="/admin/destinations" className="action-btn enhanced"><MapPin className="h-4 w-4" /> Manage Packages</Link>
                <Link to="/admin/bookings" className="action-btn enhanced"><Ticket className="h-4 w-4" /> Manage Bookings</Link>
                <Link to="/admin/hotel-partners" className="action-btn enhanced"><Building className="h-4 w-4" /> Hotel Partners</Link>
                <Link to="/admin/refunds" className="action-btn enhanced"><CreditCard className="h-4 w-4" /> Refund Oversight</Link>
              </div>
            </div>
          </div>
        </>
      )}
    </AdminLayout>
  )
}

export default DashboardAnalytics
