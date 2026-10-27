import { useEffect, useState } from 'react'
import { Ticket, Plus, Pencil as Edit, Trash2, Search, Download, DollarSign, Calendar, CreditCard, CheckCircle, Clock } from 'lucide-react'
import { api, downloadCsv, fetchAllPages, formValues, formatCurrency, formatDate, readPagination } from '../../api'
import Pagination from '../../components/Pagination'
import AdminLayout from './AdminLayout'

const mapBooking = (booking) => ({
  id: booking._id,
  customer: booking.customer,
  email: booking.email,
  package: booking.package,
  operatorId: booking.operatorId,
  dates: booking.dates,
  amount: Number(booking.amount) || 0,
  status: booking.status,
  paymentStatus: booking.paymentStatus,
  bookingDate: formatDate(booking.bookingDate)
})

const BookingManagement = () => {
  const [bookings, setBookings] = useState([])
  const [packages, setPackages] = useState([])
  const [operators, setOperators] = useState([])
  const [searchTerm, setSearchTerm] = useState('')
  const [filterStatus, setFilterStatus] = useState('all')
  const [filterPayment, setFilterPayment] = useState('all')
  const [filterOperator, setFilterOperator] = useState('all')
  const [showAddModal, setShowAddModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [selectedBooking, setSelectedBooking] = useState(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(10)
  const [meta, setMeta] = useState({ page: 1, limit: 10, total: 0, totalPages: 1, hasNext: false, hasPrev: false })
  const [stats, setStats] = useState(null)

  // The route only filters server-side on `search`. An active status/payment
  // filter asks for the full set instead of paging a partial match.
  const hasLocalFilters = filterStatus !== 'all' || filterPayment !== 'all' || filterOperator !== 'all'

  const load = async (overrides = {}) => {
    const nextPage = overrides.page ?? page
    const nextLimit = overrides.limit ?? limit
    try {
      setError('')
       const [bookingData, packageData, operatorData] = await Promise.all([
       api('/admin/bookings', {
          params: {
            page: hasLocalFilters ? undefined : nextPage,
            limit: hasLocalFilters ? 'all' : nextLimit,
            search: searchTerm,
            operatorId: filterOperator !== 'all' ? filterOperator : undefined,
            status: filterStatus !== 'all' ? filterStatus : undefined
          }
        }),
        api('/admin/packages', { params: { limit: 'all' } }),
        api('/admin/users', { params: { role: 'tour_operator', limit: 'all' } })
      ])
      const mapped = (bookingData.bookings || []).map(mapBooking)
      setBookings(mapped)
      setMeta(readPagination(bookingData, mapped.length))
      if (bookingData.stats) setStats(bookingData.stats)
      setPackages(packageData.packages || [])
      setOperators(operatorData.users || [])
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    Promise.resolve().then(() => load())
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, limit])

  useEffect(() => {
    const timer = setTimeout(() => {
      setPage(1)
      if (page === 1) Promise.resolve().then(() => load())
    }, 350)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchTerm, filterStatus, filterPayment])

  const handlePageChange = (nextPage) => {
    setPage(nextPage)
    setLoading(true)
  }

  const handleLimitChange = (nextLimit) => {
    setLimit(nextLimit)
    setPage(1)
    setLoading(true)
  }

  const filteredBookings = hasLocalFilters
    ? bookings.filter((booking) =>
      (filterStatus === 'all' || booking.status === filterStatus) &&
      (filterPayment === 'all' || booking.paymentStatus === filterPayment) &&
      (filterOperator === 'all' || booking.operatorId === filterOperator))
    : bookings

  const operatorName = (id) => {
    const key = (id && typeof id === 'object') ? (id._id || id.id) : id
    const op = operators.find((o) => String(o._id) === String(key))
    return op ? (op.fullName || op.companyName || op.email || '-') : (key ? String(key) : '-')
  }

  const updateBooking = async (id, payload) => {
    await api(`/admin/bookings/${id}`, { method: 'PUT', body: JSON.stringify(payload) })
    await load()
  }

  const handleDeleteBooking = async (id) => {
    if (!window.confirm('Delete this booking?')) return
    try {
      await api(`/admin/bookings/${id}`, { method: 'DELETE' })
      if (filteredBookings.length <= 1 && page > 1) {
        setPage(page - 1)
        setLoading(true)
      } else {
        load()
      }
    } catch (err) {
      alert(err.message)
    }
  }

  const handleExport = async () => {
    const rows = await fetchAllPages('/admin/bookings', {
      key: 'bookings',
      params: { search: searchTerm }
    })
    const mapped = rows.map(mapBooking)
    const exported = hasLocalFilters
      ? mapped.filter((booking) =>
        (filterStatus === 'all' || booking.status === filterStatus) &&
        (filterPayment === 'all' || booking.paymentStatus === filterPayment))
      : mapped
    downloadCsv('bookings.csv', ['Customer', 'Email', 'Package', 'Dates', 'Amount', 'Status', 'Payment', 'Booking Date'], exported.map((b) => [b.customer, b.email, b.package, b.dates, b.amount, b.status, b.paymentStatus, b.bookingDate]))
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

  const confirmedBookings = stats?.byStatus?.confirmed ?? bookings.filter((b) => b.status === 'confirmed').length
  const pendingBookings = stats?.byStatus?.pending ?? bookings.filter((b) => b.status === 'pending').length
  const paidRevenue = stats?.totalRevenue ?? bookings.filter((b) => b.paymentStatus === 'paid').reduce((sum, b) => sum + b.amount, 0)
  const pendingPayments = bookings.filter((b) => b.paymentStatus === 'pending').reduce((sum, b) => sum + b.amount, 0)

  return (
    <AdminLayout
      active="bookings"
    >
      <div className="bookings-page">
        {error && <div className="error-message">{error}</div>}
        <div className="filters-section enhanced">
          <div className="search-bar enhanced">
            <Search className="search-icon" />
            <input value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} placeholder="Search bookings by customer, email or package..." />
          </div>
          <div className="filter-controls enhanced">
            <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="filter-select enhanced">
              <option value="all">All Status</option>
              <option value="confirmed">Confirmed</option>
              <option value="pending">Pending</option>
              <option value="cancelled">Cancelled</option>
            </select>
            <select value={filterOperator} onChange={(e) => setFilterOperator(e.target.value)} className="filter-select enhanced">
              <option value="all">All Operators</option>
              {operators.map((op) => <option key={op._id} value={op._id}>{op.fullName || op.companyName || op.email}</option>)}
            </select>
            <select value={filterPayment} onChange={(e) => setFilterPayment(e.target.value)} className="filter-select enhanced">
              <option value="all">All Payment Status</option>
              <option value="paid">Paid</option>
              <option value="pending">Pending</option>
              <option value="refunded">Refunded</option>
            </select>
          </div>
          <div className="page-actions">
            <button className="action-btn secondary" onClick={handleExport}>
              <Download className="h-4 w-4" /> Export
            </button>
            <button className="action-btn" onClick={() => setShowAddModal(true)}><Plus className="h-4 w-4" /> Add Booking</button>
          </div>
        </div>

        <div className="stats-grid enhanced">
          <div className="stat-card"><Ticket className="stat-icon" /><div className="stat-content"><h3>Total Bookings</h3><p className="stat-number">{stats?.total ?? meta.total}</p></div></div>
          <div className="stat-card"><CheckCircle className="stat-icon" /><div className="stat-content"><h3>Confirmed</h3><p className="stat-number">{confirmedBookings}</p></div></div>
          <div className="stat-card"><Clock className="stat-icon" /><div className="stat-content"><h3>Pending</h3><p className="stat-number">{pendingBookings}</p></div></div>
          <div className="stat-card"><DollarSign className="stat-icon" /><div className="stat-content"><h3>Total Revenue</h3><p className="stat-number">{formatCurrency(paidRevenue)}</p></div></div>
          <div className="stat-card"><CreditCard className="stat-icon" /><div className="stat-content"><h3>Pending Payments</h3><p className="stat-number">{formatCurrency(pendingPayments)}</p></div></div>
        </div>

        <div className="section-card enhanced full-width">
          <h3><Ticket className="h-5 w-5" /> Bookings ({hasLocalFilters ? filteredBookings.length : meta.total})</h3>
          {loading ? (
            <div className="skeleton-wrap">
              {[0, 1, 2, 3, 4].map((i) => <div key={i} className="skeleton-bar" style={{ width: `${96 - i * 4}%` }} />)}
            </div>
          ) : (
            <div className="table-container enhanced">
              <table className="data-table enhanced">
                <thead>
                  <tr>
                    <th>Customer</th><th>Email</th><th>Package</th><th>Operator</th><th>Dates</th><th>Amount</th><th>Status</th><th>Payment</th><th>Booking Date</th><th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredBookings.length === 0 ? (
                    <tr>
                      <td colSpan="10">
                        <div className="empty-state enhanced">
                          <Ticket className="h-8 w-8" />
                          <h3>No bookings found</h3>
                          <p>Try adjusting your search or filters.</p>
                        </div>
                      </td>
                    </tr>
                  ) : filteredBookings.map((booking) => (
                    <tr key={booking.id}>
                      <td className="customer-name">{booking.customer}</td>
                      <td className="cell-ellipsis" title={booking.email}>{booking.email}</td>
                      <td className="cell-ellipsis" title={booking.package}>{booking.package}</td>
                      <td className="cell-ellipsis" title={operatorName(booking.operatorId)}>{operatorName(booking.operatorId)}</td>
                      <td className="cell-nowrap"><Calendar className="h-4 w-4 inline-icon" />{booking.dates}</td>
                      <td className="cell-amount">₹{(booking.amount || 0).toLocaleString()}</td>
                      <td><span className={`status-badge enhanced ${booking.status}`}>{booking.status}</span></td>
                      <td><span className={`payment-badge enhanced ${booking.paymentStatus}`}>{booking.paymentStatus}</span></td>
                      <td className="cell-nowrap">{booking.bookingDate}</td>
                      <td>
                        <div className="action-buttons enhanced">
                          <button className="icon-btn enhanced edit" title="Edit" onClick={() => { setSelectedBooking(booking); setShowEditModal(true) }}><Edit className="h-4 w-4" /></button>
                          <select value={booking.status} className="status-select enhanced" title="Change status" onChange={(e) => updateBooking(booking.id, { status: e.target.value })}>
                            <option value="confirmed">Confirmed</option>
                            <option value="pending">Pending</option>
                            <option value="cancelled">Cancelled</option>
                          </select>
                          {booking.paymentStatus === 'pending' && (
                            <button className="icon-btn enhanced payment" title="Mark paid" onClick={() => updateBooking(booking.id, { paymentStatus: 'paid', status: 'confirmed' })}>
                              <CreditCard className="h-4 w-4" />
                            </button>
                          )}
                          {booking.paymentStatus === 'paid' && (
                            <button className="icon-btn enhanced refund" title="Refund" onClick={() => updateBooking(booking.id, { paymentStatus: 'refunded', status: 'cancelled' })}>
                              <DollarSign className="h-4 w-4" />
                            </button>
                          )}
                          <button className="icon-btn enhanced delete" title="Delete" onClick={() => handleDeleteBooking(booking.id)}><Trash2 className="h-4 w-4" /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            <Pagination
              page={page}
              totalPages={meta.totalPages}
              total={meta.total}
              limit={meta.limit}
              onPageChange={handlePageChange}
              onLimitChange={handleLimitChange}
              itemLabel="bookings"
              disabled={loading}
            />
          </div>
        )}
      </div>

      {showAddModal && (
        <div className="modal-overlay enhanced">
          <div className="modal enhanced">
            <div className="modal-header"><h3>Add New Booking</h3><button className="modal-close" onClick={() => setShowAddModal(false)}>×</button></div>
            <div className="modal-body">
              <form className="booking-form enhanced" onSubmit={handleAddBooking}>
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
        <div className="modal-overlay enhanced">
          <div className="modal enhanced">
            <div className="modal-header"><h3>Edit Booking</h3><button className="modal-close" onClick={() => setShowEditModal(false)}>×</button></div>
            <div className="modal-body">
              <form className="booking-form enhanced" onSubmit={handleUpdateBooking}>
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
      </div>
    </AdminLayout>
  )
}

export default BookingManagement
