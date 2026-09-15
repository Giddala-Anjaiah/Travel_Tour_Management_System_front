import { API_BASE } from '../../api'
import { useState, useEffect } from 'react'
import usePolling from '../../hooks/usePolling'
import { Clock, Search, CheckCircle, XCircle, AlertCircle, Calendar, Users, DollarSign, Eye } from 'lucide-react'
import '../Dashboard.css'

const OperatorBookings = () => {
  const [bookings, setBookings] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [filterStatus, setFilterStatus] = useState('all')
  const [selectedBooking, setSelectedBooking] = useState(null)

  const fetchBookings = async () => {
    try {
      const token = localStorage.getItem('token')
      const response = await fetch(API_BASE + '/operator/bookings', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })
      const data = await response.json()
      if (data.bookings) {
        setBookings(data.bookings)
      }
    } catch (error) {
      console.error('Error fetching bookings:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    Promise.resolve().then(() => fetchBookings())
  }, [])

  usePolling(fetchBookings, 15000)

  const handleStatusUpdate = async (bookingId, newStatus) => {
    try {
      const token = localStorage.getItem('token')
      const response = await fetch(`${API_BASE}/operator/bookings/${bookingId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ status: newStatus })
      })
      if (response.ok) {
        alert('Booking status updated successfully')
        fetchBookings()
      } else {
        alert('Error updating booking status')
      }
    } catch (error) {
      console.error('Error updating booking:', error)
      alert('Error updating booking status')
    }
  }

  const filteredBookings = bookings.filter(booking => {
    const matchesSearch = booking.customer.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         booking.package.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesStatus = filterStatus === 'all' || booking.status === filterStatus
    return matchesSearch && matchesStatus
  })

  const getStatusBadge = (status) => {
    const badges = {
      pending: { icon: <AlertCircle className="h-4 w-4" />, label: 'Pending', color: '#f59e0b' },
      confirmed: { icon: <CheckCircle className="h-4 w-4" />, label: 'Confirmed', color: '#22c55e' },
      cancelled: { icon: <XCircle className="h-4 w-4" />, label: 'Cancelled', color: '#ef4444' },
      completed: { icon: <CheckCircle className="h-4 w-4" />, label: 'Completed', color: '#3b82f6' },
      rejected: { icon: <XCircle className="h-4 w-4" />, label: 'Rejected', color: '#ef4444' }
    }
    return badges[status] || badges.pending
  }

  const getPaymentStatusBadge = (status) => {
    const badges = {
      paid: { icon: <CheckCircle className="h-4 w-4" />, label: 'Paid', color: '#22c55e' },
      pending: { icon: <AlertCircle className="h-4 w-4" />, label: 'Pending', color: '#f59e0b' },
      partial: { icon: <AlertCircle className="h-4 w-4" />, label: 'Partial', color: '#6366f1' },
      refunded: { icon: <XCircle className="h-4 w-4" />, label: 'Refunded', color: '#ef4444' },
      failed: { icon: <XCircle className="h-4 w-4" />, label: 'Failed', color: '#ef4444' }
    }
    return badges[status] || badges.pending
  }

  return (
    <>
          <div className="filters-section enhanced">
            <div className="search-bar enhanced">
              <Search className="search-icon" />
              <input
                type="text"
                placeholder="Search bookings..."
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
                  <option value="pending">Pending</option>
                  <option value="confirmed">Confirmed</option>
                  <option value="cancelled">Cancelled</option>
                  <option value="completed">Completed</option>
                </select>
              </div>
            </div>
          </div>

          {loading ? (
            <div className="loading-state">Loading bookings...</div>
          ) : filteredBookings.length === 0 ? (
            <div className="empty-state">
              <Clock className="h-12 w-12" />
              <h3>No bookings found</h3>
              <p>Bookings will appear here when customers book your packages</p>
            </div>
          ) : (
            <div className="bookings-table enhanced">
              <div className="table-header">
                <span>Customer</span>
                <span>Package</span>
                <span>Travel Date</span>
                <span>Travelers</span>
                <span>Amount</span>
                <span>Status</span>
                <span>Payment</span>
                <span>Actions</span>
              </div>
              {filteredBookings.map(booking => (
                <div key={booking._id} className="table-row">
                  <div className="booking-customer">
                    <strong>{booking.customer}</strong>
                    <small>{booking.email}</small>
                  </div>
                  <div className="booking-package">{booking.package}</div>
                  <div className="booking-date">
                    <Calendar className="h-4 w-4" />
                    <span>{booking.dates}</span>
                  </div>
                  <div className="booking-travelers">
                    <Users className="h-4 w-4" />
                    <span>{booking.travelers || 1}</span>
                  </div>
                  <div className="booking-amount">
                    <DollarSign className="h-4 w-4" />
                    <strong>₹{booking.amount?.toLocaleString()}</strong>
                  </div>
                  <div className="booking-status" style={{ backgroundColor: getStatusBadge(booking.status).color }}>
                    {getStatusBadge(booking.status).icon}
                    <span>{getStatusBadge(booking.status).label}</span>
                  </div>
                  <div className="payment-status" style={{ backgroundColor: getPaymentStatusBadge(booking.paymentStatus).color }}>
                    {getPaymentStatusBadge(booking.paymentStatus).icon}
                    <span>{getPaymentStatusBadge(booking.paymentStatus).label}</span>
                  </div>
                  <div className="booking-actions">
                    <button onClick={() => setSelectedBooking(booking)} className="icon-btn">
                      <Eye className="h-4 w-4" />
                    </button>
                    {booking.status === 'pending' && (
                      <>
                        <button onClick={() => handleStatusUpdate(booking._id, 'confirmed')} className="icon-btn confirm">
                          <CheckCircle className="h-4 w-4" />
                        </button>
                        <button onClick={() => handleStatusUpdate(booking._id, 'rejected')} className="icon-btn reject">
                          <XCircle className="h-4 w-4" />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
      {selectedBooking && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <h3>Booking Details</h3>
              <button onClick={() => setSelectedBooking(null)} className="modal-close">×</button>
            </div>
            <div className="modal-body">
              <div className="booking-detail-section">
                <h4>Customer Information</h4>
                <div className="detail-row">
                  <span>Name:</span>
                  <strong>{selectedBooking.customer}</strong>
                </div>
                <div className="detail-row">
                  <span>Email:</span>
                  <strong>{selectedBooking.email}</strong>
                </div>
                <div className="detail-row">
                  <span>Phone:</span>
                  <strong>{selectedBooking.phone || 'N/A'}</strong>
                </div>
              </div>
              <div className="booking-detail-section">
                <h4>Package Information</h4>
                <div className="detail-row">
                  <span>Package:</span>
                  <strong>{selectedBooking.package}</strong>
                </div>
                <div className="detail-row">
                  <span>Travel Date:</span>
                  <strong>{selectedBooking.dates}</strong>
                </div>
                <div className="detail-row">
                  <span>Travelers:</span>
                  <strong>{selectedBooking.travelers || 1}</strong>
                </div>
              </div>
              <div className="booking-detail-section">
                <h4>Payment Information</h4>
                <div className="detail-row">
                  <span>Total Amount:</span>
                  <strong>₹{selectedBooking.amount?.toLocaleString()}</strong>
                </div>
                <div className="detail-row">
                  <span>Paid Amount:</span>
                  <strong>₹{selectedBooking.paidAmount?.toLocaleString() || 0}</strong>
                </div>
                <div className="detail-row">
                  <span>Status:</span>
                  <span className="status-badge" style={{ backgroundColor: getPaymentStatusBadge(selectedBooking.paymentStatus).color }}>
                    {getPaymentStatusBadge(selectedBooking.paymentStatus).label}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

export default OperatorBookings
