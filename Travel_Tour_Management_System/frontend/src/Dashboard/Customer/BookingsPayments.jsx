import { useState, useEffect, useRef } from 'react'
import { CreditCard, Search, Clock, CheckCircle, XCircle, AlertCircle, Download, Eye, Sparkles, Shield, Ticket, Calendar as CalendarIcon, Wallet, Zap, Users, MapPin, X, AlertTriangle, Calendar, Link as LinkIcon, QrCode, RefreshCcw } from 'lucide-react'
import { useSearchParams, useLocation, useNavigate } from 'react-router-dom'
import { Link } from 'react-router-dom'
import CustomerLayout from './CustomerLayout'
import { api, API_BASE, formatDate, readPagination } from '../../api'
import Pagination from '../../components/Pagination'
import '../Dashboard.css'

const AnimatedNumber = ({ value, prefix = '', suffix = '', decimals = 0 }) => {
  const [display, setDisplay] = useState(0)
  const displayRef = useRef(display)
  useEffect(() => {
    const start = displayRef.current
    const end = Number(value) || 0
    const duration = 700
    const startTime = Date.now()
    const tick = () => {
      const elapsed = Date.now() - startTime
      const t = Math.min(elapsed / duration, 1)
      const eased = 1 - Math.pow(1 - t, 3)
      const next = start + (end - start) * eased
      setDisplay(next)
      displayRef.current = next
      if (t < 1) requestAnimationFrame(tick)
    }
    const raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [value])
  return <>{prefix}{display.toFixed(decimals)}{suffix}</>
}

const BookingsPayments = () => {
  const [bookings, setBookings] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  const [filterStatus, setFilterStatus] = useState('all')
  const [selectedBooking, setSelectedBooking] = useState(null)
  const [showPaymentModal, setShowPaymentModal] = useState(false)
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
  const [availableCoupons, setAvailableCoupons] = useState([])
  const [couponsLoading, setCouponsLoading] = useState(false)
  const [searchParams] = useSearchParams()
  const location = useLocation()
  const navigate = useNavigate()
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(10)
  const [meta, setMeta] = useState({ page: 1, limit: 10, total: 0, totalPages: 1, hasNext: false, hasPrev: false })
  const [stats, setStats] = useState(null)
  const [showCancelModal, setShowCancelModal] = useState(false)
  const [cancelling, setCancelling] = useState(false)
  const [cancelBooking, setCancelBooking] = useState(null)
  const [cancelReason, setCancelReason] = useState('')
  const [cancelRefundInfo, setCancelRefundInfo] = useState(null)
  const [stripeCheckoutUrl, setStripeCheckoutUrl] = useState(null)
  const [stripeLoading, setStripeLoading] = useState(false)
  const [manualPaymentMethod, setManualPaymentMethod] = useState('upi')
  const [manualTransactionId, setManualTransactionId] = useState('')
  const [manualUpiId, setManualUpiId] = useState('')
  const [manualNotes, setManualNotes] = useState('')
  const [manualLoading, setManualLoading] = useState(false)
  const [manualError, setManualError] = useState('')
  const [manualSuccess, setManualSuccess] = useState('')
  const [qrDataUrl, setQrDataUrl] = useState(null)
  const [qrLoading, setQrLoading] = useState(false)
  const [upiDetails, setUpiDetails] = useState(null)
  const [paymentStatus, setPaymentStatus] = useState(null)
  const [checkingStatus, setCheckingStatus] = useState(false)

  // Fire-and-forget browsing signal for the recommendation engine.
  // Failures are swallowed on purpose — tracking must never break booking.
  const trackActivity = (payload) => {
    api('/customer/activity', { method: 'POST', body: JSON.stringify(payload) }).catch(() => {})
  }

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
    const handleCoupons = async () => {
      if (statePackage) {
        // Package details view — the booking modal is the package
        // details surface in this app, so opening it counts as a view.
        trackActivity({
          activityType: 'PACKAGE_VIEW',
          itemType: 'package',
          itemId: statePackage._id || statePackage.id,
          metadata: {
            destination: statePackage.destination,
            category: statePackage.category,
            price: Number(statePackage.price) || 0
          }
        })
        setBookingType('package')
        setForm(prev => ({
          ...prev,
          packageId: statePackage._id || statePackage.id || '',
          package: statePackage.name || '',
          amount: Number(statePackage.price) || 0
        }))
        setShowBookingModal(true)
        await fetchAvailableCoupons('package', statePackage._id || statePackage.id || '')
      } else if (stateHotel) {
        trackActivity({
          activityType: 'HOTEL_VIEW',
          itemType: 'hotel',
          itemId: stateHotel._id || stateHotel.id,
          metadata: { location: stateHotel.location }
        })
        setBookingType('hotel')
        setForm(prev => ({
          ...prev,
          hotelId: stateHotel._id || stateHotel.id || '',
          hotelName: stateHotel.name || '',
          amount: Number(stateHotel.minPrice || stateHotel.maxPrice) || 0
        }))
        setShowBookingModal(true)
        await fetchAvailableCoupons('hotel', '', stateHotel._id || stateHotel.id || '')
      } else if (packageId) {
        const pkg = packages.find(p => (p._id || p.id) === packageId)
        if (pkg) {
          trackActivity({
            activityType: 'PACKAGE_VIEW',
            itemType: 'package',
            itemId: pkg._id || pkg.id,
            metadata: {
              destination: pkg.destination,
              category: pkg.category,
              price: Number(pkg.price) || 0
            }
          })
          setBookingType('package')
          setForm(prev => ({
            ...prev,
            packageId: pkg._id || pkg.id || '',
            package: pkg.name || '',
            amount: Number(pkg.price) || 0
          }))
          setShowBookingModal(true)
          await fetchAvailableCoupons('package', pkg._id || pkg.id || '')
        }
      }
    }
    Promise.resolve().then(handleCoupons)
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
    setQrDataUrl(null)
    setUpiDetails(null)
    fetchQRPayment(booking)
  }

  // Redirect effect: when a Stripe checkout URL is ready, send the customer
  // to Stripe's hosted Checkout page (Sandbox mode).
  useEffect(() => {
    if (stripeCheckoutUrl) {
      window.location.href = stripeCheckoutUrl
    }
  }, [stripeCheckoutUrl])

  const createStripeCheckout = async () => {
    if (!selectedBooking) return
    setStripeLoading(true)
    setError('')
    try {
      const totalDue = (selectedBooking.finalAmount || selectedBooking.amount || 0) - (selectedBooking.paidAmount || 0)
      const data = await api(`/customer/bookings/${selectedBooking._id}/stripe-checkout`, {
        method: 'POST',
        body: JSON.stringify({ amount: totalDue })
      })
      if (data.checkoutUrl) {
        setStripeCheckoutUrl(data.checkoutUrl)
      } else {
        throw new Error(data.message || 'Failed to create checkout session')
      }
    } catch (err) {
      setError(err.message || 'Payment failed')
      setStripeLoading(false)
    }
  }

  const createManualPayment = async () => {
    if (!selectedBooking) return
    setManualLoading(true)
    setManualError('')
    setManualSuccess('')
    try {
      const totalDue = (selectedBooking.finalAmount || selectedBooking.amount || 0) - (selectedBooking.paidAmount || 0)
      const data = await api(`/customer/bookings/${selectedBooking._id}/manual-payment`, {
        method: 'POST',
        body: JSON.stringify({
          amount: totalDue,
          paymentMethod: manualPaymentMethod,
          transactionId: manualTransactionId.trim() || undefined,
          upiId: manualUpiId.trim() || undefined,
          notes: manualNotes.trim() || undefined
        })
      })
      if (data.paymentStatus === 'paid') {
        setManualSuccess('Payment recorded successfully! Your booking is now confirmed.')
        setShowPaymentModal(false)
        setTimeout(() => {
          setManualSuccess('')
          setManualPaymentMethod('upi')
          setManualTransactionId('')
          setManualUpiId('')
          setManualNotes('')
          fetchBookings({ page: 1 })
        }, 1500)
      } else {
        setManualSuccess(`Partial payment of ₹${(selectedBooking.paidAmount || 0).toLocaleString()} recorded.`)
      }
    } catch (err) {
      setManualError(err.message || 'Failed to record manual payment')
    } finally {
      setManualLoading(false)
    }
  }

  const fetchQRPayment = async (booking) => {
    if (!booking) return
    setQrLoading(true)
    setManualError('')
    setQrDataUrl(null)
    setUpiDetails(null)
    try {
      const totalDue = (booking.finalAmount || booking.amount || 0) - (booking.paidAmount || 0)
      if (totalDue <= 0) {
        setManualError('No remaining amount due for this booking.')
        setQrLoading(false)
        return
      }
      console.debug('[QR] Fetching QR for booking:', booking._id, 'amount due:', totalDue)
      const data = await api(`/customer/bookings/${booking._id}/qr-payment`, {
        method: 'GET'
      })
      console.debug('[QR] Response keys:', Object.keys(data || {}), 'has qrDataUrl:', Boolean(data?.qrDataUrl))
      setQrDataUrl(data.qrDataUrl || null)
      setUpiDetails({
        upiId: data.upiId,
        merchantName: data.merchantName,
        amount: data.amount,
        bookingReference: data.bookingReference,
        upiUrl: data.upiUrl
      })
    } catch (err) {
      console.error('[QR] Fetch failed:', err.status, err.message)
      setManualError(err.message || 'Failed to generate QR code.')
    } finally {
      setQrLoading(false)
    }
  }

  const checkPaymentStatus = async () => {
    if (!selectedBooking) return
    setCheckingStatus(true)
    try {
      const data = await api(`/customer/bookings/${selectedBooking._id}/payment-status`, {
        method: 'GET'
      })
      setPaymentStatus(data)
      if (data.paymentState === 'SUCCEEDED' || data.paymentStatus === 'paid') {
        setManualSuccess('Payment confirmed! Your booking is now verified.')
        setShowPaymentModal(false)
        setTimeout(() => {
          setManualSuccess('')
          fetchBookings({ page: 1 })
        }, 1500)
      } else if (data.paymentState === 'FAILED' || data.paymentState === 'EXPIRED' || data.paymentState === 'CANCELLED') {
        setManualError(`Payment ${data.paymentState.toLowerCase()}. Please retry.`)
      } else {
        setManualError(`Payment status: ${data.paymentState || 'PENDING'}. Awaiting verification.`)
      }
    } catch (err) {
      setManualError(err.message || 'Failed to check payment status')
    } finally {
      setCheckingStatus(false)
    }
  }

  const retryPayment = () => {
    setManualError('')
    setPaymentStatus(null)
    setQrDataUrl(null)
    setUpiDetails(null)
    fetchQRPayment()
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

  const fetchAvailableCoupons = async (type, pkgId, hotelId) => {
    if (type !== 'package') {
      setAvailableCoupons([])
      return
    }
    setCouponsLoading(true)
    try {
      const data = await api('/customer/coupons/available', {
        params: { bookingType: type, packageId: pkgId, hotelId }
      })
      if (data.success) {
        setAvailableCoupons(data.coupons || [])
      }
    } catch {
      setAvailableCoupons([])
    } finally {
      setCouponsLoading(false)
    }
  }

  const handleCancelBooking = async (booking) => {
    setCancelBooking(booking)
    setCancelReason('')
    setCancelRefundInfo(null)
    setShowCancelModal(true)
  }

  const confirmCancelBooking = async () => {
    if (!cancelBooking || cancelling) return
    setCancelling(true)
    try {
      const data = await api(`/customer/bookings/${cancelBooking._id}/cancel`, {
        method: 'POST',
        body: JSON.stringify({ reason: cancelReason })
      })
      if (data.success) {
        setShowCancelModal(false)
        setCancelBooking(null)
        setCancelReason('')
        await fetchBookings()
      }
    } catch (err) {
      alert(err.message || 'Failed to cancel booking')
    } finally {
      setCancelling(false)
    }
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

  const kpis = [
    { icon: Ticket, label: 'Total Bookings', value: totalCount, accent: 'var(--cp-accent)', sub: 'All time' },
    { icon: CheckCircle, label: 'Confirmed', value: bookings.filter(b => b.status === 'confirmed').length, accent: 'var(--cp-success)', sub: 'Active trips' },
    { icon: Wallet, label: 'Total Spent', value: totalSpent, prefix: '₹', accent: 'var(--cp-info)', sub: 'Lifetime spend' },
    { icon: AlertCircle, label: 'Pending Payment', value: pendingPayment, prefix: '₹', accent: 'var(--cp-warning)', sub: 'Awaiting payment' }
  ]

  // Render content based on state
  const renderContent = () => {
    if (loading) {
      return (
        <>
          <div className="cd-skeleton-grid">
            {[1,2,3,4].map(i => <div key={i} className="cd-skeleton-card" />)}
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
        </>
      )
    }
    if (bookings.length === 0) {
      return (
        <>
          <div className="cd-card cp-empty">
            <Calendar className="cp-empty-icon" size={48} />
            <h3>No bookings yet</h3>
            <p>Start your journey by browsing our curated packages.</p>
            <Link to="/customer/packages" className="btn-primary enhanced" style={{ display: 'inline-flex', marginTop: '1rem' }}>
              <Ticket className="h-4 w-4" /> Explore Packages
            </Link>
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
        </>
      )
    }
    return (
      <>
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
                  <span className={`status-badge ${booking.status}`}>
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
                      <span style={{ color: 'var(--cp-success)' }}>Coupon: {booking.coupon.code} (-₹{(booking.discountAmount || 0).toLocaleString()})</span>
                    )}
                    {booking.membershipDiscountPercentage && booking.membershipDiscountPercentage > 0 && (
                      <span style={{ color: 'var(--customer-primary-teal)', fontSize: '0.75rem' }}>Member: -{booking.membershipDiscountPercentage}%</span>
                    )}
                    <span>Paid: ₹{(booking.paidAmount || 0).toLocaleString()}</span>
                    <span>Total: ₹{(booking.finalAmount || booking.amount || 0).toLocaleString()}</span>
                  </div>
                </div>
                <div className={`payment-status-badge payment-status--${booking.paymentStatus}`}>
                  <CreditCard className="h-4 w-4" />
                  <span>{booking.paymentStatus}</span>
                </div>
              </div>

              <div className="booking-actions enhanced">
                <button className="icon-btn" onClick={() => handleViewDetails(booking)}>
                  <Eye className="h-4 w-4" />
                </button>
                <Link className="icon-btn" to={`/customer/bookings/${booking._id}/tracker`} title="Track">
                  <Clock className="h-4 w-4" />
                </Link>
                <button className="icon-btn" onClick={() => handleDownloadInvoice(booking)}>
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
                {booking.status !== 'cancelled' && booking.status !== 'completed' && (
                  <button
                    onClick={() => handleCancelBooking(booking)}
                    className="btn-danger enhanced"
                    style={{ background: 'var(--cp-danger)', borderColor: 'var(--cp-danger)' }}
                  >
                    <X className="h-4 w-4" /> Cancel
                  </button>
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
      </>
    )
  }

  return (
    <CustomerLayout active="bookings">
      <div className="page-head">
        <div className="page-head-row">
          <div>
            <h1>Bookings & payments</h1>
            <p>Manage reservations and remaining balances</p>
          </div>
          <div className="page-status-badges">
            <div className="stat-badge">
              <Sparkles className="h-4 w-4" />
              <span>{totalCount} bookings</span>
            </div>
            <div className="stat-badge">
              <Shield className="h-4 w-4" />
              <span>Secure payments</span>
            </div>
          </div>
        </div>
      </div>

      <div className="dashboard-page">
        {error && <div className="cd-card cd-alert warning" style={{ marginBottom: '1rem' }}>{error}</div>}

        <div className="cd-kpi-grid">
          {kpis.map((k, i) => {
            const Icon = k.icon
            return (
              <div key={i} className="cd-kpi" style={{ '--accent': k.accent }}>
                <div className="cd-kpi-head">
                  <div className="cd-kpi-icon"><Icon size={22} /></div>
                </div>
                <div className="cd-kpi-label">{k.label}</div>
                <p className="cd-kpi-value">
                  <AnimatedNumber value={k.value} prefix={k.prefix || ''} />
                </p>
                <div className="cd-kpi-sub">{k.sub}</div>
              </div>
            )
          })}
        </div>

        <div className="cd-card" style={{ marginBottom: '1.5rem' }}>
          <h3 style={{ margin: '0 0 1rem 0', color: 'var(--cp-ink)' }}>Create New Booking</h3>
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

        {renderContent()}

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
                  {selectedBooking.membershipDiscountPercentage && selectedBooking.membershipDiscountPercentage > 0 && (
                    <>
                      <div className="summary-row">
                        <span>Membership Plan</span>
                        <strong style={{ color: 'var(--customer-primary-teal)' }}>
                          {selectedBooking.membershipDiscountPercentage}% Member
                        </strong>
                      </div>
                      <div className="summary-row">
                        <span>Membership Discount</span>
                        <strong style={{ color: 'var(--customer-accent-emerald)' }}>-{selectedBooking.membershipDiscountPercentage}%</strong>
                      </div>
                    </>
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
                      <strong style={{ color: 'var(--customer-accent-emerald)' }}>-₹{(selectedBooking.discountAmount || 0).toLocaleString()}</strong>
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
                  {paymentStatus && (
                    <div className="summary-row">
                      <span>Payment Status</span>
                      <strong style={{ color: paymentStatus.paymentState === 'SUCCEEDED' || paymentStatus.paymentStatus === 'paid' ? 'var(--customer-accent-emerald)' : paymentStatus.paymentState === 'PENDING' ? 'var(--customer-primary-teal)' : 'var(--customer-text-secondary)' }}>
                        {paymentStatus.paymentState || paymentStatus.paymentStatus || '—'}
                      </strong>
                    </div>
                  )}
                </div>
              </div>
              <form className="payment-form enhanced" onSubmit={(e) => { e.preventDefault(); createStripeCheckout() }}>
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
                    {selectedBooking.membershipDiscountPercentage && selectedBooking.membershipDiscountPercentage > 0 && (
                      <>
                        <div className="summary-row">
                          <span>Membership Plan</span>
                          <strong style={{ color: 'var(--customer-primary-teal)' }}>
                            {selectedBooking.membershipDiscountPercentage}% Member
                          </strong>
                        </div>
                        <div className="summary-row">
                          <span>Membership Discount</span>
                          <strong style={{ color: 'var(--customer-accent-emerald)' }}>-{selectedBooking.membershipDiscountPercentage}%</strong>
                        </div>
                      </>
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
                        <strong style={{ color: 'var(--customer-accent-emerald)' }}>-₹{(selectedBooking.discountAmount || 0).toLocaleString()}</strong>
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
                  {paymentStatus && (
                    <div className="summary-row">
                      <span>Payment Status</span>
                      <strong style={{ color: paymentStatus.paymentState === 'SUCCEEDED' || paymentStatus.paymentStatus === 'paid' ? 'var(--customer-accent-emerald)' : paymentStatus.paymentState === 'PENDING' ? 'var(--customer-primary-teal)' : 'var(--customer-text-secondary)' }}>
                        {paymentStatus.paymentState || paymentStatus.paymentStatus || '—'}
                      </strong>
                    </div>
                  )}
                </div>
              </div>
                <div className="stripe-pay-section enhanced">
                  <button
                    type="submit"
                    className="btn-primary enhanced"
                    disabled={stripeLoading}
                    style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}
                  >
                    <CreditCard className="h-4 w-4" />
                    {stripeLoading ? 'Redirecting to Stripe...' : 'Pay with Stripe'}
                  </button>
                  <p className="stripe-notice">
                    You will be redirected to Stripe's secure checkout page (Sandbox mode) to complete the payment.
                  </p>
                </div>

                <div className="pay-divider enhanced">
                  <span>Or</span>
                </div>

                <div className="manual-pay-section enhanced">
                  <div className="manual-pay-header enhanced">
                    <Wallet className="h-5 w-5" style={{ color: 'var(--customer-primary-teal)' }} />
                    <div>
                      <h4 style={{ margin: 0, color: 'var(--customer-text-main)' }}>Pay via QR / Manual</h4>
                      <p style={{ margin: '0.125rem 0 0 0', color: 'var(--customer-text-secondary)', fontSize: '0.85rem' }}>UPI • QR • Bank Transfer</p>
                    </div>
                  </div>

                  {manualSuccess && (
                    <div className="cd-alert info" style={{ marginBottom: '0.75rem' }}>
                      <CheckCircle className="h-4 w-4" style={{ color: 'var(--customer-accent-emerald)', marginRight: '0.5rem' }} />
                      <span style={{ color: 'var(--customer-text-main)' }}>{manualSuccess}</span>
                    </div>
                  )}
                  {manualError && (
                    <div className="cd-alert warning" style={{ marginBottom: '0.75rem' }}>
                      <AlertCircle className="h-4 w-4" style={{ color: 'var(--customer-text-secondary)', marginRight: '0.5rem' }} />
                      <span style={{ color: 'var(--customer-text-main)' }}>{manualError}</span>
                    </div>
                  )}

                  <div className="manual-pay-methods enhanced">
                    <label className={`manual-pay-option${manualPaymentMethod === 'upi' ? ' active' : ''}`}>
                      <input
                        type="radio"
                        name="manualPaymentMethod"
                        value="upi"
                        checked={manualPaymentMethod === 'upi'}
                        onChange={(e) => setManualPaymentMethod(e.target.value)}
                      />
                      <div className="manual-pay-option-icon enhanced">
                        <Wallet className="h-4 w-4" style={{ color: 'var(--customer-accent-emerald)' }} />
                      </div>
                      <div>
                        <strong style={{ color: 'var(--customer-text-main)' }}>UPI Payment</strong>
                        <p style={{ margin: '0.125rem 0 0 0', fontSize: '0.75rem', color: 'var(--customer-text-secondary)' }}>Pay via UPI app</p>
                      </div>
                    </label>
                    <label className={`manual-pay-option${manualPaymentMethod === 'qr' ? ' active' : ''}`}>
                      <input
                        type="radio"
                        name="manualPaymentMethod"
                        value="qr"
                        checked={manualPaymentMethod === 'qr'}
                        onChange={(e) => setManualPaymentMethod(e.target.value)}
                      />
                      <div className="manual-pay-option-icon enhanced">
                        <QrCode className="h-4 w-4" style={{ color: 'var(--customer-primary-teal)' }} />
                      </div>
                      <div>
                        <strong style={{ color: 'var(--customer-text-main)' }}>QR Scan</strong>
                        <p style={{ margin: '0.125rem 0 0 0', fontSize: '0.75rem', color: 'var(--customer-text-secondary)' }}>Scan merchant QR</p>
                      </div>
                    </label>
                    <label className={`manual-pay-option${manualPaymentMethod === 'manual' ? ' active' : ''}`}>
                      <input
                        type="radio"
                        name="manualPaymentMethod"
                        value="manual"
                        checked={manualPaymentMethod === 'manual'}
                        onChange={(e) => setManualPaymentMethod(e.target.value)}
                      />
                      <div className="manual-pay-option-icon enhanced">
                        <CreditCard className="h-4 w-4" style={{ color: 'var(--customer-text-secondary)' }} />
                      </div>
                      <div>
                        <strong style={{ color: 'var(--customer-text-main)' }}>Manual / Other</strong>
                        <p style={{ margin: '0.125rem 0 0 0', fontSize: '0.75rem', color: 'var(--customer-text-secondary)' }}>Cash, card or bank</p>
                      </div>
                    </label>
                  </div>

                  {manualPaymentMethod === 'upi' && (
                    <div className="upi-card enhanced">
                      <div className="upi-card-head enhanced">
                        <Wallet className="h-4 w-4" style={{ color: 'var(--customer-accent-emerald)' }} />
                        <span style={{ color: 'var(--customer-text-main)', fontWeight: 600, marginLeft: '0.5rem' }}>Pay to Merchant</span>
                      </div>
                      <div className="upi-card-body enhanced">
                        <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--customer-text-secondary)', marginBottom: '0.375rem', fontWeight: 600 }}>Your UPI ID</label>
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                          <input
                            type="text"
                            value={manualUpiId}
                            onChange={(e) => setManualUpiId(e.target.value)}
                            placeholder="name@upi"
                            style={{ flex: 1, padding: '0.625rem 0.75rem', borderRadius: '0.5rem', border: '1px solid var(--customer-border)', background: 'var(--customer-card-bg)', color: 'var(--customer-text-main)' }}
                          />
                          <span style={{ fontSize: '0.8rem', color: 'var(--customer-text-secondary)', padding: '0.625rem 0', whiteSpace: 'nowrap' }}>@upi</span>
                        </div>
                        <p style={{ fontSize: '0.75rem', color: 'var(--customer-text-secondary)', marginTop: '0.5rem' }}>
                          Pay to: <strong style={{ color: 'var(--customer-primary-teal)' }}>{upiDetails?.upiId || 'merchant@upi'}</strong>
                        </p>
                      </div>
                    </div>
                  )}

                  {manualPaymentMethod === 'qr' && (
                    <div className="qr-card enhanced">
                      <div className="qr-card-head enhanced">
                        <QrCode className="h-4 w-4" style={{ color: 'var(--customer-primary-teal)' }} />
                        <span style={{ color: 'var(--customer-text-main)', fontWeight: 600, marginLeft: '0.5rem' }}>Scan to Pay</span>
                      </div>
                      <div className="qr-card-body enhanced">
                      {qrLoading ? (
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem', padding: '2rem', color: 'var(--customer-text-secondary)' }}>
                          <Clock className="h-5 w-5" style={{ animation: 'spin 1s linear infinite' }} />
                          <span>Generating QR code...</span>
                        </div>
                      ) : manualError && !qrDataUrl ? (
                        <div className="cd-alert warning" style={{ marginBottom: '0.75rem', textAlign: 'center' }}>
                          <AlertCircle className="h-4 w-4" style={{ color: 'var(--customer-text-secondary)', marginRight: '0.5rem' }} />
                          <span style={{ color: 'var(--customer-text-main)', fontSize: '0.85rem' }}>{manualError}</span>
                        </div>
                      ) : qrDataUrl ? (
                          <>
                            <img
                              src={qrDataUrl}
                              alt="UPI QR Code"
                              style={{ width: '160px', height: '160px', borderRadius: '1rem', background: '#ffffff', padding: '0.5rem', border: '1px solid var(--customer-border)', display: 'block', margin: '0 auto 0.75rem auto' }}
                            />
                            <p style={{ fontSize: '0.8rem', color: 'var(--customer-text-secondary)', marginBottom: '0.25rem', textAlign: 'center' }}>
                              UPI ID: <strong style={{ color: 'var(--customer-primary-teal)', wordBreak: 'break-all', display: 'block' }}>{upiDetails?.upiId || 'merchant@upi'}</strong>
                            </p>
                            <p style={{ fontSize: '0.8rem', color: 'var(--customer-text-secondary)', marginBottom: '0.25rem', textAlign: 'center' }}>
                              Amount: <strong style={{ color: 'var(--customer-primary-teal)' }}>₹{upiDetails?.amount?.toLocaleString() || 0}</strong>
                            </p>
                            <p style={{ fontSize: '0.75rem', color: 'var(--customer-text-secondary)', textAlign: 'center', marginBottom: 0 }}>
                              Ref: {upiDetails?.bookingReference || ''}
                            </p>
                          </>
                        ) : (
                          <div className="qr-placeholder enhanced" style={{ width: '140px', height: '140px', border: '2px dashed var(--customer-border)', borderRadius: '1rem', margin: '0 auto 0.75rem auto', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--customer-muted-bg)' }}>
                            <QrCode className="h-10 w-10" style={{ color: 'var(--customer-primary-teal)' }} />
                            <span style={{ display: 'block', marginTop: '0.625rem', fontSize: '0.7rem', color: 'var(--customer-text-secondary)' }}>Scan QR</span>
                          </div>
                        )}
                        <p style={{ fontSize: '0.8rem', color: 'var(--customer-text-secondary)', textAlign: 'center' }}>
                          Pay to: <strong style={{ color: 'var(--customer-primary-teal)' }}>{upiDetails?.merchantName || 'Travel Tour Merchant'}</strong>
                        </p>
                      </div>
                    </div>
                  )}

                  <div className="form-group enhanced">
                    <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--customer-text-secondary)', marginBottom: '0.375rem', fontWeight: 600 }}>Transaction Reference ID</label>
                    <input
                      type="text"
                      value={manualTransactionId}
                      onChange={(e) => setManualTransactionId(e.target.value)}
                      placeholder="Enter transaction/reference ID"
                      style={{ width: '100%', padding: '0.625rem 0.75rem', borderRadius: '0.5rem', border: '1px solid var(--customer-border)', background: 'var(--customer-card-bg)', color: 'var(--customer-text-main)' }}
                    />
                  </div>

                  <div className="form-group enhanced">
                    <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--customer-text-secondary)', marginBottom: '0.375rem', fontWeight: 600 }}>Notes</label>
                    <textarea
                      value={manualNotes}
                      onChange={(e) => setManualNotes(e.target.value)}
                      placeholder="Any payment notes (optional)"
                      rows={2}
                      style={{ width: '100%', padding: '0.625rem 0.75rem', borderRadius: '0.5rem', border: '1px solid var(--customer-border)', background: 'var(--customer-card-bg)', color: 'var(--customer-text-main)' }}
                    />
                  </div>

                  <button
                    type="button"
                    className="btn-primary enhanced"
                    disabled={manualLoading}
                    style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', marginTop: '0.25rem', background: 'linear-gradient(135deg, var(--customer-primary-teal) 0%, var(--customer-accent-emerald) 100%)', border: 'none', color: 'white' }}
                    onClick={createManualPayment}
                  >
                    {manualLoading ? <><Clock className="h-4 w-4" /> Recording...</> : <><Wallet className="h-4 w-4" /> Record Payment</>}
                  </button>
                  {paymentStatus && (
                    <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.75rem' }}>
                      <button
                        type="button"
                        disabled={checkingStatus}
                        className="btn-secondary enhanced"
                        style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}
                        onClick={checkPaymentStatus}
                      >
                        {checkingStatus ? <><Clock className="h-4 w-4" /> Checking...</> : <><RefreshCcw className="h-4 w-4" /> Check Status</>}
                      </button>
                      {(paymentStatus.paymentState === 'FAILED' || paymentStatus.paymentState === 'EXPIRED' || paymentStatus.paymentState === 'CANCELLED') && (
                        <button
                          type="button"
                          className="btn-primary enhanced"
                          style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', background: 'linear-gradient(135deg, var(--customer-primary-teal) 0%, var(--customer-accent-emerald) 100%)', border: 'none', color: 'white' }}
                          onClick={retryPayment}
                        >
                          <ArrowRight className="h-4 w-4" /> Retry Payment
                        </button>
                      )}
                    </div>
                  )}
                  <p className="stripe-notice" style={{ fontSize: '0.75rem', marginTop: '0.5rem', color: 'var(--customer-text-secondary)' }}>
                    Your payment will be verified manually. You will receive a confirmation once approved.
                  </p>
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
                <p style={{ margin: 0, color: 'var(--customer-text-secondary)' }}>{bookingType === 'package' ? 'Package Booking' : 'Hotel Booking'}</p>
                {form.amount > 0 && (
                  <div style={{ marginTop: '0.75rem' }}>
                    <p style={{ margin: '0 0 0.25rem 0', fontWeight: 700, color: 'var(--customer-text-main)' }}>Original Amount: ₹{form.amount.toLocaleString()}</p>
                    {appliedCoupon && discountAmount > 0 && (
                      <>
                        <p style={{ margin: '0 0 0.25rem 0', fontWeight: 600, color: 'var(--customer-accent-emerald)' }}>Discount ({appliedCoupon.code}): -₹{discountAmount.toLocaleString()}</p>
                        <p style={{ margin: '0 0 0.25rem 0', fontWeight: 700, color: 'var(--customer-text-main)', fontSize: '1.1rem' }}>Final Amount: ₹{finalAmount.toLocaleString()}</p>
                      </>
                    )}
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', alignItems: 'center' }}>
                {bookingType === 'package' && availableCoupons.length > 0 ? (
                  <>
                    <select
                      value={couponCode}
                      onChange={(e) => setCouponCode(e.target.value)}
                      style={{ flex: 1, padding: '0.5rem 0.75rem', border: '1px solid #e2e8f0', borderRadius: '0.5rem' }}
                      disabled={!!appliedCoupon || couponLoading || couponsLoading}
                    >
                      <option value="">Select a coupon</option>
                      {availableCoupons.map(c => (
                        <option key={c._id} value={c.code}>
                          {c.code} - {c.type === 'percentage' ? `${c.discount}%` : `₹${c.discount}`} off
                          {c.minPurchase && ` (Min ₹${c.minPurchase})`}
                          {c.maxDiscount && c.type === 'percentage' && ` (Max ₹${c.maxDiscount})`}
                        </option>
                      ))}
                    </select>
                    {!appliedCoupon ? (
                      <button type="button" onClick={applyCoupon} className="btn-primary" disabled={!couponCode.trim() || couponLoading}>
                        {couponLoading ? 'Applying...' : 'Apply'}
                      </button>
                    ) : (
                      <button type="button" onClick={removeCoupon} className="btn-secondary">Remove</button>
                    )}
                  </>
                ) : (
                  <>
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
                  </>
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

      {showCancelModal && cancelBooking && (
        <div className="modal-overlay">
          <div className="modal" style={{ maxWidth: '600px' }}>
            <div className="modal-header">
              <h3>Cancel Booking</h3>
              <button onClick={() => { setShowCancelModal(false); setCancelBooking(null); setCancelReason(''); setCancelRefundInfo(null); }} className="modal-close">×</button>
            </div>
            <div className="modal-body">
              <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '0.5rem', padding: '1rem', marginBottom: '1rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#dc2626', marginBottom: '0.5rem' }}>
                  <AlertTriangle className="h-5 w-5" />
                  <strong>Warning: This action cannot be undone</strong>
                </div>
                <p style={{ margin: 0, color: '#991b1b' }}>Cancelling this booking will change its status to "cancelled" and may result in a cancellation fee based on the package's cancellation policy.</p>
              </div>

              <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '0.5rem', padding: '1rem', marginBottom: '1rem' }}>
                <h4 style={{ margin: '0 0 1rem 0', color: '#0f172a' }}>Booking Details</h4>
                <div style={{ display: 'grid', gap: '0.5rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#64748b' }}>Package</span>
                    <strong>{cancelBooking.package}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#64748b' }}>Booking ID</span>
                    <strong>{cancelBooking.bookingId}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#64748b' }}>Travel Date</span>
                    <strong>{cancelBooking.dates}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#64748b' }}>Booking Amount</span>
                    <strong>₹{(cancelBooking.finalAmount || cancelBooking.amount || 0).toLocaleString()}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#64748b' }}>Amount Paid</span>
                    <strong>₹{(cancelBooking.paidAmount || 0).toLocaleString()}</strong>
                  </div>
                </div>
              </div>

              <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '0.5rem', padding: '1rem', marginBottom: '1rem' }}>
                <h4 style={{ margin: '0 0 1rem 0', color: '#166534' }}>Cancellation Policy & Refund Estimate</h4>
                <p style={{ margin: '0 0 1rem 0', color: '#166534', fontSize: '0.9rem' }}>
                  The refund is calculated based on the package's cancellation policy at the time of booking.
                </p>
                {cancelRefundInfo ? (
                  <div style={{ display: 'grid', gap: '0.5rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span>Days Before Trip</span>
                      <strong>{cancelRefundInfo.daysBeforeTrip} days</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span>Applicable Refund</span>
                      <strong>{cancelRefundInfo.refundPercentage}%</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid #bbf7d0', paddingTop: '0.5rem', marginTop: '0.5rem' }}>
                      <span>Estimated Refund Amount</span>
                      <strong style={{ color: '#16a34a' }}>₹{cancelRefundInfo.refundAmount.toLocaleString()}</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', color: '#dc2626' }}>
                      <span>Cancellation Fee</span>
                      <strong>₹{cancelRefundInfo.cancellationFee.toLocaleString()}</strong>
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={async () => {
                      try {
                        const data = await api(`/customer/bookings/${cancelBooking._id}/cancel`, {
                          method: 'POST',
                          body: JSON.stringify({ reason: '', preview: true })
                        })
                        if (data.success && data.refund) {
                          setCancelRefundInfo(data.refund)
                        } else if (!data.success) {
                          alert(data.message || 'Failed to calculate refund')
                        }
                      } catch (err) {
                        alert(err.message || 'Failed to calculate refund')
                      }
                    }}
                    className="btn-secondary"
                    disabled={cancelling}
                  >
                    Calculate Refund
                  </button>
                )}
              </div>

              <div className="form-group" style={{ marginBottom: '1rem' }}>
                <label>Cancellation Reason (optional)</label>
                <textarea
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  rows={3}
                  placeholder="Please let us know why you're cancelling..."
                  style={{ width: '100%', padding: '0.5rem 0.75rem', border: '1px solid #e2e8f0', borderRadius: '0.5rem' }}
                />
              </div>

              <div className="form-actions">
                <button type="button" onClick={() => { setShowCancelModal(false); setCancelBooking(null); setCancelReason(''); setCancelRefundInfo(null); }} className="btn-secondary enhanced" disabled={cancelling}>Keep Booking</button>
                <button type="button" onClick={confirmCancelBooking} className="btn-danger enhanced" disabled={cancelling}>
                  {cancelling ? 'Cancelling...' : 'Confirm Cancellation'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      </div>
    </CustomerLayout>
  )
}

export default BookingsPayments