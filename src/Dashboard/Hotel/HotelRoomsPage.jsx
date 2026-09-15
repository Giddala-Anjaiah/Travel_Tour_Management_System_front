import { useState, useEffect } from 'react'
import { Plus, Search, Bed, Edit3, Trash2, Eye, X, Save, Power, PowerOff, AlertCircle, CheckCircle } from 'lucide-react'
import HotelLayout from './HotelLayout'
import { api, formatCurrency } from '../../api'
import '../Dashboard.css'

const TYPES = ['Standard', 'Deluxe', 'Suite', 'Family', 'Presidential']
const STATUSES = ['active', 'inactive']

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

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      try {
        setLoading(true)
        const profile = await api('/hotel/profile').catch(() => ({}))
        const name = profile?.profile?.hotelName || ''
        if (!cancelled) setHotelName(name)
        if (!name) { if(!cancelled) setRooms([]); return }
        const data = await api(`/hotel/rooms?hotelName=${encodeURIComponent(name)}`)
        if (!cancelled) setRooms(data.rooms || [])
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

  const filtered = rooms.filter(r => {
    const matchSearch = !search || (r.type || '').toLowerCase().includes(search.toLowerCase())
    const matchType = filterType === 'all' || r.type === filterType
    const matchStatus = filterStatus === 'all' || r.status === filterStatus
    return matchSearch && matchType && matchStatus
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
      refresh()
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

  const stats = {
    total: rooms.reduce((s, r) => s + (r.total || 0), 0),
    available: rooms.reduce((s, r) => s + (r.available || 0), 0),
    booked: rooms.reduce((s, r) => s + (r.booked || 0), 0),
    revenue: rooms.reduce((s, r) => s + (r.booked || 0) * (r.price || 0), 0)
  }

  return (
    <HotelLayout active="rooms" title="Room Management">
      <div className="hr-stats">
        <div className="hr-stat-card"><div className="hr-stat-icon" style={{ background: '#e0e7ff', color: '#4f46e5' }}><Bed size={20} /></div><div><div className="hr-stat-label">Total Rooms</div><div className="hr-stat-value">{stats.total}</div></div></div>
        <div className="hr-stat-card"><div className="hr-stat-icon" style={{ background: '#d1fae5', color: '#10b981' }}><CheckCircle size={20} /></div><div><div className="hr-stat-label">Available</div><div className="hr-stat-value">{stats.available}</div></div></div>
        <div className="hr-stat-card"><div className="hr-stat-icon" style={{ background: '#dbeafe', color: '#3b82f6' }}><Bed size={20} /></div><div><div className="hr-stat-label">Booked</div><div className="hr-stat-value">{stats.booked}</div></div></div>
        <div className="hr-stat-card"><div className="hr-stat-icon" style={{ background: '#fef3c7', color: '#f59e0b' }}><span style={{ fontWeight: 700 }}>₹</span></div><div><div className="hr-stat-label">Potential Revenue</div><div className="hr-stat-value">{formatCurrency(stats.revenue)}</div></div></div>
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
          <h3 className="hr-card-title">Rooms ({filtered.length}) {hotelName && <small>· {hotelName}</small>}</h3>
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
              <option value="all">All</option>
              {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
        </div>

        {loading && <div className="hr-loading">Loading rooms...</div>}
        {error && <div className="hr-error">{error}</div>}
        {!loading && !error && rooms.length === 0 && hotelName && (
          <div className="hr-empty">
            <Bed size={48} style={{ color: '#cbd5e1' }} />
            <h4>No rooms yet</h4>
            <p>Click <strong>Add Room</strong> to create your first room type for {hotelName}.</p>
          </div>
        )}

        {filtered.length > 0 && (
          <div className="hr-table-wrap">
            <table className="hr-table">
              <thead>
                <tr><th>Type</th><th>Total</th><th>Available</th><th>Booked</th><th>Price/Night</th><th>Occupancy</th><th>Status</th><th>Actions</th></tr>
              </thead>
              <tbody>
                {filtered.map(r => {
                  const occ = r.total > 0 ? Math.round(((r.booked || 0) / r.total) * 100) : 0
                  return (
                    <tr key={r._id}>
                      <td><strong>{r.type}</strong></td>
                      <td>{r.total}</td>
                      <td>{r.available}</td>
                      <td>{r.booked || 0}</td>
                      <td>{formatCurrency(r.price)}</td>
                      <td>
                        <div className="hr-occ-cell">
                          <div className="hr-occ-track"><div className="hr-occ-fill" style={{ width: `${occ}%`, background: occ > 80 ? '#10b981' : occ > 40 ? '#3b82f6' : '#94a3b8' }} /></div>
                          <small>{occ}%</small>
                        </div>
                      </td>
                      <td><span className={`hr-pill hr-pill-${r.status}`}>{r.status}</span></td>
                      <td>
                        <div className="hr-actions">
                          <button className="hr-icon-btn" title="View" onClick={() => setViewing(r)}><Eye size={14} /></button>
                          <button className="hr-icon-btn" title="Edit" onClick={() => openEdit(r)}><Edit3 size={14} /></button>
                          <button className="hr-icon-btn" title={r.status === 'active' ? 'Deactivate' : 'Activate'} onClick={() => toggleStatus(r)}>
                            {r.status === 'active' ? <PowerOff size={14} /> : <Power size={14} />}
                          </button>
                          <button className="hr-icon-btn hr-danger" title="Delete" onClick={() => remove(r)}><Trash2 size={14} /></button>
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

      {showForm && (
        <div className="hr-modal-overlay" onClick={closeForm}>
          <div className="hr-modal" onClick={e => e.stopPropagation()}>
            <div className="hr-modal-header">
              <h3>{editing ? 'Edit Room' : 'Add New Room'}</h3>
              <button className="hr-modal-close" onClick={closeForm} type="button"><X size={18} /></button>
            </div>
            <form onSubmit={save} className="hr-modal-body">
              {formError && <div className="hr-form-error"><AlertCircle size={16} /> {formError}</div>}
              {formSuccess && <div className="hr-form-success"><CheckCircle size={16} /> {formSuccess}</div>}

              <div className="hr-form-grid">
                <div className="hr-form-group">
                  <label>Room Type *</label>
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
          <div className="hr-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '420px' }}>
            <div className="hr-modal-header">
              <h3>{viewing.type} Room</h3>
              <button className="hr-modal-close" onClick={() => setViewing(null)} type="button"><X size={18} /></button>
            </div>
            <div className="hr-modal-body">
              <div className="hr-detail">
                <div><span>Type</span><strong>{viewing.type}</strong></div>
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

      <style>{`
        .hr-stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem; margin-bottom: 1.25rem; }
        .hr-stat-card { background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 1rem 1.15rem; display: flex; align-items: center; gap: 0.85rem; box-shadow: 0 1px 3px rgba(0,0,0,0.04); }
        .hr-stat-icon { width: 44px; height: 44px; border-radius: 10px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; font-weight: 700; }
        .hr-stat-label { color: #64748b; font-size: 0.78rem; text-transform: uppercase; font-weight: 600; letter-spacing: 0.04em; }
        .hr-stat-value { color: #0f172a; font-size: 1.5rem; font-weight: 700; margin-top: 0.15rem; }

        .hr-warn { display: flex; align-items: flex-start; gap: 0.85rem; padding: 1rem 1.15rem; background: #fef3c7; border: 1px solid #fbbf24; border-radius: 12px; color: #92400e; margin-bottom: 1.25rem; }
        .hr-warn strong { display: block; margin-bottom: 0.2rem; }
        .hr-warn p { margin: 0; font-size: 0.88rem; }

        .hr-card { background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 1.5rem; box-shadow: 0 1px 3px rgba(0,0,0,0.04); }
        .hr-card-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.25rem; flex-wrap: wrap; gap: 0.5rem; }
        .hr-card-title { color: #0f172a; font-size: 1.1rem; font-weight: 700; margin: 0; }
        .hr-card-title small { color: #64748b; font-weight: 500; font-size: 0.88rem; margin-left: 0.4rem; }

        .hr-btn { display: inline-flex; align-items: center; gap: 0.5rem; padding: 0.55rem 1.05rem; border-radius: 8px; border: 1px solid transparent; font-weight: 600; cursor: pointer; transition: all 0.2s; font-size: 0.88rem; }
        .hr-btn:disabled { opacity: 0.5; cursor: not-allowed; }
        .hr-btn-primary { background: #4f46e5; color: white; }
        .hr-btn-primary:hover:not(:disabled) { background: #3730a3; }
        .hr-btn-secondary { background: #f1f5f9; color: #475569; border-color: #e2e8f0; }
        .hr-btn-secondary:hover:not(:disabled) { background: #e2e8f0; }

        .hr-filters { display: flex; gap: 0.85rem; margin-bottom: 1.25rem; flex-wrap: wrap; }
        .hr-search { position: relative; flex: 1; min-width: 200px; }
        .hr-search-icon { position: absolute; left: 0.85rem; top: 50%; transform: translateY(-50%); color: #94a3b8; }
        .hr-search input { width: 100%; padding: 0.55rem 0.85rem 0.55rem 2.4rem; border: 1px solid #e2e8f0; border-radius: 8px; font-size: 0.88rem; background: #ffffff; color: #0f172a; }
        .hr-search input:focus { outline: none; border-color: #4f46e5; box-shadow: 0 0 0 3px rgba(79,70,229,0.1); }
        .hr-filter-group { display: flex; flex-direction: column; gap: 0.3rem; }
        .hr-filter-group label { color: #475569; font-size: 0.78rem; font-weight: 600; }
        .hr-filter-group select { padding: 0.55rem 0.85rem; border: 1px solid #e2e8f0; border-radius: 8px; background: #ffffff; color: #0f172a; font-size: 0.88rem; cursor: pointer; }

        .hr-loading, .hr-empty { padding: 2rem; text-align: center; color: #64748b; font-weight: 500; }
        .hr-empty h4 { color: #0f172a; margin: 0.85rem 0 0.4rem; }
        .hr-empty p { color: #64748b; margin: 0; font-size: 0.9rem; }
        .hr-error { padding: 1rem; background: #fee2e2; border: 1px solid #f87171; border-radius: 8px; color: #991b1b; }

        .hr-table-wrap { overflow-x: auto; }
        .hr-table { width: 100%; border-collapse: collapse; }
        .hr-table th { text-align: left; padding: 0.75rem 1rem; background: #f8fafc; color: #475569; font-size: 0.78rem; text-transform: uppercase; letter-spacing: 0.05em; font-weight: 700; border-bottom: 1px solid #e2e8f0; }
        .hr-table td { padding: 0.85rem 1rem; color: #334155; border-bottom: 1px solid #f1f5f9; font-size: 0.9rem; }
        .hr-table tr:hover td { background: #f8fafc; }

        .hr-occ-cell { display: flex; align-items: center; gap: 0.6rem; min-width: 100px; }
        .hr-occ-track { flex: 1; height: 8px; background: #f1f5f9; border-radius: 4px; overflow: hidden; }
        .hr-occ-fill { height: 100%; border-radius: 4px; transition: width 0.4s ease; }
        .hr-occ-cell small { color: #475569; font-weight: 600; min-width: 32px; text-align: right; }

        .hr-pill { display: inline-block; padding: 0.25rem 0.6rem; border-radius: 6px; font-size: 0.75rem; font-weight: 600; text-transform: capitalize; }
        .hr-pill-active { background: #d1fae5; color: #065f46; }
        .hr-pill-inactive { background: #fee2e2; color: #991b1b; }

        .hr-actions { display: flex; gap: 0.3rem; }
        .hr-icon-btn { width: 32px; height: 32px; border-radius: 6px; border: 1px solid #e2e8f0; background: #ffffff; color: #475569; cursor: pointer; display: inline-flex; align-items: center; justify-content: center; transition: all 0.15s; }
        .hr-icon-btn:hover { background: #f1f5f9; color: #4f46e5; border-color: #cbd5e1; }
        .hr-icon-btn.hr-danger:hover { background: #fee2e2; color: #dc2626; border-color: #f87171; }

        .hr-modal-overlay { position: fixed; inset: 0; background: rgba(15, 23, 42, 0.6); display: flex; align-items: center; justify-content: center; z-index: 2000; padding: 1rem; animation: hrFadeIn 0.2s ease; }
        @keyframes hrFadeIn { from { opacity: 0; } to { opacity: 1; } }
        .hr-modal { background: #ffffff; border-radius: 14px; width: 100%; max-width: 580px; max-height: 90vh; overflow-y: auto; box-shadow: 0 20px 50px rgba(0,0,0,0.3); animation: hrSlideUp 0.25s ease; }
        @keyframes hrSlideUp { from { transform: translateY(20px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
        .hr-modal-header { padding: 1.25rem 1.5rem; border-bottom: 1px solid #e2e8f0; display: flex; justify-content: space-between; align-items: center; }
        .hr-modal-header h3 { color: #0f172a; font-size: 1.15rem; font-weight: 700; margin: 0; }
        .hr-modal-close { background: none; border: none; color: #64748b; cursor: pointer; padding: 0.25rem; border-radius: 6px; display: flex; }
        .hr-modal-close:hover { background: #f1f5f9; color: #0f172a; }
        .hr-modal-body { padding: 1.5rem; }

        .hr-form-error { display: flex; align-items: center; gap: 0.5rem; padding: 0.75rem 1rem; background: #fee2e2; border: 1px solid #f87171; border-radius: 8px; color: #991b1b; margin-bottom: 1rem; font-size: 0.88rem; font-weight: 500; }
        .hr-form-success { display: flex; align-items: center; gap: 0.5rem; padding: 0.75rem 1rem; background: #d1fae5; border: 1px solid #10b981; border-radius: 8px; color: #065f46; margin-bottom: 1rem; font-size: 0.88rem; font-weight: 500; }

        .hr-form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 0.85rem; }
        .hr-form-group { display: flex; flex-direction: column; gap: 0.35rem; }
        .hr-form-group label { color: #475569; font-size: 0.82rem; font-weight: 600; }
        .hr-form-group input, .hr-form-group select { padding: 0.6rem 0.85rem; border: 1px solid #e2e8f0; border-radius: 8px; font-size: 0.9rem; background: #ffffff; color: #0f172a; }
        .hr-form-group input:focus, .hr-form-group select:focus { outline: none; border-color: #4f46e5; box-shadow: 0 0 0 3px rgba(79,70,229,0.1); }
        .hr-form-actions { display: flex; justify-content: flex-end; gap: 0.6rem; margin-top: 1.25rem; padding-top: 1rem; border-top: 1px solid #e2e8f0; }

        .hr-detail > div { display: flex; justify-content: space-between; padding: 0.6rem 0; border-bottom: 1px solid #f1f5f9; color: #334155; }
        .hr-detail > div:last-child { border-bottom: none; }
        .hr-detail span { color: #64748b; }
        .hr-detail strong { color: #0f172a; }
      `}</style>
    </HotelLayout>
  )
}

export default HotelRoomsPage