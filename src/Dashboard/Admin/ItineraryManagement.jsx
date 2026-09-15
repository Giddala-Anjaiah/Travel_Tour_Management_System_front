import { useEffect, useState } from 'react'
import { Calendar, Building, Plus, Pencil as Edit, Trash2, Search, Download, MapPin, Clock, Users, Star } from 'lucide-react'
import { api, downloadCsv, formValues } from '../../api'
import AdminLayout from './AdminLayout'

const ItineraryManagement = () => {
  const [itineraries, setItineraries] = useState([])
  const [hotels, setHotels] = useState([])
  const [packages, setPackages] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [activeTab, setActiveTab] = useState('itineraries')
  const [searchTerm, setSearchTerm] = useState('')
  const [showAddModal, setShowAddModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [selectedItem, setSelectedItem] = useState(null)

  const load = async () => {
    try {
      setError('')
      const [itineraryData, hotelData, packageData] = await Promise.all([
        api('/admin/itineraries'),
        api('/admin/hotels'),
        api('/admin/packages')
      ])
      setItineraries((itineraryData.itineraries || []).map((it) => ({
        id: it._id, name: it.name, package: it.packageName || '', days: it.days, hotels: it.hotels || 0, status: it.status || 'active'
      })))
      setHotels((hotelData.hotels || []).map((hotel) => ({
        id: hotel._id, name: hotel.name, location: hotel.location, rooms: hotel.rooms, rating: hotel.rating || 0, partner: hotel.partner, status: hotel.status || 'active'
      })))
      setPackages(packageData.packages || [])
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    Promise.resolve().then(() => load())
  }, [])

  const filteredItineraries = itineraries.filter((item) =>
    item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (item.package || '').toLowerCase().includes(searchTerm.toLowerCase())
  )
  const filteredHotels = hotels.filter((item) =>
    item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.location.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const handleDelete = async (id, type) => {
    if (!window.confirm(`Delete this ${type}?`)) return
    const endpoint = type === 'itinerary' ? 'itineraries' : 'hotels'
    try {
      await api(`/admin/${endpoint}/${id}`, { method: 'DELETE' })
      if (type === 'itinerary') setItineraries(itineraries.filter((item) => item.id !== id))
      else setHotels(hotels.filter((item) => item.id !== id))
    } catch (err) {
      alert(err.message)
    }
  }

  const handleToggle = async (id, type) => {
    const items = type === 'itinerary' ? itineraries : hotels
    const item = items.find((entry) => entry.id === id)
    const status = item.status === 'active' ? 'inactive' : 'active'
    const endpoint = type === 'itinerary' ? 'itineraries' : 'hotels'
    try {
      await api(`/admin/${endpoint}/${id}`, { method: 'PUT', body: JSON.stringify({ status }) })
      if (type === 'itinerary') setItineraries(itineraries.map((entry) => entry.id === id ? { ...entry, status } : entry))
      else setHotels(hotels.map((entry) => entry.id === id ? { ...entry, status } : entry))
    } catch (err) {
      alert(err.message)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    const values = formValues(e.target)
    try {
      if (activeTab === 'itineraries' || selectedItem?.type === 'itinerary') {
        const payload = { name: values.name, packageName: values.packageName, days: Number(values.days), hotels: Number(values.hotels), status: selectedItem?.status || 'active' }
        if (showEditModal) await api(`/admin/itineraries/${selectedItem.id}`, { method: 'PUT', body: JSON.stringify(payload) })
        else await api('/admin/itineraries', { method: 'POST', body: JSON.stringify(payload) })
      } else {
        const payload = { name: values.name, location: values.location, rooms: Number(values.rooms), rating: Number(values.rating), partner: values.partner, status: selectedItem?.status || 'active' }
        if (showEditModal) await api(`/admin/hotels/${selectedItem.id}`, { method: 'PUT', body: JSON.stringify(payload) })
        else await api('/admin/hotels', { method: 'POST', body: JSON.stringify(payload) })
      }
      setShowAddModal(false)
      setShowEditModal(false)
      setSelectedItem(null)
      load()
    } catch (err) {
      alert(err.message)
    }
  }

  const avgRating = hotels.length ? (hotels.reduce((sum, hotel) => sum + hotel.rating, 0) / hotels.length).toFixed(1) : '0.0'
  const editingItinerary = selectedItem?.type === 'itinerary'
  const showItineraryForm = showAddModal ? activeTab === 'itineraries' : editingItinerary

  return (
    <AdminLayout
      active="itinerary"
      title="Itinerary & Hotel Management"
      actions={
        <>
          <button className="action-btn" onClick={() => {
            if (activeTab === 'itineraries') downloadCsv('itineraries.csv', ['Name', 'Package', 'Days', 'Hotels', 'Status'], filteredItineraries.map((i) => [i.name, i.package, i.days, i.hotels, i.status]))
            else downloadCsv('hotels.csv', ['Name', 'Location', 'Rooms', 'Rating', 'Partner', 'Status'], filteredHotels.map((h) => [h.name, h.location, h.rooms, h.rating, h.partner, h.status]))
          }}><Download className="h-4 w-4" /> Export</button>
          <button className="action-btn" onClick={() => { setSelectedItem(null); setShowAddModal(true) }}>
            <Plus className="h-4 w-4" /> Add {activeTab === 'itineraries' ? 'Itinerary' : 'Hotel'}
          </button>
        </>
      }
    >
      {error && <div className="error-message">{error}</div>}
      <div className="tabs">
        <button className={`tab ${activeTab === 'itineraries' ? 'active' : ''}`} onClick={() => setActiveTab('itineraries')}><Calendar className="h-4 w-4" /> Itineraries</button>
        <button className={`tab ${activeTab === 'hotels' ? 'active' : ''}`} onClick={() => setActiveTab('hotels')}><Building className="h-4 w-4" /> Hotels</button>
      </div>
      <div className="filters-section">
        <div className="search-bar">
          <Search className="search-icon" />
          <input value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} placeholder={`Search ${activeTab}...`} />
        </div>
      </div>

      {activeTab === 'itineraries' && (
        <>
          <div className="stats-grid">
            <div className="stat-card"><Calendar className="stat-icon" /><div className="stat-content"><h3>Total Itineraries</h3><p className="stat-number">{itineraries.length}</p></div></div>
            <div className="stat-card"><Clock className="stat-icon" /><div className="stat-content"><h3>Total Days</h3><p className="stat-number">{itineraries.reduce((sum, i) => sum + i.days, 0)}</p></div></div>
            <div className="stat-card"><Building className="stat-icon" /><div className="stat-content"><h3>Listed Hotels</h3><p className="stat-number">{hotels.length}</p></div></div>
          </div>
          <div className="section-card full-width">
            <h3>Itineraries ({filteredItineraries.length})</h3>
            {loading ? <div style={{ padding: '2rem', textAlign: 'center' }}>Loading...</div> : (
              <div className="table-container">
                <table className="data-table">
                  <thead><tr><th>Name</th><th>Package</th><th>Duration</th><th>Hotels</th><th>Status</th><th>Actions</th></tr></thead>
                  <tbody>
                    {filteredItineraries.length === 0 ? <tr><td colSpan="6" style={{ textAlign: 'center', padding: '2rem' }}>No itineraries found</td></tr> : filteredItineraries.map((item) => (
                      <tr key={item.id}>
                        <td>{item.name}</td><td>{item.package}</td><td>{item.days} Days</td><td>{item.hotels} Hotels</td>
                        <td><span className={`status-badge ${item.status}`}>{item.status}</span></td>
                        <td>
                          <div className="action-buttons">
                            <button className="icon-btn edit" onClick={() => { setSelectedItem({ ...item, type: 'itinerary' }); setShowEditModal(true) }}><Edit className="h-4 w-4" /></button>
                            <button className="icon-btn toggle" onClick={() => handleToggle(item.id, 'itinerary')}>{item.status === 'active' ? '🔴' : '🟢'}</button>
                            <button className="icon-btn delete" onClick={() => handleDelete(item.id, 'itinerary')}><Trash2 className="h-4 w-4" /></button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {activeTab === 'hotels' && (
        <>
          <div className="stats-grid">
            <div className="stat-card"><Building className="stat-icon" /><div className="stat-content"><h3>Total Hotels</h3><p className="stat-number">{hotels.length}</p></div></div>
            <div className="stat-card"><Users className="stat-icon" /><div className="stat-content"><h3>Total Rooms</h3><p className="stat-number">{hotels.reduce((sum, h) => sum + h.rooms, 0)}</p></div></div>
            <div className="stat-card"><Star className="stat-icon" /><div className="stat-content"><h3>Avg Rating</h3><p className="stat-number">{avgRating}</p></div></div>
          </div>
          <div className="section-card full-width">
            <h3>Hotels ({filteredHotels.length})</h3>
            <div className="hotels-grid">
              {filteredHotels.length === 0 ? <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '2rem' }}>No hotels found</div> : filteredHotels.map((hotel) => (
                <div key={hotel.id} className="hotel-card">
                  <div className="hotel-header"><h4>{hotel.name}</h4><span className={`status-badge ${hotel.status}`}>{hotel.status}</span></div>
                  <p className="hotel-location"><MapPin className="h-4 w-4" />{hotel.location}</p>
                  <div className="hotel-stats">
                    <span className="hotel-rooms"><Users className="h-4 w-4" />{hotel.rooms} rooms</span>
                    <span className="hotel-rating"><Star className="h-4 w-4 fill" />{hotel.rating}</span>
                  </div>
                  <p className="hotel-partner">Partner: {hotel.partner}</p>
                  <div className="hotel-actions">
                    <button className="icon-btn edit" onClick={() => { setSelectedItem({ ...hotel, type: 'hotel' }); setShowEditModal(true) }}><Edit className="h-4 w-4" /></button>
                    <button className="icon-btn toggle" onClick={() => handleToggle(hotel.id, 'hotel')}>{hotel.status === 'active' ? '🔴' : '🟢'}</button>
                    <button className="icon-btn delete" onClick={() => handleDelete(hotel.id, 'hotel')}><Trash2 className="h-4 w-4" /></button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {(showAddModal || showEditModal) && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <h3>{showAddModal ? 'Add' : 'Edit'} {showItineraryForm ? 'Itinerary' : 'Hotel'}</h3>
              <button className="modal-close" onClick={() => { setShowAddModal(false); setShowEditModal(false) }}>×</button>
            </div>
            <div className="modal-body">
              <form className="item-form" onSubmit={handleSubmit}>
                {showItineraryForm ? (
                  <>
                    <div className="form-group"><label>Itinerary Name</label><input name="name" defaultValue={selectedItem?.name} required /></div>
                    <div className="form-group">
                      <label>Package</label>
                      <select name="packageName" defaultValue={selectedItem?.package || ''} required>
                        <option value="">Select Package</option>
                        {packages.map((pkg) => <option key={pkg._id} value={pkg.name}>{pkg.name}</option>)}
                      </select>
                    </div>
                    <div className="form-row">
                      <div className="form-group"><label>Duration (Days)</label><input name="days" type="number" defaultValue={selectedItem?.days} required /></div>
                      <div className="form-group"><label>Number of Hotels</label><input name="hotels" type="number" defaultValue={selectedItem?.hotels} required /></div>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="form-group"><label>Hotel Name</label><input name="name" defaultValue={selectedItem?.name} required /></div>
                    <div className="form-group"><label>Location</label><input name="location" defaultValue={selectedItem?.location} required /></div>
                    <div className="form-row">
                      <div className="form-group"><label>Total Rooms</label><input name="rooms" type="number" defaultValue={selectedItem?.rooms} required /></div>
                      <div className="form-group"><label>Rating</label><input name="rating" type="number" step="0.1" min="1" max="5" defaultValue={selectedItem?.rating} required /></div>
                    </div>
                    <div className="form-group"><label>Partner</label><input name="partner" defaultValue={selectedItem?.partner} required /></div>
                  </>
                )}
                <div className="form-actions">
                  <button type="button" className="btn-secondary" onClick={() => { setShowAddModal(false); setShowEditModal(false) }}>Cancel</button>
                  <button type="submit" className="btn-primary">{showAddModal ? 'Add' : 'Update'}</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  )
}

export default ItineraryManagement
