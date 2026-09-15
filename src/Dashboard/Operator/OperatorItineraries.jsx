import { API_BASE } from '../../api'
import { useState, useEffect } from 'react'
import usePolling from '../../hooks/usePolling'
import { Calendar, Plus, Search, Pencil as Edit, Trash2, Building, Sparkles } from 'lucide-react'
import '../Dashboard.css'

const emptyDay = () => ({
  dayNumber: 1,
  title: '',
  date: '',
  description: '',
  location: '',
  activities: '',
  meals: '',
  accommodation: '',
  transportation: '',
  notes: ''
})

const OperatorItineraries = () => {
  const [itineraries, setItineraries] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [packages, setPackages] = useState([])
  const [formData, setFormData] = useState({
    name: '',
    packageId: '',
    packageName: '',
    days: 1,
    dayDetails: [emptyDay()]
  })
  const [editingId, setEditingId] = useState(null)

  const fetchItineraries = async () => {
    try {
      const token = localStorage.getItem('token')
      const response = await fetch(API_BASE + '/operator/itineraries', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })
      const data = await response.json()
      if (data.itineraries) {
        setItineraries(data.itineraries)
      }
    } catch (error) {
      console.error('Error fetching itineraries:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchPackages = async () => {
    try {
      const token = localStorage.getItem('token')
      const response = await fetch(API_BASE + '/operator/packages', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })
      const data = await response.json()
      if (data.packages) {
        setPackages(data.packages)
      }
    } catch (error) {
      console.error('Error fetching packages:', error)
    }
  }

  useEffect(() => {
    Promise.resolve().then(() => {
      fetchItineraries()
      fetchPackages()
    })
  }, [])

  usePolling(fetchItineraries, 15000)

  const handleCreate = () => {
    setEditingId(null)
    setFormData({
      name: '',
      packageId: '',
      packageName: '',
      days: 1,
      dayDetails: [emptyDay()]
    })
    setShowModal(true)
  }

  const handleEdit = (itin) => {
    setEditingId(itin._id)
    setFormData({
      name: itin.name,
      packageId: itin.packageId || '',
      packageName: itin.packageName || '',
      days: itin.days || 1,
      dayDetails: (itin.dayDetails && itin.dayDetails.length > 0)
        ? itin.dayDetails.map(day => ({
            ...day,
            activities: Array.isArray(day.activities) ? day.activities.join(', ') : (day.activities || ''),
            meals: Array.isArray(day.meals) ? day.meals.join(', ') : (day.meals || '')
          }))
        : [emptyDay()]
    })
    setShowModal(true)
  }

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this itinerary?')) return
    try {
      const token = localStorage.getItem('token')
      const response = await fetch(`${API_BASE}/operator/itineraries/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })
      if (response.ok) {
        alert('Itinerary deleted successfully')
        fetchItineraries()
      } else {
        alert('Error deleting itinerary')
      }
    } catch (error) {
      console.error('Error deleting itinerary:', error)
      alert('Error deleting itinerary')
    }
  }

  const updateDay = (index, updates) => {
    setFormData(prev => ({
      ...prev,
      dayDetails: prev.dayDetails.map((day, i) => i === index ? { ...day, ...updates } : day)
    }))
  }

  const addDay = () => {
    setFormData(prev => ({
      ...prev,
      days: prev.days + 1,
      dayDetails: [...prev.dayDetails, emptyDay()]
    }))
  }

  const removeDay = (index) => {
    setFormData(prev => {
      const next = prev.dayDetails.filter((_, i) => i !== index)
      const renumbered = next.map((day, i) => ({ ...day, dayNumber: i + 1 }))
      return {
        ...prev,
        days: Math.max(1, prev.days - 1),
        dayDetails: renumbered
      }
    })
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    try {
      const token = localStorage.getItem('token')
      const payload = {
        ...formData,
        days: formData.dayDetails.length,
        dayDetails: formData.dayDetails.map(day => ({
          ...day,
          activities: day.activities.split(',').map(s => s.trim()).filter(Boolean),
          meals: day.meals.split(',').map(s => s.trim()).filter(Boolean)
        }))
      }
      const url = editingId
        ? `${API_BASE}/operator/itineraries/${editingId}`
        : API_BASE + '/operator/itineraries'
      const method = editingId ? 'PUT' : 'POST'
      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      })
      if (response.ok) {
        alert(editingId ? 'Itinerary updated successfully' : 'Itinerary created successfully')
        setShowModal(false)
        setEditingId(null)
        fetchItineraries()
      } else {
        alert(editingId ? 'Error updating itinerary' : 'Error creating itinerary')
      }
    } catch (error) {
      console.error('Error saving itinerary:', error)
      alert('Error saving itinerary')
    }
  }

  const filteredItineraries = itineraries.filter(itin => 
    itin.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    itin.packageName?.toLowerCase().includes(searchTerm.toLowerCase())
  )

  return (
    <>
          <div className="filters-section enhanced">
            <div className="search-bar enhanced">
              <Search className="search-icon" />
              <input
                type="text"
                placeholder="Search itineraries..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <button onClick={handleCreate} className="btn-primary enhanced">
              <Plus className="h-4 w-4" />
              Create Itinerary
            </button>
          </div>

          {loading ? (
            <div className="loading-state">Loading itineraries...</div>
          ) : filteredItineraries.length === 0 ? (
            <div className="empty-state">
              <Calendar className="h-12 w-12" />
              <h3>No itineraries found</h3>
              <p>Create itineraries for your packages</p>
            </div>
          ) : (
            <div className="itineraries-list enhanced">
              {filteredItineraries.map(itin => (
                <div key={itin._id} className="itinerary-card enhanced">
                  <div className="itinerary-header">
                    <h3>{itin.name}</h3>
                    <span className="days-badge">{itin.days} Days</span>
                  </div>
                  <div className="itinerary-package">
                    <Building className="h-4 w-4" />
                    <span>{itin.packageName}</span>
                  </div>
                  <div className="itinerary-actions">
                    <button onClick={() => handleEdit(itin)} className="icon-btn">
                      <Edit className="h-4 w-4" />
                    </button>
                    <button onClick={() => handleDelete(itin._id)} className="icon-btn delete">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
      {showModal && (
        <div className="modal-overlay">
          <div className="modal" style={{ maxWidth: '900px', width: '95%' }}>
              <div className="modal-header">
                <h3>{editingId ? 'Edit Itinerary' : 'Create Itinerary'}</h3>
                <button onClick={() => { setShowModal(false); setEditingId(null) }} className="modal-close">×</button>
              </div>
            <form onSubmit={handleSubmit} className="modal-body">
              <div className="form-group">
                <label>Itinerary Name</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                />
              </div>
              <div className="form-group">
                <label>Package</label>
                <select
                  value={formData.packageId}
                  onChange={(e) => {
                    const pkg = packages.find(p => p._id === e.target.value)
                    setFormData(prev => ({
                      ...prev,
                      packageId: e.target.value,
                      packageName: pkg?.name || ''
                    }))
                  }}
                  required
                >
                  <option value="">Select a package...</option>
                  {packages.map(pkg => (
                    <option key={pkg._id} value={pkg._id}>{pkg.name} - {pkg.destination}</option>
                  ))}
                </select>
              </div>

              <div className="form-section">
                <div className="section-header">
                  <h3>Day-by-Day Itinerary</h3>
                  <button type="button" onClick={addDay} className="btn-primary enhanced">
                    <Plus className="h-4 w-4" />
                    Add Day
                  </button>
                </div>

                {formData.dayDetails.map((day, index) => (
                  <div key={index} className="day-card enhanced">
                    <div className="day-header">
                      <h4>Day {day.dayNumber}</h4>
                      {formData.dayDetails.length > 1 && (
                        <button type="button" onClick={() => removeDay(index)} className="icon-btn delete">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                    <div className="form-grid">
                      <div className="form-group">
                        <label>Title</label>
                        <input
                          type="text"
                          value={day.title}
                          onChange={(e) => updateDay(index, { title: e.target.value })}
                          placeholder="e.g., Arrival in Delhi"
                          required
                        />
                      </div>
                      <div className="form-group">
                        <label>Date</label>
                        <input
                          type="date"
                          value={day.date}
                          onChange={(e) => updateDay(index, { date: e.target.value })}
                          required
                        />
                      </div>
                      <div className="form-group">
                        <label>Location</label>
                        <input
                          type="text"
                          value={day.location}
                          onChange={(e) => updateDay(index, { location: e.target.value })}
                          placeholder="e.g., Manali"
                        />
                      </div>
                      <div className="form-group">
                        <label>Accommodation</label>
                        <input
                          type="text"
                          value={day.accommodation}
                          onChange={(e) => updateDay(index, { accommodation: e.target.value })}
                          placeholder="e.g., Hotel雪山 View"
                        />
                      </div>
                      <div className="form-group">
                        <label>Transportation</label>
                        <input
                          type="text"
                          value={day.transportation}
                          onChange={(e) => updateDay(index, { transportation: e.target.value })}
                          placeholder="e.g., Private cab"
                        />
                      </div>
                      <div className="form-group full-width">
                        <label>Description</label>
                        <textarea
                          value={day.description}
                          onChange={(e) => updateDay(index, { description: e.target.value })}
                          rows={2}
                          placeholder="Describe the day's plan..."
                        />
                      </div>
                      <div className="form-group">
                        <label>Activities (comma-separated)</label>
                        <input
                          type="text"
                          value={day.activities}
                          onChange={(e) => updateDay(index, { activities: e.target.value })}
                          placeholder="e.g., Sightseeing, Trekking, Photography"
                        />
                      </div>
                      <div className="form-group">
                        <label>Meals (comma-separated)</label>
                        <input
                          type="text"
                          value={day.meals}
                          onChange={(e) => updateDay(index, { meals: e.target.value })}
                          placeholder="e.g., Breakfast, Lunch, Dinner"
                        />
                      </div>
                      <div className="form-group full-width">
                        <label>Notes</label>
                        <textarea
                          value={day.notes}
                          onChange={(e) => updateDay(index, { notes: e.target.value })}
                          rows={2}
                          placeholder="Special instructions or tips..."
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="form-actions">
                <button type="button" onClick={() => setShowModal(false)} className="btn-secondary">
                  Cancel
                </button>
                <button type="submit" className="btn-primary enhanced">
                  <Sparkles className="h-4 w-4" />
                  {editingId ? 'Update Itinerary' : 'Create Itinerary'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}

export default OperatorItineraries
