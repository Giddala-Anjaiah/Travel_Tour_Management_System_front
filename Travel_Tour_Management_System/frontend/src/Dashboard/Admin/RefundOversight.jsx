import { useEffect, useState } from 'react'
import { CreditCard, Search, Clock, CheckCircle, XCircle, AlertCircle, Download, DollarSign, Ticket, Calendar } from 'lucide-react'
import { api, downloadCsv, fetchAllPages, formatCurrency, formatDate, readPagination } from '../../api'
import Pagination from '../../components/Pagination'
import AdminLayout from './AdminLayout'

const mapRefund = (booking) => ({
  id: booking._id,
  bookingId: booking.bookingId || booking._id,
  customer: booking.customer,
  email: booking.email,
  package: booking.package,
  dates: booking.dates,
  amount: Number(booking.amount) || 0,
  paidAmount: Number(booking.paidAmount) || 0,
  status: booking.status,
  paymentStatus: booking.paymentStatus,
  refundStatus: (booking.refund && booking.refund.status) || 'not_applicable',
  refundAmount: Number((booking.refund && booking.refund.amount) || 0),
  cancellationFee: Number((booking.cancellation && booking.cancellation.cancellationFee) || 0),
  refundPercentage: Number((booking.cancellation && booking.cancellation.refundPercentage) || 0),
  daysBeforeTrip: Number((booking.cancellation && booking.cancellation.daysBeforeTrip) || 0),
  reason: booking.cancellation && booking.cancellation.reason,
  cancelledAt: booking.cancellation && booking.cancellation.cancelledAt,
  processedAt: booking.refund && booking.refund.processedAt,
  transactionId: booking.refund && booking.refund.transactionId,
  bookingDate: formatDate(booking.bookingDate)
})

