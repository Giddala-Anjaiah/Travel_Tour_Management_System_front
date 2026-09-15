import { useState, useEffect } from 'react'
import { Save, RefreshCw, AlertTriangle, Power, PowerOff } from 'lucide-react'
import HotelLayout from './HotelLayout'
import { api, formatCurrency } from '../../api'
import '../Dashboard.css'

const HotelAvailabilityPage = () => {
  const [hotelName, setHotelName] = useState('')
  const [rooms, setRooms] = useState([])
  const [edits, setEdits] = useState({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)

  const load = async () => {
    try {
      setLoading(true)
      const profile = await api('/hotel/profile').catch(() => ({}))
      const name = profile?.profile?.hotelName || ''
      setHotelName(name)
      if (!name) { setRooms([]); return }
      const data = await api(`/hotel/availability?hotelName=${encodeURIComponent(name)}`)
      setRooms(data.rooms || [])
      setEdits({})
    } catch (err) { setError(err.message) } finally { setLoading(false) }
  }

  useEffect(() => {
    Promise.resolve().then(() => load())
  }, [refreshKey])

  useEffect(() => {
    const id = setInterval(() => setRefreshKey(k => k + 1), 25000)
    return () => clearInterval(id)
  }, [])

  const setField = (id, key, val) => {
    setEdits(prev => ({ ...prev, [id]: { ...prev[id], [key]: val } }))
  }

  const dirty = (r) => {
    const e = edits[r._id]
    if (!e) return false
    return e.available !== undefined && e.available !== r.available ||
           e.total !== undefined && e.total !== r.total ||
           e.status !== undefined && e.status !== r.status
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

  const dirtyCount = Object.keys(edits).filter(id => dirty(rooms.find(r => r._id === id))).length

  const stats = {
    total: rooms.reduce((s, r) => s + (r.total || 0), 0),
    available: rooms.reduce((s, r) => s + (r.available || 0), 0),
    booked: rooms.reduce((s, r) => s + (r.booked || 0), 0),
    maintenance: rooms.filter(r => r.status === 'inactive').reduce((s, r) => s + (r.total || 0), 0)
  }
  const occupancy = stats.total > 0 ? Math.round((stats.booked / stats.total) * 100) : 0

  return (
    <HotelLayout active="availability" title="Room Availability">
      <div className="stats-grid" style={{ marginBottom: '1rem' }}>
        <div className="stat-card"><div className="stat-content"><h3>Total Rooms</h3><p className="stat-number">{stats.total}</p></div></div>
        <div className="stat-card"><div className="stat-content"><h3>Available</h3><p className="stat-number" style={{ color: '#4ade80' }}>{stats.available}</p></div></div>
        <div className="stat-card"><div className="stat-content"><h3>Booked</h3><p className="stat-number" style={{ color: '#60a5fa' }}>{stats.booked}</p></div></div>
        <div className="stat-card"><div className="stat-content"><h3>Occupancy</h3><p className="stat-number">{occupancy}%</p></div></div>
      </div>

      <div className="section-card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
          <h3 style={{ margin: 0 }}>Live Availability <small style={{ color: '#64748b', fontWeight: 400 }}>· auto-refresh every 25s</small></h3>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button className="btn-secondary" onClick={() => setRefreshKey(k => k + 1)}><RefreshCw size={14} /> Refresh</button>
            <button className="btn-primary" onClick={saveAll} disabled={!dirtyCount || saving}>
              <Save size={14} /> Save All ({dirtyCount})
            </button>
          </div>
        </div>

        {stats.available === 0 && stats.total > 0 && (
          <div className="hd-alert warning">
            <AlertTriangle size={18} />
            <div style={{ flex: 1 }}>
              <strong>Low availability!</strong> All rooms are booked or under maintenance.
            </div>
          </div>
        )}

        {!hotelName && !loading && (
          <div className="placeholder-content">
            <p>Set your hotel name in your profile first to manage availability.</p>
          </div>
        )}

        {loading && <p>Loading...</p>}
        {error && <p style={{ color: '#ef4444' }}>{error}</p>}

        {rooms.length > 0 && (
          <div style={{ overflowX: 'auto' }}>
            <table className="data-table">
              <thead>
                <tr><th>Room Type</th><th>Total</th><th>Available</th><th>Booked</th><th>Occupancy</th><th>Status</th><th>Actions</th></tr>
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
                  return (
                    <tr key={r._id} style={{ background: isDirty ? 'rgba(99,102,241,0.08)' : 'transparent' }}>
                      <td><strong>{r.type}</strong><br /><small style={{ color: '#64748b' }}>{formatCurrency(r.price)}/night</small></td>
                      <td>
                        <input type="number" min="0" value={currentTotal} onChange={ev => setField(r._id, 'total', Number(ev.target.value))} style={{ width: '70px' }} className="inline-input" />
                      </td>
                      <td>
                        <input
                          type="number" min="0" max={currentTotal} value={currentAv}
                          onChange={ev => setField(r._id, 'available', Number(ev.target.value))}
                          style={{ width: '70px', borderColor: overBooked ? '#ef4444' : undefined }}
                          className="inline-input"
                        />
                        {overBooked && <small style={{ color: '#ef4444', display: 'block' }}>Invalid</small>}
                      </td>
                      <td>{r.booked || 0}</td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <div style={{ flex: 1, height: '6px', background: 'rgba(255,255,255,0.06)', borderRadius: '3px' }}>
                            <div style={{ width: `${occ}%`, height: '100%', background: occ > 80 ? '#22c55e' : occ > 40 ? '#3b82f6' : '#94a3b8' }} />
                          </div>
                          <small>{occ}%</small>
                        </div>
                      </td>
                      <td>
                        <select value={currentStatus} onChange={ev => setField(r._id, 'status', ev.target.value)} className="inline-select">
                          <option value="active">active</option>
                          <option value="inactive">inactive</option>
                        </select>
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: '0.25rem' }}>
                          {isDirty && <button className="btn-primary" disabled={saving || overBooked} onClick={() => saveRoom(r)}><Save size={14} /></button>}
                          <button className="icon-btn" title={r.status === 'active' ? 'Maintenance' : 'Activate'} onClick={() => toggleMaintenance(r)}>
                            {r.status === 'active' ? <PowerOff size={14} /> : <Power size={14} />}
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
      </div>

      <style>{`
        .inline-input { padding: 0.3rem 0.5rem; border-radius: 6px; border: 1px solid rgba(255,255,255,0.1); background: rgba(255,255,255,0.05); color: white; font-size: 0.85rem; }
        .inline-select { padding: 0.3rem 0.5rem; border-radius: 6px; border: 1px solid rgba(255,255,255,0.1); background: rgba(255,255,255,0.05); color: #cbd5e1; font-size: 0.85rem; cursor: pointer; }
        .hd-alert { display: flex; align-items: center; gap: 0.75rem; padding: 0.85rem 1rem; border-radius: 10px; margin-bottom: 1rem; border: 1px solid; }
        .hd-alert.warning { background: rgba(245,158,11,0.1); border-color: rgba(245,158,11,0.3); color: #fbbf24; }
      `}</style>
    </HotelLayout>
  )
}

export default HotelAvailabilityPage