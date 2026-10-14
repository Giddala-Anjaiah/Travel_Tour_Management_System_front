import { useState, useEffect } from 'react'
import {
  Plus, Search, Calendar, DollarSign, Trash2, Edit3, Eye,
  CreditCard, CheckCircle, AlertCircle, Download, X, Save
} from 'lucide-react'
import HotelLayout from './HotelLayout'
import { api, formatCurrency, formatDate, readPagination } from '../../api'
import Pagination from '../../components/Pagination'
import '../Dashboard.css'
import './HotelDashboard.css'

const STATUSES = ['pending', 'confirmed', 'checked_in', 'checked_out', 'cancelled']
const PAYMENT_STATUSES = ['pending', 'paid', 'partial', 'refunded', 'failed']
const TYPES = ['Standard', 'Deluxe', 'Suite', 'Family', 'Presidential']
const TYPE_COLORS = {
  Standard: 'standard', Deluxe: 'deluxe', Suite: 'suite', Family: 'family', Presidential: 'presidential'
}
const STAT_ICONS = {
  total: { icon: Calendar, bg: 'bg-purple', label: 'Total Bookings' },
  pending: { icon: AlertCircle, bg: 'bg-amber', label: 'Pending' },
  confirmed: { icon: CheckCircle, bg: 'bg-emerald', label: 'Confirmed' },
  revenue: { icon: DollarSign, bg: 'bg-blue', label: 'Revenue' }
}

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
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(10)
  const [meta, setMeta] = useState({ page: 1, limit: 10, total: 0, totalPages: 1, hasNext: false, hasPrev: false })
  const [statsData, setStatsData] = useState(null)

  // `/hotel/bookings` filters server-side on `search` (booking id / guest name,
  // email, phone) only. Status and payment are not supported, so when either is
  // active we load the full set and filter the rows locally.
  const hasLocalFilters = filterStatus !== 'all' || filterPayment !== 'all'

  const load = async (overrides = {}) => {
    const nextPage = overrides.page ?? page
    const nextLimit = overrides.limit ?? limit
    try {
      setLoading(true)
      setError('')
      const data = await api('/hotel/bookings', {
        params: {
          page: hasLocalFilters ? undefined : nextPage,
          limit: hasLocalFilters ? 'all' : nextLimit,
          search
        }
      })
      const rows = data.bookings || []
      setBookings(rows)
      const next = readPagination(data, rows.length)
      setMeta(next)
      if (data.stats) setStatsData(data.stats)
      if (!hasLocalFilters && next.totalPages > 0 && nextPage > next.totalPages) {
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
  }, [search, filterStatus, filterPayment])

  // Refetches the CURRENT page with the current filters.
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

  const filtered = bookings.filter(b => {
    const matchStatus = filterStatus === 'all' || b.status === filterStatus
    const matchPay = filterPayment === 'all' || b.paymentStatus === filterPayment
    return matchStatus && matchPay
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
      // Deleting the only row on a page steps back one page instead of showing nothing.
      if (page > 1 && !hasLocalFilters && filtered.length <= 1) {
        setLoading(true)
        setPage(page - 1)
      } else {
        refresh()
      }
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

  // The route aggregates status counts and revenue over the whole scoped filter.
  const localStats = {
    total: bookings.length,
    confirmed: bookings.filter(b => b.status === 'confirmed').length,
    checkedIn: bookings.filter(b => b.status === 'checked_in').length,
    pending: bookings.filter(b => b.status === 'pending').length,
    revenue: bookings.filter(b => b.paymentStatus === 'paid').reduce((s, b) => s + (b.paidAmount || 0), 0)
  }
  const stats = {
    total: statsData?.total ?? localStats.total,
    confirmed: statsData?.byStatus?.confirmed ?? localStats.confirmed,
    checkedIn: statsData?.byStatus?.checked_in ?? localStats.checkedIn,
    pending: statsData?.byStatus?.pending ?? localStats.pending,
    revenue: statsData?.totalRevenue ?? localStats.revenue
  }

  return (
    <HotelLayout active="bookings" title="Hotel Bookings">
      <div className="hr-stats">
        <StatCard icon={Calendar} bg="bg-purple" label={STAT_ICONS.total.label} value={stats.total} />
        <StatCard icon={AlertCircle} bg="bg-amber" label={STAT_ICONS.pending.label} value={stats.pending} />
        <StatCard icon={CheckCircle} bg="bg-emerald" label={STAT_ICONS.confirmed.label} value={stats.confirmed} />
        <StatCard icon={DollarSign} bg="bg-blue" label={STAT_ICONS.revenue.label} value={formatCurrency(stats.revenue)} />
      </div>

      <div className="hr-card">
        <div className="hr-card-head">
          <h3 className="hr-card-title">All Bookings</h3>
          <span className="hr-card-count">{hasLocalFilters ? `${filtered.length} of ${meta.total}` : meta.total}</span>
          <div className="hr-actions">
            <button className="hr-btn hr-btn-secondary" onClick={exportCsv} disabled={!filtered.length} type="button">
              <Download size={14} /> Export CSV
            </button>
            <button className="hr-btn hr-btn-primary" onClick={openCreate} type="button">
              <Plus size={14} /> New Booking
            </button>
          </div>
        </div>

        <div className="hr-filters">
          <div className="hr-search">
            <Search className="hr-search-icon" />
            <input type="text" placeholder="Search by guest, booking ID, room..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <div className="hr-filter-group">
            <label>Status</label>
            <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
              <option value="all">All Statuses</option>
              {STATUSES.map(s => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
            </select>
          </div>
          <div className="hr-filter-group">
            <label>Payment</label>
            <select value={filterPayment} onChange={e => setFilterPayment(e.target.value)}>
              <option value="all">All Payments</option>
              {PAYMENT_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
        </div>

        {loading && <div className="hr-loading">Loading bookings...</div>}
        {error && <div className="hr-error">{error}</div>}
        {!loading && !error && bookings.length === 0 && (
          <div className="hr-empty">
            <div className="icon"><Calendar size={48} /></div>
            <h4>No bookings yet</h4>
            <p>Click <strong>New Booking</strong> to create your first reservation.</p>
          </div>
        )}

        {filtered.length > 0 && (
          <div className="hr-table-wrap">
            <table className="hr-table">
              <thead>
                <tr>
                  <th>Booking ID</th><th>Guest</th><th>Room</th>
                  <th>Check-in</th><th>Check-out</th><th>Amount</th>
                  <th>Status</th><th>Payment</th><th className="center">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(b => (
                  <tr key={b._id}>
                    <td><strong>{b.bookingId}</strong></td>
                    <td>
                      <div className="hr-guest-cell">
                        <div className="name">{b.guestName}</div>
                        {b.guestEmail && <small>{b.guestEmail}</small>}
                      </div>
                    </td>
                    <td>
                      <span className={`hr-type-badge ${TYPE_COLORS[b.roomType] || ''}`}>{b.roomType}</span>
                    </td>
                    <td>{formatDate(b.checkInDate)}</td>
                    <td>{formatDate(b.checkOutDate)}</td>
                    <td>
                      <div className="hr-amount-cell">
                        <div className="total">{formatCurrency(b.amount || 0)}</div>
                        <small className={b.paidAmount > 0 ? 'green' : ''}>Paid: {formatCurrency(b.paidAmount || 0)}</small>
                      </div>
                    </td>
                    <td>
                      <select value={b.status} onChange={e => updateStatus(b._id, e.target.value)} className="hr-inline-select">
                        {STATUSES.map(s => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
                      </select>
                    </td>
                    <td><span className={`hr-payment-pill payment-${b.paymentStatus}`}>{b.paymentStatus}</span></td>
                    <td>
                      <div className="hr-actions">
                        <button className="hr-icon-btn" title="View" onClick={() => setViewing(b)}><Eye size={16} /></button>
                        {b.paymentStatus !== 'paid' && (
                          <button className="hr-icon-btn" title="Record Payment" onClick={() => { setPaying(b); setPayAmount((b.amount || 0) - (b.paidAmount || 0)) }}><CreditCard size={16} /></button>
                        )}
                        <button className="hr-icon-btn" title="Edit" onClick={() => openEdit(b)}><Edit3 size={16} /></button>
                        <button className="hr-icon-btn hr-danger" title="Delete" onClick={() => remove(b)}><Trash2 size={16} /></button>
                      </div>
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
          total={hasLocalFilters ? filtered.length : meta.total}
          limit={meta.limit}
          onPageChange={handlePageChange}
          onLimitChange={handleLimitChange}
          itemLabel="bookings"
          disabled={loading}
        />
      </div>

      {showForm && (
        <div className="hr-modal-overlay" onClick={closeForm}>
          <div className="hr-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '640px' }}>
            <div className="hr-modal-header">
              <h3>{editing ? <><Edit3 size={18} /> Edit Booking</> : <><Plus size={18} /> Create Booking</>}</h3>
              <button className="hr-modal-close" onClick={closeForm} type="button"><X size={18} /></button>
            </div>
            <form onSubmit={save} className="hr-modal-body">
              <div className="hr-form-grid">
                <div className="hr-form-group">
                  <label>Guest Name *</label>
                  <input value={form.guestName} onChange={e => setForm({ ...form, guestName: e.target.value })} required />
                </div>
                <div className="hr-form-group">
                  <label>Email</label>
                  <input type="email" value={form.guestEmail} onChange={e => setForm({ ...form, guestEmail: e.target.value })} />
                </div>
                <div className="hr-form-group">
                  <label>Phone</label>
                  <input value={form.guestPhone} onChange={e => setForm({ ...form, guestPhone: e.target.value })} />
                </div>
                <div className="hr-form-group">
                  <label>Room Type</label>
                  <select value={form.roomType} onChange={e => setForm({ ...form, roomType: e.target.value })}>
                    {TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div className="hr-form-group">
                  <label>Rooms</label>
                  <input type="number" min="1" value={form.rooms} onChange={e => setForm({ ...form, rooms: Number(e.target.value) || 1 })} />
                </div>
                <div className="hr-form-group">
                  <label>Guests</label>
                  <input type="number" min="1" value={form.guests} onChange={e => setForm({ ...form, guests: Number(e.target.value) || 1 })} />
                </div>
                <div className="hr-form-group">
                  <label>Check-in *</label>
                  <input type="date" value={form.checkInDate} onChange={e => setForm({ ...form, checkInDate: e.target.value })} required />
                </div>
                <div className="hr-form-group">
                  <label>Check-out *</label>
                  <input type="date" value={form.checkOutDate} onChange={e => setForm({ ...form, checkOutDate: e.target.value })} required />
                </div>
                <div className="hr-form-group">
                  <label>Total Amount (₹)</label>
                  <input type="number" min="0" value={form.amount} onChange={e => setForm({ ...form, amount: Number(e.target.value) || 0 })} />
                </div>
                <div className="hr-form-group">
                  <label>Paid Amount (₹)</label>
                  <input type="number" min="0" value={form.paidAmount} onChange={e => setForm({ ...form, paidAmount: Number(e.target.value) || 0 })} />
                </div>
                <div className="hr-form-group">
                  <label>Status</label>
                  <select value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}>
                    {STATUSES.map(s => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
                  </select>
                </div>
                <div className="hr-form-group">
                  <label>Payment Status</label>
                  <select value={form.paymentStatus} onChange={e => setForm({ ...form, paymentStatus: e.target.value })}>
                    {PAYMENT_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div className="hr-form-group full">
                  <label>Notes</label>
                  <textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} rows="2" placeholder="Optional notes..." />
                </div>
              </div>
              <div className="hr-form-actions">
                <button type="button" className="hr-btn hr-btn-secondary" onClick={closeForm}>Cancel</button>
                <button type="submit" className="hr-btn hr-btn-primary" disabled={saving}>
                  <Save size={14} /> {saving ? 'Saving...' : (editing ? 'Update Booking' : 'Create Booking')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {viewing && (
        <div className="hr-modal-overlay" onClick={() => setViewing(null)}>
          <div className="hr-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '520px' }}>
            <div className="hr-modal-header">
              <h3><Calendar size={18} /> Booking {viewing.bookingId}</h3>
              <button className="hr-modal-close" onClick={() => setViewing(null)} type="button"><X size={18} /></button>
            </div>
            <div className="hr-modal-body">
              <div className="hr-booking-detail">
                <div><strong>Guest:</strong> {viewing.guestName}</div>
                <div><strong>Email:</strong> <span>{viewing.guestEmail || '—'}</span></div>
                <div><strong>Phone:</strong> <span>{viewing.guestPhone || '—'}</span></div>
                <div><strong>Room Type:</strong> <span className={`hr-type-badge ${TYPE_COLORS[viewing.roomType] || ''}`}>{viewing.roomType}</span></div>
                <div><strong>Rooms:</strong> <span>{viewing.rooms}</span></div>
                <div><strong>Guests:</strong> <span>{viewing.guests}</span></div>
                <div><strong>Check-in:</strong> <span>{formatDate(viewing.checkInDate)}</span></div>
                <div><strong>Check-out:</strong> <span>{formatDate(viewing.checkOutDate)}</span></div>
                <div><strong>Nights:</strong> <span>{Math.ceil((new Date(viewing.checkOutDate) - new Date(viewing.checkInDate)) / 86400000)}</span></div>
                <div><strong>Status:</strong> <span className={`hr-status-pill status-${viewing.status}`}>{viewing.status}</span></div>
                <div><strong>Payment:</strong> <span className={`hr-payment-pill payment-${viewing.paymentStatus}`}>{viewing.paymentStatus}</span></div>
                <div><strong>Total:</strong> <span>{formatCurrency(viewing.amount)}</span></div>
                <div><strong>Paid:</strong> <span>{formatCurrency(viewing.paidAmount)}</span></div>
                <div><strong>Balance:</strong> <span className={viewing.amount - viewing.paidAmount > 0 ? 'balance-warning' : ''}>{formatCurrency((viewing.amount || 0) - (viewing.paidAmount || 0))}</span></div>
              </div>
            </div>
          </div>
        </div>
      )}

      {paying && (
        <div className="hr-modal-overlay" onClick={() => setPaying(null)}>
          <div className="hr-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '440px' }}>
            <div className="hr-modal-header">
              <h3><DollarSign size={18} /> Record Payment</h3>
              <button className="hr-modal-close" onClick={() => setPaying(null)} type="button"><X size={18} /></button>
            </div>
            <form onSubmit={(e) => { e.preventDefault(); recordPayment() }} className="hr-modal-body">
              <div className="hr-payment-summary">
                <div><strong>{paying.guestName}</strong> · {paying.bookingId}</div>
                <div>Total: <strong>{formatCurrency(paying.amount)}</strong></div>
                <div>Paid: <strong>{formatCurrency(paying.paidAmount)}</strong></div>
                <div><strong>Balance:</strong> <strong className="balance">{formatCurrency((paying.amount || 0) - (paying.paidAmount || 0))}</strong></div>
              </div>
              <div className="hr-form-group">
                <label>Amount (₹)</label>
                <input type="number" min="1" max={(paying.amount || 0) - (paying.paidAmount || 0)} value={payAmount} onChange={e => setPayAmount(e.target.value)} className="hr-input-sm" />
              </div>
              <div className="hr-form-actions">
                <button type="button" className="hr-btn hr-btn-secondary" onClick={() => setPaying(null)}>Cancel</button>
                <button type="submit" className="hr-btn hr-btn-primary" disabled={saving}>Record Payment</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </HotelLayout>
  )
}

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

export default HotelBookingsPage