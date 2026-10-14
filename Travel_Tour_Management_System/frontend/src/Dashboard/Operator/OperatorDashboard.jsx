import { useState, useEffect } from 'react'
import usePolling from '../../hooks/usePolling'
import { Building, Ticket, Users, DollarSign, Star, PieChart, TrendingUp, MapPin, Activity, Crown, Loader } from 'lucide-react'
import OperatorLayout from './OperatorLayout'
import { api, formatCurrency } from '../../api'

const AnimatedNumber = ({ value, prefix = '', suffix = '', decimals = 0 }) => {
  const num = Number(value) || 0
  return <>{prefix}{num.toFixed(decimals)}{suffix}</>
}

const SkeletonDashboard = () => (
  <>
    <div className="cd-skeleton-grid">
      {[1, 2, 3, 4, 5, 6].map((i) => <div key={i} className="cd-skeleton-card" />)}
    </div>
    <div className="dashboard-sections">
      <div className="section-card full-width">
        <div className="cd-skeleton-chart" />
      </div>
      <div className="section-card">
        <div className="cd-skeleton-chart" />
      </div>
      <div className="section-card">
        <div className="cd-skeleton-chart" />
      </div>
    </div>
  </>
)

const OperatorDashboard = () => {
  const [loading, setLoading] = useState(true)
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
        activePackages: packages.filter(p => p.status === 'active').length,
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
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    Promise.resolve().then(() => load())
  }, [])

  usePolling(load, 15000)

  if (loading) {
    return (
      <OperatorLayout active="dashboard" title="Dashboard" subtitle="Overview of your tour business performance">
        <SkeletonDashboard />
      </OperatorLayout>
    )
  }

  const kpis = [
    { icon: Building, label: 'Total Packages', value: stats.totalPackages, accent: 'var(--cp-accent, #0d9488)', sub: `${stats.activePackages} Active` },
    { icon: Ticket, label: 'Total Bookings', value: stats.totalBookings, accent: 'var(--cp-info, #3b82f6)', sub: 'All time' },
    { icon: Users, label: 'Total Customers', value: stats.totalCustomers, accent: 'var(--cp-purple, #8b5cf6)', sub: 'Unique customers' },
    { icon: DollarSign, label: 'Revenue', value: stats.revenue, prefix: '₹', accent: 'var(--cp-success, #10b981)', sub: 'From paid bookings' },
    { icon: Star, label: 'Avg Rating', value: stats.avgRating || '—', accent: 'var(--cp-warning, #f59e0b)', sub: 'Approved reviews' },
    { icon: PieChart, label: 'Pending', value: stats.pending, accent: 'var(--cp-danger, #ef4444)', sub: 'Awaiting confirmation' }
  ]

  return (
    <OperatorLayout active="dashboard" title="Dashboard" subtitle="Overview of your tour business performance">
      <div className="stats-grid enhanced">
        {kpis.map((kpi) => {
          const Icon = kpi.icon
          return (
            <div key={kpi.label} className="stat-card">
              <span className="stat-icon" style={{ color: kpi.accent }}>
                <Icon className="h-5 w-5" />
              </span>
              <div className="stat-content">
                <h3>{kpi.label}</h3>
                <p className="stat-number">
                  <AnimatedNumber value={kpi.value} prefix={kpi.prefix || ''} />
                </p>
                <span className="stat-change positive">{kpi.sub}</span>
              </div>
            </div>
          )
        })}
      </div>

      <div className="dashboard-sections">
        <div className="section-card enhanced full-width">
          <div className="section-card-head">
            <h3><TrendingUp className="h-4 w-4" /> Revenue Overview</h3>
            <span className="section-card-tag">Total: {formatCurrency(stats.revenue)}</span>
          </div>
          <div className="revenue-chart">
            <div className="chart-placeholder">
              <TrendingUp className="chart-icon" />
              <p>Revenue Analytics Chart</p>
              <small>Total revenue: {formatCurrency(stats.revenue)}</small>
            </div>
          </div>
        </div>

        <div className="section-card enhanced">
          <div className="section-card-head">
            <h3><Activity className="h-4 w-4" /> Recent Activities</h3>
          </div>
          <ul className="activity-list enhanced">
            {activities.length === 0 && <li>No recent activity yet.</li>}
            {activities.map((a, i) => (
              <li key={i}><Ticket className="activity-icon" /> {a}</li>
            ))}
          </ul>
        </div>

        <div className="section-card enhanced">
          <div className="section-card-head">
            <h3><Crown className="h-4 w-4" /> Top Performing Packages</h3>
          </div>
          <ul className="activity-list enhanced">
            {topPackages.length === 0 && <li>No booking data yet.</li>}
            {topPackages.map((p, i) => (
              <li key={i}><MapPin className="activity-icon" /> {p.name} — {p.bookings} bookings</li>
            ))}
          </ul>
        </div>
      </div>
    </OperatorLayout>
  )
}

export default OperatorDashboard
