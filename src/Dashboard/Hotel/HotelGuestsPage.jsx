import { useState, useEffect } from 'react'
import { Search, Users, Mail, Phone, DollarSign, X, Edit3, Trash2, Plus, Save } from 'lucide-react'
import HotelLayout from './HotelLayout'
import { api, formatCurrency, formatDate } from '../../api'
import '../Dashboard.css'

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

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      try {
        setLoading(true)
        const [b, g] = await Promise.all([api('/hotel/bookings'), api('/hotel/guests')])
        if (!cancelled) {
          setBookings(b.bookings || [])
          setGuests(g.guests || [])
        }
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

  const filtered = guests.filter(g => {
    if (!search) return true
    return (g.name || '').toLowerCase().includes(search.toLowerCase()) ||
           (g.email || '').toLowerCase().includes(search.toLowerCase()) ||
           (g.phone || '').includes(search)
  })

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
      refresh()
    } catch (err) { alert(err.message) }
  }

  const stats = {
    totalGuests: guests.length,
    returning: guests.filter(g => g.totalStays > 1).length,
    totalSpent: guests.reduce((s, g) => s + (g.totalSpent || 0), 0),
    totalStays: guests.reduce((s, g) => s + (g.totalStays || 0), 0)
  }

  return (
    <HotelLayout active="guests" title="Customer Information">
      <div className="stats-grid" style={{ marginBottom: '1rem' }}>
        <div className="stat-card"><Users className="stat-icon" /><div className="stat-content"><h3>Unique Guests</h3><p className="stat-number">{stats.totalGuests}</p></div></div>
        <div className="stat-card"><div className="stat-content"><h3>Returning</h3><p className="stat-number">{stats.returning}</p></div></div>
        <div className="stat-card"><div className="stat-content"><h3>Total Stays</h3><p className="stat-number">{stats.totalStays}</p></div></div>
        <div className="stat-card"><DollarSign className="stat-icon" /><div className="stat-content"><h3>Total Spent</h3><p className="stat-number">{formatCurrency(stats.totalSpent)}</p></div></div>
      </div>

      <div className="section-card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
          <h3 style={{ margin: 0 }}>Guests ({filtered.length})</h3>
          <button className="btn-primary" onClick={openCreate}><Plus size={14} /> Add Booking</button>
        </div>

        <div className="search-bar enhanced" style={{ marginBottom: '1rem' }}>
          <Search className="search-icon" />
          <input type="text" placeholder="Search by name, email, or phone..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>

        {loading && <p>Loading guests...</p>}
        {error && <p style={{ color: '#ef4444' }}>{error}</p>}
        {!loading && guests.length === 0 && (
          <div className="placeholder-content">
            <p>No guest data yet. Guests appear here once you receive bookings.</p>
          </div>
        )}

        {filtered.length > 0 && (
          <div style={{ overflowX: 'auto' }}>
            <table className="data-table">
              <thead>
                <tr><th>Name</th><th>Email</th><th>Phone</th><th>Stays</th><th>Total Spent</th><th>Last Stay</th><th>Actions</th></tr>
              </thead>
              <tbody>
                {filtered.map((g, i) => (
                  <tr key={i}>
                    <td><strong>{g.name}</strong></td>
                    <td>{g.email || '—'}</td>
                    <td>{g.phone || '—'}</td>
                    <td><span className="status-pill status-confirmed">{g.totalStays}</span></td>
                    <td>{formatCurrency(g.totalSpent)}</td>
                    <td>{formatDate(g.lastStay)}</td>
                    <td><button className="btn-secondary" onClick={() => setViewing(g)}>View History</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {viewing && (
        <div className="modal-overlay" onClick={() => setViewing(null)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '720px' }}>
            <div className="modal-header">
              <h3>{viewing.name} - Booking History</h3>
              <button className="modal-close" onClick={() => setViewing(null)}><X size={18} /></button>
            </div>
            <div className="modal-body">
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', marginBottom: '1rem', padding: '0.75rem', background: 'rgba(99,102,241,0.08)', borderRadius: '8px' }}>
                <div><Mail size={14} style={{ verticalAlign: 'middle' }} /> {viewing.email || '—'}</div>
                <div><Phone size={14} style={{ verticalAlign: 'middle' }} /> {viewing.phone || '—'}</div>
                <div><strong>{viewing.totalStays}</strong> stays</div>
                <div><strong>{formatCurrency(viewing.totalSpent)}</strong> total spent</div>
              </div>
              {guestBookings(viewing).length === 0 ? (
                <p>No bookings found.</p>
              ) : (
                <table className="data-table">
                  <thead><tr><th>ID</th><th>Room</th><th>Dates</th><th>Status</th><th>Amount</th><th>Actions</th></tr></thead>
                  <tbody>
                    {guestBookings(viewing).map(b => (
                      <tr key={b._id}>
                        <td><small>{b.bookingId}</small></td>
                        <td>{b.roomType}</td>
                        <td><small>{formatDate(b.checkInDate)} → {formatDate(b.checkOutDate)}</small></td>
                        <td><span className={`status-pill status-${b.status}`}>{b.status.replace('_', ' ')}</span></td>
                        <td>{formatCurrency(b.amount)}</td>
                        <td>
                          <div style={{ display: 'flex', gap: '0.25rem' }}>
                            <button className="icon-btn" onClick={() => { setViewing(null); openEdit(b) }} title="Edit"><Edit3 size={14} /></button>
                            <button className="icon-btn danger" onClick={() => { if (confirm('Delete this booking?')) { remove(b); setViewing(null) } }} title="Delete"><Trash2 size={14} /></button>
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
        <div className="modal-overlay" onClick={closeForm}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '600px' }}>
            <div className="modal-header">
              <h3>{editing ? 'Edit Booking' : 'Add Guest Booking'}</h3>
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
                <div className="form-group"><label>Amount (₹)</label><input type="number" min="0" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} /></div>
                <div className="form-group"><label>Paid (₹)</label><input type="number" min="0" value={form.paidAmount} onChange={e => setForm({ ...form, paidAmount: e.target.value })} /></div>
              </div>
              <div className="form-actions" style={{ marginTop: '1rem' }}>
                <button type="button" className="btn-secondary" onClick={closeForm}>Cancel</button>
                <button type="submit" className="btn-primary" disabled={saving}><Save size={14} /> {saving ? 'Saving...' : 'Save'}</button>
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
      `}</style>
    </HotelLayout>
  )
}

export default HotelGuestsPage