import { useState, useEffect } from 'react'
import { Calendar, Users, RefreshCw, LogIn, LogOut, Plus, Save, X, XCircle, CheckCircle, Clock, User, Phone, Mail, CreditCard, AlertCircle, DollarSign } from 'lucide-react'
import HotelLayout from './HotelLayout'
import { api, formatCurrency, formatDate } from '../../api'
import '../Dashboard.css'
import './HotelDashboard.css'

const emptyWalkin = () => ({
  guestName: '', guestEmail: '', guestPhone: '',
  roomType: 'Standard', rooms: 1, guests: 1,
  checkInDate: new Date().toISOString().split('T')[0],
  checkOutDate: new Date(Date.now() + 86400000).toISOString().split('T')[0],
  amount: '', paidAmount: 0, paymentStatus: 'paid', status: 'confirmed'
})

const STATUS_COLORS = {
  pending: { bg: 'rgba(245,158,11,0.15)', color: '#f59e0b', icon: Clock },
  confirmed: { bg: 'rgba(59,130,246,0.15)', color: '#3b82f6', icon: CheckCircle },
  checked_in: { bg: 'rgba(16,185,129,0.15)', color: '#10b981', icon: CheckCircle },
  checked_out: { bg: 'rgba(139,92,246,0.15)', color: '#8b5cf6', icon: LogOut },
  cancelled: { bg: 'rgba(239,68,68,0.15)', color: '#ef4444', icon: XCircle },
}

const PAYMENT_COLORS = {
  paid: { bg: 'rgba(16,185,129,0.15)', color: '#10b981' },
  partial: { bg: 'rgba(245,158,11,0.15)', color: '#f59e0b' },
  pending: { bg: 'rgba(239,68,68,0.15)', color: '#ef4444' },
  refunded: { bg: 'rgba(139,92,246,0.15)', color: '#8b5cf6' },
  failed: { bg: 'rgba(239,68,68,0.15)', color: '#ef4444' },
}

const StatusPill = ({ status, type = 'booking' }) => {
  const colors = type === 'booking' ? STATUS_COLORS : PAYMENT_COLORS
  const cfg = colors[status] || colors.pending
  const Icon = cfg?.icon || AlertCircle
  return (
    <span className="hc-status-pill" style={{ background: cfg.bg, color: cfg.color }}>
      <Icon className="h-3 w-3" />
      {status.replace('_', ' ')}
    </span>
  )
}

const BookingCard = ({ b, actionButtons }) => {
  const statusCfg = STATUS_COLORS[b.status] || STATUS_COLORS.pending
  const paymentCfg = PAYMENT_COLORS[b.paymentStatus] || PAYMENT_COLORS.pending

  return (
    <div className="hc-booking-card">
      <div className="hc-booking-header">
        <div className="hc-booking-id">
          {b.bookingId || b._id?.slice(-8)}
        </div>
        <StatusPill status={b.status} type="booking" />
      </div>

      <div className="hc-booking-body">
        <div className="hc-booking-guest">
          <User className="h-4 w-4" />
          <strong>{b.guestName}</strong>
        </div>
        {(b.guestEmail || b.guestPhone) && (
          <div className="hc-booking-contact">
            {b.guestEmail && (
              <span><Mail className="h-3 w-3" /> {b.guestEmail}</span>
            )}
            {b.guestPhone && (
              <span><Phone className="h-3 w-3" /> {b.guestPhone}</span>
            )}
          </div>
        )}

        <div className="hc-booking-details">
          <div className="hc-detail-item">
            <Clock className="h-4 w-4" />
            <div>
              <small>Check-in</small>
              <strong>{formatDate(b.checkInDate)}</strong>
            </div>
          </div>
          <div className="hc-detail-item">
            <Calendar className="h-4 w-4" />
            <div>
              <small>Check-out</small>
              <strong>{formatDate(b.checkOutDate)}</strong>
            </div>
          </div>
          <div className="hc-detail-item">
            <Users className="h-4 w-4" />
            <div>
              <small>Guests</small>
              <strong>{b.guests || 1}</strong>
            </div>
          </div>
          <div className="hc-detail-item">
            <LogIn className="h-4 w-4" />
            <div>
              <small>Room</small>
              <strong>{b.roomType || '—'}</strong>
            </div>
          </div>
        </div>
      </div>

      <div className="hc-booking-footer">
        <div className="hc-booking-amount">
          <div className="hc-amount-main">{formatCurrency(b.amount || 0)}</div>
          <div className="hc-amount-paid">
            Paid: {formatCurrency(b.paidAmount || 0)}
            <span className="hc-payment-badge" style={{ background: paymentCfg.bg, color: paymentCfg.color }}>
              {b.paymentStatus}
            </span>
          </div>
        </div>
        <div className="hc-booking-actions">
          {actionButtons}
        </div>
      </div>
    </div>
  )
}

