import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import {
  Bed, Calendar, Users, DollarSign, Star, TrendingUp, CheckCircle, AlertTriangle,
  RefreshCw, Bell, CreditCard, Activity, Home, ChevronRight, Sparkles, Eye,
  ArrowUpRight, ArrowDownRight, Wallet, XCircle, ArrowRight
} from 'lucide-react'
import HotelLayout from './HotelLayout'
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
    <div className="hd-spark">
      {data.map((d, i) => {
        const h = ((d[valueKey] || 0) / max) * 100
        return (
          <div key={i} className="hd-spark-bar-wrap" title={`${d.label}: ${formatCurrency(d[valueKey] || 0)}`}>
            <div className="hd-spark-bar" style={{ height: `${Math.max(3, h)}%`, animationDelay: `${i * 50}ms` }} />
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
    <div className="hd-donut-wrap">
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
      <div className="hd-donut-center">
        <strong>{total}</strong>
        <small>Total</small>
      </div>
    </div>
  )
}

const HotelDashboard = () => {
  const user = JSON.parse(localStorage.getItem('user') || '{}')
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [range, setRange] = useState('month')
  const [refreshing, setRefreshing] = useState(false)
  const [lastUpdated, setLastUpdated] = useState(null)
  const [autoRefresh, setAutoRefresh] = useState(true)

  const load = useCallback(async (silent = false) => {
    if (!silent) setRefreshing(true)
    try {
      setError('')
      const profileRes = await api('/hotel/profile').catch(() => ({}))
      const hotelName = profileRes?.profile?.hotelName || ''
      const starRating = profileRes?.profile?.starRating
      const qs = new URLSearchParams({ range, hotelName, starRating: starRating || 0 })
      const data = await api(`/hotel/analytics?${qs.toString()}`)
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

  const trend = useMemo(() => {
    if (!stats?.revenueTrend || stats.revenueTrend.length < 2) return null
    const arr = stats.revenueTrend
    const last = arr[arr.length - 1].revenue
    const prev = arr[arr.length - 2].revenue
    if (prev === 0) return null
    return Math.round(((last - prev) / prev) * 100)
  }, [stats])

  if (loading) {
    return (
      <HotelLayout active="dashboard" title="Dashboard Analytics">
        <div className="hd-skeleton-grid">
          {[1,2,3,4].map(i => <div key={i} className="hd-skeleton-card" />)}
        </div>
        <div className="hd-skeleton-chart" />
      </HotelLayout>
    )
  }

  if (error && !stats) {
    return (
      <HotelLayout active="dashboard" title="Dashboard Analytics">
        <div className="hd-card">
          <h3 style={{ color: '#1e293b' }}>Welcome, {user.fullName || 'Hotel Partner'}!</h3>
          <p style={{ color: '#475569' }}>Set up your hotel profile to start tracking your rooms, bookings, and revenue.</p>
          {error && <p style={{ color: '#ef4444', marginTop: '1rem' }}>{error}</p>}
          <button className="hd-btn hd-btn-primary" onClick={() => load()} style={{ marginTop: '1rem' }}>Retry</button>
        </div>
      </HotelLayout>
    )
  }

  const s = stats || {}
  const occupancy = s.occupancyRate ?? 0

  const bookingSegments = [
    { label: 'Confirmed', value: s.bookingStatus?.confirmed || 0, color: '#10b981' },
    { label: 'Checked-in', value: s.bookingStatus?.checked_in || 0, color: '#3b82f6' },
    { label: 'Pending', value: s.bookingStatus?.pending || 0, color: '#f59e0b' },
    { label: 'Checked-out', value: s.bookingStatus?.checked_out || 0, color: '#8b5cf6' },
    { label: 'Cancelled', value: s.bookingStatus?.cancelled || 0, color: '#ef4444' }
  ].filter(x => x.value > 0)

  const paymentSegments = [
    { label: 'Paid', value: s.paymentBreakdown?.paid || 0, color: '#10b981' },
    { label: 'Partial', value: s.paymentBreakdown?.partial || 0, color: '#f59e0b' },
    { label: 'Pending', value: s.paymentBreakdown?.pending || 0, color: '#ef4444' },
    { label: 'Refunded', value: s.paymentBreakdown?.refunded || 0, color: '#8b5cf6' }
  ].filter(x => x.value > 0)

  const maxRoomRevenue = Math.max(1, ...(s.topRooms || []).map(r => r.revenue))

  const kpis = [
    {
      icon: Bed, accent: '#4f46e5',
      label: 'Total Rooms', value: s.totalRooms ?? 0,
      sub: `${s.availableRooms ?? 0} available`, trend: `${occupancy}% occupied`,
      trendUp: occupancy >= 50
    },
    {
      icon: DollarSign, accent: '#10b981',
      label: 'Total Revenue', value: s.totalRevenue ?? 0, prefix: '₹',
      sub: formatCurrency(s.rangeRevenue || 0) + ' in range',
      trend: trend, trendLabel: 'vs yesterday'
    },
    {
      icon: Wallet, accent: '#f59e0b',
      label: 'Pending Payments', value: s.pendingPayments || 0, prefix: '₹',
      sub: 'Unpaid bookings',
      trend: s.pendingPayments > 0 ? 'Needs follow-up' : 'All clear',
      trendUp: s.pendingPayments === 0
    },
    {
      icon: Users, accent: '#3b82f6',
      label: 'Current Guests', value: s.currentlyCheckedIn ?? 0,
      sub: `${s.todayCheckIns?.length || 0} arriving today`,
      trend: `${s.pendingCheckouts ?? 0} checkouts due`
    },
    {
      icon: Calendar, accent: '#ec4899',
      label: "Today's Bookings", value: s.todayBookings ?? 0,
      sub: `${s.totalBookings || 0} total all-time`,
      trend: 'New bookings'
    },
    {
      icon: Star, accent: '#f59e0b',
      label: 'Average Rating', value: s.avgRating ?? 0, decimals: 1,
      sub: `${s.recentReviews?.length || 0} recent reviews`,
      trend: 'Guest feedback'
    }
  ]

  return (
    <HotelLayout active="dashboard" title="Dashboard Analytics">
      <style>{`
        .hd-toolbar { display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1rem; margin-bottom: 1.5rem; background: #ffffff; padding: 1rem 1.25rem; border-radius: 12px; box-shadow: 0 1px 3px rgba(0,0,0,0.06); border: 1px solid #e2e8f0; }
        .hd-toolbar-left { display: flex; gap: 0.5rem; flex-wrap: wrap; }
        .hd-range-btn { padding: 0.5rem 0.9rem; border: 1px solid #e2e8f0; background: #ffffff; color: #475569; border-radius: 8px; cursor: pointer; font-size: 0.85rem; font-weight: 500; transition: all 0.2s; }
        .hd-range-btn:hover { background: #f1f5f9; border-color: #cbd5e1; color: #1e293b; }
        .hd-range-btn.active { background: #4f46e5; color: white; border-color: #4f46e5; box-shadow: 0 2px 4px rgba(79,70,229,0.3); }
        .hd-toolbar-right { display: flex; align-items: center; gap: 0.75rem; color: #475569; font-size: 0.85rem; }
        .hd-refresh-btn { display: inline-flex; align-items: center; gap: 0.4rem; padding: 0.45rem 0.85rem; background: #f8fafc; border: 1px solid #e2e8f0; color: #475569; border-radius: 8px; cursor: pointer; font-size: 0.8rem; font-weight: 500; transition: all 0.2s; }
        .hd-refresh-btn:hover { background: #4f46e5; color: white; border-color: #4f46e5; }
        .hd-refresh-btn.spin svg { animation: hd-spin 0.6s linear; }
        @keyframes hd-spin { to { transform: rotate(360deg); } }
        .hd-auto-toggle { display: inline-flex; align-items: center; gap: 0.4rem; cursor: pointer; user-select: none; color: #475569; font-weight: 500; }
        .hd-auto-toggle input { accent-color: #4f46e5; width: 16px; height: 16px; }

        .hd-alert { display: flex; align-items: center; gap: 0.75rem; padding: 0.9rem 1.1rem; border-radius: 10px; margin-bottom: 1rem; border: 1px solid; font-weight: 500; }
        .hd-alert.warning { background: #fef3c7; border-color: #fbbf24; color: #92400e; }
        .hd-alert.danger { background: #fee2e2; border-color: #f87171; color: #991b1b; }
        .hd-alert-content { flex: 1; }
        .hd-alert-title { font-weight: 600; }
        .hd-alert-sub { font-size: 0.85rem; opacity: 0.85; margin-top: 0.15rem; }

        .hd-kpi-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 1rem; margin-bottom: 1.5rem; }
        .hd-kpi { background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 1.25rem; transition: all 0.2s; box-shadow: 0 1px 3px rgba(0,0,0,0.04); position: relative; overflow: hidden; }
        .hd-kpi:hover { transform: translateY(-2px); box-shadow: 0 8px 16px rgba(0,0,0,0.08); border-color: #cbd5e1; }
        .hd-kpi::before { content: ''; position: absolute; top: 0; left: 0; right: 0; height: 3px; background: var(--accent); }
        .hd-kpi-head { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 0.75rem; }
        .hd-kpi-icon { width: 44px; height: 44px; border-radius: 10px; display: flex; align-items: center; justify-content: center; background: color-mix(in srgb, var(--accent) 12%, transparent); color: var(--accent); }
        .hd-kpi-trend { font-size: 0.75rem; padding: 0.3rem 0.55rem; border-radius: 6px; display: inline-flex; align-items: center; gap: 0.2rem; font-weight: 600; background: #f1f5f9; color: #475569; }
        .hd-kpi-trend.up { background: #d1fae5; color: #065f46; }
        .hd-kpi-trend.down { background: #fee2e2; color: #991b1b; }
        .hd-kpi-label { color: #64748b; font-size: 0.78rem; margin: 0 0 0.35rem; text-transform: uppercase; letter-spacing: 0.05em; font-weight: 600; }
        .hd-kpi-value { color: #0f172a; font-size: 1.85rem; font-weight: 700; line-height: 1.1; margin: 0; }
        .hd-kpi-sub { color: #64748b; font-size: 0.8rem; margin-top: 0.5rem; font-weight: 500; }

        .hd-card { background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 1.5rem; box-shadow: 0 1px 3px rgba(0,0,0,0.04); }
        .hd-card-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.25rem; }
        .hd-card-title { color: #0f172a; font-size: 1.05rem; font-weight: 700; display: flex; align-items: center; gap: 0.5rem; margin: 0; }
        .hd-card-title small { color: #64748b; font-weight: 500; font-size: 0.8rem; }

        .hd-grid-2 { display: grid; grid-template-columns: 2fr 1fr; gap: 1.25rem; margin-bottom: 1.25rem; }
        .hd-grid-3 { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 1.25rem; margin-bottom: 1.25rem; }
        @media (max-width: 1100px) { .hd-grid-2, .hd-grid-3 { grid-template-columns: 1fr; } }

        .hd-spark { display: flex; align-items: flex-end; gap: 8px; height: 160px; padding-top: 0.5rem; }
        .hd-spark-bar-wrap { flex: 1; display: flex; align-items: flex-end; height: 100%; }
        .hd-spark-bar { width: 100%; border-radius: 6px 6px 0 0; min-height: 4px; background: linear-gradient(180deg, #4f46e5, #818cf8); opacity: 0.9; animation: hd-barGrow 0.6s ease-out backwards; transition: opacity 0.2s; cursor: pointer; }
        .hd-spark-bar:hover { opacity: 1; }
        @keyframes hd-barGrow { from { transform: scaleY(0); transform-origin: bottom; } to { transform: scaleY(1); transform-origin: bottom; } }
        .hd-spark-labels { display: flex; justify-content: space-between; margin-top: 0.6rem; color: #64748b; font-size: 0.75rem; font-weight: 500; }

        .hd-donut-wrap { position: relative; display: inline-block; margin: 0 auto; }
        .hd-donut-center { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; color: #0f172a; }
        .hd-donut-center strong { font-size: 2rem; font-weight: 700; }
        .hd-donut-center small { color: #64748b; font-size: 0.72rem; text-transform: uppercase; letter-spacing: 0.06em; font-weight: 600; }

        .hd-legend { display: flex; flex-direction: column; gap: 0.6rem; margin-top: 1.25rem; }
        .hd-legend-item { display: flex; align-items: center; justify-content: space-between; font-size: 0.88rem; color: #334155; font-weight: 500; }
        .hd-legend-item-left { display: flex; align-items: center; gap: 0.6rem; }
        .hd-legend-dot { width: 12px; height: 12px; border-radius: 3px; }

        .hd-room-bars { display: flex; flex-direction: column; gap: 1rem; }
        .hd-room-row { display: flex; align-items: center; gap: 0.85rem; }
        .hd-room-name { color: #334155; font-size: 0.88rem; font-weight: 600; width: 110px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .hd-room-bar-track { flex: 1; height: 10px; background: #f1f5f9; border-radius: 5px; overflow: hidden; }
        .hd-room-bar-fill { height: 100%; background: linear-gradient(90deg, #4f46e5, #7c3aed); border-radius: 5px; transition: width 0.6s ease; }
        .hd-room-amt { color: #0f172a; font-weight: 700; font-size: 0.88rem; min-width: 80px; text-align: right; }

        .hd-list { display: flex; flex-direction: column; gap: 0.65rem; }
        .hd-list-item { display: flex; align-items: center; gap: 0.85rem; padding: 0.85rem 1rem; background: #f8fafc; border-radius: 10px; border: 1px solid #e2e8f0; transition: all 0.2s; }
        .hd-list-item:hover { background: #f1f5f9; border-color: #cbd5e1; }
        .hd-list-icon { width: 38px; height: 38px; border-radius: 10px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
        .hd-list-content { flex: 1; min-width: 0; }
        .hd-list-title { color: #0f172a; font-size: 0.9rem; font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .hd-list-sub { color: #64748b; font-size: 0.78rem; margin-top: 0.15rem; }
        .hd-list-amount { color: #059669; font-weight: 700; font-size: 0.9rem; }
        .hd-empty { color: #94a3b8; font-size: 0.9rem; padding: 1.5rem; text-align: center; font-weight: 500; }

        .hd-status-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 0.85rem; }
        .hd-status-tile { padding: 1rem; border-radius: 10px; border: 1px solid; display: flex; flex-direction: column; gap: 0.3rem; }
        .hd-status-tile-label { font-size: 0.72rem; text-transform: uppercase; letter-spacing: 0.05em; font-weight: 600; }
        .hd-status-tile-value { color: #0f172a; font-size: 1.5rem; font-weight: 700; }

        .hd-donut-flex { display: flex; flex-direction: column; align-items: center; }

        .hd-quick-actions { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 0.85rem; margin-bottom: 1.5rem; }
        .hd-quick { display: flex; align-items: center; justify-content: space-between; gap: 0.65rem; padding: 1rem 1.15rem; border-radius: 10px; border: 1px solid #e2e8f0; background: #ffffff; color: #334155; cursor: pointer; transition: all 0.2s; font-size: 0.88rem; font-weight: 600; box-shadow: 0 1px 3px rgba(0,0,0,0.04); }
        .hd-quick:hover { border-color: #4f46e5; color: #4f46e5; transform: translateY(-1px); box-shadow: 0 4px 8px rgba(79,70,229,0.1); }
        .hd-quick-icon { display: flex; align-items: center; gap: 0.6rem; }

        .hd-skeleton-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 1rem; margin-bottom: 1.5rem; }
        .hd-skeleton-card, .hd-skeleton-chart { background: linear-gradient(90deg, #f1f5f9, #e2e8f0, #f1f5f9); background-size: 200% 100%; animation: hd-shimmer 1.4s infinite; border-radius: 12px; }
        .hd-skeleton-card { height: 130px; }
        .hd-skeleton-chart { height: 280px; }
        @keyframes hd-shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }

        .hd-btn { padding: 0.5rem 1rem; border-radius: 8px; border: 1px solid; font-weight: 600; cursor: pointer; transition: all 0.2s; font-size: 0.88rem; }
        .hd-btn-primary { background: #4f46e5; color: white; border-color: #4f46e5; }
        .hd-btn-primary:hover { background: #3730a3; }
      `}</style>

      <div className="hd-toolbar">
        <div className="hd-toolbar-left">
          {RANGES.map(r => (
            <button
              key={r.id}
              className={`hd-range-btn ${range === r.id ? 'active' : ''}`}
              onClick={() => setRange(r.id)}
            >
              {r.label}
            </button>
          ))}
        </div>
        <div className="hd-toolbar-right">
          {lastUpdated && (
            <span style={{ fontSize: '0.78rem', color: '#64748b' }}>
              Updated {lastUpdated.toLocaleTimeString()}
            </span>
          )}
          <label className="hd-auto-toggle">
            <input type="checkbox" checked={autoRefresh} onChange={(e) => setAutoRefresh(e.target.checked)} />
            Auto-refresh
          </label>
          <button className={`hd-refresh-btn ${refreshing ? 'spin' : ''}`} onClick={() => load()} disabled={refreshing}>
            <RefreshCw size={14} />
            {refreshing ? 'Refreshing' : 'Refresh'}
          </button>
        </div>
      </div>

      {(s.alerts?.overduePayments > 0 || s.alerts?.lowAvailability) && (
        <div>
          {s.alerts.overduePayments > 0 && (
            <div className="hd-alert warning">
              <AlertTriangle size={20} />
              <div className="hd-alert-content">
                <div className="hd-alert-title">{s.alerts.overduePayments} overdue payment{s.alerts.overduePayments !== 1 ? 's' : ''}</div>
                <div className="hd-alert-sub">Bookings older than 7 days with pending balance need follow-up.</div>
              </div>
              <ChevronRight size={18} />
            </div>
          )}
          {s.alerts.lowAvailability && (
            <div className="hd-alert danger">
              <Bell size={20} />
              <div className="hd-alert-content">
                <div className="hd-alert-title">Low room availability</div>
                <div className="hd-alert-sub">Only {s.availableRooms} of {s.totalRooms} rooms are free.</div>
              </div>
              <ChevronRight size={18} />
            </div>
          )}
        </div>
      )}

      <div className="hd-kpi-grid">
        {kpis.map((k, i) => {
          const Icon = k.icon
          return (
            <div key={i} className="hd-kpi" style={{ '--accent': k.accent }}>
              <div className="hd-kpi-head">
                <div className="hd-kpi-icon"><Icon size={22} /></div>
                {k.trend !== null && k.trend !== undefined && (
                  <span className={`hd-kpi-trend ${k.trendUp !== undefined ? (k.trendUp ? 'up' : 'down') : ''}`}>
                    {k.trendUp ? <ArrowUpRight size={12} /> : k.trendUp === false ? <ArrowDownRight size={12} /> : null}
                    {k.trendLabel ? `${k.trend}` : `${k.trend > 0 ? '+' : ''}${k.trend}%`}
                  </span>
                )}
              </div>
              <div className="hd-kpi-label">{k.label}</div>
              <p className="hd-kpi-value">
                <AnimatedNumber value={k.value} prefix={k.prefix || ''} decimals={k.decimals || 0} />
              </p>
              <div className="hd-kpi-sub">{k.sub}</div>
            </div>
          )
        })}
      </div>

      <div className="hd-quick-actions">
        <button className="hd-quick"><span className="hd-quick-icon"><Bed size={16} /> Manage Rooms</span><ArrowRight size={14} /></button>
        <button className="hd-quick"><span className="hd-quick-icon"><Calendar size={16} /> View Bookings</span><ArrowRight size={14} /></button>
        <button className="hd-quick"><span className="hd-quick-icon"><Users size={16} /> Today's Arrivals</span><ArrowRight size={14} /></button>
        <button className="hd-quick"><span className="hd-quick-icon"><Star size={16} /> Read Reviews</span><ArrowRight size={14} /></button>
        <button className="hd-quick"><span className="hd-quick-icon"><TrendingUp size={16} /> Revenue</span><ArrowRight size={14} /></button>
      </div>

      <div className="hd-grid-2">
        <div className="hd-card">
          <div className="hd-card-head">
            <h3 className="hd-card-title"><TrendingUp size={18} style={{ color: '#4f46e5' }} /> Revenue Trend <small>· 7 days</small></h3>
            <span style={{ color: '#64748b', fontSize: '0.85rem', fontWeight: 600 }}>{formatCurrency(s.rangeRevenue || 0)} total</span>
          </div>
          <SparkBars data={s.revenueTrend || []} valueKey="revenue" />
          <div className="hd-spark-labels">
            {(s.revenueTrend || []).map((d, i) => (
              <span key={i}>{d.label}</span>
            ))}
          </div>
        </div>

        <div className="hd-card">
          <div className="hd-card-head">
            <h3 className="hd-card-title"><Activity size={18} style={{ color: '#3b82f6' }} /> Booking Status</h3>
            <span style={{ color: '#64748b', fontSize: '0.85rem', fontWeight: 600 }}>{s.totalBookings || 0} total</span>
          </div>
          {bookingSegments.length > 0 ? (
            <div className="hd-donut-flex">
              <Donut segments={bookingSegments} />
              <div className="hd-legend">
                {bookingSegments.map(seg => (
                  <div key={seg.label} className="hd-legend-item">
                    <div className="hd-legend-item-left">
                      <span className="hd-legend-dot" style={{ background: seg.color }} />
                      {seg.label}
                    </div>
                    <strong style={{ color: '#0f172a' }}>{seg.value}</strong>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="hd-empty">No bookings yet</div>
          )}
        </div>
      </div>

      <div className="hd-grid-3">
        <div className="hd-card">
          <div className="hd-card-head">
            <h3 className="hd-card-title"><CreditCard size={18} style={{ color: '#10b981' }} /> Payment Mix</h3>
          </div>
          {paymentSegments.length > 0 ? (
            <div className="hd-donut-flex">
              <Donut segments={paymentSegments} size={130} thickness={16} />
              <div className="hd-legend">
                {paymentSegments.map(seg => (
                  <div key={seg.label} className="hd-legend-item">
                    <div className="hd-legend-item-left">
                      <span className="hd-legend-dot" style={{ background: seg.color }} />
                      {seg.label}
                    </div>
                    <strong style={{ color: '#0f172a' }}>{seg.value}</strong>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="hd-empty">No payments yet</div>
          )}
        </div>

        <div className="hd-card">
          <div className="hd-card-head">
            <h3 className="hd-card-title"><Sparkles size={18} style={{ color: '#7c3aed' }} /> Top Rooms</h3>
          </div>
          {(s.topRooms || []).length === 0 ? (
            <div className="hd-empty">No revenue data yet</div>
          ) : (
            <div className="hd-room-bars">
              {(s.topRooms || []).map((r, i) => (
                <div key={i} className="hd-room-row">
                  <div className="hd-room-name" title={r.name}>{r.name}</div>
                  <div className="hd-room-bar-track">
                    <div className="hd-room-bar-fill" style={{ width: `${(r.revenue / maxRoomRevenue) * 100}%` }} />
                  </div>
                  <div className="hd-room-amt">{formatCurrency(r.revenue)}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="hd-card">
          <div className="hd-card-head">
            <h3 className="hd-card-title"><Home size={18} style={{ color: '#f59e0b' }} /> Room Status</h3>
          </div>
          <div className="hd-status-grid">
            <div className="hd-status-tile" style={{ background: '#d1fae5', borderColor: '#10b981' }}>
              <span className="hd-status-tile-label" style={{ color: '#065f46' }}>Available</span>
              <span className="hd-status-tile-value"><AnimatedNumber value={s.roomStatus?.available ?? 0} /></span>
            </div>
            <div className="hd-status-tile" style={{ background: '#dbeafe', borderColor: '#3b82f6' }}>
              <span className="hd-status-tile-label" style={{ color: '#1e40af' }}>Occupied</span>
              <span className="hd-status-tile-value"><AnimatedNumber value={s.roomStatus?.occupied ?? 0} /></span>
            </div>
            <div className="hd-status-tile" style={{ background: '#fed7aa', borderColor: '#f97316' }}>
              <span className="hd-status-tile-label" style={{ color: '#9a3412' }}>Reserved</span>
              <span className="hd-status-tile-value"><AnimatedNumber value={s.roomStatus?.reserved ?? 0} /></span>
            </div>
            <div className="hd-status-tile" style={{ background: '#fee2e2', borderColor: '#ef4444' }}>
              <span className="hd-status-tile-label" style={{ color: '#991b1b' }}>Maintenance</span>
              <span className="hd-status-tile-value"><AnimatedNumber value={s.roomStatus?.maintenance ?? 0} /></span>
            </div>
          </div>
          <div style={{ marginTop: '1.1rem', padding: '0.9rem', background: '#f8fafc', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', color: '#334155', fontSize: '0.88rem', fontWeight: 600 }}>
              <span>Occupancy Rate</span>
              <strong style={{ color: '#0f172a' }}>{occupancy}%</strong>
            </div>
            <div style={{ marginTop: '0.6rem', height: '8px', background: '#e2e8f0', borderRadius: '4px', overflow: 'hidden' }}>
              <div style={{ width: `${occupancy}%`, height: '100%', background: 'linear-gradient(90deg, #10b981, #4f46e5)', transition: 'width 0.6s ease' }} />
            </div>
          </div>
        </div>
      </div>

      <div className="hd-grid-2">
        <div className="hd-card">
          <div className="hd-card-head">
            <h3 className="hd-card-title"><Users size={18} style={{ color: '#10b981' }} /> Today's Check-ins <small>· {s.todayCheckIns?.length || 0}</small></h3>
          </div>
          {(s.todayCheckIns || []).length === 0 ? (
            <div className="hd-empty">No arrivals scheduled for today</div>
          ) : (
            <div className="hd-list">
              {s.todayCheckIns.slice(0, 5).map(b => (
                <div key={b._id} className="hd-list-item">
                  <div className="hd-list-icon" style={{ background: '#d1fae5', color: '#065f46' }}><CheckCircle size={18} /></div>
                  <div className="hd-list-content">
                    <div className="hd-list-title">{b.guestName}</div>
                    <div className="hd-list-sub">{b.roomType} · {b.guests || 1} guest{b.guests !== 1 ? 's' : ''}</div>
                  </div>
                  <div className="hd-list-amount">{formatCurrency(b.amount || 0)}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="hd-card">
          <div className="hd-card-head">
            <h3 className="hd-card-title"><Calendar size={18} style={{ color: '#8b5cf6' }} /> Today's Check-outs <small>· {s.todayCheckOuts?.length || 0}</small></h3>
          </div>
          {(s.todayCheckOuts || []).length === 0 ? (
            <div className="hd-empty">No departures scheduled for today</div>
          ) : (
            <div className="hd-list">
              {s.todayCheckOuts.slice(0, 5).map(b => (
                <div key={b._id} className="hd-list-item">
                  <div className="hd-list-icon" style={{ background: '#ede9fe', color: '#5b21b6' }}><XCircle size={18} /></div>
                  <div className="hd-list-content">
                    <div className="hd-list-title">{b.guestName}</div>
                    <div className="hd-list-sub">{b.roomType} · {b.guests || 1} guest{b.guests !== 1 ? 's' : ''}</div>
                  </div>
                  <div className="hd-list-amount">{formatCurrency(b.paidAmount || 0)}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="hd-grid-2">
        <div className="hd-card">
          <div className="hd-card-head">
            <h3 className="hd-card-title"><Calendar size={18} style={{ color: '#4f46e5' }} /> Recent Bookings</h3>
            <Eye size={14} style={{ color: '#94a3b8' }} />
          </div>
          {(s.recentBookings || []).length === 0 ? (
            <div className="hd-empty">No bookings yet</div>
          ) : (
            <div className="hd-list">
              {s.recentBookings.slice(0, 6).map(b => (
                <div key={b._id} className="hd-list-item">
                  <div className="hd-list-icon" style={{ background: '#e0e7ff', color: '#3730a3' }}><Calendar size={18} /></div>
                  <div className="hd-list-content">
                    <div className="hd-list-title">{b.guestName} · {b.roomType || 'Room'}</div>
                    <div className="hd-list-sub">{formatDate(b.checkInDate)} → {formatDate(b.checkOutDate)} · {b.status}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div className="hd-list-amount">{formatCurrency(b.amount || 0)}</div>
                    <div style={{ fontSize: '0.72rem', color: b.paymentStatus === 'paid' ? '#059669' : b.paymentStatus === 'partial' ? '#d97706' : '#dc2626', fontWeight: 600, marginTop: '0.15rem' }}>{b.paymentStatus}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="hd-card">
          <div className="hd-card-head">
            <h3 className="hd-card-title"><Star size={18} style={{ color: '#f59e0b' }} /> Recent Reviews</h3>
          </div>
          {(s.recentReviews || []).length === 0 ? (
            <div className="hd-empty">No reviews yet</div>
          ) : (
            <div className="hd-list">
              {s.recentReviews.slice(0, 5).map(r => (
                <div key={r._id} className="hd-list-item">
                  <div className="hd-list-icon" style={{ background: '#fef3c7', color: '#92400e' }}><Star size={18} /></div>
                  <div className="hd-list-content">
                    <div className="hd-list-title">{r.customer}</div>
                    <div className="hd-list-sub">{'★'.repeat(r.rating)}{'☆'.repeat(5 - r.rating)} · {r.comment?.slice(0, 60)}{r.comment?.length > 60 ? '...' : ''}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </HotelLayout>
  )
}

export default HotelDashboard