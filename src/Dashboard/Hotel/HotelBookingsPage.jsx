import { useState, useEffect } from 'react'
import {
  Plus, Search, Calendar, DollarSign, Trash2, Edit3, Eye,
  CreditCard, CheckCircle, AlertCircle, Download, X
} from 'lucide-react'
import HotelLayout from './HotelLayout'
import { api, formatCurrency, formatDate } from '../../api'
import '../Dashboard.css'

const STATUSES = ['pending', 'confirmed', 'checked_in', 'checked_out', 'cancelled']
const PAYMENT_STATUSES = ['pending', 'paid', 'partial', 'refunded', 'failed']

const emptyForm = () => ({
  guestName: '', guestEmail: '', guestPhone: '',
  roomType: 'Standard', rooms: 1, guests: 1,
  checkInDate: new Date().toISOString().split('T')[0],
  checkOutDate: new Date(Date.now() + 86400000).toISOString().split('T')[0],
  amount: '', paidAmount: 0, status: 'pending', paymentStatus: 'pending',
  notes: ''
})

const HotelBookingsPage = () => {
  const [bookings, setBookings] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState('all')
  const [filterPayment, setFilterPayment] = useState('all')
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState(null)
  const [viewing, setViewing] = useState(null)
  const [paying, setPaying] = useState(null)
  const [payAmount, setPayAmount] = useState(0)
  const [form, setForm] = useState(emptyForm())
  const [saving, setSaving] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)

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

  const refresh = () => setRefreshKey(k => k + 1)

  const filtered = bookings.filter(b => {
    const matchSearch = !search ||
      (b.guestName || '').toLowerCase().includes(search.toLowerCase()) ||
      (b.bookingId || '').toLowerCase().includes(search.toLowerCase()) ||
      (b.roomType || '').toLowerCase().includes(search.toLowerCase())
    const matchStatus = filterStatus === 'all' || b.status === filterStatus
    const matchPay = filterPayment === 'all' || b.paymentStatus === filterPayment
    return matchSearch && matchStatus && matchPay
  })

  const openCreate = () => { setForm(emptyForm()); setEditing(null); setShowForm(true) }
  const openEdit = (b) => {
    setEditing(b)
    setForm({
      guestName: b.guestName || '',
      guestEmail: b.guestEmail || '',
      guestPhone: b.guestPhone || '',
      roomType: b.roomType || 'Standard',
      rooms: b.rooms || 1,
      guests: b.guests || 1,
      checkInDate: b.checkInDate ? formatDate(b.checkInDate) : '',
      checkOutDate: b.checkOutDate ? formatDate(b.checkOutDate) : '',
      amount: b.amount || '',
      paidAmount: b.paidAmount || 0,
      status: b.status || 'pending',
      paymentStatus: b.paymentStatus || 'pending',
      notes: b.notes || ''
    })
    setShowForm(true)
  }
  const closeForm = () => { setShowForm(false); setEditing(null); setForm(emptyForm()) }

  const save = async (e) => {
    e.preventDefault()
    if (!form.guestName.trim()) return alert('Guest name is required')
    if (!form.checkInDate || !form.checkOutDate) return alert('Dates are required')
    if (new Date(form.checkOutDate) <= new Date(form.checkInDate)) return alert('Check-out must be after check-in')
    setSaving(true)
    try {
      const payload = {
        ...form,
        amount: Number(form.amount) || 0,
        paidAmount: Number(form.paidAmount) || 0,
        rooms: Number(form.rooms) || 1,
        guests: Number(form.guests) || 1,
        hotelName: editing?.hotelName || 'My Hotel'
      }
      if (editing) {
        await api(`/hotel/bookings/${editing._id}`, { method: 'PUT', body: JSON.stringify(payload) })
      } else {
        await api('/hotel/bookings', { method: 'POST', body: JSON.stringify(payload) })
      }
      closeForm()
      refresh()
    } catch (err) {
      alert(err.message)
    } finally {
      setSaving(false)
    }
  }

  const remove = async (b) => {
    if (!confirm(`Delete booking ${b.bookingId} for ${b.guestName}?`)) return
    try {
      await api(`/hotel/bookings/${b._id}`, { method: 'DELETE' })
      refresh()
    } catch (err) { alert(err.message) }
  }

  const updateStatus = async (id, status) => {
    try {
      await api(`/hotel/bookings/${id}`, { method: 'PUT', body: JSON.stringify({ status }) })
      refresh()
    } catch (err) { alert(err.message) }
  }

  const recordPayment = async () => {
    if (!paying || !payAmount || Number(payAmount) <= 0) return alert('Enter a valid amount')
    try {
      await api(`/hotel/bookings/${paying._id}/pay`, { method: 'PUT', body: JSON.stringify({ amount: Number(payAmount) }) })
      setPaying(null)
      setPayAmount(0)
      refresh()
    } catch (err) { alert(err.message) }
  }

  const exportCsv = () => {
    const headers = ['Booking ID', 'Guest', 'Email', 'Phone', 'Room', 'Check-in', 'Check-out', 'Guests', 'Amount', 'Paid', 'Status', 'Payment']
    const rows = filtered.map(b => [
      b.bookingId, b.guestName, b.guestEmail || '', b.guestPhone || '',
      b.roomType, formatDate(b.checkInDate), formatDate(b.checkOutDate),
      b.guests, b.amount, b.paidAmount, b.status, b.paymentStatus
    ])
    const csv = [headers, ...rows].map(r => r.map(v => `"${String(v ?? '').replace(/"/g, '""')}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url; link.download = `bookings-${Date.now()}.csv`; link.click()
    URL.revokeObjectURL(url)
  }

  const stats = {
    total: bookings.length,
    confirmed: bookings.filter(b => b.status === 'confirmed').length,
    checkedIn: bookings.filter(b => b.status === 'checked_in').length,
    pending: bookings.filter(b => b.status === 'pending').length,
    revenue: bookings.filter(b => b.paymentStatus === 'paid').reduce((s, b) => s + (b.paidAmount || 0), 0)
  }

  return (
    <HotelLayout active="bookings" title="Hotel Bookings">
      <div className="stats-grid" style={{ marginBottom: '1rem' }}>
        <div className="stat-card"><Calendar className="stat-icon" /><div className="stat-content"><h3>Total</h3><p className="stat-number">{stats.total}</p></div></div>
        <div className="stat-card"><AlertCircle className="stat-icon" /><div className="stat-content"><h3>Pending</h3><p className="stat-number">{stats.pending}</p></div></div>
        <div className="stat-card"><CheckCircle className="stat-icon" /><div className="stat-content"><h3>Checked-in</h3><p className="stat-number">{stats.checkedIn}</p></div></div>
        <div className="stat-card"><DollarSign className="stat-icon" /><div className="stat-content"><h3>Revenue</h3><p className="stat-number">{formatCurrency(stats.revenue)}</p></div></div>
      </div>

      <div className="section-card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
          <h3 style={{ margin: 0 }}>All Bookings ({filtered.length})</h3>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button className="btn-secondary" onClick={exportCsv} disabled={!filtered.length}><Download size={14} /> Export CSV</button>
            <button className="btn-primary" onClick={openCreate}><Plus size={14} /> New Booking</button>
          </div>
        </div>

        <div className="filters-section enhanced">
          <div className="search-bar enhanced">
            <Search className="search-icon" />
            <input type="text" placeholder="Search by guest, booking ID, room..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <div className="filter-controls enhanced">
            <div className="filter-group">
              <label>Status</label>
              <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="filter-select">
                <option value="all">All</option>
                {STATUSES.map(s => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
              </select>
            </div>
            <div className="filter-group">
              <label>Payment</label>
              <select value={filterPayment} onChange={e => setFilterPayment(e.target.value)} className="filter-select">
                <option value="all">All</option>
                {PAYMENT_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>
        </div>

        {loading && <p>Loading bookings...</p>}
        {error && <p style={{ color: '#ef4444' }}>{error}</p>}
        {!loading && !error && bookings.length === 0 && (
          <div className="placeholder-content">
            <p>No bookings yet. Create your first booking to start tracking reservations.</p>
          </div>
        )}

        {filtered.length > 0 && (
          <div style={{ overflowX: 'auto' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Booking ID</th><th>Guest</th><th>Room</th>
                  <th>Check-in</th><th>Check-out</th><th>Amount</th>
                  <th>Status</th><th>Payment</th><th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(b => (
                  <tr key={b._id}>
                    <td><strong>{b.bookingId}</strong></td>
                    <td>
                      <div>{b.guestName}</div>
                      <small style={{ color: '#64748b' }}>{b.guestEmail}</small>
                    </td>
                    <td>{b.roomType}</td>
                    <td>{formatDate(b.checkInDate)}</td>
                    <td>{formatDate(b.checkOutDate)}</td>
                    <td>
                      <div>{formatCurrency(b.amount || 0)}</div>
                      <small style={{ color: '#4ade80' }}>Paid: {formatCurrency(b.paidAmount || 0)}</small>
                    </td>
                    <td>
                      <select value={b.status} onChange={e => updateStatus(b._id, e.target.value)} className="inline-select">
                        {STATUSES.map(s => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
                      </select>
                    </td>
                    <td>
                      <span className={`status-pill payment-${b.paymentStatus}`}>{b.paymentStatus}</span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: '0.25rem' }}>
                        <button className="icon-btn" title="View" onClick={() => setViewing(b)}><Eye size={14} /></button>
                        {b.paymentStatus !== 'paid' && (
                          <button className="icon-btn" title="Record Payment" onClick={() => { setPaying(b); setPayAmount((b.amount || 0) - (b.paidAmount || 0)) }}><CreditCard size={14} /></button>
                        )}
                        <button className="icon-btn" title="Edit" onClick={() => openEdit(b)}><Edit3 size={14} /></button>
                        <button className="icon-btn danger" title="Delete" onClick={() => remove(b)}><Trash2 size={14} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showForm && (
        <div className="modal-overlay" onClick={closeForm}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '640px' }}>
            <div className="modal-header">
              <h3>{editing ? 'Edit Booking' : 'Create Booking'}</h3>
              <button className="modal-close" onClick={closeForm}><X size={18} /></button>
            </div>
            <form onSubmit={save} className="modal-body">
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
                <div className="form-group"><label>Total Amount (₹)</label><input type="number" min="0" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} /></div>
                <div className="form-group"><label>Paid Amount (₹)</label><input type="number" min="0" value={form.paidAmount} onChange={e => setForm({ ...form, paidAmount: e.target.value })} /></div>
                <div className="form-group"><label>Status</label>
                  <select value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}>
                    {STATUSES.map(s => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
                  </select>
                </div>
                <div className="form-group"><label>Payment Status</label>
                  <select value={form.paymentStatus} onChange={e => setForm({ ...form, paymentStatus: e.target.value })}>
                    {PAYMENT_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
              </div>
              <div className="form-actions" style={{ marginTop: '1rem' }}>
                <button type="button" className="btn-secondary" onClick={closeForm}>Cancel</button>
                <button type="submit" className="btn-primary" disabled={saving}>{saving ? 'Saving...' : (editing ? 'Update Booking' : 'Create Booking')}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {viewing && (
        <div className="modal-overlay" onClick={() => setViewing(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Booking {viewing.bookingId}</h3>
              <button className="modal-close" onClick={() => setViewing(null)}><X size={18} /></button>
            </div>
            <div className="modal-body">
              <div className="booking-detail">
                <div><strong>Guest:</strong> {viewing.guestName}</div>
                <div><strong>Email:</strong> {viewing.guestEmail || '—'}</div>
                <div><strong>Phone:</strong> {viewing.guestPhone || '—'}</div>
                <div><strong>Room Type:</strong> {viewing.roomType}</div>
                <div><strong>Rooms:</strong> {viewing.rooms}</div>
                <div><strong>Guests:</strong> {viewing.guests}</div>
                <div><strong>Check-in:</strong> {formatDate(viewing.checkInDate)}</div>
                <div><strong>Check-out:</strong> {formatDate(viewing.checkOutDate)}</div>
                <div><strong>Status:</strong> <span className={`status-pill status-${viewing.status}`}>{viewing.status}</span></div>
                <div><strong>Payment:</strong> <span className={`status-pill payment-${viewing.paymentStatus}`}>{viewing.paymentStatus}</span></div>
                <div><strong>Total:</strong> {formatCurrency(viewing.amount)}</div>
                <div><strong>Paid:</strong> {formatCurrency(viewing.paidAmount)}</div>
                <div><strong>Balance:</strong> {formatCurrency((viewing.amount || 0) - (viewing.paidAmount || 0))}</div>
                <div><strong>Created:</strong> {formatDate(viewing.createdAt)}</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {paying && (
        <div className="modal-overlay" onClick={() => setPaying(null)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '420px' }}>
            <div className="modal-header">
              <h3>Record Payment</h3>
              <button className="modal-close" onClick={() => setPaying(null)}><X size={18} /></button>
            </div>
            <div className="modal-body">
              <div style={{ marginBottom: '1rem', padding: '0.75rem', background: 'rgba(99,102,241,0.08)', borderRadius: '8px' }}>
                <div><strong>{paying.guestName}</strong> · {paying.bookingId}</div>
                <div>Total: {formatCurrency(paying.amount)} · Paid: {formatCurrency(paying.paidAmount)}</div>
                <div>Balance: <strong style={{ color: '#f59e0b' }}>{formatCurrency((paying.amount || 0) - (paying.paidAmount || 0))}</strong></div>
              </div>
              <div className="form-group">
                <label>Amount (₹)</label>
                <input type="number" min="1" max={(paying.amount || 0) - (paying.paidAmount || 0)} value={payAmount} onChange={e => setPayAmount(e.target.value)} />
              </div>
              <div className="form-actions">
                <button type="button" className="btn-secondary" onClick={() => setPaying(null)}>Cancel</button>
                <button type="button" className="btn-primary" onClick={recordPayment}>Record Payment</button>
              </div>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .inline-select { padding: 0.3rem 0.5rem; border-radius: 6px; border: 1px solid rgba(255,255,255,0.1); background: rgba(255,255,255,0.05); color: #cbd5e1; font-size: 0.85rem; cursor: pointer; }
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
        .booking-detail > div { padding: 0.4rem 0; border-bottom: 1px solid rgba(255,255,255,0.05); }
        .booking-detail > div:last-child { border-bottom: none; }
      `}</style>
    </HotelLayout>
  )
}

export default HotelBookingsPage