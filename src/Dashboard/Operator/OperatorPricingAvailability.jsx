import { API_BASE } from '../../api'
import { useState, useEffect, useCallback } from 'react'
import usePolling from '../../hooks/usePolling'
import { Calendar, Plus, Pencil as Edit, Trash2, Save, Users, CheckCircle } from 'lucide-react'
import '../Dashboard.css'

const emptyPricing = () => ({
  basePrice: '',
  adultPrice: '',
  childPrice: '',
  infantPrice: '',
  singleOccupancyPrice: '',
  discount: 0,
  promotionalPrice: '',
  tax: 0,
  serviceFee: 0,
  validFrom: '',
  validUntil: ''
})

const emptyAvailability = () => ({
  startDate: '',
  endDate: '',
  totalSeats: 20,
  availableSeats: 20,
  bookingCutoffDate: '',
  minGroupSize: 1,
  maxGroupSize: 20,
  status: 'available'
})

const OperatorPricingAvailability = () => {
  const [pricing, setPricing] = useState(null)
  const [availability, setAvailability] = useState([])
  const [, setLoading] = useState(true)
  const [selectedPackageId, setSelectedPackageId] = useState('')
  const [packages, setPackages] = useState([])
  const [showPricingForm, setShowPricingForm] = useState(false)
  const [showAvailabilityForm, setShowAvailabilityForm] = useState(false)
  const [editingPricingId, setEditingPricingId] = useState(null)
  const [pricingForm, setPricingForm] = useState(emptyPricing())
  const [availabilityForm, setAvailabilityForm] = useState(emptyAvailability())

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

  const fetchPricing = useCallback(async () => {
    if (!selectedPackageId) return
    try {
      const token = localStorage.getItem('token')
      const response = await fetch(`${API_BASE}/operator/pricing/package/${selectedPackageId}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })
      const data = await response.json()
      if (data.pricing) {
        setPricing(data.pricing)
      } else {
        setPricing(null)
      }
    } catch (error) {
      console.error('Error fetching pricing:', error)
    }
  }, [selectedPackageId])

  const fetchAvailability = useCallback(async () => {
    if (!selectedPackageId) return
    try {
      const token = localStorage.getItem('token')
      const response = await fetch(`${API_BASE}/operator/availability/package/${selectedPackageId}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })
      const data = await response.json()
      if (data.availability) {
        setAvailability(data.availability)
      } else {
        setAvailability([])
      }
    } catch (error) {
      console.error('Error fetching availability:', error)
    } finally {
      setLoading(false)
    }
  }, [selectedPackageId])

  useEffect(() => {
    Promise.resolve().then(() => fetchPackages())
  }, [])

  useEffect(() => {
    Promise.resolve().then(() => {
      if (selectedPackageId) {
        fetchPricing()
        fetchAvailability()
      }
    })
  }, [selectedPackageId, fetchPricing, fetchAvailability])

  usePolling(() => {
    if (selectedPackageId) {
      fetchPricing()
      fetchAvailability()
    }
  }, 15000)

  const handlePricingSubmit = async (e) => {
    e.preventDefault()
    try {
      const token = localStorage.getItem('token')
      const payload = {
        ...pricingForm,
        packageId: selectedPackageId,
        basePrice: Number(pricingForm.basePrice),
        adultPrice: pricingForm.adultPrice ? Number(pricingForm.adultPrice) : undefined,
        childPrice: pricingForm.childPrice ? Number(pricingForm.childPrice) : undefined,
        infantPrice: pricingForm.infantPrice ? Number(pricingForm.infantPrice) : undefined,
        singleOccupancyPrice: pricingForm.singleOccupancyPrice ? Number(pricingForm.singleOccupancyPrice) : undefined,
        discount: Number(pricingForm.discount) || 0,
        promotionalPrice: pricingForm.promotionalPrice ? Number(pricingForm.promotionalPrice) : undefined,
        tax: Number(pricingForm.tax) || 0,
        serviceFee: Number(pricingForm.serviceFee) || 0,
        validFrom: pricingForm.validFrom || undefined,
        validUntil: pricingForm.validUntil || undefined
      }
      const url = editingPricingId
        ? `${API_BASE}/operator/pricing/${editingPricingId}`
        : API_BASE + '/operator/pricing'
      const method = editingPricingId ? 'PUT' : 'POST'
      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      })
      if (response.ok) {
        alert(editingPricingId ? 'Pricing updated successfully' : 'Pricing created successfully')
        setShowPricingForm(false)
        setEditingPricingId(null)
        setPricingForm(emptyPricing())
        fetchPricing()
      } else {
        alert('Error saving pricing')
      }
    } catch (error) {
      console.error('Error saving pricing:', error)
      alert('Error saving pricing')
    }
  }

  const handleAvailabilitySubmit = async (e) => {
    e.preventDefault()
    try {
      const token = localStorage.getItem('token')
      const payload = {
        ...availabilityForm,
        packageId: selectedPackageId,
        totalSeats: Number(availabilityForm.totalSeats),
        availableSeats: Number(availabilityForm.availableSeats),
        minGroupSize: Number(availabilityForm.minGroupSize),
        maxGroupSize: Number(availabilityForm.maxGroupSize),
        bookingCutoffDate: availabilityForm.bookingCutoffDate || undefined
      }
      const response = await fetch(API_BASE + '/operator/availability', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      })
      if (response.ok) {
        alert('Availability created successfully')
        setShowAvailabilityForm(false)
        setAvailabilityForm(emptyAvailability())
        fetchAvailability()
      } else {
        alert('Error creating availability')
      }
    } catch (error) {
      console.error('Error creating availability:', error)
      alert('Error creating availability')
    }
  }

  const handleDeleteAvailability = async (id) => {
    if (!window.confirm('Are you sure you want to delete this availability?')) return
    try {
      const token = localStorage.getItem('token')
      const response = await fetch(`${API_BASE}/operator/availability/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })
      if (response.ok) {
        alert('Availability deleted successfully')
        fetchAvailability()
      } else {
        alert('Error deleting availability')
      }
    } catch (error) {
      console.error('Error deleting availability:', error)
      alert('Error deleting availability')
    }
  }

  const startEditPricing = () => {
    if (!pricing) return
    setPricingForm({
      basePrice: pricing.basePrice || '',
      adultPrice: pricing.adultPrice || '',
      childPrice: pricing.childPrice || '',
      infantPrice: pricing.infantPrice || '',
      singleOccupancyPrice: pricing.singleOccupancyPrice || '',
      discount: pricing.discount || 0,
      promotionalPrice: pricing.promotionalPrice || '',
      tax: pricing.tax || 0,
      serviceFee: pricing.serviceFee || 0,
      validFrom: pricing.validFrom ? pricing.validFrom.split('T')[0] : '',
      validUntil: pricing.validUntil ? pricing.validUntil.split('T')[0] : ''
    })
    setEditingPricingId(pricing._id)
    setShowPricingForm(true)
  }

  return (
    <>
          <div className="section-card enhanced">
            <h3>Select Package</h3>
            <select
              value={selectedPackageId}
              onChange={(e) => setSelectedPackageId(e.target.value)}
              className="filter-select"
            >
              <option value="">Choose a package...</option>
              {packages.map(pkg => (
                <option key={pkg._id} value={pkg._id}>{pkg.name} - {pkg.destination}</option>
              ))}
            </select>
          </div>

          {selectedPackageId && (
            <>
              <div className="section-card enhanced">
                <div className="section-header">
                  <h3>Pricing Configuration</h3>
                  {pricing && !showPricingForm && (
                    <button onClick={startEditPricing} className="icon-btn">
                      <Edit className="h-4 w-4" />
                    </button>
                  )}
                </div>

                {showPricingForm ? (
                  <form onSubmit={handlePricingSubmit} className="modal-body">
                    <div className="form-grid">
                      <div className="form-group">
                        <label>Base Price (₹) *</label>
                        <input
                          type="number"
                          value={pricingForm.basePrice}
                          onChange={(e) => setPricingForm({ ...pricingForm, basePrice: e.target.value })}
                          required
                        />
                      </div>
                      <div className="form-group">
                        <label>Adult Price (₹)</label>
                        <input
                          type="number"
                          value={pricingForm.adultPrice}
                          onChange={(e) => setPricingForm({ ...pricingForm, adultPrice: e.target.value })}
                        />
                      </div>
                      <div className="form-group">
                        <label>Child Price (₹)</label>
                        <input
                          type="number"
                          value={pricingForm.childPrice}
                          onChange={(e) => setPricingForm({ ...pricingForm, childPrice: e.target.value })}
                        />
                      </div>
                      <div className="form-group">
                        <label>Infant Price (₹)</label>
                        <input
                          type="number"
                          value={pricingForm.infantPrice}
                          onChange={(e) => setPricingForm({ ...pricingForm, infantPrice: e.target.value })}
                        />
                      </div>
                      <div className="form-group">
                        <label>Single Occupancy (₹)</label>
                        <input
                          type="number"
                          value={pricingForm.singleOccupancyPrice}
                          onChange={(e) => setPricingForm({ ...pricingForm, singleOccupancyPrice: e.target.value })}
                        />
                      </div>
                      <div className="form-group">
                        <label>Discount (%)</label>
                        <input
                          type="number"
                          value={pricingForm.discount}
                          onChange={(e) => setPricingForm({ ...pricingForm, discount: e.target.value })}
                        />
                      </div>
                      <div className="form-group">
                        <label>Promotional Price (₹)</label>
                        <input
                          type="number"
                          value={pricingForm.promotionalPrice}
                          onChange={(e) => setPricingForm({ ...pricingForm, promotionalPrice: e.target.value })}
                        />
                      </div>
                      <div className="form-group">
                        <label>Tax (%)</label>
                        <input
                          type="number"
                          value={pricingForm.tax}
                          onChange={(e) => setPricingForm({ ...pricingForm, tax: e.target.value })}
                        />
                      </div>
                      <div className="form-group">
                        <label>Service Fee (₹)</label>
                        <input
                          type="number"
                          value={pricingForm.serviceFee}
                          onChange={(e) => setPricingForm({ ...pricingForm, serviceFee: e.target.value })}
                        />
                      </div>
                      <div className="form-group">
                        <label>Valid From</label>
                        <input
                          type="date"
                          value={pricingForm.validFrom}
                          onChange={(e) => setPricingForm({ ...pricingForm, validFrom: e.target.value })}
                        />
                      </div>
                      <div className="form-group">
                        <label>Valid Until</label>
                        <input
                          type="date"
                          value={pricingForm.validUntil}
                          onChange={(e) => setPricingForm({ ...pricingForm, validUntil: e.target.value })}
                        />
                      </div>
                    </div>
                    <div className="form-actions">
                      <button type="button" onClick={() => { setShowPricingForm(false); setEditingPricingId(null); setPricingForm(emptyPricing()) }} className="btn-secondary">
                        Cancel
                      </button>
                      <button type="submit" className="btn-primary enhanced">
                        <Save className="h-4 w-4" />
                        {editingPricingId ? 'Update Pricing' : 'Save Pricing'}
                      </button>
                    </div>
                  </form>
                ) : pricing ? (
                  <div className="pricing-details">
                    <div className="pricing-row">
                      <span>Base Price</span>
                      <strong>₹{pricing.basePrice?.toLocaleString()}</strong>
                    </div>
                    <div className="pricing-row">
                      <span>Adult Price</span>
                      <strong>₹{pricing.adultPrice?.toLocaleString()}</strong>
                    </div>
                    <div className="pricing-row">
                      <span>Child Price</span>
                      <strong>₹{pricing.childPrice?.toLocaleString()}</strong>
                    </div>
                    <div className="pricing-row">
                      <span>Discount</span>
                      <strong>{pricing.discount}%</strong>
                    </div>
                    <div className="pricing-row">
                      <span>Tax</span>
                      <strong>{pricing.tax}%</strong>
                    </div>
                    <div className="pricing-row">
                      <span>Service Fee</span>
                      <strong>₹{pricing.serviceFee?.toLocaleString()}</strong>
                    </div>
                    <div className="pricing-row">
                      <span>Valid From</span>
                      <strong>{pricing.validFrom ? new Date(pricing.validFrom).toLocaleDateString() : '—'}</strong>
                    </div>
                    <div className="pricing-row">
                      <span>Valid Until</span>
                      <strong>{pricing.validUntil ? new Date(pricing.validUntil).toLocaleDateString() : '—'}</strong>
                    </div>
                  </div>
                ) : (
                  <div className="empty-state">
                    <p>No pricing configured yet</p>
                    <button onClick={() => setShowPricingForm(true)} className="btn-primary enhanced">
                      <Plus className="h-4 w-4" />
                      Add Pricing
                    </button>
                  </div>
                )}
              </div>

              <div className="section-card enhanced">
                <div className="section-header">
                  <h3>Availability Calendar</h3>
                  <button onClick={() => setShowAvailabilityForm(true)} className="btn-primary enhanced">
                    <Plus className="h-4 w-4" />
                    Add Availability
                  </button>
                </div>

                {showAvailabilityForm && (
                  <form onSubmit={handleAvailabilitySubmit} className="modal-body" style={{ marginBottom: '1rem' }}>
                    <div className="form-grid">
                      <div className="form-group">
                        <label>Start Date *</label>
                        <input
                          type="date"
                          value={availabilityForm.startDate}
                          onChange={(e) => setAvailabilityForm({ ...availabilityForm, startDate: e.target.value })}
                          required
                        />
                      </div>
                      <div className="form-group">
                        <label>End Date *</label>
                        <input
                          type="date"
                          value={availabilityForm.endDate}
                          onChange={(e) => setAvailabilityForm({ ...availabilityForm, endDate: e.target.value })}
                          required
                        />
                      </div>
                      <div className="form-group">
                        <label>Total Seats *</label>
                        <input
                          type="number"
                          value={availabilityForm.totalSeats}
                          onChange={(e) => setAvailabilityForm({ ...availabilityForm, totalSeats: e.target.value })}
                          required
                        />
                      </div>
                      <div className="form-group">
                        <label>Available Seats *</label>
                        <input
                          type="number"
                          value={availabilityForm.availableSeats}
                          onChange={(e) => setAvailabilityForm({ ...availabilityForm, availableSeats: e.target.value })}
                          required
                        />
                      </div>
                      <div className="form-group">
                        <label>Booking Cutoff Date</label>
                        <input
                          type="date"
                          value={availabilityForm.bookingCutoffDate}
                          onChange={(e) => setAvailabilityForm({ ...availabilityForm, bookingCutoffDate: e.target.value })}
                        />
                      </div>
                      <div className="form-group">
                        <label>Min Group Size</label>
                        <input
                          type="number"
                          value={availabilityForm.minGroupSize}
                          onChange={(e) => setAvailabilityForm({ ...availabilityForm, minGroupSize: e.target.value })}
                        />
                      </div>
                      <div className="form-group">
                        <label>Max Group Size</label>
                        <input
                          type="number"
                          value={availabilityForm.maxGroupSize}
                          onChange={(e) => setAvailabilityForm({ ...availabilityForm, maxGroupSize: e.target.value })}
                        />
                      </div>
                      <div className="form-group">
                        <label>Status</label>
                        <select
                          value={availabilityForm.status}
                          onChange={(e) => setAvailabilityForm({ ...availabilityForm, status: e.target.value })}
                        >
                          <option value="available">Available</option>
                          <option value="limited">Limited</option>
                          <option value="full">Full</option>
                          <option value="closed">Closed</option>
                          <option value="past">Past</option>
                        </select>
                      </div>
                    </div>
                    <div className="form-actions">
                      <button type="button" onClick={() => setShowAvailabilityForm(false)} className="btn-secondary">
                        Cancel
                      </button>
                      <button type="submit" className="btn-primary enhanced">
                        <Save className="h-4 w-4" />
                        Save Availability
                      </button>
                    </div>
                  </form>
                )}

                {availability.length > 0 ? (
                  <div className="availability-list">
                    {availability.map((avail, index) => (
                      <div key={avail._id || index} className="availability-item">
                        <div className="availability-dates">
                          <Calendar className="h-4 w-4" />
                          <span>{new Date(avail.startDate).toLocaleDateString()} - {new Date(avail.endDate).toLocaleDateString()}</span>
                        </div>
                        <div className="availability-seats">
                          <Users className="h-4 w-4" />
                          <span>{avail.availableSeats} / {avail.totalSeats} available</span>
                        </div>
                        <div className={`availability-status ${avail.status}`}>
                          <CheckCircle className="h-4 w-4" />
                          <span>{avail.status}</span>
                        </div>
                        <button onClick={() => handleDeleteAvailability(avail._id)} className="icon-btn delete" title="Delete">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="empty-state">
                    <Calendar className="h-12 w-12" />
                    <h3>No availability configured</h3>
                    <p>Add availability dates for this package</p>
                  </div>
                )}
              </div>
            </>
          )}
      </>
  )
}

export default OperatorPricingAvailability