const RefundOversight = () => {
  const [refunds, setRefunds] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  const [filterRefundStatus, setFilterRefundStatus] = useState('all')
  const [filterPayment, setFilterPayment] = useState('all')
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(10)
  const [meta, setMeta] = useState({ page: 1, limit: 10, total: 0, totalPages: 1, hasNext: false, hasPrev: false })
  const [stats, setStats] = useState(null)

  const hasLocalFilters = filterRefundStatus !== 'all' || filterPayment !== 'all'

  const load = async (overrides = {}) => {
    const nextPage = overrides.page ?? page
    const nextLimit = overrides.limit ?? limit
    try {
      setError('')
      const data = await api('/admin/refunds', {
        params: {
          page: hasLocalFilters ? undefined : nextPage,
          limit: hasLocalFilters ? 'all' : nextLimit,
          search: searchTerm,
          refundStatus: filterRefundStatus !== 'all' ? filterRefundStatus : undefined,
          paymentStatus: filterPayment !== 'all' ? filterPayment : undefined
        }
      })
      const mapped = (data.refunds || []).map(mapRefund)
      setRefunds(mapped)
      setMeta(readPagination(data, mapped.length))
      if (data.stats) setStats(data.stats)
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
    const timer = setTimeout(() => { setPage(1); Promise.resolve().then(() => load()) }, 350)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchTerm, filterRefundStatus, filterPayment])

  const handlePageChange = (nextPage) => { setPage(nextPage); setLoading(true) }
  const handleLimitChange = (nextLimit) => { setLimit(nextLimit); setPage(1); setLoading(true) }

  const filteredRefunds = hasLocalFilters
    ? refunds.filter((r) =>
      (filterRefundStatus === 'all' || r.refundStatus === filterRefundStatus) &&
      (filterPayment === 'all' || r.paymentStatus === filterPayment))
    : refunds

  const refundBadge = (status) => {
    const badges = {
      pending: { label: 'Pending', color: '#f59e0b' },
      completed: { label: 'Completed', color: '#22c55e' },
      failed: { label: 'Failed', color: '#ef4444' },
      not_applicable: { label: 'N/A', color: '#6b7280' }
    }
    return badges[status] || badges.not_applicable
  }

  const processRefund = async (id, booking) => {
    if (!window.confirm(`Process refund of ₹${booking.refundAmount.toLocaleString()} for ${booking.customer}?`)) return
    try {
      await api(`/admin/refunds/${id}/process`, { method: 'PUT', body: JSON.stringify({ transactionId: '', notes: 'Refund processed by admin' }) })
      await load()
    } catch (err) { alert(err.message || 'Failed to process refund') }
  }

  const rejectRefund = async (id) => {
    const reason = window.prompt('Enter rejection reason:')
    if (reason === null) return
    try {
      await api(`/admin/refunds/${id}/reject`, { method: 'PUT', body: JSON.stringify({ reason, notes: 'Refund rejected by admin' }) })
      await load()
    } catch (err) { alert(err.message || 'Failed to reject refund') }
  }

  const handleExport = async () => {
    try {
      const rows = await fetchAllPages('/admin/refunds', { key: 'refunds', params: { search: searchTerm } })
      downloadCsv('refunds.csv', ['Booking ID', 'Customer', 'Email', 'Package', 'Amount', 'Refund Amount', 'Refund Status', 'Payment Status', 'Booking Date'], rows.map(r => [r.bookingId, r.customer, r.email, r.package, r.amount, r.refundAmount, r.refundStatus, r.paymentStatus, r.bookingDate]))
    } catch (err) { alert(err.message || 'Export failed') }
  }

  const reconcile = async () => {
    try {
      const data = await api('/admin/refunds/reconcile')
      alert(`Reconciliation complete:\nPending: ${data.pendingRefunds.count}\nFailed: ${data.failedRefunds.count}\nAmount mismatches: ${data.amountMismatches.count}\nRefunded but incomplete: ${data.refundedIncomplete.count}`)
    } catch (err) { alert(err.message || 'Reconciliation failed') }
  }

  const totalPending = stats?.pendingRefunds ?? refunds.filter((r) => r.refundStatus === 'pending').length
  const totalCompleted = stats?.completedRefunds ?? refunds.filter((r) => r.refundStatus === 'completed').length
  const totalFailed = stats?.failedRefunds ?? refunds.filter((r) => r.refundStatus === 'failed').length
  const totalRefunded = stats?.refundedAmount ?? refunds.filter((r) => r.paymentStatus === 'refunded').reduce((sum, r) => sum + r.amount, 0)

  return (
    <AdminLayout active="refunds" title="Refund & Payment Oversight">
      <div className="bookings-page">
        {error && <div className="error-message">{error}</div>}
        <div className="filters-section enhanced">
          <div className="search-bar enhanced">
            <Search className="search-icon" />
            <input value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} placeholder="Search by booking ID, customer, email or package..." />
          </div>
          <div className="filter-controls enhanced">
            <select value={filterRefundStatus} onChange={(e) => setFilterRefundStatus(e.target.value)} className="filter-select enhanced">
              <option value="all">All Refund Status</option>
              <option value="pending">Pending</option>
              <option value="completed">Completed</option>
              <option value="failed">Failed</option>
              <option value="not_applicable">Not Applicable</option>
            </select>
            <select value={filterPayment} onChange={(e) => setFilterPayment(e.target.value)} className="filter-select enhanced">
              <option value="all">All Payment Status</option>
              <option value="refunded">Refunded</option>
              <option value="paid">Paid</option>
              <option value="failed">Failed</option>
              <option value="pending">Pending</option>
            </select>
            <div className="page-actions">
              <button className="action-btn" onClick={reconcile}><Clock className="h-4 w-4" /> Reconcile</button>
              <button className="action-btn secondary" onClick={handleExport}><Download className="h-4 w-4" /> Export</button>
            </div>
          </div>
        </div>

        <div className="stats-grid enhanced">
          <div className="stat-card"><AlertCircle className="stat-icon" /><div className="stat-content"><h3>Pending Refunds</h3><p className="stat-number">{totalPending}</p></div></div>
          <div className="stat-card"><CheckCircle className="stat-icon" /><div className="stat-content"><h3>Completed</h3><p className="stat-number">{totalCompleted}</p></div></div>
          <div className="stat-card"><XCircle className="stat-icon" /><div className="stat-content"><h3>Failed</h3><p className="stat-number">{totalFailed}</p></div></div>
          <div className="stat-card"><DollarSign className="stat-icon" /><div className="stat-content"><h3>Refunded Amount</h3><p className="stat-number">{formatCurrency(totalRefunded)}</p></div></div>
        </div>

        <div className="section-card enhanced full-width">
          <h3><Ticket className="h-5 w-5" /> Refund Requests ({hasLocalFilters ? filteredRefunds.length : meta.total})</h3>
          {loading ? (
            <div className="skeleton-wrap">
              {[0, 1, 2, 3, 4].map((i) => <div key={i} className="skeleton-bar" style={{ width: `${96 - i * 4}%` }} />)}
            </div>
          ) : (
            <>
              <div className="table-container enhanced">
                <table className="data-table enhanced">
                  <thead>
                    <tr>
                      <th>Booking ID</th><th>Customer</th><th>Package</th><th>Dates</th><th>Amount</th><th>Refund Amt</th><th>Refund Status</th><th>Payment</th><th>Booking Date</th><th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredRefunds.length === 0 ? (
                      <tr>
                        <td colSpan="10">
                          <div className="empty-state enhanced">
                            <AlertCircle className="h-8 w-8" />
                            <h3>No refund requests found</h3>
                            <p>Try adjusting your search or filters.</p>
                          </div>
                        </td>
                      </tr>
                    ) : filteredRefunds.map((r) => (
                      <tr key={r.id}>
                        <td className="cell-ellipsis" title={r.bookingId}>{r.bookingId}</td>
                        <td className="cell-ellipsis" title={r.customer}>{r.customer}</td>
                        <td className="cell-ellipsis" title={r.package}>{r.package}</td>
                        <td className="cell-nowrap"><Calendar className="h-4 w-4 inline-icon" />{r.dates}</td>
                        <td className="cell-amount">₹{r.amount.toLocaleString()}</td>
                        <td className="cell-amount">₹{r.refundAmount.toLocaleString()}</td>
                        <td><span className={`status-badge enhanced ${r.refundStatus}`}>{refundBadge(r.refundStatus).label}</span></td>
                        <td><span className={`payment-badge enhanced ${r.paymentStatus}`}>{r.paymentStatus}</span></td>
                        <td className="cell-nowrap">{r.bookingDate}</td>
                        <td>
                          <div className="action-buttons enhanced">
                            {r.refundStatus === 'pending' && r.paymentStatus === 'refunded' && (
                              <button className="icon-btn enhanced process" title="Process refund" onClick={() => processRefund(r.id, r)}>
                                <CheckCircle className="h-4 w-4" />
                              </button>
                            )}
                            {r.refundStatus === 'pending' && (
                              <button className="icon-btn enhanced reject" title="Reject refund" onClick={() => rejectRefund(r.id, r)}>
                                <XCircle className="h-4 w-4" />
                              </button>
                            )}
                            {r.refundStatus === 'completed' && (
                              <button className="icon-btn enhanced view" title="View details" onClick={() => alert(`Transaction: ${r.transactionId || 'N/A'}\nProcessed: ${formatDate(r.processedAt)}\nRefunded: ₹${r.refundAmount.toLocaleString()}`)}>
                                <CreditCard className="h-4 w-4" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <Pagination
                page={page}
                totalPages={meta.totalPages}
                total={meta.total}
                limit={meta.limit}
                onPageChange={handlePageChange}
                onLimitChange={handleLimitChange}
                itemLabel="refunds"
                disabled={loading}
              />
            </>
          )}
        </div>
      </div>
    </AdminLayout>
  )
}

export default RefundOversight
