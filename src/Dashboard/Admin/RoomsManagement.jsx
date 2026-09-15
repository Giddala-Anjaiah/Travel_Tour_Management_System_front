import { useEffect, useState } from 'react'
import { Bed, Plus, Pencil as Edit, Trash2, Search, Download, Building, Users, DollarSign } from 'lucide-react'
import { api, downloadCsv, formValues, formatCurrency } from '../../api'
import AdminLayout from './AdminLayout'

const RoomsManagement = () => {
  const [rooms, setRooms] = useState([])
  const [hotels, setHotels] = useState([])
  const [searchTerm, setSearchTerm] = useState('')
  const [filterHotel, setFilterHotel] = useState('all')
  const [showAddModal, setShowAddModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [selectedRoom, setSelectedRoom] = useState(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  const load = async () => {
    try {
      setError('')
      const [roomData, hotelData] = await Promise.all([api('/admin/rooms'), api('/admin/hotels')])
      setRooms((roomData.rooms || []).map((room) => ({
        id: room._id,
        hotel: room.hotel,
        type: room.type,
        total: room.total,
        available: room.available,
        booked: room.booked || 0,
        price: room.price,
        status: room.status || 'active'
      })))
      setHotels(hotelData.hotels || [])
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    Promise.resolve().then(() => load())
  }, [])

  const hotelNames = [...new Set([
    ...hotels.map((hotel) => hotel.name),
    ...rooms.map((room) => room.hotel)
  ].filter(Boolean))]

  const filteredRooms = rooms.filter((room) => {
    const matchesSearch = room.type.toLowerCase().includes(searchTerm.toLowerCase()) ||
      room.hotel.toLowerCase().includes(searchTerm.toLowerCase())
    return matchesSearch && (filterHotel === 'all' || room.hotel === filterHotel)
  })

  const persistRoom = async (id, payload) => {
    await api(`/admin/rooms/${id}`, { method: 'PUT', body: JSON.stringify(payload) })
  }

  const handleDeleteRoom = async (id) => {
    if (!window.confirm('Delete this room type?')) return
    try {
      await api(`/admin/rooms/${id}`, { method: 'DELETE' })
      setRooms(rooms.filter((room) => room.id !== id))
    } catch (err) {
      alert(err.message)
    }
  }

  const handleToggleStatus = async (id) => {
    const room = rooms.find((item) => item.id === id)
    const status = room.status === 'active' ? 'inactive' : 'active'
    try {
      await persistRoom(id, { status })
      setRooms(rooms.map((item) => item.id === id ? { ...item, status } : item))
    } catch (err) {
      alert(err.message)
    }
  }

  const updateAvailability = async (id, change) => {
    const room = rooms.find((item) => item.id === id)
    const available = Math.min(room.total, Math.max(0, room.available + change))
    const booked = room.total - available
    try {
      await persistRoom(id, { available, booked })
      setRooms(rooms.map((item) => item.id === id ? { ...item, available, booked } : item))
    } catch (err) {
      alert(err.message)
    }
  }

  const handleAddRoom = async (e) => {
    e.preventDefault()
    const values = formValues(e.target)
    try {
      await api('/admin/rooms', {
        method: 'POST',
        body: JSON.stringify({
          hotel: values.hotel,
          type: values.type,
          total: Number(values.total),
          available: Number(values.available),
          booked: Math.max(0, Number(values.total) - Number(values.available)),
          price: Number(values.price),
          status: 'active'
        })
      })
      setShowAddModal(false)
      load()
    } catch (err) {
      alert(err.message)
    }
  }

  const handleUpdateRoom = async (e) => {
    e.preventDefault()
    const values = formValues(e.target)
    const total = Number(values.total)
    const available = Number(values.available)
    try {
      await persistRoom(selectedRoom.id, {
        type: values.type,
        total,
        available,
        booked: Math.max(0, total - available),
        price: Number(values.price)
      })
      setShowEditModal(false)
      load()
    } catch (err) {
      alert(err.message)
    }
  }

  return (
    <AdminLayout
      active="rooms"
      title="Rooms & Availability"
      actions={
        <>
          <button className="action-btn" onClick={() => downloadCsv('rooms.csv', ['Hotel', 'Type', 'Total', 'Available', 'Booked', 'Price', 'Status'], filteredRooms.map((r) => [r.hotel, r.type, r.total, r.available, r.booked, r.price, r.status]))}>
            <Download className="h-4 w-4" /> Export
          </button>
          <button className="action-btn" onClick={() => setShowAddModal(true)}><Plus className="h-4 w-4" /> Add Room Type</button>
        </>
      }
    >
      {error && <div className="error-message">{error}</div>}
      <div className="filters-section">
        <div className="search-bar">
          <Search className="search-icon" />
          <input value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} placeholder="Search rooms by type or hotel..." />
        </div>
        <div className="filter-controls">
          <select value={filterHotel} onChange={(e) => setFilterHotel(e.target.value)} className="filter-select">
            <option value="all">All Hotels</option>
            {hotelNames.map((hotel) => <option key={hotel} value={hotel}>{hotel}</option>)}
          </select>
        </div>
      </div>

      <div className="stats-grid">
        <div className="stat-card"><Bed className="stat-icon" /><div className="stat-content"><h3>Total Rooms</h3><p className="stat-number">{rooms.reduce((sum, room) => sum + room.total, 0)}</p></div></div>
        <div className="stat-card"><Users className="stat-icon" /><div className="stat-content"><h3>Available</h3><p className="stat-number">{rooms.reduce((sum, room) => sum + room.available, 0)}</p></div></div>
        <div className="stat-card"><Users className="stat-icon" /><div className="stat-content"><h3>Booked</h3><p className="stat-number">{rooms.reduce((sum, room) => sum + room.booked, 0)}</p></div></div>
        <div className="stat-card"><DollarSign className="stat-icon" /><div className="stat-content"><h3>Booked Value</h3><p className="stat-number">{formatCurrency(rooms.reduce((sum, room) => sum + room.booked * room.price, 0))}</p></div></div>
      </div>

      <div className="section-card full-width">
        <h3>Room Types ({filteredRooms.length})</h3>
        {loading ? <div style={{ padding: '2rem', textAlign: 'center' }}>Loading rooms...</div> : (
          <div className="rooms-grid">
            {filteredRooms.length === 0 ? <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '2rem' }}>No rooms found. Add a hotel first, then a room type.</div> : filteredRooms.map((room) => (
              <div key={room.id} className="room-card">
                <div className="room-header">
                  <div className="room-type-info">
                    <h4>{room.type}</h4>
                    <span className="room-hotel"><Building className="h-4 w-4" />{room.hotel}</span>
                  </div>
                  <span className={`status-badge ${room.status}`}>{room.status}</span>
                </div>
                <div className="room-stats">
                  <div className="room-stat"><span className="stat-label">Total</span><span className="stat-value">{room.total}</span></div>
                  <div className="room-stat"><span className="stat-label">Available</span><span className="stat-value available">{room.available}</span></div>
                  <div className="room-stat"><span className="stat-label">Booked</span><span className="stat-value booked">{room.booked}</span></div>
                </div>
                <div className="room-availability-bar">
                  <div className="availability-fill" style={{ width: `${room.total ? (room.available / room.total) * 100 : 0}%` }}></div>
                </div>
                <div className="room-footer">
                  <span className="room-price">₹{room.price.toLocaleString()}/night</span>
                  <div className="room-actions">
                    <button onClick={() => updateAvailability(room.id, -1)} className="availability-btn decrease" disabled={room.available === 0}>-</button>
                    <button onClick={() => updateAvailability(room.id, 1)} className="availability-btn increase" disabled={room.available === room.total}>+</button>
                    <button onClick={() => { setSelectedRoom(room); setShowEditModal(true) }} className="icon-btn edit"><Edit className="h-4 w-4" /></button>
                    <button onClick={() => handleToggleStatus(room.id)} className="icon-btn toggle">{room.status === 'active' ? '🔴' : '🟢'}</button>
                    <button onClick={() => handleDeleteRoom(room.id)} className="icon-btn delete"><Trash2 className="h-4 w-4" /></button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {showAddModal && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header"><h3>Add Room Type</h3><button className="modal-close" onClick={() => setShowAddModal(false)}>×</button></div>
            <div className="modal-body">
              <form className="room-form" onSubmit={handleAddRoom}>
                <div className="form-group">
                  <label>Hotel</label>
                  {hotelNames.length > 0 ? (
                    <select name="hotel" required>
                      <option value="">Select Hotel</option>
                      {hotelNames.map((hotel) => <option key={hotel} value={hotel}>{hotel}</option>)}
                    </select>
                  ) : (
                    <input name="hotel" placeholder="Add a hotel first, or type a hotel name" required />
                  )}
                </div>
                <div className="form-group"><label>Room Type</label><input name="type" required /></div>
                <div className="form-row">
                  <div className="form-group"><label>Total Rooms</label><input name="total" type="number" required /></div>
                  <div className="form-group"><label>Available</label><input name="available" type="number" required /></div>
                </div>
                <div className="form-group"><label>Price per Night (₹)</label><input name="price" type="number" required /></div>
                <div className="form-actions">
                  <button type="button" className="btn-secondary" onClick={() => setShowAddModal(false)}>Cancel</button>
                  <button type="submit" className="btn-primary">Add Room Type</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {showEditModal && selectedRoom && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header"><h3>Edit Room Type</h3><button className="modal-close" onClick={() => setShowEditModal(false)}>×</button></div>
            <div className="modal-body">
              <form className="room-form" onSubmit={handleUpdateRoom}>
                <div className="form-group"><label>Room Type</label><input name="type" defaultValue={selectedRoom.type} required /></div>
                <div className="form-row">
                  <div className="form-group"><label>Total Rooms</label><input name="total" type="number" defaultValue={selectedRoom.total} required /></div>
                  <div className="form-group"><label>Available</label><input name="available" type="number" defaultValue={selectedRoom.available} required /></div>
                </div>
                <div className="form-group"><label>Price per Night (₹)</label><input name="price" type="number" defaultValue={selectedRoom.price} required /></div>
                <div className="form-actions">
                  <button type="button" className="btn-secondary" onClick={() => setShowEditModal(false)}>Cancel</button>
                  <button type="submit" className="btn-primary">Update Room Type</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  )
}

export default RoomsManagement
