import { useEffect, useState } from 'react'
import { MapPin, Plus, Pencil as Edit, Trash2, Search, Download, Star, DollarSign, Calendar, Users } from 'lucide-react'
import { api, downloadCsv, formValues, formatCurrency } from '../../api'
import AdminLayout from './AdminLayout'

const DestinationManagement = () => {
  const [packages, setPackages] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  const [filterStatus, setFilterStatus] = useState('all')
  const [showAddModal, setShowAddModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [selectedPackage, setSelectedPackage] = useState(null)

  const fetchPackages = async () => {
    try {
      setError('')
      const data = await api('/admin/packages')
      setPackages((data.packages || []).map((pkg) => ({
        id: pkg._id,
        name: pkg.name,
        destination: pkg.destination,
        duration: pkg.duration,
        price: pkg.price,
        rating: pkg.rating || 0,
        bookings: pkg.bookings || 0,
        status: pkg.status || 'active',
        publishedStatus: pkg.publishedStatus || 'published',
        description: pkg.description || '',
        inclusions: Array.isArray(pkg.inclusions) ? pkg.inclusions.join('\n') : (pkg.inclusions || ''),
        highlights: Array.isArray(pkg.highlights) ? pkg.highlights.join('\n') : (pkg.highlights || ''),
        image: pkg.image || '',
        category: pkg.category || '',
        shortDescription: pkg.shortDescription || ''
      })))
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    Promise.resolve().then(() => fetchPackages())
  }, [])

  const filteredPackages = packages.filter((pkg) => {
    const matchesSearch = pkg.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      pkg.destination.toLowerCase().includes(searchTerm.toLowerCase())
    return (filterStatus === 'all' || pkg.status === filterStatus) && matchesSearch
  })

  const payloadFromForm = (values) => ({
    name: values.name,
    destination: values.destination,
    duration: values.duration,
    price: Number(values.price),
    description: values.description,
    inclusions: (values.inclusions || '').split('\n').map((line) => line.trim()).filter(Boolean),
    highlights: (values.highlights || '').split('\n').map((line) => line.trim()).filter(Boolean),
    image: (values.image || '').trim(),
    category: values.category || '',
    shortDescription: values.shortDescription || '',
    publishedStatus: values.publishedStatus || 'published',
    status: values.status || 'active'
  })

  const handleAddPackage = async (e) => {
    e.preventDefault()
    try {
      await api('/admin/packages', { method: 'POST', body: JSON.stringify(payloadFromForm(formValues(e.target))) })
      setShowAddModal(false)
      fetchPackages()
    } catch (err) {
      alert(err.message)
    }
  }

  const handleUpdatePackage = async (e) => {
    e.preventDefault()
    try {
      await api(`/admin/packages/${selectedPackage.id}`, {
        method: 'PUT',
        body: JSON.stringify(payloadFromForm(formValues(e.target)))
      })
      setShowEditModal(false)
      fetchPackages()
    } catch (err) {
      alert(err.message)
    }
  }

  const handleDeletePackage = async (id) => {
    if (!window.confirm('Delete this package?')) return
    try {
      await api(`/admin/packages/${id}`, { method: 'DELETE' })
      setPackages(packages.filter((pkg) => pkg.id !== id))
    } catch (err) {
      alert(err.message)
    }
  }

  const handleToggleStatus = async (id) => {
    const pkg = packages.find((item) => item.id === id)
    const status = pkg.status === 'active' ? 'inactive' : 'active'
    try {
      await api(`/admin/packages/${id}`, { method: 'PUT', body: JSON.stringify({ status }) })
      setPackages(packages.map((item) => item.id === id ? { ...item, status } : item))
    } catch (err) {
      alert(err.message)
    }
  }

  return (
    <AdminLayout
      active="destinations"
      title="Destinations & Packages"
      actions={
        <>
          <button
            className="action-btn"
            onClick={() => downloadCsv('packages.csv', ['Name', 'Destination', 'Duration', 'Price', 'Bookings', 'Status'], filteredPackages.map((p) => [p.name, p.destination, p.duration, p.price, p.bookings, p.status]))}
          >
            <Download className="h-4 w-4" /> Export
          </button>
          <button onClick={() => { setSelectedPackage(null); setShowAddModal(true) }} className="action-btn"><Plus className="h-4 w-4" /> Add Package</button>
        </>
      }
    >
      {error && <div className="error-message">{error}</div>}
      <div className="filters-section">
        <div className="search-bar">
          <Search className="search-icon" />
          <input value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} placeholder="Search packages by name or destination..." />
        </div>
        <div className="filter-controls">
          <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="filter-select">
            <option value="all">All Status</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </div>
      </div>

      <div className="stats-grid">
        <div className="stat-card"><MapPin className="stat-icon" /><div className="stat-content"><h3>Total Packages</h3><p className="stat-number">{packages.length}</p></div></div>
        <div className="stat-card"><Users className="stat-icon" /><div className="stat-content"><h3>Total Bookings</h3><p className="stat-number">{packages.reduce((sum, pkg) => sum + pkg.bookings, 0)}</p></div></div>
        <div className="stat-card"><DollarSign className="stat-icon" /><div className="stat-content"><h3>Est. Revenue</h3><p className="stat-number">{formatCurrency(packages.reduce((sum, pkg) => sum + pkg.price * pkg.bookings, 0))}</p></div></div>
      </div>

      <div className="section-card full-width">
        <h3>Tour Packages ({filteredPackages.length})</h3>
        {loading ? <div style={{ textAlign: 'center', padding: '2rem' }}>Loading packages...</div> : (
          <div className="packages-grid">
            {filteredPackages.length === 0 ? <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '2rem' }}>No packages found</div> : filteredPackages.map((pkg) => (
              <div key={pkg.id} className="package-card">
                <div className="package-card-image-wrap">
                  {pkg.image ? (
                    <img
                      src={pkg.image}
                      alt={pkg.name}
                      className="package-card-image"
                      loading="lazy"
                      onError={(e) => {
                        e.currentTarget.style.display = 'none'
                        const fallback = e.currentTarget.nextElementSibling
                        if (fallback) fallback.style.display = 'flex'
                      }}
                    />
                  ) : null}
                  <div
                    className="package-card-image-fallback"
                    style={{ display: pkg.image ? 'none' : 'flex' }}
                  >
                    🌴
                  </div>
                </div>
                <div className="package-content">
                  <div className="package-header">
                    <h4>{pkg.name}</h4>
                    <span className={`status-badge ${pkg.status}`}>{pkg.status}</span>
                  </div>
                  <p className="package-destination"><MapPin className="h-4 w-4" />{pkg.destination}</p>
                  <p className="package-duration"><Calendar className="h-4 w-4" />{pkg.duration}</p>
                  <div className="package-stats">
                    <span className="package-rating"><Star className="h-4 w-4 fill" />{pkg.rating}</span>
                    <span className="package-bookings"><Users className="h-4 w-4" />{pkg.bookings} bookings</span>
                  </div>
                  <div className="package-footer">
                    <span className="package-price">₹{pkg.price.toLocaleString()}</span>
                    <div className="package-actions">
                      <button onClick={() => { setSelectedPackage(pkg); setShowEditModal(true) }} className="icon-btn edit"><Edit className="h-4 w-4" /></button>
                      <button onClick={() => handleToggleStatus(pkg.id)} className="icon-btn toggle">{pkg.status === 'active' ? '🔴' : '🟢'}</button>
                      <button onClick={() => handleDeletePackage(pkg.id)} className="icon-btn delete"><Trash2 className="h-4 w-4" /></button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {(showAddModal || (showEditModal && selectedPackage)) && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <h3>{showAddModal ? 'Add New Package' : 'Edit Package'}</h3>
              <button onClick={() => { setShowAddModal(false); setShowEditModal(false) }} className="modal-close">×</button>
            </div>
            <div className="modal-body">
              <form className="package-form" onSubmit={showAddModal ? handleAddPackage : handleUpdatePackage}>
                <div className="form-row">
                  <div className="form-group"><label>Package Name</label><input name="name" defaultValue={selectedPackage?.name} required /></div>
                  <div className="form-group"><label>Category</label><input name="category" defaultValue={selectedPackage?.category} placeholder="e.g., Beach, Adventure, Heritage" /></div>
                </div>
                <div className="form-group"><label>Destination</label><input name="destination" defaultValue={selectedPackage?.destination} required /></div>
                <div className="form-row">
                  <div className="form-group"><label>Duration</label><input name="duration" defaultValue={selectedPackage?.duration} placeholder="e.g., 5 Days 4 Nights" required /></div>
                  <div className="form-group"><label>Price (₹)</label><input name="price" type="number" defaultValue={selectedPackage?.price} required /></div>
                </div>
                <div className="form-group"><label>Cover Image URL</label><input name="image" type="url" defaultValue={selectedPackage?.image} placeholder="https://example.com/photo.jpg" /></div>
                <div className="form-group"><label>Short Description</label><input name="shortDescription" defaultValue={selectedPackage?.shortDescription} placeholder="One-line summary" /></div>
                <div className="form-group"><label>Description</label><textarea name="description" rows="4" defaultValue={selectedPackage?.description} required /></div>
                <div className="form-group"><label>Highlights (one per line)</label><textarea name="highlights" rows="3" defaultValue={selectedPackage?.highlights} /></div>
                <div className="form-group"><label>Inclusions (one per line)</label><textarea name="inclusions" rows="3" defaultValue={selectedPackage?.inclusions} required /></div>
                <div className="form-row">
                  <div className="form-group">
                    <label>Status</label>
                    <select name="status" defaultValue={selectedPackage?.status || 'active'}>
                      <option value="active">Active</option>
                      <option value="inactive">Inactive</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Publish</label>
                    <select name="publishedStatus" defaultValue={selectedPackage?.publishedStatus || 'published'}>
                      <option value="published">Published</option>
                      <option value="draft">Draft</option>
                      <option value="unpublished">Unpublished</option>
                    </select>
                  </div>
                </div>
                <div className="form-actions">
                  <button type="button" onClick={() => { setShowAddModal(false); setShowEditModal(false) }} className="btn-secondary">Cancel</button>
                  <button type="submit" className="btn-primary">{showAddModal ? 'Add Package' : 'Update Package'}</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  )
}

export default DestinationManagement
