import { API_BASE } from '../../api'
import { useState, useEffect } from 'react'
import usePolling from '../../hooks/usePolling'
import { MapPin, Calendar, Clock, Plus, Search, Pencil as Edit, Trash2, Star, CheckCircle, XCircle, Sparkles, Award, Image as ImageIcon } from 'lucide-react'
import '../Dashboard.css'

const OperatorPackages = () => {
  const [packages, setPackages] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [filterStatus, setFilterStatus] = useState('all')
  const [showModal, setShowModal] = useState(false)
  const [editingPackage, setEditingPackage] = useState(null)
  const [formData, setFormData] = useState({
    name: '',
    destination: '',
    duration: '',
    price: '',
    description: '',
    shortDescription: '',
    category: '',
    inclusions: '',
    highlights: '',
    exclusions: '',
    terms: '',
    cancellationPolicy: '',
    pickupInfo: '',
    startingLocation: '',
    transportType: '',
    minTravelers: 1,
    maxTravelers: 20,
    publishedStatus: 'draft',
    image: '',
    images: []
  })

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
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    Promise.resolve().then(() => fetchPackages())
  }, [])

  usePolling(fetchPackages, 15000)

  const handleCreate = () => {
    setEditingPackage(null)
    setFormData({
      name: '',
      destination: '',
      duration: '',
      price: '',
      description: '',
      shortDescription: '',
      category: '',
      inclusions: '',
      highlights: '',
      exclusions: '',
      terms: '',
      cancellationPolicy: '',
      pickupInfo: '',
      startingLocation: '',
      transportType: '',
      minTravelers: 1,
      maxTravelers: 20,
      publishedStatus: 'draft',
      image: '',
      images: []
    })
    setShowModal(true)
  }

  const handleEdit = (pkg) => {
    setEditingPackage(pkg)
    setFormData({
      name: pkg.name || '',
      destination: pkg.destination || '',
      duration: pkg.duration || '',
      price: pkg.price || '',
      description: pkg.description || '',
      shortDescription: pkg.shortDescription || '',
      category: pkg.category || '',
      inclusions: pkg.inclusions?.join(', ') || '',
      highlights: pkg.highlights?.join(', ') || '',
      exclusions: pkg.exclusions?.join(', ') || '',
      terms: pkg.terms || '',
      cancellationPolicy: pkg.cancellationPolicy || '',
      pickupInfo: pkg.pickupInfo || '',
      startingLocation: pkg.startingLocation || '',
      transportType: pkg.transportType || '',
      minTravelers: pkg.minTravelers || 1,
      maxTravelers: pkg.maxTravelers || 20,
      publishedStatus: pkg.publishedStatus || 'draft',
      image: pkg.image || '',
      images: pkg.images || []
    })
    setShowModal(true)
  }

  const handleDelete = async (id) => {
    if (window.confirm('Are you sure you want to delete this package?')) {
      try {
        const token = localStorage.getItem('token')
        const response = await fetch(`${API_BASE}/operator/packages/${id}`, {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${token}`
          }
        })
        if (response.ok) {
          alert('Package deleted successfully')
          fetchPackages()
        } else {
          alert('Error deleting package')
        }
      } catch (error) {
        console.error('Error deleting package:', error)
        alert('Error deleting package')
      }
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    try {
      const token = localStorage.getItem('token')
      const payload = {
        ...formData,
        price: parseFloat(formData.price),
        minTravelers: parseInt(formData.minTravelers),
        maxTravelers: parseInt(formData.maxTravelers),
        inclusions: formData.inclusions.split(',').map(i => i.trim()).filter(i => i),
        highlights: formData.highlights.split(',').map(h => h.trim()).filter(h => h),
        exclusions: formData.exclusions.split(',').map(e => e.trim()).filter(e => e)
      }

      const url = editingPackage 
        ? `${API_BASE}/operator/packages/${editingPackage._id}`
        : API_BASE + '/operator/packages'
      
      const method = editingPackage ? 'PUT' : 'POST'

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      })

      if (response.ok) {
        alert(editingPackage ? 'Package updated successfully' : 'Package created successfully')
        setShowModal(false)
        fetchPackages()
      } else {
        alert('Error saving package')
      }
    } catch (error) {
      console.error('Error saving package:', error)
      alert('Error saving package')
    }
  }

  const filteredPackages = packages.filter(pkg => {
    const matchesSearch = pkg.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         pkg.destination.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesStatus = filterStatus === 'all' || pkg.publishedStatus === filterStatus
    return matchesSearch && matchesStatus
  })

  const getStatusBadge = (status) => {
    const badges = {
      draft: { icon: <Clock className="h-4 w-4" />, label: 'Draft', color: '#64748b' },
      published: { icon: <CheckCircle className="h-4 w-4" />, label: 'Published', color: '#22c55e' },
      unpublished: { icon: <XCircle className="h-4 w-4" />, label: 'Unpublished', color: '#ef4444' }
    }
    return badges[status] || badges.draft
  }

  return (
    <>
      <div className="filters-section enhanced">
        <div className="search-bar enhanced">
          <Search className="search-icon" />
          <input
            type="text"
            placeholder="Search packages..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="filter-controls enhanced">
          <div className="filter-group">
            <label>Status</label>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="filter-select"
            >
              <option value="all">All Status</option>
              <option value="draft">Draft</option>
              <option value="published">Published</option>
              <option value="unpublished">Unpublished</option>
            </select>
          </div>
        </div>
        <button onClick={handleCreate} className="btn-primary enhanced">
          <Plus className="h-4 w-4" />
          Create Package
        </button>
      </div>

          {loading ? (
            <div className="loading-state">Loading packages...</div>
          ) : filteredPackages.length === 0 ? (
            <div className="empty-state">
              <Award className="h-12 w-12" />
              <h3>No packages found</h3>
              <p>Create your first package to get started</p>
              <button onClick={handleCreate} className="btn-primary enhanced">
                <Plus className="h-4 w-4" />
                Create Package
              </button>
            </div>
          ) : (
            <div className="packages-grid enhanced">
              {filteredPackages.map(pkg => (
                <div key={pkg._id} className="package-card enhanced">
                  <div className="package-image-wrapper">
                    {pkg.image ? (
                      <img src={pkg.image} alt={pkg.name} />
                    ) : (
                      <div className="package-placeholder">
                        <ImageIcon className="h-8 w-8" />
                      </div>
                    )}
                    <div className="package-status-badge" style={{ backgroundColor: getStatusBadge(pkg.publishedStatus).color }}>
                      {getStatusBadge(pkg.publishedStatus).icon}
                      <span>{getStatusBadge(pkg.publishedStatus).label}</span>
                    </div>
                  </div>
                  <div className="package-content enhanced">
                    <h3>{pkg.name}</h3>
                    <div className="package-meta">
                      <MapPin className="h-4 w-4" />
                      <span>{pkg.destination}</span>
                    </div>
                    <div className="package-meta">
                      <Calendar className="h-4 w-4" />
                      <span>{pkg.duration}</span>
                    </div>
                    <div className="package-rating">
                      <Star className="h-4 w-4 fill" />
                      <span>{pkg.rating || 0}</span>
                      <span>({pkg.bookings || 0} bookings)</span>
                    </div>
                    <div className="package-price">
                      <small>Starting from</small>
                      <strong>₹{pkg.price?.toLocaleString()}</strong>
                    </div>
                  </div>
                  <div className="package-actions enhanced">
                    <button onClick={() => handleEdit(pkg)} className="icon-btn">
                      <Edit className="h-4 w-4" />
                    </button>
                    <button onClick={() => handleDelete(pkg._id)} className="icon-btn delete">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

      {showModal && (
        <div className="modal-overlay">
          <div className="modal package-modal">
            <div className="modal-header">
              <h3>{editingPackage ? 'Edit Package' : 'Create Package'}</h3>
              <button onClick={() => setShowModal(false)} className="modal-close">×</button>
            </div>
            <form onSubmit={handleSubmit} className="modal-body">
              <div className="form-section">
                <h3>Basic Information</h3>
                <div className="form-grid">
                  <div className="form-group full-width">
                    <label>Package Name *</label>
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label>Destination *</label>
                    <input
                      type="text"
                      value={formData.destination}
                      onChange={(e) => setFormData({ ...formData, destination: e.target.value })}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label>Duration *</label>
                    <input
                      type="text"
                      value={formData.duration}
                      onChange={(e) => setFormData({ ...formData, duration: e.target.value })}
                      placeholder="e.g., 3 Days 2 Nights"
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label>Price (₹) *</label>
                    <input
                      type="number"
                      value={formData.price}
                      onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label>Category</label>
                    <input
                      type="text"
                      value={formData.category}
                      onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                      placeholder="e.g., Beach, Adventure, Nature"
                    />
                  </div>
                  <div className="form-group">
                    <label>Status</label>
                    <select
                      value={formData.publishedStatus}
                      onChange={(e) => setFormData({ ...formData, publishedStatus: e.target.value })}
                    >
                      <option value="draft">Draft</option>
                      <option value="published">Published</option>
                      <option value="unpublished">Unpublished</option>
                    </select>
                  </div>
                </div>
              </div>

              <div className="form-section">
                <h3>Description</h3>
                <div className="form-group full-width">
                  <label>Short Description</label>
                  <input
                    type="text"
                    value={formData.shortDescription}
                    onChange={(e) => setFormData({ ...formData, shortDescription: e.target.value })}
                    placeholder="Brief summary for listings"
                  />
                </div>
                <div className="form-group full-width">
                  <label>Full Description *</label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    rows={4}
                    required
                  />
                </div>
              </div>

              <div className="form-section">
                <h3>Package Details</h3>
                <div className="form-group full-width">
                  <label>Highlights (comma-separated)</label>
                  <input
                    type="text"
                    value={formData.highlights}
                    onChange={(e) => setFormData({ ...formData, highlights: e.target.value })}
                    placeholder="e.g., Beach Parties, Water Sports, Sunset Points"
                  />
                </div>
                <div className="form-group full-width">
                  <label>Inclusions (comma-separated)</label>
                  <input
                    type="text"
                    value={formData.inclusions}
                    onChange={(e) => setFormData({ ...formData, inclusions: e.target.value })}
                    placeholder="e.g., Accommodation, Meals, Transport, Guide"
                  />
                </div>
                <div className="form-group full-width">
                  <label>Exclusions (comma-separated)</label>
                  <input
                    type="text"
                    value={formData.exclusions}
                    onChange={(e) => setFormData({ ...formData, exclusions: e.target.value })}
                    placeholder="e.g., Personal expenses, Tips, Optional activities"
                  />
                </div>
              </div>

              <div className="form-section">
                <h3>Travel Information</h3>
                <div className="form-grid">
                  <div className="form-group">
                    <label>Starting Location</label>
                    <input
                      type="text"
                      value={formData.startingLocation}
                      onChange={(e) => setFormData({ ...formData, startingLocation: e.target.value })}
                    />
                  </div>
                  <div className="form-group">
                    <label>Transport Type</label>
                    <input
                      type="text"
                      value={formData.transportType}
                      onChange={(e) => setFormData({ ...formData, transportType: e.target.value })}
                      placeholder="e.g., Bus, Flight, Train"
                    />
                  </div>
                  <div className="form-group">
                    <label>Min Travelers</label>
                    <input
                      type="number"
                      value={formData.minTravelers}
                      onChange={(e) => setFormData({ ...formData, minTravelers: e.target.value })}
                      min="1"
                    />
                  </div>
                  <div className="form-group">
                    <label>Max Travelers</label>
                    <input
                      type="number"
                      value={formData.maxTravelers}
                      onChange={(e) => setFormData({ ...formData, maxTravelers: e.target.value })}
                      min="1"
                    />
                  </div>
                </div>
              </div>

              <div className="form-section">
                <h3>Policies</h3>
                <div className="form-group full-width">
                  <label>Cancellation Policy</label>
                  <textarea
                    value={formData.cancellationPolicy}
                    onChange={(e) => setFormData({ ...formData, cancellationPolicy: e.target.value })}
                    rows={3}
                  />
                </div>
                <div className="form-group full-width">
                  <label>Pickup Information</label>
                  <textarea
                    value={formData.pickupInfo}
                    onChange={(e) => setFormData({ ...formData, pickupInfo: e.target.value })}
                    rows={2}
                  />
                </div>
                <div className="form-group full-width">
                  <label>Terms & Conditions</label>
                  <textarea
                    value={formData.terms}
                    onChange={(e) => setFormData({ ...formData, terms: e.target.value })}
                    rows={3}
                  />
                </div>
              </div>

              <div className="form-section">
                <h3>Images</h3>
                <div className="form-group full-width">
                  <label>Primary Image URL</label>
                  <input
                    type="url"
                    value={formData.image}
                    onChange={(e) => setFormData({ ...formData, image: e.target.value })}
                    placeholder="https://example.com/image.jpg"
                  />
                </div>
              </div>

              <div className="form-actions">
                <button type="button" onClick={() => setShowModal(false)} className="btn-secondary">
                  Cancel
                </button>
                <button type="submit" className="btn-primary enhanced">
                  <Sparkles className="h-4 w-4" />
                  {editingPackage ? 'Update Package' : 'Create Package'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}

export default OperatorPackages
