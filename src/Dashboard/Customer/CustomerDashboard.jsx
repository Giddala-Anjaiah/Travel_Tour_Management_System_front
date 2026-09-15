import { useState, useEffect, useCallback, useRef } from 'react'
import {
  MapPin, Ticket, Wallet, Award, TrendingUp, Clock, ArrowUpRight, ArrowDownRight,
  RefreshCw, Star, Calendar, Compass, ChevronRight, Eye, ArrowRight,
  AlertTriangle, CreditCard
} from 'lucide-react'
import CustomerLayout from './CustomerLayout'
import { api, formatCurrency, formatDate } from '../../api'
import '../Dashboard.css'

const RANGES = [
  { id: 'week', label: 'Last 7 Days' },
  { id: 'month', label: 'Last 30 Days' },
  { id: 'quarter', label: 'Last 90 Days' },
  { id: 'year', label: 'Last 12 Months' }
]

const AnimatedNumber = ({ value, prefix = '', suffix = '', decimals = 0 }) => {
  const [display, setDisplay] = useState(0)
  const displayRef = useRef(display)
  useEffect(() => {
    const start = displayRef.current
    const end = Number(value) || 0
    const duration = 700
    const startTime = Date.now()
    const tick = () => {
      const elapsed = Date.now() - startTime
      const t = Math.min(elapsed / duration, 1)
      const eased = 1 - Math.pow(1 - t, 3)
      const next = start + (end - start) * eased
      setDisplay(next)
      displayRef.current = next
      if (t < 1) requestAnimationFrame(tick)
    }
    const raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [value])
  return <>{prefix}{display.toFixed(decimals)}{suffix}</>
}

const SparkBars = ({ data, valueKey = 'revenue' }) => {
  const max = Math.max(1, ...data.map(d => d[valueKey] || 0))
  return (
    <div className="cd-spark">
      {data.map((d, i) => {
        const h = ((d[valueKey] || 0) / max) * 100
        return (
          <div key={i} className="cd-spark-bar-wrap" title={`${d.label}: ${formatCurrency(d[valueKey] || 0)}`}>
            <div className="cd-spark-bar" style={{ height: `${Math.max(3, h)}%`, animationDelay: `${i * 50}ms` }} />
          </div>
        )
      })}
    </div>
  )
}

const Donut = ({ segments, size = 140, thickness = 18 }) => {
  const total = segments.reduce((s, x) => s + x.value, 0) || 1
  const radius = (size - thickness) / 2
  const circumference = 2 * Math.PI * radius
  const cumulativeSums = segments.reduce((acc, seg) => {
    const prev = acc[acc.length - 1]?.end || 0
    acc.push({ start: prev, end: prev + seg.value })
    return acc
  }, [])
  return (
    <div className="cd-donut-wrap">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={size/2} cy={size/2} r={radius} fill="none" stroke="#e2e8f0" strokeWidth={thickness} />
        {segments.map((seg, i) => {
          const portion = seg.value / total
          const dash = portion * circumference
          const offset = (cumulativeSums[i].start / total) * circumference
          return (
            <circle key={i}
              cx={size/2} cy={size/2} r={radius}
              fill="none"
              stroke={seg.color}
              strokeWidth={thickness}
              strokeDasharray={`${dash} ${circumference - dash}`}
              strokeDashoffset={-offset}
              transform={`rotate(-90 ${size/2} ${size/2})`}
              style={{ transition: 'stroke-dasharray 0.6s ease' }}
            />
          )
        })}
      </svg>
      <div className="cd-donut-center">
        <strong>{total}</strong>
        <small>Total</small>
      </div>
    </div>
  )
}

const CustomerDashboard = () => {
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [range, setRange] = useState('month')
  const [refreshing, setRefreshing] = useState(false)
  const [lastUpdated, setLastUpdated] = useState(null)
  const [autoRefresh, setAutoRefresh] = useState(false)
  const user = JSON.parse(localStorage.getItem('user') || '{}')

  const load = useCallback(async (silent = false) => {
    if (!silent) setRefreshing(true)
    try {
      setError('')
      const data = await api(`/customer/analytics?range=${range}`)
      setStats(data)
      setLastUpdated(new Date())
    } catch (err) {
      setError(err.message || 'Failed to load analytics')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [range])

  useEffect(() => {
    Promise.resolve().then(() => load())
  }, [load])
  useEffect(() => {
    if (!autoRefresh) return
    const id = setInterval(() => load(true), 30000)
    return () => clearInterval(id)
  }, [autoRefresh, load])

  if (loading) {
    return (
      <CustomerLayout active="dashboard" title="Dashboard Analytics">
        <div className="cd-skeleton-grid">
          {[1,2,3,4].map(i => <div key={i} className="cd-skeleton-card" />)}
        </div>
        <div className="cd-skeleton-chart" />
      </CustomerLayout>
    )
  }

  if (error && !stats) {
    return (
      <CustomerLayout active="dashboard" title="Dashboard Analytics">
        <div className="cd-card">
          <h3 style={{ color: '#1e293b' }}>Welcome, {user.fullName || 'Traveler'}!</h3>
          <p style={{ color: '#475569' }}>Plan your trips, track bookings, and explore destinations.</p>
          {error && <p style={{ color: '#ef4444', marginTop: '1rem' }}>{error}</p>}
          <button className="cd-btn cd-btn-primary" onClick={() => load()} style={{ marginTop: '1rem' }}>Retry</button>
        </div>
      </CustomerLayout>
    )
  }

  const s = stats || {}
  const avgTripValue = s.totalBookings > 0 ? Math.round(s.totalSpent / s.totalBookings) : 0

  const bookingSegments = [
    { label: 'Confirmed', value: s.bookingStatus?.confirmed || 0, color: '#10b981' },
    { label: 'Pending', value: s.bookingStatus?.pending || 0, color: '#f59e0b' },
    { label: 'Completed', value: s.bookingStatus?.completed || 0, color: '#3b82f6' },
    { label: 'Cancelled', value: s.bookingStatus?.cancelled || 0, color: '#ef4444' }
  ].filter(x => x.value > 0)

  const paymentSegments = [
    { label: 'Paid', value: s.paymentStatus?.paid || 0, color: '#10b981' },
    { label: 'Partial', value: s.paymentStatus?.partial || 0, color: '#f59e0b' },
    { label: 'Pending', value: s.paymentStatus?.pending || 0, color: '#ef4444' },
    { label: 'Refunded', value: s.paymentStatus?.refunded || 0, color: '#8b5cf6' },
    { label: 'Failed', value: s.paymentStatus?.failed || 0, color: '#dc2626' }
  ].filter(x => x.value > 0)

  const kpis = [
    {
      icon: Ticket, accent: '#4f46e5',
      label: 'Total Bookings', value: s.totalBookings ?? 0,
      sub: `${s.rangeBookings || 0} in selected range`,
      trend: s.rangeBookings > 0 ? '+' + s.rangeBookings : '0',
      trendUp: true
    },
    {
      icon: Wallet, accent: '#10b981',
      label: 'Total Spent', value: s.totalSpent ?? 0, prefix: '₹',
      sub: formatCurrency(s.rangeSpent || 0) + ' in range',
      trend: s.rangeSpent > 0 ? '+' + Math.round((s.rangeSpent / Math.max(1, s.totalSpent)) * 100) + '%' : '0%',
      trendUp: s.rangeSpent > 0
    },
    {
      icon: MapPin, accent: '#ec4899',
      label: 'Destinations Explored', value: s.topDestinations?.length || 0,
      sub: 'Places you have visited',
      trend: s.topDestinations?.length > 0 ? 'Traveler' : 'Beginner',
      trendUp: true
    },
    {
      icon: Award, accent: '#f59e0b',
      label: 'Loyalty Tier', value: s.loyaltyTier || 'Explorer',
      sub: 'Based on your spending',
      trend: s.loyaltyTier === 'Gold' ? 'Premium' : s.loyaltyTier === 'Silver' ? 'Regular' : 'New',
      trendUp: s.loyaltyTier === 'Gold' || s.loyaltyTier === 'Silver'
    },
    {
      icon: TrendingUp, accent: '#3b82f6',
      label: 'Avg Trip Value', value: avgTripValue, prefix: '₹',
      sub: 'Per booking average',
      trend: avgTripValue > 0 ? 'Per booking' : 'No trips',
      trendUp: avgTripValue > 0
    },
    {
      icon: Clock, accent: '#ef4444',
      label: 'Pending Payments', value: s.paymentStatus?.partial + s.paymentStatus?.pending || 0,
      sub: 'Awaiting confirmation',
      trend: s.alerts?.pendingPayments > 0 ? 'Needs attention' : 'All clear',
      trendUp: (s.paymentStatus?.partial + s.paymentStatus?.pending) === 0
    }
  ]

  return (
    <CustomerLayout active="dashboard" title="Dashboard Analytics">
      <div className="cd-toolbar">
        <div className="cd-toolbar-left">
          {RANGES.map(r => (
            <button
              key={r.id}
              className={`cd-range-btn ${range === r.id ? 'active' : ''}`}
              onClick={() => setRange(r.id)}
            >
              {r.label}
            </button>
          ))}
        </div>
        <div className="cd-toolbar-right">
          {lastUpdated && (
            <span style={{ fontSize: '0.78rem', color: '#64748b' }}>
              Updated {lastUpdated.toLocaleTimeString()}
            </span>
          )}
          <label className="cd-auto-toggle">
            <input type="checkbox" checked={autoRefresh} onChange={(e) => setAutoRefresh(e.target.checked)} />
            Auto-refresh
          </label>
          <button className={`cd-refresh-btn ${refreshing ? 'spin' : ''}`} onClick={() => load()} disabled={refreshing}>
            <RefreshCw size={14} />
            {refreshing ? 'Refreshing' : 'Refresh'}
          </button>
        </div>
      </div>

      {(s.alerts?.upcomingTrips > 0 || s.alerts?.pendingPayments > 0) && (
        <div>
          {s.alerts.upcomingTrips > 0 && (
            <div className="cd-alert info">
              <Calendar size={20} />
              <div className="cd-alert-content">
                <div className="cd-alert-title">{s.alerts.upcomingTrips} upcoming trip{s.alerts.upcomingTrips !== 1 ? 's' : ''}</div>
                <div className="cd-alert-sub">You have confirmed or pending bookings coming up.</div>
              </div>
              <ChevronRight size={18} />
            </div>
          )}
          {s.alerts.pendingPayments > 0 && (
            <div className="cd-alert warning">
              <AlertTriangle size={20} />
              <div className="cd-alert-content">
                <div className="cd-alert-title">{s.alerts.pendingPayments} pending payment{s.alerts.pendingPayments !== 1 ? 's' : ''}</div>
                <div className="cd-alert-sub">Older than 7 days. Consider completing your payment.</div>
              </div>
              <ChevronRight size={18} />
            </div>
          )}
        </div>
      )}

      <div className="cd-kpi-grid">
        {kpis.map((k, i) => {
          const Icon = k.icon
          return (
            <div key={i} className="cd-kpi" style={{ '--accent': k.accent }}>
              <div className="cd-kpi-head">
                <div className="cd-kpi-icon"><Icon size={22} /></div>
                {k.trend !== null && k.trend !== undefined && (
                  <span className={`cd-kpi-trend ${k.trendUp !== undefined ? (k.trendUp ? 'up' : 'down') : ''}`}>
                    {k.trendUp ? <ArrowUpRight size={12} /> : k.trendUp === false ? <ArrowDownRight size={12} /> : null}
                    {k.trendLabel ? `${k.trend}` : `${k.trend}`}
                  </span>
                )}
              </div>
              <div className="cd-kpi-label">{k.label}</div>
              <p className="cd-kpi-value">
                <AnimatedNumber value={k.value} prefix={k.prefix || ''} decimals={k.decimals || 0} />
              </p>
              <div className="cd-kpi-sub">{k.sub}</div>
            </div>
          )
        })}
      </div>

      <div className="cd-quick-actions">
        <a href="/customer/packages" className="cd-quick"><span className="cd-quick-icon"><MapPin size={16} /> Browse Packages</span><ArrowRight size={14} /></a>
        <a href="/customer/destinations" className="cd-quick"><span className="cd-quick-icon"><Compass size={16} /> Explore Destinations</span><ArrowRight size={14} /></a>
        <a href="/customer/bookings" className="cd-quick"><span className="cd-quick-icon"><Ticket size={16} /> My Bookings</span><ArrowRight size={14} /></a>
        <a href="/customer/wishlist" className="cd-quick"><span className="cd-quick-icon"><Star size={16} /> My Wishlist</span><ArrowRight size={14} /></a>
        <a href="/customer/invoices" className="cd-quick"><span className="cd-quick-icon"><Calendar size={16} /> Invoices</span><ArrowRight size={14} /></a>
        <a href="/customer/profile" className="cd-quick"><span className="cd-quick-icon"><Award size={16} /> My Profile</span><ArrowRight size={14} /></a>
      </div>

      <div className="cd-grid-2">
        <div className="cd-card">
          <div className="cd-card-head">
            <h3 className="cd-card-title"><TrendingUp size={18} style={{ color: '#4f46e5' }} /> Spending Trend <small>· 6 months</small></h3>
            <span style={{ color: '#64748b', fontSize: '0.85rem', fontWeight: 600 }}>{formatCurrency(s.totalSpent || 0)} total</span>
          </div>
          <SparkBars data={s.revenueTrend || []} valueKey="revenue" />
          <div className="cd-spark-labels">
            {(s.revenueTrend || []).map((d, i) => (
              <span key={i}>{d.label}</span>
            ))}
          </div>
        </div>

        <div className="cd-card">
          <div className="cd-card-head">
            <h3 className="cd-card-title"><Calendar size={18} style={{ color: '#3b82f6' }} /> Booking Status</h3>
            <span style={{ color: '#64748b', fontSize: '0.85rem', fontWeight: 600 }}>{s.totalBookings || 0} total</span>
          </div>
          {bookingSegments.length > 0 ? (
            <div className="cd-donut-flex">
              <Donut segments={bookingSegments} />
              <div className="cd-legend">
                {bookingSegments.map(seg => (
                  <div key={seg.label} className="cd-legend-item">
                    <div className="cd-legend-item-left">
                      <span className="cd-legend-dot" style={{ background: seg.color }} />
                      {seg.label}
                    </div>
                    <strong style={{ color: '#0f172a' }}>{seg.value}</strong>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="cd-empty">No bookings yet</div>
          )}
        </div>
      </div>

      <div className="cd-grid-3">
        <div className="cd-card">
          <div className="cd-card-head">
            <h3 className="cd-card-title"><CreditCard size={18} style={{ color: '#10b981' }} /> Payment Mix</h3>
          </div>
          {paymentSegments.length > 0 ? (
            <div className="cd-donut-flex">
              <Donut segments={paymentSegments} size={130} thickness={16} />
              <div className="cd-legend">
                {paymentSegments.map(seg => (
                  <div key={seg.label} className="cd-legend-item">
                    <div className="cd-legend-item-left">
                      <span className="cd-legend-dot" style={{ background: seg.color }} />
                      {seg.label}
                    </div>
                    <strong style={{ color: '#0f172a' }}>{seg.value}</strong>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="cd-empty">No payments yet</div>
          )}
        </div>

        <div className="cd-card">
          <div className="cd-card-head">
            <h3 className="cd-card-title"><MapPin size={18} style={{ color: '#ec4899' }} /> Top Destinations</h3>
          </div>
          {(s.topDestinations || []).length === 0 ? (
            <div className="cd-empty">No trips booked yet</div>
          ) : (
            <div className="cd-room-bars">
              {s.topDestinations.map((d, i) => (
                <div key={i} className="cd-room-row">
                  <div className="cd-room-name" title={d.name}>{d.name}</div>
                  <div className="cd-room-bar-track">
                    <div className="cd-room-bar-fill" style={{ width: `${(d.count / Math.max(1, s.topDestinations[0].count)) * 100}%` }} />
                  </div>
                  <div className="cd-room-amt">{d.count} trip{d.count !== 1 ? 's' : ''}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="cd-card">
          <div className="cd-card-head">
            <h3 className="cd-card-title"><Star size={18} style={{ color: '#f59e0b' }} /> Recent Reviews</h3>
          </div>
          {(s.recentReviews || []).length === 0 ? (
            <div className="cd-empty">No reviews yet</div>
          ) : (
            <div className="cd-list">
              {s.recentReviews.slice(0, 5).map(r => (
                <div key={r._id} className="cd-list-item">
                  <div className="cd-list-icon" style={{ background: '#fef3c7', color: '#92400e' }}><Star size={18} /></div>
                  <div className="cd-list-content">
                    <div className="cd-list-title">{r.package}</div>
                    <div className="cd-list-sub">{'★'.repeat(r.rating)}{'☆'.repeat(5 - r.rating)} · {r.comment?.slice(0, 50)}{r.comment?.length > 50 ? '...' : ''}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="cd-grid-2">
        <div className="cd-card">
          <div className="cd-card-head">
            <h3 className="cd-card-title"><Calendar size={18} style={{ color: '#4f46e5' }} /> Upcoming Trips</h3>
            <Eye size={14} style={{ color: '#94a3b8' }} />
          </div>
          {(s.upcomingTrips || []).length === 0 ? (
            <div className="cd-empty">No upcoming trips. <a href="/customer/packages" style={{ color: '#4f46e5' }}>Browse packages</a></div>
          ) : (
            <div className="cd-list">
              {s.upcomingTrips.slice(0, 5).map(b => (
                <div key={b._id} className="cd-list-item">
                  <div className="cd-list-icon" style={{ background: '#dbeafe', color: '#1e40af' }}><Ticket size={18} /></div>
                  <div className="cd-list-content">
                    <div className="cd-list-title">{b.package}</div>
                    <div className="cd-list-sub">{b.dates} · {b.travelers || 1} traveler{(b.travelers || 1) !== 1 ? 's' : ''}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div className="cd-list-amount">{formatCurrency(b.amount || 0)}</div>
                    <div style={{ fontSize: '0.72rem', color: b.status === 'confirmed' ? '#059669' : b.status === 'pending' ? '#d97706' : '#dc2626', fontWeight: 600, marginTop: '0.15rem' }}>{b.status}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="cd-card">
          <div className="cd-card-head">
            <h3 className="cd-card-title"><Clock size={18} style={{ color: '#8b5cf6' }} /> Recent Bookings</h3>
          </div>
          {(s.recentBookings || []).length === 0 ? (
            <div className="cd-empty">No bookings yet</div>
          ) : (
            <div className="cd-list">
              {s.recentBookings.slice(0, 6).map(b => (
                <div key={b._id} className="cd-list-item">
                  <div className="cd-list-icon" style={{ background: '#e0e7ff', color: '#3730a3' }}><Calendar size={18} /></div>
                  <div className="cd-list-content">
                    <div className="cd-list-title">{b.package}</div>
                    <div className="cd-list-sub">{formatDate(b.bookingDate)} · {b.status}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div className="cd-list-amount">{formatCurrency(b.amount || 0)}</div>
                    <div style={{ fontSize: '0.72rem', color: b.paymentStatus === 'paid' ? '#059669' : b.paymentStatus === 'partial' ? '#d97706' : '#dc2626', fontWeight: 600, marginTop: '0.15rem' }}>{b.paymentStatus}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </CustomerLayout>
  )
}

export default CustomerDashboard