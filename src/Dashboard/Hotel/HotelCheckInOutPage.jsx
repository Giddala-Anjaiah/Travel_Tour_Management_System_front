import { useState, useEffect } from 'react'
import { Calendar, Users, RefreshCw, LogIn, LogOut, Plus, Save, X, XCircle } from 'lucide-react'
import HotelLayout from './HotelLayout'
import { api, formatCurrency, formatDate } from '../../api'
import '../Dashboard.css'

const emptyWalkin = () => ({
  guestName: '', guestEmail: '', guestPhone: '',
  roomType: 'Standard', rooms: 1, guests: 1,
  checkInDate: new Date().toISOString().split('T')[0],
  checkOutDate: new Date(Date.now() + 86400000).toISOString().split('T')[0],
  amount: '', paidAmount: 0, paymentStatus: 'paid', status: 'confirmed'
})

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
        const data = await api('/hotel/bookings')
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

  // Auto-refresh every 20s for real-time updates
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

  const stats = {
    arrivals: checkIns.length,
    departures: checkOuts.length,
    inHouse: currentlyIn.length,
    upcoming: upcoming.length
  }

  const BookingRow = ({ b, actions }) => (
    <tr>
      <td><small>{b.bookingId}</small></td>
      <td><strong>{b.guestName}</strong><br /><small style={{ color: '#64748b' }}>{b.guestEmail || b.guestPhone || ''}</small></td>
      <td>{b.roomType}</td>
      <td>{b.guests}</td>
      <td>{formatCurrency(b.amount)}<br /><small style={{ color: '#4ade80' }}>Paid: {formatCurrency(b.paidAmount || 0)}</small></td>
      <td><span className={`status-pill status-${b.status}`}>{b.status.replace('_', ' ')}</span><br /><small className={`status-pill payment-${b.paymentStatus}`}>{b.paymentStatus}</small></td>
      <td>
        <div style={{ display: 'flex', gap: '0.25rem', flexWrap: 'wrap' }}>
          {actions}
        </div>
      </td>
    </tr>
  )

  return (
    <HotelLayout active="checkin" title="Check-in / Check-out">
      <div className="stats-grid" style={{ marginBottom: '1rem' }}>
        <div className="stat-card"><LogIn className="stat-icon" /><div className="stat-content"><h3>Today's Arrivals</h3><p className="stat-number">{stats.arrivals}</p></div></div>
        <div className="stat-card"><LogOut className="stat-icon" /><div className="stat-content"><h3>Today's Departures</h3><p className="stat-number">{stats.departures}</p></div></div>
        <div className="stat-card"><Users className="stat-icon" /><div className="stat-content"><h3>In-House</h3><p className="stat-number">{stats.inHouse}</p></div></div>
        <div className="stat-card"><Calendar className="stat-icon" /><div className="stat-content"><h3>Upcoming</h3><p className="stat-number">{stats.upcoming}</p></div></div>
      </div>

      <div className="section-card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
          <h3 style={{ margin: 0 }}>Operations <small style={{ color: '#64748b', fontWeight: 400 }}>· auto-refresh every 20s</small></h3>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button className="btn-secondary" onClick={refresh}><RefreshCw size={14} /> Refresh</button>
            <button className="btn-primary" onClick={() => setShowWalkin(true)}><Plus size={14} /> Walk-in Booking</button>
          </div>
        </div>

        <div className="tabs-container" style={{ marginBottom: '1rem' }}>
          <div className="tabs">
            <button className={`tab ${activeTab === 'today' ? 'active' : ''}`} onClick={() => setActiveTab('today')}>Today ({checkIns.length + checkOuts.length})</button>
            <button className={`tab ${activeTab === 'inhouse' ? 'active' : ''}`} onClick={() => setActiveTab('inhouse')}>In-House ({currentlyIn.length})</button>
            <button className={`tab ${activeTab === 'upcoming' ? 'active' : ''}`} onClick={() => setActiveTab('upcoming')}>Upcoming ({upcoming.length})</button>
            <button className={`tab ${activeTab === 'all' ? 'active' : ''}`} onClick={() => setActiveTab('all')}>All Bookings ({bookings.length})</button>
          </div>
        </div>

        {loading && <p>Loading...</p>}
        {error && <p style={{ color: '#ef4444' }}>{error}</p>}

        {activeTab === 'today' && (
          <>
            <h4>Arrivals Today ({checkIns.length})</h4>
            {checkIns.length === 0 ? <p style={{ color: '#64748b' }}>No arrivals today</p> : (
              <table className="data-table">
                <thead><tr><th>ID</th><th>Guest</th><th>Room</th><th>Guests</th><th>Amount</th><th>Status</th><th>Actions</th></tr></thead>
                <tbody>
                  {checkIns.map(b => (
                    <BookingRow key={b._id} b={b} actions={
                      <>
                        {b.status === 'pending' && <button className="btn-primary" disabled={processingId === b._id} onClick={() => handleCheckIn(b)}><LogIn size={14} /> Check In</button>}
                        {b.status === 'confirmed' && <button className="btn-primary" disabled={processingId === b._id} onClick={() => handleCheckIn(b)}><LogIn size={14} /> Check In</button>}
                        {b.paymentStatus !== 'paid' && <button className="btn-secondary" onClick={() => handleRecordPayment(b)}>Pay</button>}
                        <button className="icon-btn danger" onClick={() => handleCancel(b)}><XCircle size={14} /></button>
                      </>
                    } />
                  ))}
                </tbody>
              </table>
            )}

            <h4 style={{ marginTop: '1.5rem' }}>Departures Today ({checkOuts.length})</h4>
            {checkOuts.length === 0 ? <p style={{ color: '#64748b' }}>No departures today</p> : (
              <table className="data-table">
                <thead><tr><th>ID</th><th>Guest</th><th>Room</th><th>Guests</th><th>Amount</th><th>Status</th><th>Actions</th></tr></thead>
                <tbody>
                  {checkOuts.map(b => (
                    <BookingRow key={b._id} b={b} actions={
                      <>
                        {b.status === 'checked_in' && <button className="btn-primary" disabled={processingId === b._id} onClick={() => handleCheckOut(b)}><LogOut size={14} /> Check Out</button>}
                        {b.paymentStatus !== 'paid' && <button className="btn-secondary" onClick={() => handleRecordPayment(b)}>Pay</button>}
                      </>
                    } />
                  ))}
                </tbody>
              </table>
            )}
          </>
        )}

        {activeTab === 'inhouse' && (
          currentlyIn.length === 0 ? <p style={{ color: '#64748b' }}>No guests currently in-house</p> : (
            <table className="data-table">
              <thead><tr><th>ID</th><th>Guest</th><th>Room</th><th>Guests</th><th>Amount</th><th>Status</th><th>Actions</th></tr></thead>
              <tbody>
                {currentlyIn.map(b => (
                  <BookingRow key={b._id} b={b} actions={
                    <>
                      <button className="btn-primary" disabled={processingId === b._id} onClick={() => handleCheckOut(b)}><LogOut size={14} /> Check Out</button>
                      {b.paymentStatus !== 'paid' && <button className="btn-secondary" onClick={() => handleRecordPayment(b)}>Pay</button>}
                    </>
                  } />
                ))}
              </tbody>
            </table>
          )
        )}

        {activeTab === 'upcoming' && (
          upcoming.length === 0 ? <p style={{ color: '#64748b' }}>No upcoming bookings</p> : (
            <table className="data-table">
              <thead><tr><th>ID</th><th>Guest</th><th>Room</th><th>Guests</th><th>Amount</th><th>Status</th><th>Actions</th></tr></thead>
              <tbody>
                {upcoming.map(b => (
                  <BookingRow key={b._id} b={b} actions={
                    <>
                      {b.status === 'pending' && <button className="btn-primary" disabled={processingId === b._id} onClick={() => handleCheckIn(b)}><LogIn size={14} /> Check In</button>}
                      <button className="icon-btn danger" onClick={() => handleCancel(b)}><XCircle size={14} /></button>
                    </>
                  } />
                ))}
              </tbody>
            </table>
          )
        )}

        {activeTab === 'all' && (
          bookings.length === 0 ? <p style={{ color: '#64748b' }}>No bookings yet</p> : (
            <table className="data-table">
              <thead><tr><th>ID</th><th>Guest</th><th>Room</th><th>Guests</th><th>Amount</th><th>Status</th><th>Actions</th></tr></thead>
              <tbody>
                {bookings.map(b => (
                  <BookingRow key={b._id} b={b} actions={
                    <>
                      {(b.status === 'pending' || b.status === 'confirmed') && <button className="btn-primary" disabled={processingId === b._id} onClick={() => handleCheckIn(b)}><LogIn size={14} /> In</button>}
                      {b.status === 'checked_in' && <button className="btn-primary" disabled={processingId === b._id} onClick={() => handleCheckOut(b)}><LogOut size={14} /> Out</button>}
                      {b.paymentStatus !== 'paid' && <button className="btn-secondary" onClick={() => handleRecordPayment(b)}>Pay</button>}
                      {!['checked_out', 'cancelled'].includes(b.status) && <button className="icon-btn danger" onClick={() => handleCancel(b)}><XCircle size={14} /></button>}
                    </>
                  } />
                ))}
              </tbody>
            </table>
          )
        )}
      </div>

      {showWalkin && (
        <div className="modal-overlay" onClick={() => setShowWalkin(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '600px' }}>
            <div className="modal-header">
              <h3>Walk-in Booking</h3>
              <button className="modal-close" onClick={() => setShowWalkin(false)}><X size={18} /></button>
            </div>
            <form onSubmit={handleWalkinSubmit} className="modal-body">
              <div className="form-grid">
                <div className="form-group"><label>Guest Name *</label><input value={form.guestName} onChange={e => setForm({ ...form, guestName: e.target.value })} required /></div>
                <div className="form-group"><label>Email</label><input type="email" value={form.guestEmail} onChange={e => setForm({ ...form, guestEmail: e.target.value })} /></div>
                <div className="form-group"><label>Phone</label><input value={form.guestPhone} onChange={e => setForm({ ...form, guestPhone: e.target.value })} /></div>
                <div className="form-group"><label>Room Type</label>
                  <select value={form.roomType} onChange={e => setForm({ ...form, roomType: e.target.value })}>
                    <option>Standard</option><option>Deluxe</option><option>Suite</option><option>Family</option>
                  </select>
                </div>
                <div className="form-group"><label>Rooms</label><input type="number" min="1" value={form.rooms} onChange={e => setForm({ ...form, rooms: e.target.value })} /></div>
                <div className="form-group"><label>Guests</label><input type="number" min="1" value={form.guests} onChange={e => setForm({ ...form, guests: e.target.value })} /></div>
                <div className="form-group"><label>Check-in *</label><input type="date" value={form.checkInDate} onChange={e => setForm({ ...form, checkInDate: e.target.value })} required /></div>
                <div className="form-group"><label>Check-out *</label><input type="date" value={form.checkOutDate} onChange={e => setForm({ ...form, checkOutDate: e.target.value })} required /></div>
                <div className="form-group"><label>Amount (₹)</label><input type="number" min="0" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} /></div>
                <div className="form-group"><label>Paid (₹)</label><input type="number" min="0" value={form.paidAmount} onChange={e => setForm({ ...form, paidAmount: e.target.value })} /></div>
              </div>
              <div className="form-actions" style={{ marginTop: '1rem' }}>
                <button type="button" className="btn-secondary" onClick={() => setShowWalkin(false)}>Cancel</button>
                <button type="submit" className="btn-primary" disabled={saving}><Save size={14} /> {saving ? 'Saving...' : 'Check In Guest'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      <style>{`
        .icon-btn.danger:hover { color: #f87171; }
        .status-pill { display: inline-block; padding: 0.2rem 0.55rem; border-radius: 6px; font-size: 0.75rem; font-weight: 600; text-transform: capitalize; }
        .status-pill.status-pending { background: rgba(245,158,11,0.2); color: #fbbf24; }
        .status-pill.status-confirmed { background: rgba(34,197,94,0.2); color: #4ade80; }
        .status-pill.status-checked_in { background: rgba(59,130,246,0.2); color: #60a5fa; }
        .status-pill.status-checked_out { background: rgba(139,92,246,0.2); color: #a78bfa; }
        .status-pill.status-cancelled { background: rgba(239,68,68,0.2); color: #f87171; }
        .status-pill.payment-paid { background: rgba(34,197,94,0.2); color: #4ade80; }
        .status-pill.payment-partial { background: rgba(245,158,11,0.2); color: #fbbf24; }
        .status-pill.payment-pending { background: rgba(239,68,68,0.2); color: #f87171; }
        .status-pill.payment-refunded { background: rgba(139,92,246,0.2); color: #a78bfa; }
        .status-pill.payment-failed { background: rgba(239,68,68,0.2); color: #f87171; }
      `}</style>
    </HotelLayout>
  )
}

export default HotelCheckInOutPage