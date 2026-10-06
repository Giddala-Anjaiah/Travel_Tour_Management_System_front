import { useState, useEffect } from 'react'
import { CreditCard, Search, Clock, CheckCircle, XCircle, AlertCircle, Download, Eye, Sparkles, Shield, Ticket, Calendar as CalendarIcon, Wallet, Zap, Users, MapPin } from 'lucide-react'
import { useSearchParams, useLocation } from 'react-router-dom'
import CustomerLayout from './CustomerLayout'
import { api, formatDate, readPagination } from '../../api'
import Pagination from '../../components/Pagination'
import '../Dashboard.css'

const BookingsPayments = () => {
  const [bookings, setBookings] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  const [filterStatus, setFilterStatus] = useState('all')
  const [selectedBooking, setSelectedBooking] = useState(null)
  const [showPaymentModal, setShowPaymentModal] = useState(false)
  const [paying, setPaying] = useState(false)
  const [showBookingModal, setShowBookingModal] = useState(false)
  const [creating, setCreating] = useState(false)
  const [packages, setPackages] = useState([])
  const [, setHotels] = useState([])
  const [bookingType, setBookingType] = useState('package')
  const [form, setForm] = useState({
    packageId: '',
    package: '',
    hotelId: '',
    hotelName: '',
    dates: '',
    travelers: 1,
    amount: 0,
    customer: '',
    email: '',
    phone: ''
  })
  const [formError, setFormError] = useState('')
  const [couponCode, setCouponCode] = useState('')
  const [appliedCoupon, setAppliedCoupon] = useState(null)
  const [couponLoading, setCouponLoading] = useState(false)
  const [couponError, setCouponError] = useState('')
  const [couponSuccess, setCouponSuccess] = useState('')
  const [discountAmount, setDiscountAmount] = useState(0)
  const [finalAmount, setFinalAmount] = useState(0)
  const [searchParams] = useSearchParams()
  const location = useLocation()
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(10)
  const [meta, setMeta] = useState({ page: 1, limit: 10, total: 0, totalPages: 1, hasNext: false, hasPrev: false })
  const [stats, setStats] = useState(null)

  // `/customer/bookings` filters server-side on `search` only. Status is not
  // supported, so when it is active we load the full set and filter rows locally.
  const hasLocalFilters = filterStatus !== 'all'

  const fetchBookings = async (overrides = {}) => {
    const nextPage = overrides.page ?? page
    const nextLimit = overrides.limit ?? limit
    try {
      setError('')
      const data = await api('/customer/bookings', {
        params: {
          page: hasLocalFilters ? undefined : nextPage,
          limit: hasLocalFilters ? 'all' : nextLimit,
          search: searchTerm
        }
      })
      const rows = data.bookings || []
      setBookings(rows)
      const next = readPagination(data, rows.length)
      setMeta(next)
      if (data.stats) setStats(data.stats)
      if (!hasLocalFilters && next.totalPages > 0 && nextPage > next.totalPages) {
        setLoading(true)
        setPage(next.totalPages)
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  // Lookup sources for the booking modal and the deep link — always the full set.
  useEffect(() => {
    const load = async () => {
      const [packagesData, hotelsData] = await Promise.all([
        api('/packages', { params: { publishedOnly: 'true', limit: 'all' } }).catch(() => ({ packages: [] })),
        api('/public/hotels', { params: { limit: 'all' } }).catch(() => ({ hotels: [] }))
      ])
      setPackages(packagesData.packages || [])
      setHotels(hotelsData.hotels || [])
    }
    load()
  }, [])

  useEffect(() => {
    Promise.resolve().then(() => fetchBookings())
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, limit])

  useEffect(() => {
    const timer = setTimeout(() => {
      setPage(1)
      setLoading(true)
      fetchBookings({ page: 1 })
    }, 350)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchTerm, filterStatus])

  const handlePageChange = (nextPage) => {
    setPage(nextPage)
    setLoading(true)
  }

  const handleLimitChange = (nextLimit) => {
    setLimit(nextLimit)
    setPage(1)
    setLoading(true)
  }

  useEffect(() => {
    const packageId = searchParams.get('packageId')
    const statePackage = location.state?.package
    const stateHotel = location.state?.hotel
    Promise.resolve().then(() => {
      if (statePackage) {
        setBookingType('package')
        setForm(prev => ({
          ...prev,
          packageId: statePackage._id || statePackage.id || '',
          package: statePackage.name || '',
          amount: Number(statePackage.price) || 0
        }))
        setShowBookingModal(true)
      } else if (stateHotel) {
        setBookingType('hotel')
        setForm(prev => ({
          ...prev,
          hotelId: stateHotel._id || stateHotel.id || '',
          hotelName: stateHotel.name || '',
          amount: Number(stateHotel.minPrice || stateHotel.maxPrice) || 0
        }))
        setShowBookingModal(true)
      } else if (packageId) {
        const pkg = packages.find(p => (p._id || p.id) === packageId)
        if (pkg) {
          setBookingType('package')
          setForm(prev => ({
            ...prev,
            packageId: pkg._id || pkg.id || '',
            package: pkg.name || '',
            amount: Number(pkg.price) || 0
          }))
          setShowBookingModal(true)
        }
      }
    })
  }, [searchParams, location.state, packages])

  // `search` runs server-side (bookingId/customer/package/email); only the
  // unsupported status filter is resolved locally.
  const filteredBookings = bookings.filter(booking => {
    const matchesStatus = filterStatus === 'all' || booking.status === filterStatus
    return matchesStatus
  })

  const getStatusIcon = (status) => {
    switch(status) {
      case 'confirmed': return <CheckCircle className="h-4 w-4" />
      case 'completed': return <CheckCircle className="h-4 w-4" />
      case 'pending': return <AlertCircle className="h-4 w-4" />
      case 'cancelled': return <XCircle className="h-4 w-4" />
      case 'rejected': return <XCircle className="h-4 w-4" />
      default: return <Clock className="h-4 w-4" />
    }
  }

  const getStatusColor = (status) => {
    switch(status) {
      case 'confirmed': return '#22c55e'
      case 'completed': return '#22c55e'
      case 'pending': return '#f59e0b'
      case 'cancelled': return '#ef4444'
      case 'rejected': return '#ef4444'
      default: return '#64748b'
    }
  }

  const getPaymentStatusColor = (status) => {
    switch(status) {
      case 'paid': return '#22c55e'
      case 'partial': return '#f59e0b'
      default: return '#ef4444'
    }
  }

  const handlePayment = (booking) => {
    setSelectedBooking(booking)
    setShowPaymentModal(true)
  }

  const processPayment = async (e) => {
    e.preventDefault()
    if (!selectedBooking) return
    setPaying(true)
    try {
      const totalDue = selectedBooking.finalAmount || selectedBooking.amount
      const remaining = totalDue - (selectedBooking.paidAmount || 0)
      const data = await api(`/customer/bookings/${selectedBooking._id}/pay`, {
        method: 'PUT',
        body: JSON.stringify({ amount: remaining })
      })
      void data
      setShowPaymentModal(false)
      setSelectedBooking(null)
      await fetchBookings()
    } catch (err) {
      alert(err.message || 'Payment failed')
    } finally {
      setPaying(false)
    }
  }

  const getPaymentProgress = (paid, total) => {
    if (!total) return 0
    return Math.round((paid / total) * 100)
  }

  const applyCoupon = async () => {
    if (!couponCode.trim() || couponLoading) return
    setCouponLoading(true)
    setCouponError('')
    setCouponSuccess('')
    try {
      const payload = {
        code: couponCode.trim(),
        bookingType,
        amount: form.amount
      }
      if (bookingType === 'package' && form.packageId) {
        payload.packageId = form.packageId
      }
      if (bookingType === 'hotel' && form.hotelId) {
        payload.hotelId = form.hotelId
      }
      const data = await api('/customer/coupons/validate', {
        method: 'POST',
        body: JSON.stringify(payload)
      })
      if (data.success) {
        setAppliedCoupon(data.coupon)
        setDiscountAmount(data.discountAmount)
        setFinalAmount(data.finalAmount)
        setCouponSuccess(data.message)
      } else {
        setCouponError(data.message)
        setAppliedCoupon(null)
        setDiscountAmount(0)
        setFinalAmount(0)
      }
    } catch (err) {
      setCouponError(err.message || 'Failed to apply coupon')
      setAppliedCoupon(null)
      setDiscountAmount(0)
      setFinalAmount(0)
    } finally {
      setCouponLoading(false)
    }
  }

  const removeCoupon = () => {
    setCouponCode('')
    setAppliedCoupon(null)
    setCouponError('')
    setCouponSuccess('')
    setDiscountAmount(0)
    setFinalAmount(0)
  }

  const openBookingModal = (type) => {
    setBookingType(type)
    setCouponCode('')
    setAppliedCoupon(null)
    setCouponError('')
    setCouponSuccess('')
    setDiscountAmount(0)
    setFinalAmount(0)
    setForm({
      packageId: '',
      package: '',
      hotelId: '',
      hotelName: '',
      dates: '',
      travelers: 1,
      amount: 0,
      customer: '',
      email: '',
      phone: ''
    })
    setFormError('')
    setShowBookingModal(true)
  }

  const handleCreateBooking = async (e) => {
    e.preventDefault()
    setCreating(true)
    setFormError('')
    try {
      const payload = {
        package: form.package || form.hotelName,
        customer: form.customer,
        email: form.email,
        phone: form.phone,
        dates: form.dates,
        travelers: form.travelers,
        amount: form.amount
      }
      if (bookingType === 'package' && form.packageId) {
        payload.packageId = form.packageId
      }
      if (bookingType === 'hotel') {
        payload.hotelId = form.hotelId
        payload.hotelName = form.hotelName
      }
      if (appliedCoupon) {
        payload.coupon = {
          code: appliedCoupon.code,
          bookingType,
          packageId: bookingType === 'package' ? form.packageId : undefined,
          hotelId: bookingType === 'hotel' ? form.hotelId : undefined
        }
      }
      const data = await api('/customer/bookings', {
        method: 'POST',
        body: JSON.stringify(payload)
      })
      void data
      setShowBookingModal(false)
      setForm({
        packageId: '',
        package: '',
        hotelId: '',
        hotelName: '',
        dates: '',
        travelers: 1,
        amount: 0,
        customer: '',
        email: '',
        phone: ''
      })
      setCouponCode('')
      setAppliedCoupon(null)
      setCouponError('')
      setCouponSuccess('')
      setDiscountAmount(0)
      setFinalAmount(0)
    } catch (err) {
      setFormError(err.message || 'Failed to create booking')
    } finally {
      setCreating(false)
    }
  }

  const totalCount = stats?.total ?? meta.total
  const totalSpent = stats?.totalSpent ?? bookings.reduce((sum, b) => sum + (b.paidAmount || 0), 0)
  const pendingPayment = bookings.reduce((sum, b) => sum + ((b.amount || 0) - (b.paidAmount || 0)), 0)

  return (
    <CustomerLayout
      active="bookings"
      title="Bookings & payments"
      subtitle="Manage reservations and remaining balances"
      actions={
        <div className="header-stats">
          <div className="stat-badge">
            <Sparkles className="h-4 w-4" />
            <span>{totalCount} bookings</span>
          </div>
          <div className="stat-badge">
            <Shield className="h-4 w-4" />
            <span>Secure payments</span>
          </div>
        </div>
      }
    >
      {error && <div className="section-card"><p style={{ color: '#ef4444' }}>{error}</p></div>}

      <div className="stats-grid enhanced">
        <div className="stat-card enhanced">
          <Ticket className="stat-icon" />
          <div className="stat-content">
<h3>Total Bookings</h3>
          <p className="stat-number">{totalCount}</p>
          </div>
        </div>
        <div className="stat-card enhanced">
          <CheckCircle className="stat-icon" />
          <div className="stat-content">
            <h3>Confirmed</h3>
            <p className="stat-number">{bookings.filter(b => b.status === 'confirmed').length}</p>
          </div>
        </div>
        <div className="stat-card enhanced">
          <Wallet className="stat-icon" />
          <div className="stat-content">
            <h3>Total Spent</h3>
            <p className="stat-number">₹{totalSpent.toLocaleString()}</p>
          </div>
        </div>
        <div className="stat-card enhanced">
          <AlertCircle className="stat-icon" />
          <div className="stat-content">
            <h3>Pending Payment</h3>
            <p className="stat-number">₹{pendingPayment.toLocaleString()}</p>
          </div>
        </div>
      </div>

      <div className="section-card" style={{ marginBottom: '1.5rem' }}>
        <h3 style={{ margin: '0 0 1rem 0' }}>Create New Booking</h3>
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          <button onClick={() => openBookingModal('package')} className="btn-primary enhanced">
            <Ticket className="h-4 w-4" /> Book a Package
          </button>
          <button onClick={() => openBookingModal('hotel')} className="btn-secondary enhanced">
            <MapPin className="h-4 w-4" /> Book a Hotel
          </button>
        </div>
      </div>

      <div className="filters-section enhanced">
        <div className="search-bar enhanced">
          <Search className="search-icon" />
          <input
            type="text"
            placeholder="Search bookings, packages..."
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
              <option value="confirmed">Confirmed</option>
              <option value="pending">Pending</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>
        </div>
      </div>

      {loading && <div className="section-card"><p>Loading bookings...</p></div>}
      {!loading && bookings.length === 0 && (
        <div className="section-card">
          <p>You have no bookings yet. Browse packages to book your first trip.</p>
        </div>
      )}

      <div className="bookings-list enhanced">
        {filteredBookings.map(booking => (
          <div key={booking._id} className="booking-card enhanced">
            <div className="booking-header enhanced">
              <div className="booking-info">
                <h3>{booking.package}</h3>
                <div className="booking-id">
                  <Ticket className="h-4 w-4" />
                  <span>{booking.bookingId}</span>
                </div>
              </div>
              <div className="booking-badges">
                <span className={`status-badge ${booking.status}`} style={{ backgroundColor: getStatusColor(booking.status) }}>
                  {getStatusIcon(booking.status)}
                  {booking.status}
                </span>
              </div>
            </div>

            <div className="booking-details enhanced">
              <div className="detail-item">
                <CalendarIcon className="h-4 w-4" />
                <div>
                  <small>Travel Date</small>
                  <strong>{booking.dates || formatDate(booking.bookingDate)}</strong>
                </div>
              </div>
              <div className="detail-item">
                <Users className="h-4 w-4" />
                <div>
                  <small>Travelers</small>
                  <strong>{booking.travelers || 1}</strong>
                </div>
              </div>
            </div>

            <div className="booking-payment-section">
              <div className="payment-progress">
                <div className="progress-header">
                  <span>Payment Progress</span>
                  <span>{getPaymentProgress(booking.paidAmount || 0, booking.finalAmount || booking.amount || 0)}%</span>
                </div>
                <div className="progress-bar">
                  <div
                    className="progress-fill"
                    style={{
                      width: `${getPaymentProgress(booking.paidAmount || 0, booking.finalAmount || booking.amount || 0)}%`,
                      backgroundColor: getPaymentStatusColor(booking.paymentStatus)
                    }}
                  ></div>
                </div>
                <div className="payment-amounts">
                  {booking.coupon && (
                    <span style={{ color: '#22c55e' }}>Coupon: {booking.coupon.code} (-₹{(booking.discountAmount || 0).toLocaleString()})</span>
                  )}
                  <span>Paid: ₹{(booking.paidAmount || 0).toLocaleString()}</span>
                  <span>Total: ₹{(booking.finalAmount || booking.amount || 0).toLocaleString()}</span>
                </div>
              </div>
              <div className="payment-status-badge" style={{ color: getPaymentStatusColor(booking.paymentStatus) }}>
                <CreditCard className="h-4 w-4" />
                <span>{booking.paymentStatus}</span>
              </div>
            </div>

            <div className="booking-actions enhanced">
              <button className="icon-btn">
                <Eye className="h-4 w-4" />
              </button>
              <button className="icon-btn">
                <Download className="h-4 w-4" />
              </button>
              {booking.paymentStatus !== 'paid' && (
                <button
                  onClick={() => handlePayment(booking)}
                  className="btn-primary enhanced"
                >
                  <CreditCard className="h-4 w-4" /> Pay Now
                </button>
              )}
              {booking.paymentStatus === 'paid' && (
                <span className="fully-paid-badge">
                  <CheckCircle className="h-4 w-4" /> Fully Paid
                </span>
              )}
            </div>
          </div>
        ))}
      </div>

      <Pagination
        page={page}
        totalPages={meta.totalPages}
        total={hasLocalFilters ? filteredBookings.length : totalCount}
        limit={meta.limit}
        onPageChange={handlePageChange}
        onLimitChange={handleLimitChange}
        itemLabel="bookings"
        disabled={loading}
      />

      {showPaymentModal && selectedBooking && (
        <div className="modal-overlay">
          <div className="modal payment-modal">
            <div className="modal-header">
              <h3>Make Payment</h3>
              <button onClick={() => setShowPaymentModal(false)} className="modal-close">×</button>
            </div>
            <div className="modal-body">
              <div className="payment-summary enhanced">
                <div className="summary-header">
                  <h4>Booking Summary</h4>
                  <span className="booking-id-tag">{selectedBooking.bookingId}</span>
                </div>
                <div className="summary-details">
                  <div className="summary-row">
                    <span>Package</span>
                    <strong>{selectedBooking.package}</strong>
                  </div>
                  {selectedBooking.coupon && (
                    <div className="summary-row">
                      <span>Coupon</span>
                      <strong>{selectedBooking.coupon.code}</strong>
                    </div>
                  )}
                  {selectedBooking.originalAmount && selectedBooking.originalAmount !== selectedBooking.amount && (
                    <div className="summary-row">
                      <span>Original Amount</span>
                      <strong>₹{(selectedBooking.originalAmount || 0).toLocaleString()}</strong>
                    </div>
                  )}
                  <div className="summary-row">
                    <span>Total Amount</span>
                    <strong>₹{(selectedBooking.amount || 0).toLocaleString()}</strong>
                  </div>
                  {selectedBooking.discountAmount > 0 && (
                    <div className="summary-row">
                      <span>Discount</span>
                      <strong style={{ color: '#22c55e' }}>-₹{(selectedBooking.discountAmount || 0).toLocaleString()}</strong>
                    </div>
                  )}
                  <div className="summary-row">
                    <span>Amount Paid</span>
                    <strong>₹{(selectedBooking.paidAmount || 0).toLocaleString()}</strong>
                  </div>
                  <div className="summary-row highlight">
                    <span>Remaining Amount</span>
                    <strong>₹{((selectedBooking.finalAmount || selectedBooking.amount || 0) - (selectedBooking.paidAmount || 0)).toLocaleString()}</strong>
                  </div>
                </div>
              </div>
              <form className="payment-form enhanced" onSubmit={processPayment}>
                <div className="form-group">
                  <label>Card Number</label>
                  <input type="text" placeholder="1234 5678 9012 3456" required />
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>Expiry Date</label>
                    <input type="text" placeholder="MM/YY" required />
                  </div>
                  <div className="form-group">
                    <label>CVV</label>
                    <input type="text" placeholder="123" required />
                  </div>
                </div>
                <div className="form-group">
                  <label>Cardholder Name</label>
                  <input type="text" placeholder="Name on card" required />
                </div>
                <div className="payment-amount-display">
                  <span>Amount to Pay</span>
                  <strong>₹{((selectedBooking.finalAmount || selectedBooking.amount || 0) - (selectedBooking.paidAmount || 0)).toLocaleString()}</strong>
                </div>
                <div className="form-actions">
                  <button type="button" onClick={() => setShowPaymentModal(false)} className="btn-secondary">
                    Cancel
                  </button>
                  <button type="submit" className="btn-primary enhanced" disabled={paying}>
                    <Zap className="h-4 w-4" /> {paying ? 'Processing...' : 'Pay Securely'}
                  </button>
                </div>
                <div className="secure-payment-notice">
                  <Shield className="h-4 w-4" />
                  <span>Your payment is secured with 256-bit SSL encryption</span>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {showBookingModal && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <h3>{bookingType === 'package' ? 'Book Package' : 'Book Hotel'}</h3>
              <button onClick={() => { setShowBookingModal(false); removeCoupon() }} className="modal-close">×</button>
            </div>
            <div className="modal-body">
              {formError && <div className="cd-alert warning" style={{ marginBottom: '1rem' }}>{formError}</div>}
              <div className="booking-summary" style={{ padding: '1rem', background: '#f8fafc', borderRadius: '0.5rem', marginBottom: '1rem', border: '1px solid #e2e8f0' }}>
                <h4 style={{ margin: '0 0 0.5rem 0' }}>{bookingType === 'package' ? form.package : form.hotelName}</h4>
                <p style={{ margin: 0, color: '#64748b' }}>{bookingType === 'package' ? 'Package Booking' : 'Hotel Booking'}</p>
                {form.amount > 0 && (
                  <div style={{ marginTop: '0.75rem' }}>
                    <p style={{ margin: '0 0 0.25rem 0', fontWeight: 700, color: '#0f172a' }}>Original Amount: ₹{form.amount.toLocaleString()}</p>
                    {appliedCoupon && discountAmount > 0 && (
                      <>
                        <p style={{ margin: '0 0 0.25rem 0', fontWeight: 600, color: '#22c55e' }}>Discount ({appliedCoupon.code}): -₹{discountAmount.toLocaleString()}</p>
                        <p style={{ margin: '0 0 0.25rem 0', fontWeight: 700, color: '#0f172a', fontSize: '1.1rem' }}>Final Amount: ₹{finalAmount.toLocaleString()}</p>
                      </>
                    )}
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', alignItems: 'center' }}>
                <input
                  type="text"
                  placeholder="Enter coupon code"
                  value={couponCode}
                  onChange={(e) => setCouponCode(e.target.value)}
                  style={{ flex: 1, padding: '0.5rem 0.75rem', border: '1px solid #e2e8f0', borderRadius: '0.5rem' }}
                  disabled={!!appliedCoupon || couponLoading}
                />
                {!appliedCoupon ? (
                  <button type="button" onClick={applyCoupon} className="btn-primary" disabled={!couponCode.trim() || couponLoading}>
                    {couponLoading ? 'Applying...' : 'Apply'}
                  </button>
                ) : (
                  <button type="button" onClick={removeCoupon} className="btn-secondary">Remove</button>
                )}
              </div>
              {couponError && <div className="cd-alert warning" style={{ marginBottom: '1rem' }}>{couponError}</div>}
              {couponSuccess && <div className="cd-alert info" style={{ marginBottom: '1rem' }}>{couponSuccess}</div>}

              <form onSubmit={handleCreateBooking}>
                <div className="form-group">
                  <label>Full Name</label>
                  <input type="text" value={form.customer} onChange={(e) => setForm({...form, customer: e.target.value})} placeholder="Enter your full name" required />
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>Email</label>
                    <input type="email" value={form.email} onChange={(e) => setForm({...form, email: e.target.value})} placeholder="your@email.com" required />
                  </div>
                  <div className="form-group">
                    <label>Phone</label>
                    <input type="tel" value={form.phone} onChange={(e) => setForm({...form, phone: e.target.value})} placeholder="+91 98765 43210" required />
                  </div>
                </div>
                <div className="form-group">
                  <label>Travel/Check-in Date</label>
                  <input type="date" value={form.dates} onChange={(e) => setForm({...form, dates: e.target.value})} required />
                </div>
                <div className="form-group">
                  <label>Number of Travelers/Guests</label>
                  <input type="number" min="1" value={form.travelers} onChange={(e) => setForm({...form, travelers: parseInt(e.target.value) || 1})} required />
                </div>
                <div className="form-group">
                  <label>Total Amount (₹)</label>
                  <input type="number" min="0" value={form.amount} onChange={(e) => setForm({...form, amount: Number(e.target.value)})} required />
                </div>
                <div className="form-actions">
                  <button type="button" onClick={() => { setShowBookingModal(false); removeCoupon() }} className="btn-secondary" disabled={creating}>Cancel</button>
                  <button type="submit" className="btn-primary enhanced" disabled={creating}>
                    <Zap className="h-4 w-4" /> {creating ? 'Creating...' : 'Confirm Booking'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </CustomerLayout>
  )
}

export default BookingsPayments