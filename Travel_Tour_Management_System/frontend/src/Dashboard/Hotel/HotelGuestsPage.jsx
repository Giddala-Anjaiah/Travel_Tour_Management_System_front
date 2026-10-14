import { useState, useEffect } from 'react'
import { Search, Users, Mail, Phone, DollarSign, X, Edit3, Trash2, Plus, Save } from 'lucide-react'
import HotelLayout from './HotelLayout'
import { api, formatCurrency, formatDate, readPagination } from '../../api'
import Pagination from '../../components/Pagination'
import '../Dashboard.css'
import './HotelDashboard.css'

const emptyGuestBooking = () => ({
  guestName: '', guestEmail: '', guestPhone: '',
  roomType: 'Standard', rooms: 1, guests: 1,
  checkInDate: new Date().toISOString().split('T')[0],
  checkOutDate: new Date(Date.now() + 86400000).toISOString().split('T')[0],
  amount: '', paidAmount: 0, status: 'confirmed', paymentStatus: 'paid'
})

const HotelGuestsPage = () => {
  const [bookings, setBookings] = useState([])
  const [guests, setGuests] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [viewing, setViewing] = useState(null)
  const [editing, setEditing] = useState(null)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(emptyGuestBooking())
  const [saving, setSaving] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(10)
  const [meta, setMeta] = useState({ page: 1, limit: 10, total: 0, totalPages: 1, hasNext: false, hasPrev: false })
  const [guestStats, setGuestStats] = useState(null)

  // Guest name/email/phone search runs server-side on `/hotel/guests`; this page
  // has no other filter controls, so the guest list is always server-paged.
  const load = async (overrides = {}) => {
    const nextPage = overrides.page ?? page
    const nextLimit = overrides.limit ?? limit
    try {
      setLoading(true)
      setError('')
      // Guests are paged; the bookings behind the "View History" modal must not be.
      const [g, b] = await Promise.all([
        api('/hotel/guests', { params: { page: nextPage, limit: nextLimit, search } }),
        api('/hotel/bookings', { params: { limit: 'all' } })
      ])
      const rows = g.guests || []
      setGuests(rows)
      setBookings(b.bookings || [])
      const next = readPagination(g, rows.length)
      setMeta(next)
      if (g.stats) setGuestStats(g.stats)
      if (next.totalPages > 0 && nextPage > next.totalPages) {
        setLoading(true)
        setPage(next.totalPages)
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    Promise.resolve().then(() => load())
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, limit, refreshKey])

  useEffect(() => {
    const timer = setTimeout(() => {
      setPage(1)
      load({ page: 1 })
    }, 350)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search])

  // Refetches the CURRENT page with the current search.
  const refresh = () => setRefreshKey(k => k + 1)

  const handlePageChange = (nextPage) => {
    setPage(nextPage)
    setLoading(true)
  }

  const handleLimitChange = (nextLimit) => {
    setLimit(nextLimit)
    setPage(1)
    setLoading(true)
  }

  const filtered = guests

  const guestBookings = (g) => bookings.filter(b =>
    (g.email && b.guestEmail === g.email) || b.guestName === g.name
  )

  const openCreate = () => { setForm(emptyGuestBooking()); setEditing(null); setShowForm(true) }
  const openEdit = (b) => {
    setEditing(b)
    setForm({
      guestName: b.guestName, guestEmail: b.guestEmail || '', guestPhone: b.guestPhone || '',
      roomType: b.roomType || 'Standard', rooms: b.rooms || 1, guests: b.guests || 1,
      checkInDate: b.checkInDate ? formatDate(b.checkInDate) : '',
      checkOutDate: b.checkOutDate ? formatDate(b.checkOutDate) : '',
      amount: b.amount || '', paidAmount: b.paidAmount || 0,
      status: b.status || 'confirmed', paymentStatus: b.paymentStatus || 'paid'
    })
    setShowForm(true)
  }
  const closeForm = () => { setShowForm(false); setEditing(null); setForm(emptyGuestBooking()) }

  const save = async (e) => {
    e.preventDefault()
    if (!form.guestName.trim()) return alert('Guest name is required')
    setSaving(true)
    try {
      const payload = {
        ...form,
        amount: Number(form.amount) || 0,
        paidAmount: Number(form.paidAmount) || 0,
        rooms: Number(form.rooms) || 1,
        guests: Number(form.guests) || 1,
        hotelName: 'My Hotel'
      }
      if (editing) {
        await api(`/hotel/bookings/${editing._id}`, { method: 'PUT', body: JSON.stringify(payload) })
      } else {
        await api('/hotel/bookings', { method: 'POST', body: JSON.stringify(payload) })
      }
      closeForm()
      refresh()
    } catch (err) { alert(err.message) } finally { setSaving(false) }
  }

  const remove = async (b) => {
    if (!confirm(`Delete booking for ${b.guestName}?`)) return
    try {
      await api(`/hotel/bookings/${b._id}`, { method: 'DELETE' })
      // Deleting the only row on a page steps back one page instead of showing nothing.
      if (page > 1 && filtered.length <= 1) {
        setLoading(true)
        setPage(page - 1)
      } else {
        refresh()
      }
    } catch (err) { alert(err.message) }
  }

  // The route counts unique guests over the whole scoped search; the remaining
  // roll-ups have no server aggregate and fall back to the loaded rows.
  const localStats = {
    returning: guests.filter(g => g.totalStays > 1).length,
    totalSpent: guests.reduce((s, g) => s + (g.totalSpent || 0), 0),
    totalStays: guests.reduce((s, g) => s + (g.totalStays || 0), 0)
  }
  const stats = {
    totalGuests: guestStats?.totalGuests ?? meta.total,
    returning: localStats.returning,
    totalSpent: localStats.totalSpent,
    totalStays: localStats.totalStays
  }

  const getPaymentPill = (status) => {
    const s = status?.toLowerCase()
    if (s === 'paid') return 'status-paid'
    if (s === 'pending') return 'status-pending'
    if (s === 'refunded') return 'status-refunded'
    if (s === 'failed') return 'status-failed'
    return 'status-pending'
  }

  return (
    <HotelLayout active="guests" title="Customer Information">
      <div className="hr-stats">
        <div className="hr-stat-card">
          <div className="hr-stat-icon bg-blue"><Users size={20} /></div>
          <div>
            <div className="hr-stat-label">Unique Guests</div>
            <div className="hr-stat-value">{stats.totalGuests}</div>
          </div>
        </div>
        <div className="hr-stat-card">
          <div className="hr-stat-icon bg-emerald"><Users size={20} /></div>
          <div>
            <div className="hr-stat-label">Returning</div>
            <div className="hr-stat-value">{stats.returning}</div>
          </div>
        </div>
        <div className="hr-stat-card">
          <div className="hr-stat-icon bg-purple"><Users size={20} /></div>
          <div>
            <div className="hr-stat-label">Total Stays</div>
            <div className="hr-stat-value">{stats.totalStays}</div>
          </div>
        </div>
        <div className="hr-stat-card">
          <div className="hr-stat-icon bg-amber"><DollarSign size={20} /></div>
          <div>
            <div className="hr-stat-label">Total Spent</div>
            <div className="hr-stat-value">{formatCurrency(stats.totalSpent)}</div>
          </div>
        </div>
      </div>

      <div className="hr-card">
        <div className="hr-card-head">
          <h3 className="hr-card-title">Guests ({meta.total})</h3>
          <button className="hr-btn hr-btn-primary" onClick={openCreate}>
            <Plus size={14} /> Add Booking
          </button>
        </div>

        <div className="search-bar enhanced">
          <Search className="search-icon" />
          <input type="text" placeholder="Search by name, email, or phone..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>

        {loading && <p className="hr-text-muted">Loading guests...</p>}
        {error && <p className="hr-error">{error}</p>}
        {!loading && guests.length === 0 && meta.total === 0 && (
          <div className="hr-placeholder">
            <p>No guest data yet. Guests appear here once you receive bookings.</p>
          </div>
        )}

        {filtered.length > 0 && (
          <div className="hr-table-wrap">
            <table className="hr-table">
              <thead>
                <tr><th>Name</th><th>Email</th><th>Phone</th><th>Stays</th><th>Total Spent</th><th>Last Stay</th><th>Actions</th></tr>
              </thead>
              <tbody>
                {filtered.map((g, i) => (
                  <tr key={i}>
                    <td className="hr-td-name"><strong>{g.name}</strong></td>
                    <td>{g.email || '—'}</td>
                    <td>{g.phone || '—'}</td>
                    <td><span className="hr-status-pill status-confirmed">{g.totalStays}</span></td>
                    <td>{formatCurrency(g.totalSpent)}</td>
                    <td>{formatDate(g.lastStay)}</td>
                    <td>
                      <button className="hr-btn hr-btn-secondary hr-btn-sm" onClick={() => setViewing(g)}>View History</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <Pagination
          page={page}
          totalPages={meta.totalPages}
          total={meta.total}
          limit={meta.limit}
          onPageChange={handlePageChange}
          onLimitChange={handleLimitChange}
          itemLabel="guests"
          disabled={loading}
        />
      </div>

      {viewing && (
        <div className="hr-modal-overlay" onClick={() => setViewing(null)}>
          <div className="hr-modal" onClick={e => e.stopPropagation()}>
            <div className="hr-modal-head">
              <h3 className="hr-modal-title">{viewing.name} - Booking History</h3>
              <button className="hr-modal-close" onClick={() => setViewing(null)}><X size={18} /></button>
            </div>
            <div className="hr-modal-body">
              <div className="hr-guest-summary">
                <div className="hr-guest-summary-item"><Mail size={14} /> {viewing.email || '—'}</div>
                <div className="hr-guest-summary-item"><Phone size={14} /> {viewing.phone || '—'}</div>
                <div className="hr-guest-summary-item"><strong>{viewing.totalStays}</strong> stays</div>
                <div className="hr-guest-summary-item"><strong>{formatCurrency(viewing.totalSpent)}</strong> total spent</div>
              </div>
              {guestBookings(viewing).length === 0 ? (
                <p className="hr-text-muted">No bookings found.</p>
              ) : (
                <table className="hr-table">
                  <thead><tr><th>ID</th><th>Room</th><th>Dates</th><th>Status</th><th>Amount</th><th>Payment</th><th>Actions</th></tr></thead>
                  <tbody>
                    {guestBookings(viewing).map(b => (
                      <tr key={b._id}>
                        <td><small>{b.bookingId}</small></td>
                        <td>{b.roomType}</td>
                        <td><small>{formatDate(b.checkInDate)} → {formatDate(b.checkOutDate)}</small></td>
                        <td><span className={`hr-status-pill status-${b.status}`}>{b.status.replace('_', ' ')}</span></td>
                        <td>{formatCurrency(b.amount)}</td>
                        <td><span className={`hr-payment-pill ${getPaymentPill(b.paymentStatus)}`}>{b.paymentStatus || '—'}</span></td>
                        <td>
                          <div className="hr-actions">
                            <button className="hr-icon-btn hr-btn-sm" onClick={() => { setViewing(null); openEdit(b) }} title="Edit"><Edit3 size={14} /></button>
                            <button className="hr-icon-btn hr-btn-sm hr-danger" onClick={() => { if (confirm('Delete this booking?')) { remove(b); setViewing(null) } }} title="Delete"><Trash2 size={14} /></button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}

      {showForm && (
        <div className="hr-modal-overlay" onClick={closeForm}>
          <div className="hr-modal" onClick={e => e.stopPropagation()}>
            <div className="hr-modal-head">
              <h3 className="hr-modal-title">{editing ? 'Edit Booking' : 'Add Guest Booking'}</h3>
              <button className="hr-modal-close" onClick={closeForm}><X size={18} /></button>
            </div>
            <form onSubmit={save} className="hr-modal-body">
              <div className="hr-form-grid">
                <div className="hr-form-group full"><label>Guest Name *</label><input value={form.guestName} onChange={e => setForm({ ...form, guestName: e.target.value })} required /></div>
                <div className="hr-form-group"><label>Email</label><input type="email" value={form.guestEmail} onChange={e => setForm({ ...form, guestEmail: e.target.value })} /></div>
                <div className="hr-form-group"><label>Phone</label><input value={form.guestPhone} onChange={e => setForm({ ...form, guestPhone: e.target.value })} /></div>
                <div className="hr-form-group"><label>Room Type</label>
                  <select value={form.roomType} onChange={e => setForm({ ...form, roomType: e.target.value })}>
                    <option>Standard</option><option>Deluxe</option><option>Suite</option><option>Family</option>
                  </select>
                </div>
                <div className="hr-form-group"><label>Rooms</label><input type="number" min="1" value={form.rooms} onChange={e => setForm({ ...form, rooms: e.target.value })} /></div>
                <div className="hr-form-group"><label>Guests</label><input type="number" min="1" value={form.guests} onChange={e => setForm({ ...form, guests: e.target.value })} /></div>
                <div className="hr-form-group"><label>Check-in *</label><input type="date" value={form.checkInDate} onChange={e => setForm({ ...form, checkInDate: e.target.value })} required /></div>
                <div className="hr-form-group"><label>Check-out *</label><input type="date" value={form.checkOutDate} onChange={e => setForm({ ...form, checkOutDate: e.target.value })} required /></div>
                <div className="hr-form-group"><label>Amount (₹)</label><input type="number" min="0" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} /></div>
                <div className="hr-form-group"><label>Paid (₹)</label><input type="number" min="0" value={form.paidAmount} onChange={e => setForm({ ...form, paidAmount: e.target.value })} /></div>
              </div>
              <div className="hr-form-actions">
                <button type="button" className="hr-btn hr-btn-secondary" onClick={closeForm}>Cancel</button>
                <button type="submit" className="hr-btn hr-btn-primary" disabled={saving}><Save size={14} /> {saving ? 'Saving...' : 'Save'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </HotelLayout>
  )
}

export default HotelGuestsPage
