import { useState, useEffect } from 'react'
import { Save, RefreshCw, AlertTriangle, Power, PowerOff, Bed, CheckCircle, Users } from 'lucide-react'
import HotelLayout from './HotelLayout'
import { api, formatCurrency, readPagination } from '../../api'
import Pagination from '../../components/Pagination'
import '../Dashboard.css'
import './HotelDashboard.css'

const TYPE_COLORS = {
  Standard: 'standard', Deluxe: 'deluxe', Suite: 'suite', Family: 'family', Presidential: 'presidential'
}

const HotelAvailabilityPage = () => {
  const [hotelName, setHotelName] = useState('')
  const [rooms, setRooms] = useState([])
  const [edits, setEdits] = useState({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(10)
  const [meta, setMeta] = useState({ page: 1, limit: 10, total: 0, totalPages: 1, hasNext: false, hasPrev: false })

  // This page has no filter controls, so `/hotel/availability` is always paged.
   const load = async (overrides = {}) => {
    const nextPage = overrides.page ?? page
    const nextLimit = overrides.limit ?? limit
    const skipEditClear = overrides.skipEditClear
    const silent = overrides.silent
    try {
      if (!silent) setLoading(true)
      setError('')
      const profile = await api('/hotel/profile').catch(() => ({}))
      const name = profile?.profile?.hotelName || ''
      setHotelName(name)
      if (!name) { setRooms([]); setMeta(readPagination({}, 0)); return }
      const data = await api('/hotel/availability', {
        params: { hotelName: name, page: nextPage, limit: nextLimit }
      })
      const rows = data.rooms || []
      setRooms(rows)
      if (!skipEditClear) setEdits({})
      const next = readPagination(data, rows.length)
      setMeta(next)
      if (next.totalPages > 0 && nextPage > next.totalPages) {
        if (!silent) setLoading(true)
        setPage(next.totalPages)
      }
    } catch (err) { setError(err.message) } finally {
      if (!silent) setLoading(false)
    }
  }

  useEffect(() => {
    Promise.resolve().then(() => load())
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, limit, refreshKey])

  useEffect(() => {
    const id = setInterval(() => {
      load({ skipEditClear: true, silent: true })
    }, 25000)
    return () => clearInterval(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handlePageChange = (nextPage) => {
    setPage(nextPage)
    setLoading(true)
  }

  const handleLimitChange = (nextLimit) => {
    setLimit(nextLimit)
    setPage(1)
    setLoading(true)
  }

  const setField = (id, key, val) => {
    setEdits(prev => ({ ...prev, [id]: { ...prev[id], [key]: val } }))
  }

   const dirty = (r) => {
    if (!r) return false
    const e = edits[r._id]
    if (!e) return false
    return (e.available !== undefined && e.available !== r.available) ||
           (e.total !== undefined && e.total !== r.total) ||
           (e.status !== undefined && e.status !== r.status)
  }

  const saveRoom = async (r) => {
    const e = edits[r._id]
    if (!e) return
    setSaving(true)
    try {
      await api(`/hotel/rooms/${r._id}`, { method: 'PUT', body: JSON.stringify(e) })
      setRefreshKey(k => k + 1)
    } catch (err) { alert(err.message) } finally { setSaving(false) }
  }

  const saveAll = async () => {
    const updates = Object.entries(edits)
      .filter(([, e]) => Object.keys(e).length > 0)
      .map(([id, e]) => ({ id, ...e }))
    if (updates.length === 0) return alert('No changes to save')
    if (!confirm(`Apply ${updates.length} bulk change(s)?`)) return
    setSaving(true)
    try {
      await api('/hotel/availability/bulk', { method: 'PUT', body: JSON.stringify({ updates }) })
      setRefreshKey(k => k + 1)
    } catch (err) { alert(err.message) } finally { setSaving(false) }
  }

  const toggleMaintenance = async (r) => {
    try {
      await api(`/hotel/rooms/${r._id}`, { method: 'PUT', body: JSON.stringify({ status: r.status === 'active' ? 'inactive' : 'active' }) })
      setRefreshKey(k => k + 1)
    } catch (err) { alert(err.message) }
  }

  const dirtyCount = Object.keys(edits)
    .filter(id => {
      const r = rooms.find(r => r._id === id)
      return r ? dirty(r) : false
    })
    .length

  const stats = {
    total: rooms.reduce((s, r) => s + (r.total || 0), 0),
    available: rooms.reduce((s, r) => s + (r.available || 0), 0),
    booked: rooms.reduce((s, r) => s + (r.booked || 0), 0),
    maintenance: rooms.filter(r => r.status === 'inactive').reduce((s, r) => s + (r.total || 0), 0)
  }
  const occupancy = stats.total > 0 ? Math.round((stats.booked / stats.total) * 100) : 0

  return (
    <HotelLayout active="availability" title="Room Availability">
      <div className="hr-stats">
        <StatCard icon={Bed} bg="bg-purple" label="Total Rooms" value={stats.total} />
        <StatCard icon={CheckCircle} bg="bg-emerald" label="Available" value={stats.available} />
        <StatCard icon={Users} bg="bg-blue" label="Booked" value={stats.booked} />
        <StatCard icon={AlertTriangle} bg="bg-amber" label="Occupancy" value={`${occupancy}%`} />
      </div>

      <div className="hr-card">
        <div className="hr-card-head">
          <div>
            <h3 className="hr-card-title">Live Availability</h3>
            <small className="hotel-name">Auto-refreshes every 25 seconds</small>
          </div>
          <div className="hr-actions">
            <button className="hr-btn hr-btn-secondary" onClick={() => setRefreshKey(k => k + 1)} type="button">
              <RefreshCw size={14} /> Refresh
            </button>
            <button className="hr-btn hr-btn-primary" onClick={saveAll} disabled={!dirtyCount || saving} type="button">
              <Save size={14} /> Save All ({dirtyCount})
            </button>
          </div>
        </div>

        {stats.available === 0 && stats.total > 0 && (
          <div className="hr-alert warning">
            <AlertTriangle size={18} />
            <div>
              <strong>Low availability!</strong>
              <p>All rooms are booked or under maintenance.</p>
            </div>
          </div>
        )}

        {!hotelName && !loading && (
          <div className="hr-placeholder">
            <p>Set your hotel name in your <strong>Hotel Profile</strong> to manage room availability.</p>
          </div>
        )}

        {loading && <div className="hr-loading">Loading availability...</div>}
        {error && <div className="hr-error">{error}</div>}

        {rooms.length > 0 && (
          <div className="hr-table-wrap">
            <table className="hr-table">
              <thead>
                <tr><th>Room Type</th><th>Total</th><th>Available</th><th>Booked</th><th>Occupancy</th><th>Status</th><th className="center">Actions</th></tr>
              </thead>
              <tbody>
                {rooms.map(r => {
                  const e = edits[r._id] || {}
                  const currentAv = e.available !== undefined ? e.available : r.available
                  const currentTotal = e.total !== undefined ? e.total : r.total
                  const currentStatus = e.status !== undefined ? e.status : r.status
                  const isDirty = dirty(r)
                  const occ = currentTotal > 0 ? Math.round(((r.booked || 0) / currentTotal) * 100) : 0
                  const overBooked = currentAv < 0 || currentAv > currentTotal
                  const occClass = occ > 80 ? 'high' : occ > 40 ? 'medium' : 'low'
                  return (
                    <tr key={r._id} className={isDirty ? 'hr-dirty' : ''}>
                      <td>
                        <span className={`hr-type-badge ${TYPE_COLORS[r.type] || ''}`}>{r.type}</span>
                        <br />
                        <small className="hr-text-muted">{formatCurrency(r.price)}/night</small>
                      </td>
                      <td>
                        <input type="number" min="0" value={currentTotal} onChange={ev => setField(r._id, 'total', Number(ev.target.value))} className="hr-input-sm" />
                      </td>
                      <td>
                        <input
                          type="number" min="0" max={currentTotal} value={currentAv}
                          onChange={ev => setField(r._id, 'available', Number(ev.target.value))}
                          className={`hr-input-sm ${overBooked ? 'error' : ''}`}
                        />
                        {overBooked && <small className="hr-error-inline">Invalid</small>}
                      </td>
                      <td>{r.booked || 0}</td>
                      <td>
                        <div className="hr-occ-cell">
                          <div className="hr-occ-track"><div className={`hr-occ-fill ${occClass}`} style={{ width: `${occ}%` }} /></div>
                          <small>{occ}%</small>
                        </div>
                      </td>
                      <td>
                        <select value={currentStatus} onChange={ev => setField(r._id, 'status', ev.target.value)} className="hr-inline-select">
                          <option value="active">active</option>
                          <option value="inactive">inactive</option>
                        </select>
                      </td>
                      <td>
                        <div className="hr-actions">
                          {isDirty && (
                            <button className="hr-btn hr-btn-primary" disabled={saving || overBooked} onClick={() => saveRoom(r)} type="button">
                              <Save size={14} /> Save
                            </button>
                          )}
                          <button className="hr-icon-btn" title={r.status === 'active' ? 'Maintenance' : 'Activate'} onClick={() => toggleMaintenance(r)}>
                            {r.status === 'active' ? <PowerOff size={16} /> : <Power size={16} />}
                          </button>
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
          total={meta.total}
          limit={meta.limit}
          onPageChange={handlePageChange}
          onLimitChange={handleLimitChange}
          itemLabel="rooms"
          disabled={loading}
        />
      </div>
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

export default HotelAvailabilityPage