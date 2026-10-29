import { useEffect, useState } from 'react'
import { Mail, Search, Eye, Users, Send, AlertCircle, CheckCircle, Clock, ShieldCheck, Download, RefreshCw, Copy, Phone } from 'lucide-react'
import { api, readPagination } from '../../api'
import Pagination from '../../components/Pagination'
import '../Dashboard.css'

const typeLabel = (t) => ({
  booking_update: 'Booking Update',
  itinerary_update: 'Itinerary Update',
  general: 'General Announcement',
  disruption: 'Disruption Alert'
}[t] || t)

const channelLabel = (c) => ({
  in_app: 'In-App Only',
  email: 'Email Only',
  both: 'In-App + Email'
}[c] || c)

const statusLabel = (s) => ({
  sent: 'Sent',
  partial: 'Partial',
  failed: 'Failed'
}[s] || s)

const OperatorCustomerCommunication = () => {
  const [bookings, setBookings] = useState([])
  const [packages, setPackages] = useState([])
  const [customers, setCustomers] = useState([])
  const [communications, setCommunications] = useState([])
  const [commsLoading, setCommsLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [sending, setSending] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [typeFilter, setTypeFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(10)
  const [meta, setMeta] = useState({ page: 1, limit: 10, total: 0, totalPages: 1, hasNext: false, hasPrev: false })

  // Compose form state
  const [form, setForm] = useState({
    type: 'booking_update',
    channel: 'both',
    title: '',
    message: '',
    recipientType: 'single',
    customerId: '',
    bookingId: '',
    packageId: ''
  })

  const hasLocalFilters = searchTerm !== '' || typeFilter !== 'all' || statusFilter !== 'all'

  const fetchReferenceData = async () => {
    try {
      const [bResp, pResp, cResp] = await Promise.all([
        api('/operator/bookings', { params: { page: 1, limit: 200 } }),
        api('/operator/packages', { params: { page: 1, limit: 200 } }),
        api('/operator/customers', { params: { page: 1, limit: 200 } })
      ])
      if (bResp.bookings) setBookings(bResp.bookings)
      if (pResp.packages) setPackages(pResp.packages)
      if (cResp.customers) setCustomers(cResp.customers)
    } catch (err) {
      console.error('Error loading reference data:', err)
    }
  }

  const fetchCommunications = async (overrides = {}) => {
    const nextPage = overrides.page ?? page
    const nextLimit = overrides.limit ?? limit
    try {
      setCommsLoading(true)
      setError('')
      const data = await api('/operator/communication', {
        params: {
          page: hasLocalFilters ? undefined : nextPage,
          limit: hasLocalFilters ? 'all' : nextLimit,
          search: searchTerm,
          type: typeFilter !== 'all' ? typeFilter : undefined,
          status: statusFilter !== 'all' ? statusFilter : undefined
        }
      })
      if (data.communications) {
        setCommunications(data.communications)
      }
      setMeta(readPagination(data, data.communications?.length || 0))
    } catch (err) {
      setError(err.message || 'Failed to load communications')
    } finally {
      setCommsLoading(false)
    }
  }

  useEffect(() => {
    Promise.resolve().then(() => fetchReferenceData())
    Promise.resolve().then(() => fetchCommunications())
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const timer = setTimeout(() => {
      setPage(1)
      fetchCommunications({ page: 1 })
    }, 350)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchTerm, typeFilter, statusFilter])

  const handlePageChange = (nextPage) => {
    setPage(nextPage)
    setCommsLoading(true)
  }

  const handleLimitChange = (nextLimit) => {
    setLimit(nextLimit)
    setPage(1)
    setCommsLoading(true)
  }

  const handleSend = async (e) => {
    e.preventDefault()
    setSending(true)
    setError('')
    setSuccess('')
    try {
      await api('/operator/communication', {
        method: 'POST',
        body: JSON.stringify(form)
      })
      setSuccess('Communication sent successfully!')
      setForm({
        type: form.type,
        channel: form.channel,
        title: '',
        message: '',
        recipientType: form.recipientType,
        customerId: '',
        bookingId: '',
        packageId: ''
      })
      await fetchCommunications()
    } catch (err) {
      setError(err.message || 'Failed to send communication')
    } finally {
      setSending(false)
    }
  }

  const recipientCount = (() => {
    if (form.recipientType === 'single') return form.customerId ? 1 : 0
    if (form.recipientType === 'booking') {
      const b = bookings.find(b => b._id === form.bookingId)
      return b && b.customerId ? 1 : 0
    }
    if (form.recipientType === 'package') {
      const p = packages.find(p => p._id === form.packageId)
      if (!p) return 0
      return bookings.filter(b => b.packageId === p._id && ['pending', 'confirmed'].includes(b.status)).length
    }
    if (form.recipientType === 'all_confirmed') {
      return bookings.filter(b => b.status === 'confirmed').length
    }
    return 0
  })()

  const filteredCommunications = hasLocalFilters
    ? communications.filter(c => {
        const matchesSearch = c.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                              c.message?.toLowerCase().includes(searchTerm.toLowerCase())
        const matchesType = typeFilter === 'all' || c.type === typeFilter
        const matchesStatus = statusFilter === 'all' || c.status === statusFilter
        return matchesSearch && matchesType && matchesStatus
      })
    : communications

  const totalCount = communications.length
  const sentCount = communications.filter(c => c.status === 'sent').length
  const partialCount = communications.filter(c => c.status === 'partial').length
  const failedCount = communications.filter(c => c.status === 'failed').length

  const getTypeColor = (t) => ({
    booking_update: '#3b82f6',
    itinerary_update: '#8b5cf6',
    general: '#64748b',
    disruption: '#ef4444'
  }[t] || '#64748b')

  const getStatusColor = (s) => ({
    sent: '#166534',
    partial: '#d97706',
    failed: '#991b1b'
  }[s] || '#64748b')

  const bookingLabel = (b) => `${b.customer || 'Customer'} — ${b.package || 'Package'} (${b.bookingId || b._id})`
  const packageLabel = (p) => `${p.name} — ${p.destination || ''}`

  return (
    <>
      <div className="comm-header">
        <div className="comm-header-content">
          <div className="comm-header-icon">
            <Mail className="h-6 w-6" />
          </div>
          <div>
            <h2>Customer Communication</h2>
            <p>Send booking and itinerary updates to customers via in-app and email.</p>
          </div>
        </div>
        <div className="comm-header-actions">
          <button className="action-btn enhanced" onClick={fetchCommunications} title="Refresh"><RefreshCw className="h-4 w-4" /></button>
          <button className="action-btn enhanced" onClick={() => {
            // placeholder for future export
          }} title="Export"><Download className="h-4 w-4" /></button>
        </div>
      </div>

      {error && <div className="error-message enhanced"><AlertCircle className="h-4 w-4" /><div className="error-message-content"><strong>Error</strong><p>{error}</p></div></div>}
      {success && <div className="success-message enhanced"><CheckCircle className="h-4 w-4" /><span>{success}</span></div>}

      <div className="comm-stats">
        <div className="comm-stat-card">
          <div className="comm-stat-icon"><Mail className="h-5 w-5" /></div>
          <div className="comm-stat-content">
            <h3>Total Sent</h3>
            <p className="comm-stat-number">{totalCount}</p>
          </div>
        </div>
        <div className="comm-stat-card sent">
          <div className="comm-stat-icon"><CheckCircle className="h-5 w-5" /></div>
          <div className="comm-stat-content">
            <h3>Sent</h3>
            <p className="comm-stat-number">{sentCount}</p>
          </div>
        </div>
        <div className="comm-stat-card partial">
          <div className="comm-stat-icon"><Clock className="h-5 w-5" /></div>
          <div className="comm-stat-content">
            <h3>Partial</h3>
            <p className="comm-stat-number">{partialCount}</p>
          </div>
        </div>
        <div className="comm-stat-card failed">
          <div className="comm-stat-icon"><AlertCircle className="h-5 w-5" /></div>
          <div className="comm-stat-content">
            <h3>Failed</h3>
            <p className="comm-stat-number">{failedCount}</p>
          </div>
        </div>
      </div>

      <div className="filters-section enhanced">
        <div className="search-bar enhanced">
          <Search className="search-icon" />
          <input
            type="text"
            placeholder="Search by title, message or customer..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="filter-controls enhanced">
          <div className="filter-group">
            <label>Message Type</label>
            <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} className="filter-select enhanced">
              <option value="all">All Types</option>
              <option value="booking_update">Booking Update</option>
              <option value="itinerary_update">Itinerary Update</option>
              <option value="general">General Announcement</option>
              <option value="disruption">Disruption Alert</option>
            </select>
          </div>
          <div className="filter-group">
            <label>Delivery Status</label>
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="filter-select enhanced">
              <option value="all">All Status</option>
              <option value="sent">Sent</option>
              <option value="partial">Partial</option>
              <option value="failed">Failed</option>
            </select>
          </div>
        </div>
      </div>

      <div className="compose-section enhanced">
        <div className="section-card enhanced">
          <div className="section-header">
            <div className="section-icon">
              <ShieldCheck className="h-4 w-4" />
            </div>
            <div>
              <h3>Compose Communication</h3>
              <p>Create and send a new update to your customers.</p>
            </div>
          </div>
          <form onSubmit={handleSend} className="compose-form">
            <div className="form-row">
              <div className="form-group">
                <label>Message Type</label>
                <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} required>
                  <option value="booking_update">Booking Update</option>
                  <option value="itinerary_update">Itinerary Update</option>
                  <option value="general">General Announcement</option>
                  <option value="disruption">Disruption Alert</option>
                </select>
              </div>
              <div className="form-group">
                <label>Channel</label>
                <select value={form.channel} onChange={(e) => setForm({ ...form, channel: e.target.value })} required>
                  <option value="both">In-App + Email</option>
                  <option value="in_app">In-App Only</option>
                  <option value="email">Email Only</option>
                </select>
              </div>
            </div>
            <div className="form-group">
              <label>Title</label>
              <input type="text" required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="e.g. Itinerary change for Kerala Backwater tour" />
            </div>
            <div className="form-group">
              <label>Message</label>
              <textarea required value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} rows={4} placeholder="Write your update to customers..." />
            </div>
            <div className="form-group">
              <label>Recipients</label>
              <select value={form.recipientType} onChange={(e) => {
                const val = e.target.value
                setForm({ ...form, recipientType: val, customerId: '', bookingId: '', packageId: '' })
              }} required>
                <option value="single">Single Customer</option>
                <option value="booking">Specific Booking</option>
                <option value="package">Package Customers</option>
                <option value="all_confirmed">All Confirmed Bookings</option>
              </select>
            </div>
            {form.recipientType === 'single' && (
              <div className="form-group">
                <label>Customer</label>
                <select value={form.customerId} onChange={(e) => setForm({ ...form, customerId: e.target.value })} required>
                  <option value="">Select a customer</option>
                  {customers.map(c => (
                    <option key={c._id} value={c._id}>{c.fullName} ({c.email})</option>
                  ))}
                </select>
              </div>
            )}
            {form.recipientType === 'booking' && (
              <div className="form-group">
                <label>Booking</label>
                <select value={form.bookingId} onChange={(e) => setForm({ ...form, bookingId: e.target.value })} required>
                  <option value="">Select a booking</option>
                  {bookings.map(b => (
                    <option key={b._id} value={b._id}>{bookingLabel(b)}</option>
                  ))}
                </select>
              </div>
            )}
            {form.recipientType === 'package' && (
              <div className="form-group">
                <label>Package</label>
                <select value={form.packageId} onChange={(e) => setForm({ ...form, packageId: e.target.value })} required>
                  <option value="">Select a package</option>
                  {packages.map(p => (
                    <option key={p._id} value={p._id}>{packageLabel(p)}</option>
                  ))}
                </select>
              </div>
            )}
            <div className="form-group recipient-preview">
              <label>Estimated Recipients</label>
              <div className="recipient-count-badge">
                <Users className="h-4 w-4" />
                <span>{recipientCount} customer{recipientCount === 1 ? '' : 's'}</span>
              </div>
            </div>
            <div className="form-actions">
              <button type="button" onClick={() => {
                setForm({ ...form, title: '', message: '' })
                setSuccess('')
                setError('')
              }} className="btn-secondary">Clear</button>
              <button type="submit" className="btn-primary enhanced" disabled={sending || !recipientCount}>
                {sending ? <><Clock className="h-4 w-4" /> Sending...</> : <><Send className="h-4 w-4" /> Send Communication</>}
              </button>
            </div>
          </form>
        </div>
      </div>

      <div className="audit-section enhanced">
        <div className="section-card enhanced">
          <div className="section-header">
            <div className="section-icon">
              <Clock className="h-4 w-4" />
            </div>
            <div>
              <h3>Communication Audit Trail</h3>
              <p>History of all booking/itinerary updates sent to customers.</p>
            </div>
          </div>
          {commsLoading ? (
            <div style={{ textAlign: 'center', padding: '3rem' }}>
              <div className="spinner" style={{ display: 'inline-block', marginBottom: '1rem' }}></div>
              <p>Loading audit trail...</p>
            </div>
          ) : filteredCommunications.length === 0 ? (
            <div className="empty-state enhanced">
              <AlertCircle className="h-8 w-8" />
              <h3>No communications sent yet</h3>
              <p>Use the compose form above to send your first update.</p>
            </div>
          ) : (
            <div className="table-container enhanced">
              <table className="data-table enhanced">
                <thead>
                  <tr>
                    <th>Sent At</th><th>Type</th><th>Channel</th><th>Title</th><th>Recipients</th><th>Status</th><th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredCommunications.map(c => (
                    <tr key={c._id}>
                      <td className="cell-ellipsis" title={new Date(c.sentAt).toLocaleString()}>{new Date(c.sentAt).toLocaleString()}</td>
                      <td>
                        <span className="comm-type-badge" style={{ backgroundColor: `${getTypeColor(c.type)}15`, color: getTypeColor(c.type) }}>{typeLabel(c.type)}</span>
                      </td>
                      <td>
                        <span className="comm-channel-chip">{channelLabel(c.channel)}</span>
                      </td>
                      <td className="cell-ellipsis" title={c.title}>{c.title}</td>
                      <td className="comm-recipient-cell">{c.recipientCount}</td>
                      <td><span className={`status-badge enhanced ${c.status}`} style={{ backgroundColor: `${getStatusColor(c.status)}15`, color: getStatusColor(c.status) }}>{statusLabel(c.status)}</span></td>
                      <td>
                        <div className="action-buttons enhanced">
                          <button className="icon-btn enhanced view" title="View Details"><Eye className="h-4 w-4" /></button>
                          <button className="icon-btn enhanced copy" title="Copy Message"><Copy className="h-4 w-4" /></button>
                          <button className="icon-btn enhanced send" title="Resend"><Phone className="h-4 w-4" /></button>
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
                itemLabel="communications"
                disabled={commsLoading}
              />
            </div>
          )}
        </div>
      </div>
    </>
  )
}

export default OperatorCustomerCommunication
