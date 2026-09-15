import { useState, useEffect } from 'react'
import { Save, TrendingUp, TrendingDown, DollarSign, X } from 'lucide-react'
import HotelLayout from './HotelLayout'
import { api, formatCurrency } from '../../api'
import '../Dashboard.css'

const HotelPricingPage = () => {
  const [hotelName, setHotelName] = useState('')
  const [rooms, setRooms] = useState([])
  const [edits, setEdits] = useState({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [bulkMode, setBulkMode] = useState(null)
  const [bulkPercent, setBulkPercent] = useState('')
  const [refreshKey, setRefreshKey] = useState(0)

  const load = async () => {
    try {
      setLoading(true)
      const profile = await api('/hotel/profile').catch(() => ({}))
      const name = profile?.profile?.hotelName || ''
      setHotelName(name)
      if (!name) { setRooms([]); return }
      const data = await api(`/hotel/pricing?hotelName=${encodeURIComponent(name)}`)
      setRooms(data.rooms || [])
      setEdits({})
    } catch (err) { setError(err.message) } finally { setLoading(false) }
  }

  useEffect(() => {
    Promise.resolve().then(() => load())
  }, [refreshKey])

  const setPrice = (id, price) => setEdits(prev => ({ ...prev, [id]: { ...prev[id], price: Number(price) } }))
  const dirty = (r) => edits[r._id]?.price !== undefined && edits[r._id].price !== r.price

  const saveRoom = async (r) => {
    const e = edits[r._id]
    if (!e || e.price === undefined) return
    if (e.price < 0) return alert('Price cannot be negative')
    setSaving(true)
    try {
      await api(`/hotel/pricing/${r._id}`, { method: 'PUT', body: JSON.stringify({ price: e.price }) })
      setRefreshKey(k => k + 1)
    } catch (err) { alert(err.message) } finally { setSaving(false) }
  }

  const applyBulk = async () => {
    const pct = Number(bulkPercent)
    if (!pct || isNaN(pct)) return alert('Enter a valid percentage')
    const updates = rooms
      .filter(r => bulkMode === 'all' || r.type === bulkMode)
      .map(r => {
        const newPrice = Math.max(0, Math.round(r.price * (1 + pct / 100)))
        return { id: r._id, price: newPrice }
      })
    if (updates.length === 0) return alert('No rooms to update')
    if (!confirm(`Apply ${pct > 0 ? '+' : ''}${pct}% to ${updates.length} room(s)?`)) return
    setSaving(true)
    try {
      await api('/hotel/availability/bulk', { method: 'PUT', body: JSON.stringify({ updates }) })
      setBulkMode(null)
      setBulkPercent('')
      setRefreshKey(k => k + 1)
    } catch (err) { alert(err.message) } finally { setSaving(false) }
  }

  const dirtyCount = rooms.filter(dirty).length
  const avgPrice = rooms.length > 0 ? Math.round(rooms.reduce((s, r) => s + r.price, 0) / rooms.length) : 0
  const totalRevenuePotential = rooms.reduce((s, r) => s + (r.total || 0) * (r.price || 0), 0)

  return (
    <HotelLayout active="pricing" title="Pricing">
      <div className="stats-grid" style={{ marginBottom: '1rem' }}>
        <div className="stat-card"><DollarSign className="stat-icon" /><div className="stat-content"><h3>Avg Price/Night</h3><p className="stat-number">{formatCurrency(avgPrice)}</p></div></div>
        <div className="stat-card"><div className="stat-content"><h3>Room Types</h3><p className="stat-number">{rooms.length}</p></div></div>
        <div className="stat-card"><div className="stat-content"><h3>Full Revenue/Night</h3><p className="stat-number">{formatCurrency(totalRevenuePotential)}</p></div></div>
        <div className="stat-card"><div className="stat-content"><h3>Unsaved Changes</h3><p className="stat-number" style={{ color: dirtyCount ? '#fbbf24' : 'inherit' }}>{dirtyCount}</p></div></div>
      </div>

      <div className="section-card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
          <h3 style={{ margin: 0 }}>Room Pricing</h3>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button className="btn-secondary" onClick={() => setBulkMode('all')}>Bulk %</button>
          </div>
        </div>

        {!hotelName && !loading && (
          <div className="placeholder-content"><p>Set your hotel name in your profile first.</p></div>
        )}

        {loading && <p>Loading...</p>}
        {error && <p style={{ color: '#ef4444' }}>{error}</p>}

        {rooms.length > 0 && (
          <div style={{ overflowX: 'auto' }}>
            <table className="data-table">
              <thead>
                <tr><th>Room Type</th><th>Total Rooms</th><th>Current Price</th><th>New Price</th><th>Change</th><th>Nightly Potential</th><th>Action</th></tr>
              </thead>
              <tbody>
                {rooms.map(r => {
                  const newPrice = edits[r._id]?.price !== undefined ? edits[r._id].price : r.price
                  const change = newPrice - r.price
                  const changePct = r.price > 0 ? Math.round((change / r.price) * 100) : 0
                  return (
                    <tr key={r._id} style={{ background: dirty(r) ? 'rgba(99,102,241,0.08)' : 'transparent' }}>
                      <td><strong>{r.type}</strong></td>
                      <td>{r.total}</td>
                      <td>{formatCurrency(r.price)}</td>
                      <td>
                        <input type="number" min="0" value={newPrice} onChange={e => setPrice(r._id, e.target.value)} style={{ width: '110px' }} className="inline-input" />
                      </td>
                      <td>
                        {change !== 0 && (
                          <span style={{ color: change > 0 ? '#4ade80' : '#f87171', display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                            {change > 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                            {change > 0 ? '+' : ''}{formatCurrency(change)} ({changePct}%)
                          </span>
                        )}
                      </td>
                      <td>{formatCurrency(newPrice * r.total)}</td>
                      <td>
                        {dirty(r) && <button className="btn-primary" disabled={saving} onClick={() => saveRoom(r)}><Save size={14} /> Save</button>}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {bulkMode && (
        <div className="modal-overlay" onClick={() => setBulkMode(null)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '420px' }}>
            <div className="modal-header">
              <h3>Bulk Price Adjustment</h3>
              <button className="modal-close" onClick={() => setBulkMode(null)}><X size={18} /></button>
            </div>
            <div className="modal-body">
              <p>Apply a percentage change to all rooms (positive = increase, negative = decrease).</p>
              <div className="form-group">
                <label>Percentage (%)</label>
                <input type="number" value={bulkPercent} onChange={e => setBulkPercent(e.target.value)} placeholder="e.g. 10 or -15" />
              </div>
              <div className="form-actions">
                <button type="button" className="btn-secondary" onClick={() => setBulkMode(null)}>Cancel</button>
                <button type="button" className="btn-primary" onClick={applyBulk} disabled={saving}>Apply</button>
              </div>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .inline-input { padding: 0.3rem 0.5rem; border-radius: 6px; border: 1px solid rgba(255,255,255,0.1); background: rgba(255,255,255,0.05); color: white; font-size: 0.85rem; }
      `}</style>
    </HotelLayout>
  )
}

export default HotelPricingPage