const EmptyState = ({ icon: Icon, title, subtitle }) => (
  <div className="hc-empty-state">
    <div className="hc-empty-icon">
      <Icon className="h-8 w-8" />
    </div>
    <h4>{title}</h4>
    <p>{subtitle}</p>
  </div>
)

const StatCard = ({ icon: Icon, bg, label, value }) => (
  <div className="hr-stat-card">
    <div className={`hr-stat-icon ${bg}`}>
      <Icon size={20} />
    </div>
    <div>
      <div className="hr-stat-label">{label}</div>
      <div className="hr-stat-value">{value}</div>
    </div>
  </div>
)

const HotelCheckInOutPage = () => {
  const [bookings, setBookings] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [activeTab, setActiveTab] = useState('today')
  const [showWalkin, setShowWalkin] = useState(false)
  const [form, setForm] = useState(emptyWalkin())
  const [saving, setSaving] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)
  const [processingId, setProcessingId] = useState(null)

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      try {
        setLoading(true)
        const data = await api('/hotel/bookings', { params: { limit: 'all' } })
        if (!cancelled) setBookings(data.bookings || [])
      } catch (err) {
        if (!cancelled) setError(err.message)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [refreshKey])

  useEffect(() => {
    const id = setInterval(() => setRefreshKey(k => k + 1), 20000)
    return () => clearInterval(id)
  }, [])

  const refresh = () => setRefreshKey(k => k + 1)

  const today = new Date().toISOString().split('T')[0]
  const checkIns = bookings.filter(b => b.checkInDate && formatDate(b.checkInDate) === today)
  const checkOuts = bookings.filter(b => b.checkOutDate && formatDate(b.checkOutDate) === today)
  const currentlyIn = bookings.filter(b => b.status === 'checked_in')
  const upcoming = bookings.filter(b => ['pending', 'confirmed'].includes(b.status) && b.checkInDate && formatDate(b.checkInDate) > today)

  const handleCheckIn = async (b) => {
    setProcessingId(b._id)
    try {
      await api(`/hotel/bookings/${b._id}`, { method: 'PUT', body: JSON.stringify({ status: 'checked_in' }) })
      refresh()
    } catch (err) { alert(err.message) } finally { setProcessingId(null) }
  }

  const handleCheckOut = async (b) => {
    setProcessingId(b._id)
    try {
      await api(`/hotel/bookings/${b._id}`, { method: 'PUT', body: JSON.stringify({ status: 'checked_out' }) })
      refresh()
    } catch (err) { alert(err.message) } finally { setProcessingId(null) }
  }

  const handleCancel = async (b) => {
    if (!confirm(`Cancel booking for ${b.guestName}?`)) return
    setProcessingId(b._id)
    try {
      await api(`/hotel/bookings/${b._id}`, { method: 'PUT', body: JSON.stringify({ status: 'cancelled' }) })
      refresh()
    } catch (err) { alert(err.message) } finally { setProcessingId(null) }
  }

  const handleRecordPayment = async (b) => {
    const remaining = (b.amount || 0) - (b.paidAmount || 0)
    const amt = prompt(`Record payment for ${b.guestName}. Outstanding: ₹${remaining}`, remaining)
    if (!amt) return
    try {
      await api(`/hotel/bookings/${b._id}/pay`, { method: 'PUT', body: JSON.stringify({ amount: Number(amt) }) })
      refresh()
    } catch (err) { alert(err.message) }
  }

  const handleWalkinSubmit = async (e) => {
    e.preventDefault()
    if (!form.guestName.trim()) return alert('Guest name required')
    setSaving(true)
    try {
      await api('/hotel/bookings', {
        method: 'POST',
        body: JSON.stringify({
          ...form,
          amount: Number(form.amount) || 0,
          paidAmount: Number(form.paidAmount) || 0,
          rooms: Number(form.rooms) || 1,
          guests: Number(form.guests) || 1,
          hotelName: 'My Hotel'
        })
      })
      setShowWalkin(false)
      setForm(emptyWalkin())
      refresh()
    } catch (err) { alert(err.message) } finally { setSaving(false) }
  }



  return (
    <HotelLayout active="checkin" title="Check-in / Check-out">
      <div className="hr-stats">
        <StatCard icon={LogIn} bg="bg-blue" label="Arrivals Today" value={checkIns.length} />
        <StatCard icon={LogOut} bg="bg-purple" label="Departures Today" value={checkOuts.length} />
        <StatCard icon={Users} bg="bg-emerald" label="In-House" value={currentlyIn.length} />
        <StatCard icon={Calendar} bg="bg-amber" label="Upcoming" value={upcoming.length} />
        <StatCard icon={DollarSign} bg="bg-amber" label="Total Revenue" value={formatCurrency(bookings.reduce((s, b) => s + (b.amount || 0), 0))} />
      </div>

      <div className="hr-card" style={{ marginBottom: '1.5rem' }}>
        <div className="hr-card-head">
          <h3 className="hr-card-title">Operations <small style={{ color: '#64748b', fontWeight: 400 }}>· auto-refresh every 20s</small></h3>
          <div className="hr-actions">
            <button className="hr-btn hr-btn-secondary" onClick={refresh}>
              <RefreshCw size={14} /> Refresh
            </button>
            <button className="hr-btn hr-btn-primary" onClick={() => setShowWalkin(true)}>
              <Plus size={14} /> Walk-in Guest
            </button>
          </div>
        </div>

        <div className="hc-tabs">
          <button className={`hc-tab ${activeTab === 'today' ? 'active' : ''}`} onClick={() => setActiveTab('today')}>
            Today ({checkIns.length + checkOuts.length})
          </button>
          <button className={`hc-tab ${activeTab === 'inhouse' ? 'active' : ''}`} onClick={() => setActiveTab('inhouse')}>
            In-House ({currentlyIn.length})
          </button>
          <button className={`hc-tab ${activeTab === 'upcoming' ? 'active' : ''}`} onClick={() => setActiveTab('upcoming')}>
            Upcoming ({upcoming.length})
          </button>
          <button className={`hc-tab ${activeTab === 'all' ? 'active' : ''}`} onClick={() => setActiveTab('all')}>
            All Bookings ({bookings.length})
          </button>
        </div>

        {loading && (
          <div className="hc-loading">
            <RefreshCw className="h-6 w-6 animate-spin" />
            <span>Loading bookings...</span>
          </div>
        )}
        {error && (
          <div className="hc-error-banner">
            <AlertCircle className="h-4 w-4" />
            {error}
          </div>
        )}

        {!loading && !error && activeTab === 'today' && (
          (checkIns.length === 0 && checkOuts.length === 0) ? (
            <EmptyState icon={Clock} title="No arrivals or departures today" subtitle="No guests are scheduled to check in or out today." />
          ) : (
            <>
              {checkIns.length > 0 && (
                <>
                  <div className="hc-section-header">
                    <LogIn className="h-5 w-5" />
                    <h4>Arrivals Today ({checkIns.length})</h4>
                  </div>
                  <div className="hc-bookings-list">
                    {checkIns.map(b => (
                      <BookingCard key={b._id} b={b} actionButtons={
                        <>
                          {(b.status === 'pending' || b.status === 'confirmed') && (
                            <button className="hc-btn hc-btn-primary" disabled={processingId === b._id} onClick={() => handleCheckIn(b)}>
                              <LogIn size={14} /> Check In
                            </button>
                          )}
                          {b.paymentStatus !== 'paid' && (
                            <button className="hc-btn" onClick={() => handleRecordPayment(b)}>
                              <CreditCard size={14} /> Pay
                            </button>
                          )}
                          <button className="hc-btn hc-btn-danger" onClick={() => handleCancel(b)}>
                            <XCircle size={14} />
                          </button>
                        </>
                      } />
                    ))}
                  </div>
                </>
              )}

              {checkOuts.length > 0 && (
                <>
                  <div className="hc-section-header" style={{ marginTop: checkIns.length > 0 ? '1.5rem' : 0 }}>
                    <LogOut className="h-5 w-5" />
                    <h4>Departures Today ({checkOuts.length})</h4>
                  </div>
                  <div className="hc-bookings-list">
                    {checkOuts.map(b => (
                      <BookingCard key={b._id} b={b} actionButtons={
                        <>
                          {b.status === 'checked_in' && (
                            <button className="hc-btn hc-btn-primary" disabled={processingId === b._id} onClick={() => handleCheckOut(b)}>
                              <LogOut size={14} /> Check Out
                            </button>
                          )}
                          {b.paymentStatus !== 'paid' && (
                            <button className="hc-btn" onClick={() => handleRecordPayment(b)}>
                              <CreditCard size={14} /> Pay
                            </button>
                          )}
                        </>
                      } />
                    ))}
                  </div>
                </>
              )}
            </>
          )
        )}

        {!loading && !error && activeTab === 'inhouse' && (
          currentlyIn.length === 0 ? (
            <EmptyState icon={Users} title="No guests in-house" subtitle="There are currently no checked-in guests." />
          ) : (
            <div className="hc-bookings-list">
              {currentlyIn.map(b => (
                <BookingCard key={b._id} b={b} actionButtons={
                  <>
                    <button className="hc-btn hc-btn-primary" disabled={processingId === b._id} onClick={() => handleCheckOut(b)}>
                      <LogOut size={14} /> Check Out
                    </button>
                    {b.paymentStatus !== 'paid' && (
                      <button className="hc-btn" onClick={() => handleRecordPayment(b)}>
                        <CreditCard size={14} /> Pay
                      </button>
                    )}
                  </>
                } />
              ))}
            </div>
          )
        )}

        {!loading && !error && activeTab === 'upcoming' && (
          upcoming.length === 0 ? (
            <EmptyState icon={Calendar} title="No upcoming bookings" subtitle="No future arrivals are scheduled at this time." />
          ) : (
            <div className="hc-bookings-list">
              {upcoming.map(b => (
                <BookingCard key={b._id} b={b} actionButtons={
                  <>
                    {b.status === 'pending' && (
                      <button className="hc-btn hc-btn-primary" disabled={processingId === b._id} onClick={() => handleCheckIn(b)}>
                        <LogIn size={14} /> Pre-Check In
                      </button>
                    )}
                    <button className="hc-btn hc-btn-danger" onClick={() => handleCancel(b)}>
                      <XCircle size={14} />
                    </button>
                  </>
                } />
              ))}
            </div>
          )
        )}

        {!loading && !error && activeTab === 'all' && (
          bookings.length === 0 ? (
            <EmptyState icon={Users} title="No bookings yet" subtitle="No bookings have been made for this property." />
          ) : (
            <div className="hc-bookings-list">
              {bookings.map(b => (
                <BookingCard key={b._id} b={b} actionButtons={
                  <>
                    {(b.status === 'pending' || b.status === 'confirmed') && (
                      <button className="hc-btn hc-btn-primary" disabled={processingId === b._id} onClick={() => handleCheckIn(b)}>
                        <LogIn size={14} /> In
                      </button>
                    )}
                    {b.status === 'checked_in' && (
                      <button className="hc-btn hc-btn-primary" disabled={processingId === b._id} onClick={() => handleCheckOut(b)}>
                        <LogOut size={14} /> Out
                      </button>
                    )}
                    {b.paymentStatus !== 'paid' && (
                      <button className="hc-btn" onClick={() => handleRecordPayment(b)}>
                        <CreditCard size={14} /> Pay
                      </button>
                    )}
                    {!['checked_out', 'cancelled'].includes(b.status) && (
                      <button className="hc-btn hc-btn-danger" onClick={() => handleCancel(b)}>
                        <XCircle size={14} />
                      </button>
                    )}
                  </>
                } />
              ))}
            </div>
          )
        )}
      </div>

      {showWalkin && (
        <div className="hr-modal-overlay" onClick={() => setShowWalkin(false)}>
          <div className="hr-modal" onClick={e => e.stopPropagation()}>
            <div className="hr-modal-header">
              <h3>Walk-in Booking</h3>
              <button className="hr-modal-close" onClick={() => setShowWalkin(false)}><X size={18} /></button>
            </div>
            <form onSubmit={handleWalkinSubmit} className="hr-modal-body">
              <div className="hc-form-grid">
                <div className="hc-form-group hc-form-group--full">
                  <label>Guest Name *</label>
                  <input
                    value={form.guestName}
                    onChange={e => setForm({ ...form, guestName: e.target.value })}
                    required
                  />
                </div>
                <div className="hc-form-group">
                  <label>Email</label>
                  <input
                    type="email"
                    value={form.guestEmail}
                    onChange={e => setForm({ ...form, guestEmail: e.target.value })}
                  />
                </div>
                <div className="hc-form-group">
                  <label>Phone</label>
                  <input
                    value={form.guestPhone}
                    onChange={e => setForm({ ...form, guestPhone: e.target.value })}
                  />
                </div>
                <div className="hc-form-group">
                  <label>Room Type</label>
                  <select value={form.roomType} onChange={e => setForm({ ...form, roomType: e.target.value })}>
                    <option>Standard</option>
                    <option>Deluxe</option>
                    <option>Suite</option>
                    <option>Family</option>
                  </select>
                </div>
                <div className="hc-form-group">
                  <label>Rooms</label>
                  <input type="number" min="1" value={form.rooms} onChange={e => setForm({ ...form, rooms: Number(e.target.value) || 1 })} />
                </div>
                <div className="hc-form-group">
                  <label>Guests</label>
                  <input type="number" min="1" value={form.guests} onChange={e => setForm({ ...form, guests: Number(e.target.value) || 1 })} />
                </div>
                <div className="hc-form-group">
                  <label>Check-in *</label>
                  <input type="date" value={form.checkInDate} onChange={e => setForm({ ...form, checkInDate: e.target.value })} required />
                </div>
                <div className="hc-form-group">
                  <label>Check-out *</label>
                  <input type="date" value={form.checkOutDate} onChange={e => setForm({ ...form, checkOutDate: e.target.value })} required />
                </div>
                <div className="hc-form-group">
                  <label>Amount (₹)</label>
                  <input type="number" min="0" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} />
                </div>
                <div className="hc-form-group">
                  <label>Paid (₹)</label>
                  <input type="number" min="0" value={form.paidAmount} onChange={e => setForm({ ...form, paidAmount: Number(e.target.value) || 0 })} />
                </div>
              </div>
              <div className="hr-form-actions">
                <button type="button" className="hr-btn hr-btn-secondary" onClick={() => setShowWalkin(false)}>
                  Cancel
                </button>
                <button type="submit" className="hr-btn hr-btn-primary" disabled={saving}>
                  <Save size={14} /> {saving ? 'Checking In...' : 'Check In Guest'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </HotelLayout>
  )
}

export default HotelCheckInOutPage
