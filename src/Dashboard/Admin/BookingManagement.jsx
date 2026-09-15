import { useEffect, useState } from 'react'
import { Ticket, Plus, Pencil as Edit, Trash2, Search, Download, DollarSign, Calendar, CreditCard, CheckCircle, Clock } from 'lucide-react'
import { api, downloadCsv, formValues, formatCurrency, formatDate } from '../../api'
import AdminLayout from './AdminLayout'

const BookingManagement = () => {
  const [bookings, setBookings] = useState([])
  const [packages, setPackages] = useState([])
  const [searchTerm, setSearchTerm] = useState('')
  const [filterStatus, setFilterStatus] = useState('all')
  const [filterPayment, setFilterPayment] = useState('all')
  const [showAddModal, setShowAddModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [selectedBooking, setSelectedBooking] = useState(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  const load = async () => {
    try {
      setError('')
      const [bookingData, packageData] = await Promise.all([api('/admin/bookings'), api('/admin/packages')])
      setBookings((bookingData.bookings || []).map((booking) => ({
        id: booking._id,
        customer: booking.customer,
        email: booking.email,
        package: booking.package,
        dates: booking.dates,
        amount: booking.amount,
        status: booking.status,
        paymentStatus: booking.paymentStatus,
        bookingDate: formatDate(booking.bookingDate)
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

  const filteredBookings = bookings.filter((booking) => {
    const haystack = `${booking.customer} ${booking.email} ${booking.package}`.toLowerCase()
    return haystack.includes(searchTerm.toLowerCase()) &&
      (filterStatus === 'all' || booking.status === filterStatus) &&
      (filterPayment === 'all' || booking.paymentStatus === filterPayment)
  })

  const updateBooking = async (id, payload) => {
    await api(`/admin/bookings/${id}`, { method: 'PUT', body: JSON.stringify(payload) })
    await load()
  }

  const handleDeleteBooking = async (id) => {
    if (!window.confirm('Delete this booking?')) return
    try {
      await api(`/admin/bookings/${id}`, { method: 'DELETE' })
      setBookings(bookings.filter((booking) => booking.id !== id))
    } catch (err) {
      alert(err.message)
    }
  }

  const payloadFromForm = (values) => ({
    customer: values.customer,
    email: values.email,
    package: values.package,
    dates: values.startDate && values.endDate ? `${values.startDate} to ${values.endDate}` : values.dates,
    amount: Number(values.amount),
    status: values.status || 'pending',
    paymentStatus: values.paymentStatus || 'pending'
  })

  const handleAddBooking = async (e) => {
    e.preventDefault()
    try {
      await api('/admin/bookings', { method: 'POST', body: JSON.stringify(payloadFromForm(formValues(e.target))) })
      setShowAddModal(false)
      load()
    } catch (err) {
      alert(err.message)
    }
  }

  const handleUpdateBooking = async (e) => {
    e.preventDefault()
    try {
      const values = formValues(e.target)
      await updateBooking(selectedBooking.id, {
        customer: values.customer,
        email: values.email,
        package: values.package,
        dates: values.dates,
        amount: Number(values.amount),
        status: values.status,
        paymentStatus: values.paymentStatus
      })
      setShowEditModal(false)
    } catch (err) {
      alert(err.message)
    }
  }

  const paidRevenue = bookings.filter((b) => b.paymentStatus === 'paid').reduce((sum, b) => sum + b.amount, 0)
  const pendingPayments = bookings.filter((b) => b.paymentStatus === 'pending').reduce((sum, b) => sum + b.amount, 0)

  return (
    <AdminLayout
      active="bookings"
      title="Bookings & Payments"
      actions={
        <>
          <button className="action-btn" onClick={() => downloadCsv('bookings.csv', ['Customer', 'Email', 'Package', 'Dates', 'Amount', 'Status', 'Payment', 'Booking Date'], filteredBookings.map((b) => [b.customer, b.email, b.package, b.dates, b.amount, b.status, b.paymentStatus, b.bookingDate]))}>
            <Download className="h-4 w-4" /> Export
          </button>
          <button className="action-btn" onClick={() => setShowAddModal(true)}><Plus className="h-4 w-4" /> Add Booking</button>
        </>
      }
    >
      {error && <div className="error-message">{error}</div>}
      <div className="filters-section">
        <div className="search-bar">
          <Search className="search-icon" />
          <input value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} placeholder="Search bookings by customer, email or package..." />
        </div>
        <div className="filter-controls">
          <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="filter-select">
            <option value="all">All Status</option>
            <option value="confirmed">Confirmed</option>
            <option value="pending">Pending</option>
            <option value="cancelled">Cancelled</option>
          </select>
          <select value={filterPayment} onChange={(e) => setFilterPayment(e.target.value)} className="filter-select">
            <option value="all">All Payment Status</option>
            <option value="paid">Paid</option>
            <option value="pending">Pending</option>
            <option value="refunded">Refunded</option>
          </select>
        </div>
      </div>

      <div className="stats-grid">
        <div className="stat-card"><Ticket className="stat-icon" /><div className="stat-content"><h3>Total Bookings</h3><p className="stat-number">{bookings.length}</p></div></div>
        <div className="stat-card"><CheckCircle className="stat-icon" /><div className="stat-content"><h3>Confirmed</h3><p className="stat-number">{bookings.filter((b) => b.status === 'confirmed').length}</p></div></div>
        <div className="stat-card"><Clock className="stat-icon" /><div className="stat-content"><h3>Pending</h3><p className="stat-number">{bookings.filter((b) => b.status === 'pending').length}</p></div></div>
        <div className="stat-card"><DollarSign className="stat-icon" /><div className="stat-content"><h3>Total Revenue</h3><p className="stat-number">{formatCurrency(paidRevenue)}</p></div></div>
        <div className="stat-card"><CreditCard className="stat-icon" /><div className="stat-content"><h3>Pending Payments</h3><p className="stat-number">{formatCurrency(pendingPayments)}</p></div></div>
      </div>

      <div className="section-card full-width">
        <h3>Bookings ({filteredBookings.length})</h3>
        {loading ? <div style={{ padding: '2rem', textAlign: 'center' }}>Loading bookings...</div> : (
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Customer</th><th>Email</th><th>Package</th><th>Dates</th><th>Amount</th><th>Status</th><th>Payment</th><th>Booking Date</th><th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredBookings.length === 0 ? <tr><td colSpan="9" style={{ textAlign: 'center', padding: '2rem' }}>No bookings found</td></tr> : filteredBookings.map((booking) => (
                  <tr key={booking.id}>
                    <td className="customer-name">{booking.customer}</td>
                    <td>{booking.email}</td>
                    <td>{booking.package}</td>
                    <td><Calendar className="h-4 w-4 inline-icon" />{booking.dates}</td>
                    <td>₹{booking.amount.toLocaleString()}</td>
                    <td><span className={`status-badge ${booking.status}`}>{booking.status}</span></td>
                    <td><span className={`payment-badge ${booking.paymentStatus}`}>{booking.paymentStatus}</span></td>
                    <td>{booking.bookingDate}</td>
                    <td>
                      <div className="action-buttons">
                        <button className="icon-btn edit" onClick={() => { setSelectedBooking(booking); setShowEditModal(true) }}><Edit className="h-4 w-4" /></button>
                        <select value={booking.status} className="status-select" onChange={(e) => updateBooking(booking.id, { status: e.target.value })}>
                          <option value="confirmed">Confirmed</option>
                          <option value="pending">Pending</option>
                          <option value="cancelled">Cancelled</option>
                        </select>
                        {booking.paymentStatus === 'pending' && (
                          <button className="icon-btn payment" title="Mark paid" onClick={() => updateBooking(booking.id, { paymentStatus: 'paid', status: 'confirmed' })}>
                            <CreditCard className="h-4 w-4" />
                          </button>
                        )}
                        {booking.paymentStatus === 'paid' && (
                          <button className="icon-btn refund" title="Refund" onClick={() => updateBooking(booking.id, { paymentStatus: 'refunded', status: 'cancelled' })}>
                            <DollarSign className="h-4 w-4" />
                          </button>
                        )}
                        <button className="icon-btn delete" onClick={() => handleDeleteBooking(booking.id)}><Trash2 className="h-4 w-4" /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showAddModal && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header"><h3>Add New Booking</h3><button className="modal-close" onClick={() => setShowAddModal(false)}>×</button></div>
            <div className="modal-body">
              <form className="booking-form" onSubmit={handleAddBooking}>
                <div className="form-group"><label>Customer Name</label><input name="customer" required /></div>
                <div className="form-group"><label>Email</label><input name="email" type="email" required /></div>
                <div className="form-group">
                  <label>Package</label>
                  <select name="package" required>
                    <option value="">Select Package</option>
                    {packages.map((pkg) => <option key={pkg._id} value={pkg.name}>{pkg.name}</option>)}
                  </select>
                </div>
                <div className="form-row">
                  <div className="form-group"><label>Start Date</label><input name="startDate" type="date" required /></div>
                  <div className="form-group"><label>End Date</label><input name="endDate" type="date" required /></div>
                </div>
                <div className="form-group"><label>Amount (₹)</label><input name="amount" type="number" required /></div>
                <div className="form-group">
                  <label>Payment Status</label>
                  <select name="paymentStatus" defaultValue="pending">
                    <option value="pending">Pending</option>
                    <option value="paid">Paid</option>
                  </select>
                </div>
                <div className="form-actions">
                  <button type="button" className="btn-secondary" onClick={() => setShowAddModal(false)}>Cancel</button>
                  <button type="submit" className="btn-primary">Add Booking</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {showEditModal && selectedBooking && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header"><h3>Edit Booking</h3><button className="modal-close" onClick={() => setShowEditModal(false)}>×</button></div>
            <div className="modal-body">
              <form className="booking-form" onSubmit={handleUpdateBooking}>
                <div className="form-group"><label>Customer Name</label><input name="customer" defaultValue={selectedBooking.customer} required /></div>
                <div className="form-group"><label>Email</label><input name="email" type="email" defaultValue={selectedBooking.email} required /></div>
                <div className="form-group">
                  <label>Package</label>
                  <select name="package" defaultValue={selectedBooking.package} required>
                    {packages.map((pkg) => <option key={pkg._id} value={pkg.name}>{pkg.name}</option>)}
                    {!packages.find((pkg) => pkg.name === selectedBooking.package) && <option value={selectedBooking.package}>{selectedBooking.package}</option>}
                  </select>
                </div>
                <div className="form-group"><label>Dates</label><input name="dates" defaultValue={selectedBooking.dates} required /></div>
                <div className="form-group"><label>Amount (₹)</label><input name="amount" type="number" defaultValue={selectedBooking.amount} required /></div>
                <div className="form-row">
                  <div className="form-group">
                    <label>Status</label>
                    <select name="status" defaultValue={selectedBooking.status}>
                      <option value="confirmed">Confirmed</option>
                      <option value="pending">Pending</option>
                      <option value="cancelled">Cancelled</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Payment</label>
                    <select name="paymentStatus" defaultValue={selectedBooking.paymentStatus}>
                      <option value="pending">Pending</option>
                      <option value="paid">Paid</option>
                      <option value="refunded">Refunded</option>
                    </select>
                  </div>
                </div>
                <div className="form-actions">
                  <button type="button" className="btn-secondary" onClick={() => setShowEditModal(false)}>Cancel</button>
                  <button type="submit" className="btn-primary">Update Booking</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  )
}

export default BookingManagement
