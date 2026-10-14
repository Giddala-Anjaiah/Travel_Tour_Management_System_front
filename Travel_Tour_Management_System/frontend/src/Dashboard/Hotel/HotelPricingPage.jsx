import { useState, useEffect } from 'react'
import { Save, TrendingUp, TrendingDown, DollarSign, X, Bed } from 'lucide-react'
import HotelLayout from './HotelLayout'
import { api, fetchAllPages, formatCurrency, readPagination } from '../../api'
import Pagination from '../../components/Pagination'
import '../Dashboard.css'
import './HotelDashboard.css'

const TYPE_COLORS = {
  Standard: 'standard', Deluxe: 'deluxe', Suite: 'suite', Family: 'family', Presidential: 'presidential'
}

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
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(10)
  const [meta, setMeta] = useState({ page: 1, limit: 10, total: 0, totalPages: 1, hasNext: false, hasPrev: false })

  // This page has no filter controls, so `/hotel/pricing` is always paged.
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
      const data = await api('/hotel/pricing', {
        params: { hotelName: name, page: nextPage, limit: nextLimit }
      })
      const rows = data.rooms || []
      setRooms(rows)
      setEdits({})
      const next = readPagination(data, rows.length)
      setMeta(next)
      if (next.totalPages > 0 && nextPage > next.totalPages) {
        setLoading(true)
        setPage(next.totalPages)
      }
    } catch (err) { setError(err.message) } finally { setLoading(false) }
  }

  useEffect(() => {
    Promise.resolve().then(() => load())
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, limit, refreshKey])

  const handlePageChange = (nextPage) => {
    setPage(nextPage)
    setLoading(true)
  }

  const handleLimitChange = (nextLimit) => {
    setLimit(nextLimit)
    setPage(1)
    setLoading(true)
  }

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
    // The bulk adjustment covers the whole hotel, not just the rendered page.
    const allRooms = hotelName
      ? await fetchAllPages('/hotel/pricing', { key: 'rooms', params: { hotelName } })
      : rooms
    const updates = allRooms
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
      <div className="hr-stats">
        <StatCard icon={DollarSign} bg="bg-purple" label="Avg Price/Night" value={formatCurrency(avgPrice)} />
        <StatCard icon={Bed} bg="bg-emerald" label="Room Types" value={meta.total} />
        <StatCard icon={TrendingUp} bg="bg-blue" label="Full Revenue/Night" value={formatCurrency(totalRevenuePotential)} />
        <StatCard icon={Save} bg="bg-amber" label="Unsaved Changes" value={dirtyCount} warning={dirtyCount > 0} />
      </div>

      <div className="hr-card">
        <div className="hr-card-head">
          <h3 className="hr-card-title">Room Pricing</h3>
          <div className="hr-actions">
            <button className="hr-btn hr-btn-secondary" onClick={() => setBulkMode('all')} type="button">
              <TrendingUp size={14} /> Bulk % Adjustment
            </button>
          </div>
        </div>

        {!hotelName && !loading && (
          <div className="hr-placeholder">
            <p>Set your hotel name in your <strong>Hotel Profile</strong> before managing pricing.</p>
          </div>
        )}

        {loading && <div className="hr-loading">Loading pricing data...</div>}
        {error && <div className="hr-error">{error}</div>}

        {rooms.length > 0 && (
          <div className="hr-table-wrap">
            <table className="hr-table">
              <thead>
                <tr><th>Room Type</th><th>Total Rooms</th><th>Current Price</th><th>New Price</th><th>Change</th><th>Nightly Potential</th><th className="center">Action</th></tr>
              </thead>
              <tbody>
                {rooms.map(r => {
                  const newPrice = edits[r._id]?.price !== undefined ? edits[r._id].price : r.price
                  const change = newPrice - r.price
                  const changePct = r.price > 0 ? Math.round((change / r.price) * 100) : 0
                  const isDirty = dirty(r)
                  const changeClass = change > 0 ? 'positive' : change < 0 ? 'negative' : 'neutral'
                  return (
                    <tr key={r._id} className={isDirty ? 'hr-dirty' : ''}>
                      <td>
                        <span className={`hr-type-badge ${TYPE_COLORS[r.type] || ''}`}>{r.type}</span>
                      </td>
                      <td>{r.total}</td>
                      <td>{formatCurrency(r.price)}</td>
                      <td>
                        <input type="number" min="0" value={newPrice} onChange={e => setPrice(r._id, e.target.value)} className="hr-price-input" />
                      </td>
                      <td>
                        {change !== 0 && (
                          <span className={`hr-change ${changeClass}`}>
                            {change > 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                            {change > 0 ? '+' : ''}{formatCurrency(change)} ({changePct}%)
                          </span>
                        )}
                      </td>
                      <td>{formatCurrency(newPrice * r.total)}</td>
                      <td><div className="hr-actions">
                        {isDirty && <button className="hr-btn hr-btn-primary hr-save-btn" disabled={saving} onClick={() => saveRoom(r)}><Save size={14} /> Save</button>}
                      </div></td>
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

      {bulkMode && (
          <div className="hr-modal-overlay" onClick={() => setBulkMode(null)}>
          <div className="hr-modal hr-modal-sm" onClick={e => e.stopPropagation()}>
            <div className="hr-modal-header">
              <h3><TrendingUp size={18} /> Bulk Price Adjustment</h3>
              <button className="hr-modal-close" onClick={() => setBulkMode(null)} type="button"><X size={18} /></button>
            </div>
            <div className="hr-modal-body">
              <p className="hr-modal-text">Apply a percentage change to room prices. Positive values increase prices, negative values decrease them.</p>
              <div className="hr-form-group">
                <label>Scope</label>
                <select value={bulkMode} onChange={e => setBulkMode(e.target.value)}>
                  <option value="all">All Room Types</option>
                  {rooms.map(r => (
                    <option key={r._id} value={r.type}>{r.type}</option>
                  ))}
                </select>
              </div>
              <div className="hr-form-group">
                <label>Percentage (%)</label>
                <input type="number" value={bulkPercent} onChange={e => setBulkPercent(e.target.value)} placeholder="e.g. 10 or -15" className="hr-price-input" />
              </div>
              <div className="hr-form-actions">
                <button type="button" className="hr-btn hr-btn-secondary" onClick={() => setBulkMode(null)}>Cancel</button>
                <button type="button" className="hr-btn hr-btn-primary" onClick={applyBulk} disabled={saving}>Apply</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </HotelLayout>
  )
}

const StatCard = ({ icon: Icon, bg, label, value, warning = false }) => (
  <div className="hr-stat-card">
    <div className={`hr-stat-icon ${bg}`}>
      <Icon size={20} />
    </div>
    <div>
      <div className="hr-stat-label">{label}</div>
      <div className={`hr-stat-value ${warning ? 'warning' : ''}`}>{value}</div>
    </div>
  </div>
)

export default HotelPricingPage