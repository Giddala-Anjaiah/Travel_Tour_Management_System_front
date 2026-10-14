import { useState, useEffect } from 'react'
import { Plus, Search, Bed, Edit3, Trash2, Eye, X, Save, Power, PowerOff, AlertCircle, CheckCircle } from 'lucide-react'
import HotelLayout from './HotelLayout'
import { api, formatCurrency, readPagination } from '../../api'
import Pagination from '../../components/Pagination'
import '../Dashboard.css'
import './HotelDashboard.css'

const TYPES = ['Standard', 'Deluxe', 'Suite', 'Family', 'Presidential']
const STATUSES = ['active', 'inactive']
const TYPE_COLORS = {
  Standard: 'standard', Deluxe: 'deluxe', Suite: 'suite', Family: 'family', Presidential: 'presidential'
}

const emptyForm = () => ({
  type: 'Standard', total: 1, available: 1, booked: 0, price: 0, status: 'active'
})

const HotelRoomsPage = () => {
  const [hotelName, setHotelName] = useState('')
  const [rooms, setRooms] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [filterType, setFilterType] = useState('all')
  const [filterStatus, setFilterStatus] = useState('all')
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState(null)
  const [viewing, setViewing] = useState(null)
  const [form, setForm] = useState(emptyForm())
  const [saving, setSaving] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)
  const [formError, setFormError] = useState('')
  const [formSuccess, setFormSuccess] = useState('')
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(10)
  const [meta, setMeta] = useState({ page: 1, limit: 10, total: 0, totalPages: 1, hasNext: false, hasPrev: false })
  const [roomStats, setRoomStats] = useState(null)

  // `/hotel/rooms` filters server-side on `hotelName` and `search` (room type)
  // only. Type/status are not supported, so when either is active we load the
  // full set and filter the rows locally.
  const hasLocalFilters = filterType !== 'all' || filterStatus !== 'all'

  const load = async (overrides = {}) => {
    const nextPage = overrides.page ?? page
    const nextLimit = overrides.limit ?? limit
    try {
      setLoading(true)
      setError('')
      const profile = await api('/hotel/profile').catch(() => ({}))
      const name = profile?.profile?.hotelName || ''
      setHotelName(name)
      if (!name) { setRooms([]); setMeta(readPagination({}, 0)); return }
      const data = await api('/hotel/rooms', {
        params: {
          hotelName: name,
          page: hasLocalFilters ? undefined : nextPage,
          limit: hasLocalFilters ? 'all' : nextLimit,
          search
        }
      })
      const rows = data.rooms || []
      setRooms(rows)
      const next = readPagination(data, rows.length)
      setMeta(next)
      if (data.stats) setRoomStats(data.stats)
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
  }, [search, filterType, filterStatus])

  // Refetches the CURRENT page with the current filters — never resets the user.
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

  const filtered = rooms.filter(r => {
    const matchType = filterType === 'all' || r.type === filterType
    const matchStatus = filterStatus === 'all' || r.status === filterStatus
    return matchType && matchStatus
  })

  const openCreate = () => {
    setForm(emptyForm())
    setEditing(null)
    setFormError('')
    setFormSuccess('')
    setShowForm(true)
  }
  const openEdit = (r) => {
    setEditing(r)
    setForm({
      type: r.type || 'Standard',
      total: r.total ?? 1,
      available: r.available ?? 1,
      booked: r.booked || 0,
      price: r.price ?? 0,
      status: r.status || 'active'
    })
    setFormError('')
    setFormSuccess('')
    setShowForm(true)
  }
  const closeForm = () => { setShowForm(false); setEditing(null); setForm(emptyForm()); setFormError(''); setFormSuccess('') }

  const save = async (e) => {
    if (e) e.preventDefault()
    setFormError('')
    setFormSuccess('')
    const total = Number(form.total)
    const available = Number(form.available)
    const booked = Number(form.booked) || 0
    const price = Number(form.price)
    if (!form.type) return setFormError('Please select a room type')
    if (!total || total < 1) return setFormError('Total rooms must be at least 1')
    if (available < 0) return setFormError('Available cannot be negative')
    if (available > total) return setFormError('Available cannot exceed total rooms')
    if (booked < 0) return setFormError('Booked cannot be negative')
    if (booked > total) return setFormError('Booked cannot exceed total rooms')
    if (price < 0) return setFormError('Price must be non-negative')
    if (!hotelName) return setFormError('Please set your hotel name in your Profile first, then return here.')

    setSaving(true)
    try {
      const payload = {
        type: form.type,
        total,
        available,
        booked,
        price,
        status: form.status,
        hotel: hotelName
      }
      let res
      if (editing) {
        res = await api(`/hotel/rooms/${editing._id}`, { method: 'PUT', body: JSON.stringify(payload) })
      } else {
        res = await api('/hotel/rooms', { method: 'POST', body: JSON.stringify(payload) })
      }
      void res
      setFormSuccess(editing ? 'Room updated successfully' : 'Room created successfully')
      setTimeout(() => {
        closeForm()
        refresh()
      }, 600)
    } catch (err) {
      setFormError(err.message || 'Failed to save room')
    } finally {
      setSaving(false)
    }
  }

  const remove = async (r) => {
    if (!confirm(`Delete ${r.type} room? This cannot be undone.`)) return
    try {
      await api(`/hotel/rooms/${r._id}`, { method: 'DELETE' })
      // Deleting the only row on a page steps back one page instead of showing nothing.
      if (page > 1 && !hasLocalFilters && filtered.length <= 1) {
        setLoading(true)
        setPage(page - 1)
      } else {
        refresh()
      }
    } catch (err) { alert(err.message) }
  }

  const toggleStatus = async (r) => {
    try {
      await api(`/hotel/rooms/${r._id}`, {
        method: 'PUT',
        body: JSON.stringify({ status: r.status === 'active' ? 'inactive' : 'active' })
      })
      refresh()
    } catch (err) { alert(err.message) }
  }

  // The route aggregates room-status counts over the whole scoped filter, so those
  // come from `stats`; potential revenue has no server aggregate.
  const localStats = {
    total: rooms.reduce((s, r) => s + (r.total || 0), 0),
    available: rooms.reduce((s, r) => s + (r.available || 0), 0),
    booked: rooms.reduce((s, r) => s + (r.booked || 0), 0),
    revenue: rooms.reduce((s, r) => s + (r.booked || 0) * (r.price || 0), 0)
  }
  const stats = {
    total: roomStats?.total ?? localStats.total,
    available: roomStats?.available ?? localStats.available,
    booked: roomStats?.occupied ?? localStats.booked,
    revenue: localStats.revenue
  }

  return (
    <HotelLayout active="rooms" title="Room Management">
      <div className="hr-stats">
        <StatCard icon={Bed} bg="bg-purple" label="Total Rooms" value={stats.total} />
        <StatCard icon={CheckCircle} bg="bg-emerald" label="Available" value={stats.available} />
        <StatCard icon={Bed} bg="bg-blue" label="Booked" value={stats.booked} />
        <StatCard icon="₹" bg="bg-amber" label="Potential Revenue" value={formatCurrency(stats.revenue)} />
      </div>

      {!hotelName && !loading && (
        <div className="hr-warn">
          <AlertCircle size={20} />
          <div>
            <strong>Hotel name not set</strong>
            <p>Please go to <strong>Hotel Profile &amp; Management</strong> and set your hotel name before adding rooms.</p>
          </div>
        </div>
      )}

      <div className="hr-card">
        <div className="hr-card-head">
          <h3 className="hr-card-title">
            Rooms
            <span className="hr-card-count">{hasLocalFilters ? `${filtered.length} of ${meta.total}` : meta.total}</span>
            {hotelName && <small className="hotel-name">· {hotelName}</small>}
          </h3>
          <button className="hr-btn hr-btn-primary" onClick={openCreate} type="button">
            <Plus size={16} /> Add Room
          </button>
        </div>

        <div className="hr-filters">
          <div className="hr-search">
            <Search className="hr-search-icon" />
            <input type="text" placeholder="Search by room type..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <div className="hr-filter-group">
            <label>Type</label>
            <select value={filterType} onChange={e => setFilterType(e.target.value)}>
              <option value="all">All Types</option>
              {TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div className="hr-filter-group">
            <label>Status</label>
            <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
              <option value="all">All Statuses</option>
              {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
        </div>

        {loading && <div className="hr-loading">Loading rooms...</div>}
        {error && <div className="hr-error">{error}</div>}
        {!loading && !error && rooms.length === 0 && hotelName && (
          <div className="hr-empty">
            <div className="icon"><Bed size={48} /></div>
            <h4>No rooms yet</h4>
            <p>Click <strong>Add Room</strong> to create your first room type for {hotelName}.</p>
          </div>
        )}

        {filtered.length > 0 && (
          <div className="hr-table-wrap">
            <table className="hr-table">
              <thead>
                <tr><th>Type</th><th>Total</th><th>Available</th><th>Booked</th><th>Price/Night</th><th>Occupancy</th><th>Status</th><th className="center">Actions</th></tr>
              </thead>
              <tbody>
                {filtered.map(r => {
                  const occ = r.total > 0 ? Math.round(((r.booked || 0) / r.total) * 100) : 0
                  const occClass = occ > 80 ? 'high' : occ > 40 ? 'medium' : 'low'
                  return (
                    <tr key={r._id}>
                      <td>
                        <span className={`hr-type-badge ${TYPE_COLORS[r.type] || ''}`}>{r.type}</span>
                      </td>
                      <td>{r.total}</td>
                      <td>{r.available}</td>
                      <td>{r.booked || 0}</td>
                      <td>{formatCurrency(r.price)}</td>
                      <td>
                        <div className="hr-occ-cell">
                          <div className="hr-occ-track"><div className={`hr-occ-fill ${occClass}`} style={{ width: `${occ}%` }} /></div>
                          <small>{occ}%</small>
                        </div>
                      </td>
                      <td><span className={`hr-pill hr-pill-${r.status}`}>{r.status}</span></td>
                      <td>
                        <div className="hr-actions">
                          <button className="hr-icon-btn" title="View" onClick={() => setViewing(r)}><Eye size={16} /></button>
                          <button className="hr-icon-btn" title="Edit" onClick={() => openEdit(r)}><Edit3 size={16} /></button>
                          <button className="hr-icon-btn" title={r.status === 'active' ? 'Deactivate' : 'Activate'} onClick={() => toggleStatus(r)}>
                            {r.status === 'active' ? <PowerOff size={16} /> : <Power size={16} />}
                          </button>
                          <button className="hr-icon-btn hr-danger" title="Delete" onClick={() => remove(r)}><Trash2 size={16} /></button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
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
          itemLabel="rooms"
          disabled={loading}
        />
      </div>

      {showForm && (
        <div className="hr-modal-overlay" onClick={closeForm}>
          <div className="hr-modal" onClick={e => e.stopPropagation()}>
            <div className="hr-modal-header">
              <h3>{editing ? <><Edit3 size={18} /> Edit Room</> : <><Plus size={18} /> Add New Room</>}</h3>
              <button className="hr-modal-close" onClick={closeForm} type="button"><X size={18} /></button>
            </div>
            <form onSubmit={save} className="hr-modal-body">
              {formError && <div className="hr-form-error"><AlertCircle size={16} /> {formError}</div>}
              {formSuccess && <div className="hr-form-success"><CheckCircle size={16} /> {formSuccess}</div>}

              <div className="hr-form-grid">
                <div className="hr-form-group">
                  <label>Room Type</label>
                  <select value={form.type} onChange={e => setForm({ ...form, type: e.target.value })} required>
                    {TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div className="hr-form-group">
                  <label>Status</label>
                  <select value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}>
                    {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div className="hr-form-group">
                  <label>Total Rooms *</label>
                  <input type="number" min="1" value={form.total} onChange={e => setForm({ ...form, total: e.target.value })} required />
                </div>
                <div className="hr-form-group">
                  <label>Available *</label>
                  <input type="number" min="0" max={form.total} value={form.available} onChange={e => setForm({ ...form, available: e.target.value })} required />
                </div>
                <div className="hr-form-group">
                  <label>Currently Booked</label>
                  <input type="number" min="0" value={form.booked} onChange={e => setForm({ ...form, booked: e.target.value })} />
                </div>
                <div className="hr-form-group">
                  <label>Price/Night (₹) *</label>
                  <input type="number" min="0" value={form.price} onChange={e => setForm({ ...form, price: e.target.value })} required />
                </div>
              </div>
              <div className="hr-form-actions">
                <button type="button" className="hr-btn hr-btn-secondary" onClick={closeForm}>Cancel</button>
                <button type="submit" className="hr-btn hr-btn-primary" disabled={saving}>
                  <Save size={14} /> {saving ? 'Saving...' : (editing ? 'Update Room' : 'Create Room')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {viewing && (
        <div className="hr-modal-overlay" onClick={() => setViewing(null)}>
          <div className="hr-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '440px' }}>
            <div className="hr-modal-header">
              <h3><Bed size={18} /> {viewing.type} Room</h3>
              <button className="hr-modal-close" onClick={() => setViewing(null)} type="button"><X size={18} /></button>
            </div>
            <div className="hr-modal-body">
              <div className="hr-detail">
                <div><span>Type</span><strong><span className={`hr-type-badge ${TYPE_COLORS[viewing.type] || ''}`}>{viewing.type}</span></strong></div>
                <div><span>Total</span><strong>{viewing.total}</strong></div>
                <div><span>Available</span><strong>{viewing.available}</strong></div>
                <div><span>Booked</span><strong>{viewing.booked || 0}</strong></div>
                <div><span>Price/Night</span><strong>{formatCurrency(viewing.price)}</strong></div>
                <div><span>Status</span><span className={`hr-pill hr-pill-${viewing.status}`}>{viewing.status}</span></div>
                <div><span>Potential Revenue</span><strong>{formatCurrency((viewing.booked || 0) * (viewing.price || 0))}</strong></div>
              </div>
            </div>
          </div>
        </div>
      )}
    </HotelLayout>
  )
}

const StatCard = ({ icon: Icon, bg, label, value }) => (
  <div className="hr-stat-card">
    <div className={`hr-stat-icon ${bg}`}>
      {typeof Icon === 'string' ? <span style={{ fontWeight: 700, fontSize: '1.1rem' }}>{Icon}</span> : <Icon size={20} />}
    </div>
    <div>
      <div className="hr-stat-label">{label}</div>
      <div className="hr-stat-value">{value}</div>
    </div>
  </div>
)

export default HotelRoomsPage