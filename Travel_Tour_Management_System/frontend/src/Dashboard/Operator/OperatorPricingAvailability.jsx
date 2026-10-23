import { API_BASE } from '../../api'
import { useState, useEffect, useCallback, useMemo } from 'react'
import usePolling from '../../hooks/usePolling'
import { Calendar, Plus, Pencil as Edit, Trash2, Save, Users, Clock, DollarSign, Wallet, Link as LinkIcon } from 'lucide-react'
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

const statusConfig = {
  available: { label: 'Available', color: '#22c55e', bg: '#dcfce7' },
  limited: { label: 'Limited', color: '#f59e0b', bg: '#fef3c7' },
  full: { label: 'Full', color: '#ef4444', bg: '#fee2e2' },
  closed: { label: 'Closed', color: '#64748b', bg: '#e2e8f0' },
  past: { label: 'Past', color: '#94a3b8', bg: '#f1f5f9' }
}

const OperatorPricingAvailability = () => {
  const [pricing, setPricing] = useState(null)
  const [availability, setAvailability] = useState([])
  const [loading, setLoading] = useState(true)
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
        headers: { 'Authorization': `Bearer ${token}` }
      })
      const data = await response.json()
      if (data.packages) setPackages(data.packages)
    } catch (error) {
      console.error('Error fetching packages:', error)
    }
  }

  const fetchPricing = useCallback(async () => {
    if (!selectedPackageId) return
    try {
      const token = localStorage.getItem('token')
      const response = await fetch(`${API_BASE}/operator/pricing/package/${selectedPackageId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      const data = await response.json()
      setPricing(data.pricing || null)
    } catch (error) {
      console.error('Error fetching pricing:', error)
    }
  }, [selectedPackageId])

  const fetchAvailability = useCallback(async () => {
    if (!selectedPackageId) return
    try {
      const token = localStorage.getItem('token')
      const response = await fetch(`${API_BASE}/operator/availability/package/${selectedPackageId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      const data = await response.json()
      const rows = Array.isArray(data.availability) ? data.availability : []
      setAvailability(rows.sort((a, b) => new Date(a.startDate) - new Date(b.startDate)))
    } catch (error) {
      console.error('Error fetching availability:', error)
      setAvailability([])
    } finally {
      setLoading(false)
    }
  }, [selectedPackageId])

useEffect(() => { Promise.resolve().then(() => fetchPackages()) }, [])
useEffect(() => {
  if (!selectedPackageId) return
  const run = async () => {
    await fetchPricing()
    await fetchAvailability()
  }
  run()
}, [selectedPackageId, fetchPricing, fetchAvailability])
  usePolling(() => { if (selectedPackageId) { fetchPricing(); fetchAvailability() } }, 15000)

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
      const url = editingPricingId ? `${API_BASE}/operator/pricing/${editingPricingId}` : API_BASE + '/operator/pricing'
      const method = editingPricingId ? 'PUT' : 'POST'
      const response = await fetch(url, {
        method, headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify(payload)
      })
      if (response.ok) {
        alert(editingPricingId ? 'Pricing updated successfully' : 'Pricing created successfully')
        setShowPricingForm(false); setEditingPricingId(null); setPricingForm(emptyPricing())
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
        status: availabilityForm.status === 'closed' ? 'inactive' : 'active',
        totalSeats: Number(availabilityForm.totalSeats),
        availableSeats: Number(availabilityForm.availableSeats),
        minGroupSize: Number(availabilityForm.minGroupSize),
        maxGroupSize: Number(availabilityForm.maxGroupSize),
        bookingCutoffDate: availabilityForm.bookingCutoffDate || undefined
      }
      const response = await fetch(API_BASE + '/operator/availability', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify(payload)
      })
      if (response.ok) {
        alert('Availability created successfully')
        setShowAvailabilityForm(false); setAvailabilityForm(emptyAvailability())
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
        method: 'DELETE', headers: { 'Authorization': `Bearer ${token}` }
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

  // Computed effective price for display
  const effectivePrice = useMemo(() => {
    if (!pricing) return null
    const base = Number(pricing.basePrice || 0)
    const promo = Number(pricing.promotionalPrice || 0)
    const discount = Number(pricing.discount || 0)
    const tax = Number(pricing.tax || 0)
    const fee = Number(pricing.serviceFee || 0)
    let price = promo > 0 && promo < base ? promo : base
    price = price - (price * discount) / 100
    price = price + (price * tax) / 100 + fee
    return Math.max(0, Math.round(price * 100) / 100)
  }, [pricing])

  const statusInfo = (status) => statusConfig[status] || statusConfig.available

  return (
    <>
      <div className="section-card pricing-card enhanced">
        <h3>Select Package</h3>
        <div className="package-select-wrap">
          <select
            value={selectedPackageId}
            onChange={(e) => setSelectedPackageId(e.target.value)}
            className="filter-select package-select"
          >
            <option value="">Choose a package...</option>
            {packages.map(pkg => (
              <option key={pkg._id} value={pkg._id}>{pkg.name} - {pkg.destination}</option>
            ))}
          </select>
        </div>
      </div>

      {selectedPackageId && (
        <>
          <div className="pricing-availability-grid">
            {/* Pricing Card */}
            <div className="section-card pricing-section enhanced">
              <div className="section-header pricing-header">
                <div className="header-left">
                  <DollarSign className="h-5 w-5" />
                  <h3>Pricing Configuration</h3>
                </div>
                {pricing && !showPricingForm && (
                  <button onClick={startEditPricing} className="icon-btn edit-btn" title="Edit pricing">
                    <Edit className="h-4 w-4" />
                  </button>
                )}
              </div>

              {showPricingForm ? (
                <form onSubmit={handlePricingSubmit} className="pricing-form">
                  <div className="form-grid pricing-grid">
                    <div className="form-group wide">
                      <label>Base Price (₹)</label>
                      <div className="input-wrap"><span className="input-prefix">₹</span>
                        <input type="number" step="0.01" value={pricingForm.basePrice} onChange={(e) => setPricingForm({ ...pricingForm, basePrice: e.target.value })} required />
                      </div>
                    </div>
                    <div className="form-group">
                      <label>Adult Price (₹)</label>
                      <div className="input-wrap"><span className="input-prefix">₹</span>
                        <input type="number" step="0.01" value={pricingForm.adultPrice} onChange={(e) => setPricingForm({ ...pricingForm, adultPrice: e.target.value })} />
                      </div>
                    </div>
                    <div className="form-group">
                      <label>Child Price (₹)</label>
                      <div className="input-wrap"><span className="input-prefix">₹</span>
                        <input type="number" step="0.01" value={pricingForm.childPrice} onChange={(e) => setPricingForm({ ...pricingForm, childPrice: e.target.value })} />
                      </div>
                    </div>
                    <div className="form-group">
                      <label>Infant Price (₹)</label>
                      <div className="input-wrap"><span className="input-prefix">₹</span>
                        <input type="number" step="0.01" value={pricingForm.infantPrice} onChange={(e) => setPricingForm({ ...pricingForm, infantPrice: e.target.value })} />
                      </div>
                    </div>
                    <div className="form-group">
                      <label>Single Occupancy (₹)</label>
                      <div className="input-wrap"><span className="input-prefix">₹</span>
                        <input type="number" step="0.01" value={pricingForm.singleOccupancyPrice} onChange={(e) => setPricingForm({ ...pricingForm, singleOccupancyPrice: e.target.value })} />
                      </div>
                    </div>
                    <div className="form-group">
                      <label>Discount (%)</label>
                      <div className="input-wrap">
                        <input type="number" step="0.01" min="0" max="100" value={pricingForm.discount} onChange={(e) => setPricingForm({ ...pricingForm, discount: e.target.value })} />
                        <span className="input-suffix">%</span>
                      </div>
                    </div>
                    <div className="form-group">
                      <label>Promotional Price (₹)</label>
                      <div className="input-wrap"><span className="input-prefix">₹</span>
                        <input type="number" step="0.01" value={pricingForm.promotionalPrice} onChange={(e) => setPricingForm({ ...pricingForm, promotionalPrice: e.target.value })} />
                      </div>
                    </div>
                    <div className="form-group">
                      <label>Tax (%)</label>
                      <div className="input-wrap">
                        <input type="number" step="0.01" min="0" max="100" value={pricingForm.tax} onChange={(e) => setPricingForm({ ...pricingForm, tax: e.target.value })} />
                        <span className="input-suffix">%</span>
                      </div>
                    </div>
                    <div className="form-group">
                      <label>Service Fee (₹)</label>
                      <div className="input-wrap"><span className="input-prefix">₹</span>
                        <input type="number" step="0.01" value={pricingForm.serviceFee} onChange={(e) => setPricingForm({ ...pricingForm, serviceFee: e.target.value })} />
                      </div>
                    </div>
                    <div className="form-group">
                      <label>Valid From</label>
                      <input type="date" value={pricingForm.validFrom} onChange={(e) => setPricingForm({ ...pricingForm, validFrom: e.target.value })} />
                    </div>
                    <div className="form-group">
                      <label>Valid Until</label>
                      <input type="date" value={pricingForm.validUntil} onChange={(e) => setPricingForm({ ...pricingForm, validUntil: e.target.value })} />
                    </div>
                  </div>
                  <div className="form-actions pricing-actions">
                    <button type="button" onClick={() => { setShowPricingForm(false); setEditingPricingId(null); setPricingForm(emptyPricing()) }} className="btn-secondary">Cancel</button>
                    <button type="submit" className="btn-primary enhanced"><Save className="h-4 w-4" /> {editingPricingId ? 'Update Pricing' : 'Save Pricing'}</button>
                  </div>
                </form>
              ) : pricing ? (
                <div className="pricing-details">
                  <div className="effective-price-badge">
                    <span>Effective Price</span>
                    <strong>₹{effectivePrice?.toLocaleString()}</strong>
                  </div>
                  <div className="pricing-rows">
                    {pricing.basePrice && <div className="pricing-row"><span className="label">Base Price</span><span className="value">₹{Number(pricing.basePrice).toLocaleString()}</span></div>}
                    {pricing.adultPrice && <div className="pricing-row"><span className="label">Adult Price</span><span className="value">₹{Number(pricing.adultPrice).toLocaleString()}</span></div>}
                    {pricing.childPrice && <div className="pricing-row"><span className="label">Child Price</span><span className="value">₹{Number(pricing.childPrice).toLocaleString()}</span></div>}
                    {pricing.infantPrice && <div className="pricing-row"><span className="label">Infant Price</span><span className="value">₹{Number(pricing.infantPrice).toLocaleString()}</span></div>}
                    {pricing.singleOccupancyPrice && <div className="pricing-row"><span className="label">Single Occupancy</span><span className="value">₹{Number(pricing.singleOccupancyPrice).toLocaleString()}</span></div>}
                    {pricing.discount && <div className="pricing-row discount-row"><span className="label">Discount</span><span className="value discount">{pricing.discount}%</span></div>}
                    {pricing.promotionalPrice && <div className="pricing-row"><span className="label">Promotional Price</span><span className="value">₹{Number(pricing.promotionalPrice).toLocaleString()}</span></div>}
                    {pricing.tax && <div className="pricing-row"><span className="label">Tax</span><span className="value">{pricing.tax}%</span></div>}
                    {pricing.serviceFee && <div className="pricing-row"><span className="label">Service Fee</span><span className="value">₹{Number(pricing.serviceFee).toLocaleString()}</span></div>}
                    {pricing.validFrom && <div className="pricing-row"><span className="label">Valid From</span><span className="value">{new Date(pricing.validFrom).toLocaleDateString()}</span></div>}
                    {pricing.validUntil && <div className="pricing-row"><span className="label">Valid Until</span><span className="value">{new Date(pricing.validUntil).toLocaleDateString()}</span></div>}
                  </div>
                </div>
              ) : (
                <div className="empty-state pricing-empty">
                  <Wallet className="h-10 w-10" />
                  <h3>No pricing configured</h3>
                  <p>Set base price, discounts, tax and validity for this package.</p>
                  <button onClick={() => setShowPricingForm(true)} className="btn-primary enhanced"><Plus className="h-4 w-4" /> Add Pricing</button>
                </div>
              )}
            </div>

            {/* Availability Calendar */}
            <div className="section-card availability-section enhanced">
              <div className="section-header availability-header">
                <div className="header-left">
                  <Calendar className="h-5 w-5" />
                  <h3>Availability Calendar</h3>
                </div>
                <button onClick={() => setShowAvailabilityForm(true)} className="btn-primary enhanced add-btn"><Plus className="h-4 w-4" /> Add Availability</button>
              </div>

              {showAvailabilityForm && (
                <form onSubmit={handleAvailabilitySubmit} className="availability-form">
                  <div className="form-grid availability-grid">
                    <div className="form-group wide">
                      <label>Start Date *</label>
                      <input type="date" value={availabilityForm.startDate} onChange={(e) => setAvailabilityForm({ ...availabilityForm, startDate: e.target.value })} required />
                    </div>
                    <div className="form-group wide">
                      <label>End Date *</label>
                      <input type="date" value={availabilityForm.endDate} onChange={(e) => setAvailabilityForm({ ...availabilityForm, endDate: e.target.value })} required />
                    </div>
                    <div className="form-group">
                      <label>Total Seats *</label>
                      <input type="number" min="1" value={availabilityForm.totalSeats} onChange={(e) => setAvailabilityForm({ ...availabilityForm, totalSeats: e.target.value })} required />
                    </div>
                    <div className="form-group">
                      <label>Available Seats *</label>
                      <input type="number" min="0" value={availabilityForm.availableSeats} onChange={(e) => setAvailabilityForm({ ...availabilityForm, availableSeats: e.target.value })} required />
                    </div>
                    <div className="form-group">
                      <label>Booking Cutoff Date</label>
                      <input type="date" value={availabilityForm.bookingCutoffDate} onChange={(e) => setAvailabilityForm({ ...availabilityForm, bookingCutoffDate: e.target.value })} />
                    </div>
                    <div className="form-group">
                      <label>Min Group Size</label>
                      <input type="number" min="1" value={availabilityForm.minGroupSize} onChange={(e) => setAvailabilityForm({ ...availabilityForm, minGroupSize: e.target.value })} />
                    </div>
                    <div className="form-group">
                      <label>Max Group Size</label>
                      <input type="number" min="1" value={availabilityForm.maxGroupSize} onChange={(e) => setAvailabilityForm({ ...availabilityForm, maxGroupSize: e.target.value })} />
                    </div>
                    <div className="form-group">
                      <label>Status</label>
                      <select value={availabilityForm.status} onChange={(e) => setAvailabilityForm({ ...availabilityForm, status: e.target.value })}>
                        <option value="available">Available</option>
                        <option value="limited">Limited</option>
                        <option value="full">Full</option>
                        <option value="closed">Closed</option>
                        <option value="past">Past</option>
                      </select>
                    </div>
                  </div>
                  <div className="form-actions availability-actions">
                    <button type="button" onClick={() => setShowAvailabilityForm(false)} className="btn-secondary">Cancel</button>
                    <button type="submit" className="btn-primary enhanced"><Save className="h-4 w-4" /> Save Availability</button>
                  </div>
                </form>
              )}

              {loading ? (
                <div className="empty-state"><Clock className="h-10 w-10" /><h3>Loading availability...</h3></div>
              ) : availability.length > 0 ? (
                <div className="calendar-grid">
                  {availability.map((avail) => {
                    const info = statusInfo(avail.status)
                    const start = new Date(avail.startDate)
                    const end = new Date(avail.endDate)
                    const pct = avail.totalSeats ? Math.round(((avail.totalSeats - avail.availableSeats) / avail.totalSeats) * 100) : 0
                    return (
                      <div key={avail._id} className={`calendar-day avail-card ${avail.status}`}>
                        <div className="day-header">
                          <div className="day-range">
                            <span className="day-start">{start.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span>
                            {start.getTime() !== end.getTime() && <span className="day-sep"> to </span>}
                            {start.getTime() !== end.getTime() && <span className="day-end">{end.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span>}
                          </div>
                          <span className={`status-badge ${avail.status}`} style={{ backgroundColor: info.bg, color: info.color }}>
                            {info.label}
                          </span>
                        </div>
                        <div className="day-body">
                          <div className="seats-row">
                            <Users className="h-4 w-4" />
                            <span>{avail.availableSeats} / {avail.totalSeats} seats</span>
                          </div>
                          <div className="seats-row">
                            <Clock className="h-4 w-4" />
                            <span>{avail.minGroupSize} - {avail.maxGroupSize} group size</span>
                          </div>
                          {avail.bookingCutoffDate && (
                            <div className="seats-row cutoff-row">
                              <LinkIcon className="h-4 w-4" />
                              <span>Cutoff: {new Date(avail.bookingCutoffDate).toLocaleDateString()}</span>
                            </div>
                          )}
                          <div className="occupancy-bar">
                            <div className="occupancy-track"><div className={`occupancy-fill ${avail.status}`} style={{ width: `${pct}%` }} /></div>
                            <span className="occupancy-pct">{pct}% booked</span>
                          </div>
                        </div>
                        <div className="day-actions">
                          <button onClick={() => handleDeleteAvailability(avail._id)} className="icon-btn delete-btn" title="Delete"><Trash2 className="h-4 w-4" /></button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              ) : (
                <div className="empty-state availability-empty">
                  <Calendar className="h-10 w-10" />
                  <h3>No availability configured</h3>
                  <p>Add date ranges and seat inventory for this package.</p>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </>
  )
}

export default OperatorPricingAvailability
