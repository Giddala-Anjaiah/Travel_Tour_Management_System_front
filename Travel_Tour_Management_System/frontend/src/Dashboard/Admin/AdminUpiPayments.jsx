import { useEffect, useState } from 'react'
import { QrCode, Search, Clock, CheckCircle, XCircle } from 'lucide-react'
import { api, formatDate, readPagination } from '../../api'
import Pagination from '../../components/Pagination'
import AdminLayout from './AdminLayout'

const AdminUpiPayments = () => {
  const [payments, setPayments] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  const [filterStatus, setFilterStatus] = useState('pending')
  const [filterType, setFilterType] = useState('all')
  const [page] = useState(1)
  const [limit] = useState(20)
  const [meta, setMeta] = useState({ page: 1, limit: 20, total: 0, totalPages: 1, hasNext: false, hasPrev: false })
  const [verifying, setVerifying] = useState(null)

  const hasLocalFilters = searchTerm.trim() !== '' || filterStatus !== 'pending' || filterType !== 'all'

  const fetchPayments = async (overrides = {}) => {
    const nextPage = overrides.page ?? page
    const nextLimit = overrides.limit ?? limit
    try {
      setError('')
      const data = await api('/admin/upi-payments', {
        params: {
          page: hasLocalFilters ? undefined : nextPage,
          limit: hasLocalFilters ? 'all' : nextLimit,
          status: filterStatus,
          type: filterType === 'all' ? undefined : filterType,
          search: searchTerm
        }
      })
      const rows = data.payments || []
      setPayments(rows)
      setMeta(readPagination(data, rows.length))
    } catch (err) {
      setError(err.message || 'Failed to fetch UPI payments')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    Promise.resolve().then(() => fetchPayments())
  }, [page, limit, searchTerm, filterStatus, filterType])

  const filteredPayments = payments.filter(p => {
    const matchesSearch = searchTerm === '' ||
      (p.customerName && p.customerName.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (p.customerEmail && p.customerEmail.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (p.itemName && p.itemName.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (p.upiTransactionRef && p.upiTransactionRef.toLowerCase().includes(searchTerm.toLowerCase()))
    const matchesType = filterType === 'all' || p.paymentType === filterType
    return matchesSearch && matchesType
  })

  const verifyPayment = async (paymentId, action, notes) => {
    setVerifying(paymentId)
    try {
      const res = await api(`/api/admin/membership/payments/${paymentId}/verify`, {
        method: 'POST',
        body: JSON.stringify({ action, notes })
      })
      setSuccess(res.message || `Payment ${action}d successfully`)
      setVerifying(null)
      setTimeout(() => { setSuccess('') }, 2000)
      fetchPayments({ page: 1 })
    } catch (err) {
      setVerifying(null)
      setError(err.message || `Failed to ${action} payment`)
    }
  }

  const statusColor = (status) => {
    switch (status) {
      case 'paid': return 'var(--customer-accent-emerald)'
      case 'pending': return 'var(--customer-primary-teal)'
      case 'failed': return 'var(--cp-danger)'
      case 'refunded': return 'var(--cp-warning)'
      default: return 'var(--customer-text-secondary)'
    }
  }

  const typeColor = (type) => {
    return type === 'Membership' ? 'var(--customer-primary-teal)' : 'var(--cp-accent)'
  }

  return (
    <AdminLayout active="upi-payments">
      <div className="page-head">
        <div className="page-head-row">
          <div>
            <h1>UPI Payment Management</h1>
            <p>Verify and manage pending UPI payments for memberships and travel bookings.</p>
          </div>
        </div>
      </div>

      {error && (
        <div className="cd-alert warning" style={{ marginBottom: '1rem' }}>
          <XCircle className="h-4 w-4" style={{ marginRight: '0.5rem' }} />
          {error}
        </div>
      )}
      {success && (
        <div className="cd-alert info" style={{ marginBottom: '1rem' }}>
          <CheckCircle className="h-4 w-4" style={{ marginRight: '0.5rem', color: 'var(--customer-accent-emerald)' }} />
          {success}
        </div>
      )}

      <div className="dashboard-page" style={{ padding: '0 2rem 2rem 2rem' }}>
        <div className="filters-section enhanced">
          <div className="search-bar enhanced">
            <Search className="search-icon" />
            <input
              type="text"
              placeholder="Search by customer, package, or reference..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="filter-controls enhanced">
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="filter-select enhanced"
            >
              <option value="pending">Pending</option>
              <option value="paid">Paid</option>
              <option value="failed">Failed</option>
              <option value="all">All Status</option>
            </select>
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="filter-select enhanced"
            >
              <option value="all">All Types</option>
              <option value="Membership">Membership</option>
              <option value="Travel Booking">Travel Booking</option>
            </select>
          </div>
        </div>

        <div className="section-card enhanced full-width">
          <h3 style={{ margin: '0 0 1rem 0', color: 'var(--customer-text-main)' }}>
            <QrCode className="h-5 w-5" style={{ marginRight: '0.5rem' }} />
            Pending UPI Payments ({filteredPayments.length})
          </h3>
          {loading ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '2rem', color: 'var(--customer-text-secondary)' }}>
              <Clock className="h-4 w-4" style={{ animation: 'spin 1s linear infinite' }} />
              <span>Loading payments...</span>
            </div>
          ) : filteredPayments.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--customer-text-secondary)' }}>
              <QrCode className="h-8 w-8" style={{ marginBottom: '1rem', opacity: 0.5 }} />
              <p>No pending UPI payments found.</p>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid var(--customer-border)' }}>
                    <th style={{ textAlign: 'left', padding: '0.75rem', fontSize: '0.8rem', color: 'var(--customer-text-secondary)', fontWeight: 700 }}>Reference</th>
                    <th style={{ textAlign: 'left', padding: '0.75rem', fontSize: '0.8rem', color: 'var(--customer-text-secondary)', fontWeight: 700 }}>Customer</th>
                    <th style={{ textAlign: 'left', padding: '0.75rem', fontSize: '0.8rem', color: 'var(--customer-text-secondary)', fontWeight: 700 }}>Type</th>
                    <th style={{ textAlign: 'left', padding: '0.75rem', fontSize: '0.8rem', color: 'var(--customer-text-secondary)', fontWeight: 700 }}>Item / Plan</th>
                    <th style={{ textAlign: 'right', padding: '0.75rem', fontSize: '0.8rem', color: 'var(--customer-text-secondary)', fontWeight: 700 }}>Original</th>
                    <th style={{ textAlign: 'right', padding: '0.75rem', fontSize: '0.8rem', color: 'var(--customer-text-secondary)', fontWeight: 700 }}>Discount</th>
                    <th style={{ textAlign: 'right', padding: '0.75rem', fontSize: '0.8rem', color: 'var(--customer-text-secondary)', fontWeight: 700 }}>Final Amount</th>
                    <th style={{ textAlign: 'left', padding: '0.75rem', fontSize: '0.8rem', color: 'var(--customer-text-secondary)', fontWeight: 700 }}>UPI Txn Ref</th>
                    <th style={{ textAlign: 'left', padding: '0.75rem', fontSize: '0.8rem', color: 'var(--customer-text-secondary)', fontWeight: 700 }}>Status</th>
                    <th style={{ textAlign: 'left', padding: '0.75rem', fontSize: '0.8rem', color: 'var(--customer-text-secondary)', fontWeight: 700 }}>Date</th>
                    <th style={{ textAlign: 'center', padding: '0.75rem', fontSize: '0.8rem', color: 'var(--customer-text-secondary)', fontWeight: 700 }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredPayments.map((p) => (
                    <tr key={p.paymentReference || p._id} style={{ borderBottom: '1px solid var(--customer-border)' }}>
                      <td style={{ padding: '0.75rem', fontSize: '0.85rem', color: 'var(--customer-text-main)', fontWeight: 600 }}>
                        {p.paymentReference || p._id}
                      </td>
                      <td style={{ padding: '0.75rem', fontSize: '0.85rem', color: 'var(--customer-text-main)' }}>
                        <div>{p.customerName}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--customer-text-secondary)' }}>{p.customerEmail}</div>
                      </td>
                      <td style={{ padding: '0.75rem', fontSize: '0.85rem', color: 'var(--customer-text-main)' }}>
                        <span style={{
                          display: 'inline-block',
                          padding: '0.15rem 0.5rem',
                          borderRadius: '0.5rem',
                          background: 'var(--customer-muted-bg)',
                          color: typeColor(p.paymentType),
                          fontSize: '0.7rem',
                          fontWeight: 600
                        }}>
                          {p.paymentType}
                        </span>
                      </td>
                      <td style={{ padding: '0.75rem', fontSize: '0.85rem', color: 'var(--customer-text-main)' }}>{p.itemName}</td>
                      <td style={{ padding: '0.75rem', fontSize: '0.85rem', color: 'var(--customer-text-main)', textAlign: 'right' }}>
                        ₹{(p.originalAmount || 0).toLocaleString()}
                      </td>
                      <td style={{ padding: '0.75rem', fontSize: '0.85rem', color: 'var(--customer-text-main)', textAlign: 'right' }}>
                        {(p.discountAmount || 0) > 0 ? `-₹${(p.discountAmount || 0).toLocaleString()}` : '—'}
                      </td>
                      <td style={{ padding: '0.75rem', fontSize: '0.85rem', color: 'var(--customer-text-main)', textAlign: 'right', fontWeight: 600 }}>
                        ₹{(p.finalAmount || 0).toLocaleString()}
                      </td>
                      <td style={{ padding: '0.75rem', fontSize: '0.8rem', color: 'var(--customer-text-secondary)', wordBreak: 'break-all' }}>
                        {p.upiTransactionRef || '—'}
                      </td>
                      <td style={{ padding: '0.75rem' }}>
                        <span style={{
                          display: 'inline-block',
                          padding: '0.2rem 0.6rem',
                          borderRadius: '0.5rem',
                          fontSize: '0.7rem',
                          fontWeight: 600,
                          background: p.paymentStatus === 'paid' ? 'var(--cp-success-bg)' : p.paymentStatus === 'failed' ? 'var(--danger-light)' : 'var(--customer-muted-bg)',
                          color: statusColor(p.paymentStatus)
                        }}>
                          {p.paymentStatus}
                        </span>
                      </td>
                      <td style={{ padding: '0.75rem', fontSize: '0.8rem', color: 'var(--customer-text-main)' }}>
                        {formatDate(p.paymentDate)}
                      </td>
                      <td style={{ padding: '0.75rem', textAlign: 'center' }}>
                        {p.paymentStatus === 'pending' && (
                          <div style={{ display: 'flex', gap: '0.25rem', flexDirection: 'column' }}>
                            <button
                              onClick={() => {
                                const notes = window.confirm('Approve this UPI payment?\n\nCustomer: ' + p.customerName + '\nAmount: ₹' + (p.finalAmount || 0))
                                if (notes) verifyPayment(p.paymentId || p._id, 'approve', notes)
                              }}
                              disabled={verifying === p.paymentId || verifying === p._id}
                              className="icon-btn enhanced"
                              style={{ padding: '0.25rem', background: 'var(--cp-success-bg)', border: 'none', borderRadius: '0.5rem', color: 'var(--customer-accent-emerald)', cursor: 'pointer' }}
                              title="Approve"
                            >
                              <CheckCircle className="h-3 w-3" />
                            </button>
                            <button
                              onClick={() => {
                                const notes = window.prompt('Reject reason (optional):', '')
                                if (notes !== null) verifyPayment(p.paymentId || p._id, 'reject', notes)
                              }}
                              disabled={verifying === p.paymentId || verifying === p._id}
                              className="icon-btn enhanced"
                              style={{ padding: '0.25rem', background: 'var(--danger-light)', border: 'none', borderRadius: '0.5rem', color: 'var(--cp-danger)', cursor: 'pointer' }}
                              title="Reject"
                            >
                              <XCircle className="h-3 w-3" />
                            </button>
                          </div>
                        )}
                        {p.paymentStatus !== 'pending' && (
                          <span style={{ fontSize: '0.7rem', color: 'var(--customer-text-secondary)' }}>{p.paymentStatus === 'paid' ? 'Verified' : 'Processed'}</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <Pagination
            page={meta.page}
            totalPages={meta.totalPages}
            total={meta.total}
            limit={meta.limit}
            onPageChange={(p) => fetchPayments({ page: p })}
            onLimitChange={(l) => fetchPayments({ page: 1, limit: l })}
            itemLabel="payments"
            disabled={loading}
          />
        </div>
      </div>
    </AdminLayout>
  )
}

export default AdminUpiPayments
