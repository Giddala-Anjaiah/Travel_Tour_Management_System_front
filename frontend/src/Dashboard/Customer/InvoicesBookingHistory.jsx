import { useState, useEffect } from 'react'
import { DollarSign, Search, CheckCircle, Clock, Eye, Printer, Sparkles, Shield, Receipt, CalendarIcon, AlertCircle, Download } from 'lucide-react'
import CustomerLayout from './CustomerLayout'
import { api, formatCurrency, formatDate, readPagination } from '../../api'
import Pagination from '../../components/Pagination'
import jsPDF from 'jspdf'
import '../Dashboard.css'

const InvoicesBookingHistory = () => {
  const [searchTerm, setSearchTerm] = useState('')
  const [filterStatus, setFilterStatus] = useState('all')
  const [selectedInvoice, setSelectedInvoice] = useState(null)
  const [showInvoiceModal, setShowInvoiceModal] = useState(false)
  const [invoices, setInvoices] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(10)
  const [meta, setMeta] = useState({ page: 1, limit: 10, total: 0, totalPages: 1, hasNext: false, hasPrev: false })
  const [stats, setStats] = useState(null)

  // The route filters server-side on `search` only. Status is not supported, so
  // when it is active we load the full set and filter the rows locally.
  const hasLocalFilters = filterStatus !== 'all'

  const fetchInvoices = async (overrides = {}) => {
    const nextPage = overrides.page ?? page
    const nextLimit = overrides.limit ?? limit
    try {
      const data = await api('/customer/invoices', {
        params: {
          page: hasLocalFilters ? undefined : nextPage,
          limit: hasLocalFilters ? 'all' : nextLimit,
          search: searchTerm
        }
      })
      const rows = data.invoices || []
      setInvoices(rows)
      const next = readPagination(data, rows.length)
      setMeta(next)
      if (data.stats) setStats(data.stats)
      if (!hasLocalFilters && next.totalPages > 0 && nextPage > next.totalPages) {
        setLoading(true)
        setPage(next.totalPages)
      }
    } catch (err) {
      setError(err.message || 'Failed to load invoices')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    Promise.resolve().then(() => fetchInvoices())
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, limit])

  useEffect(() => {
    const timer = setTimeout(() => {
      setPage(1)
      fetchInvoices({ page: 1 })
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

  // `search` runs server-side (invoiceNo/customer/package); only the unsupported
  // status filter is resolved locally.
  const filteredInvoices = invoices.filter(invoice => {
    const matchesStatus = filterStatus === 'all' || invoice.status === filterStatus
    return matchesStatus
  })

  const getStatusIcon = (status) => {
    switch(status) {
      case 'paid': return <CheckCircle className="h-4 w-4" />
      case 'pending': return <Clock className="h-4 w-4" />
      case 'overdue': return <AlertCircle className="h-4 w-4" />
      default: return <Clock className="h-4 w-4" />
    }
  }

  const getStatusColor = (status) => {
    switch(status) {
      case 'paid': return '#22c55e'
      case 'pending': return '#f59e0b'
      case 'overdue': return '#ef4444'
      default: return '#64748b'
    }
  }

  const viewInvoice = (invoice) => {
    setSelectedInvoice(invoice)
    setShowInvoiceModal(true)
  }

  const downloadInvoice = (invoice) => {
    const doc = new jsPDF()
    doc.setFontSize(18)
    doc.text('Invoice', 14, 20)
    doc.setFontSize(12)
    doc.text(`Invoice No: ${invoice.invoiceNo || ''}`, 14, 30)
    doc.text(`Package: ${invoice.package || ''}`, 14, 38)
    doc.text(`Customer: ${invoice.customer || ''}`, 14, 46)
    doc.text(`Email: ${invoice.email || ''}`, 14, 54)
    doc.text(`Amount: ${formatCurrency(invoice.amount)}`, 14, 62)
    doc.text(`Status: ${invoice.status || ''}`, 14, 70)
    doc.text(`Date: ${formatDate(invoice.date)}`, 14, 78)
    doc.text(`Due Date: ${formatDate(invoice.dueDate)}`, 14, 86)
    doc.save(`${invoice.invoiceNo || 'invoice'}.pdf`)
  }

  const printInvoice = (invoice) => {
    const doc = new jsPDF()
    doc.setFontSize(18)
    doc.text('Invoice', 14, 20)
    doc.setFontSize(12)
    doc.text(`Invoice No: ${invoice.invoiceNo || ''}`, 14, 30)
    doc.text(`Package: ${invoice.package || ''}`, 14, 38)
    doc.text(`Customer: ${invoice.customer || ''}`, 14, 46)
    doc.text(`Email: ${invoice.email || ''}`, 14, 54)
    doc.text(`Amount: ${formatCurrency(invoice.amount)}`, 14, 62)
    doc.text(`Status: ${invoice.status || ''}`, 14, 70)
    doc.text(`Date: ${formatDate(invoice.date)}`, 14, 78)
    doc.text(`Due Date: ${formatDate(invoice.dueDate)}`, 14, 86)
    const blob = doc.output('blob')
    const url = URL.createObjectURL(blob)
    const win = window.open(url)
    if (win) {
      win.print()
    } else {
      URL.revokeObjectURL(url)
    }
  }

  const totalBilled = stats?.totalAmount ?? invoices.reduce((sum, i) => sum + (i.amount || 0), 0)
  const totalCount = stats?.total ?? meta.total
  const paidCount = invoices.filter(i => i.status === 'paid').length
  const pendingCount = invoices.filter(i => i.status === 'pending' || i.status === 'overdue').length

  if (loading) {
    return (
      <CustomerLayout active="invoices" title="Invoices & history" subtitle="Payment records for every booking">
        <div className="cd-card" style={{ textAlign: 'center', padding: '3rem' }}>
          <p style={{ color: '#64748b' }}>Loading invoices…</p>
        </div>
      </CustomerLayout>
    )
  }

  return (
    <CustomerLayout
      active="invoices"
      title="Invoices & history"
      subtitle="Payment records for every booking"
      actions={
        <div className="header-stats">
          <div className="stat-badge">
            <Sparkles className="h-4 w-4" />
            <span>{totalCount} invoices</span>
          </div>
          <div className="stat-badge">
            <Shield className="h-4 w-4" />
            <span>Digital records</span>
          </div>
        </div>
      }
    >
      {error && <div className="cd-card cd-alert warning" style={{ marginBottom: '1rem' }}>{error}</div>}

      <div className="stats-grid enhanced">
        <div className="stat-card enhanced">
          <Receipt className="stat-icon" />
          <div className="stat-content">
            <h3>Total Invoices</h3>
            <p className="stat-number">{totalCount}</p>
          </div>
        </div>
        <div className="stat-card enhanced">
          <CheckCircle className="stat-icon" />
          <div className="stat-content">
            <h3>Paid</h3>
            <p className="stat-number">{paidCount}</p>
          </div>
        </div>
        <div className="stat-card enhanced">
          <Clock className="stat-icon" />
          <div className="stat-content">
            <h3>Pending</h3>
            <p className="stat-number">{pendingCount}</p>
          </div>
        </div>
        <div className="stat-card enhanced">
          <DollarSign className="stat-icon" />
          <div className="stat-content">
            <h3>Total Billed</h3>
            <p className="stat-number">₹{totalBilled.toLocaleString()}</p>
          </div>
        </div>
      </div>

      <div className="filters-section enhanced">
        <div className="search-bar enhanced">
          <Search className="search-icon" />
          <input
            type="text"
            placeholder="Search invoices, bookings..."
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
              <option value="paid">Paid</option>
              <option value="pending">Pending</option>
              <option value="overdue">Overdue</option>
            </select>
          </div>
        </div>
      </div>

      <div className="invoices-list enhanced">
        {filteredInvoices.length === 0 ? (
          <div className="cd-empty">No invoices found.</div>
        ) : (
          filteredInvoices.map(invoice => (
            <div key={invoice._id} className="invoice-card enhanced">
              <div className="invoice-header enhanced">
                <div className="invoice-info">
                  <h3>{invoice.package}</h3>
                  <div className="invoice-id">
                    <Receipt className="h-4 w-4" />
                    <span>{invoice.invoiceNo}</span>
                  </div>
                </div>
                <div className="invoice-badges">
                  <span className={`status-badge ${invoice.status}`} style={{ backgroundColor: getStatusColor(invoice.status) }}>
                    {getStatusIcon(invoice.status)}
                    {invoice.status}
                  </span>
                </div>
              </div>

              <div className="invoice-details enhanced">
                <div className="detail-item">
                  <CalendarIcon className="h-4 w-4" />
                  <div>
                    <small>Invoice Date</small>
                    <strong>{formatDate(invoice.date)}</strong>
                  </div>
                </div>
                <div className="detail-item">
                  <Clock className="h-4 w-4" />
                  <div>
                    <small>Due Date</small>
                    <strong>{formatDate(invoice.dueDate)}</strong>
                  </div>
                </div>
              </div>

              <div className="invoice-amount-section">
                <div className="amount-display">
                  <small>Total Amount</small>
                  <strong>{formatCurrency(invoice.amount)}</strong>
                </div>
              </div>

              <div className="invoice-actions enhanced">
                <button onClick={() => viewInvoice(invoice)} className="icon-btn">
                  <Eye className="h-4 w-4" />
                </button>
                <button onClick={() => downloadInvoice(invoice)} className="icon-btn">
                  <Download className="h-4 w-4" />
                </button>
                <button onClick={() => printInvoice(invoice)} className="icon-btn">
                  <Printer className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      <Pagination
        page={page}
        totalPages={meta.totalPages}
        total={hasLocalFilters ? filteredInvoices.length : totalCount}
        limit={meta.limit}
        onPageChange={handlePageChange}
        onLimitChange={handleLimitChange}
        itemLabel="invoices"
        disabled={loading}
      />

      {showInvoiceModal && selectedInvoice && (
        <div className="modal-overlay">
          <div className="modal invoice-modal">
            <div className="modal-header">
              <div>
                <h3>Invoice Details - {selectedInvoice.invoiceNo}</h3>
                <p className="modal-subtitle">{selectedInvoice.package}</p>
              </div>
              <button onClick={() => setShowInvoiceModal(false)} className="modal-close">×</button>
            </div>
            <div className="modal-body">
              <div className="invoice-details enhanced">
                <div className="invoice-header-info enhanced">
                  <div className="info-row">
                    <span className="label">Invoice ID:</span>
                    <span className="value">{selectedInvoice.invoiceNo}</span>
                  </div>
                  <div className="info-row">
                    <span className="label">Customer:</span>
                    <span className="value">{selectedInvoice.customer}</span>
                  </div>
                  <div className="info-row">
                    <span className="label">Package:</span>
                    <span className="value">{selectedInvoice.package}</span>
                  </div>
                  <div className="info-row">
                    <span className="label">Invoice Date:</span>
                    <span className="value">{formatDate(selectedInvoice.date)}</span>
                  </div>
                  <div className="info-row">
                    <span className="label">Due Date:</span>
                    <span className="value">{formatDate(selectedInvoice.dueDate)}</span>
                  </div>
                  <div className="info-row">
                    <span className="label">Amount:</span>
                    <span className="value">{formatCurrency(selectedInvoice.amount)}</span>
                  </div>
                  <div className="info-row">
                    <span className="label">Status:</span>
                    <span className={`value status-badge ${selectedInvoice.status}`} style={{ backgroundColor: getStatusColor(selectedInvoice.status) }}>
                      {getStatusIcon(selectedInvoice.status)}
                      {selectedInvoice.status}
                    </span>
                  </div>
                </div>

                <div className="invoice-modal-actions">
                  <button onClick={() => downloadInvoice(selectedInvoice)} className="btn-secondary">
                    <Download className="h-4 w-4" /> Download PDF
                  </button>
                  <button onClick={() => printInvoice(selectedInvoice)} className="btn-secondary">
                    <Printer className="h-4 w-4" /> Print
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </CustomerLayout>
  )
}

export default InvoicesBookingHistory
