import { useState, useEffect } from 'react'
import usePolling from '../../hooks/usePolling'
import { Building, Ticket, Users, DollarSign, Star, PieChart, TrendingUp } from 'lucide-react'
import OperatorLayout from './OperatorLayout'
import { api, formatCurrency } from '../../api'

const OperatorDashboard = () => {
  const [stats, setStats] = useState({
    totalPackages: 0,
    activePackages: 0,
    totalBookings: 0,
    totalCustomers: 0,
    revenue: 0,
    avgRating: 0,
    pending: 0
  })
  const [topPackages, setTopPackages] = useState([])
  const [activities, setActivities] = useState([])

  const load = async () => {
    try {
      const results = await Promise.allSettled([
        api('/operator/packages').catch(() => ({ packages: [] })),
        api('/operator/bookings').catch(() => ({ bookings: [] })),
        api('/operator/customers').catch(() => ({ customers: [] })),
        api('/operator/reviews').catch(() => ({ reviews: [] })),
        api('/operator/revenue').catch(() => ({}))
      ])
      const packages = results[0].status === 'fulfilled' ? results[0].value.packages || [] : []
      const bookings = results[1].status === 'fulfilled' ? results[1].value.bookings || [] : []
      const customers = results[2].status === 'fulfilled' ? results[2].value.customers || [] : []
      const reviews = results[3].status === 'fulfilled' ? results[3].value.reviews || [] : []
      const revenue = results[4].status === 'fulfilled' ? results[4].value : {}

      const approvedReviews = reviews.filter(r => r.status === 'approved')
      const avgRating = approvedReviews.length
        ? approvedReviews.reduce((s, r) => s + r.rating, 0) / approvedReviews.length
        : 0

      const revenueByPackage = revenue.revenueByPackage || []
      const tops = revenueByPackage.slice(0, 4).map(p => ({
        name: p._id || 'Package',
        bookings: p.count || 0
      }))

      const acts = []
      bookings.slice(0, 3).forEach(b => {
        acts.push(`New booking: ${b.package} by ${b.customer}`)
      })
      reviews.slice(0, 2).forEach(r => {
        acts.push(`New review: ${r.rating} stars for ${r.package}`)
      })

      setStats({
        totalPackages: packages.length,
        activePackages: packages.filter(p => p.status === 'active' && p.publishedStatus === 'published').length,
        totalBookings: bookings.length,
        totalCustomers: customers.length,
        revenue: revenue.totalRevenue || 0,
        avgRating: Number(avgRating.toFixed(1)),
        pending: bookings.filter(b => b.status === 'pending').length
      })
      setTopPackages(tops)
      setActivities(acts)
    } catch (err) {
      console.error(err)
    }
  }

  useEffect(() => {
    Promise.resolve().then(() => load())
  }, [])

  usePolling(load, 15000)

  return (
    <OperatorLayout active="dashboard" title="Dashboard Analytics">
      <div className="stats-grid">
        <div className="stat-card">
          <Building className="stat-icon" />
          <div className="stat-content">
            <h3>Total Packages</h3>
            <p className="stat-number">{stats.totalPackages}</p>
            <span className="stat-change positive">{stats.activePackages} Active</span>
          </div>
        </div>
        <div className="stat-card">
          <Ticket className="stat-icon" />
          <div className="stat-content">
            <h3>Total Bookings</h3>
            <p className="stat-number">{stats.totalBookings}</p>
            <span className="stat-change positive">All time</span>
          </div>
        </div>
        <div className="stat-card">
          <Users className="stat-icon" />
          <div className="stat-content">
            <h3>Total Customers</h3>
            <p className="stat-number">{stats.totalCustomers}</p>
            <span className="stat-change positive">Unique customers</span>
          </div>
        </div>
        <div className="stat-card">
          <DollarSign className="stat-icon" />
          <div className="stat-content">
            <h3>Revenue</h3>
            <p className="stat-number">{formatCurrency(stats.revenue)}</p>
            <span className="stat-change positive">From paid bookings</span>
          </div>
        </div>
        <div className="stat-card">
          <Star className="stat-icon" />
          <div className="stat-content">
            <h3>Avg Rating</h3>
            <p className="stat-number">{stats.avgRating || '—'}</p>
            <span className="stat-change positive">Approved reviews</span>
          </div>
        </div>
        <div className="stat-card">
          <PieChart className="stat-icon" />
          <div className="stat-content">
            <h3>Pending</h3>
            <p className="stat-number">{stats.pending}</p>
            <span className="stat-change neutral">Awaiting confirmation</span>
          </div>
        </div>
      </div>

      <div className="dashboard-sections">
        <div className="section-card full-width">
          <h3>Revenue Overview</h3>
          <div className="revenue-chart">
            <div className="chart-placeholder">
              <TrendingUp className="chart-icon" />
              <p>Revenue Analytics Chart</p>
              <small>Total revenue: {formatCurrency(stats.revenue)}</small>
            </div>
          </div>
        </div>

        <div className="section-card">
          <h3>Recent Activities</h3>
          <ul className="activity-list">
            {activities.length === 0 && <li>No recent activity yet.</li>}
            {activities.map((a, i) => (
              <li key={i}><Ticket className="activity-icon" /> {a}</li>
            ))}
          </ul>
        </div>

        <div className="section-card">
          <h3>Top Performing Packages</h3>
          <ul className="activity-list">
            {topPackages.length === 0 && <li>No booking data yet.</li>}
            {topPackages.map((p, i) => (
              <li key={i}>📦 {p.name} - {p.bookings} bookings</li>
            ))}
          </ul>
        </div>
      </div>
    </OperatorLayout>
  )
}

export default OperatorDashboard