import { useEffect, useState } from 'react'
import { FileText, Star, Plus, Trash2, Search, Download, DollarSign } from 'lucide-react'
import { api, downloadCsv, formValues, formatCurrency, formatDate } from '../../api'
import AdminLayout from './AdminLayout'

const InvoicesReviews = () => {
  const [activeTab, setActiveTab] = useState('invoices')
  const [invoices, setInvoices] = useState([])
  const [reviews, setReviews] = useState([])
  const [packages, setPackages] = useState([])
  const [searchTerm, setSearchTerm] = useState('')
  const [filterStatus, setFilterStatus] = useState('all')
  const [showAddModal, setShowAddModal] = useState(false)
  const [showReviewModal, setShowReviewModal] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  const load = async () => {
    try {
      setError('')
      const [invoiceData, reviewData, packageData] = await Promise.all([
        api('/admin/invoices'),
        api('/admin/reviews'),
        api('/admin/packages')
      ])
      setInvoices((invoiceData.invoices || []).map((invoice) => ({
        id: invoice._id,
        invoiceNo: invoice.invoiceNo,
        customer: invoice.customer,
        email: invoice.email,
        package: invoice.package,
        amount: invoice.amount,
        status: invoice.status,
        date: formatDate(invoice.date),
        dueDate: formatDate(invoice.dueDate)
      })))
      setReviews((reviewData.reviews || []).map((review) => ({
        id: review._id,
        customer: review.customer,
        package: review.package,
        rating: review.rating,
        comment: review.comment,
        status: review.status,
        date: formatDate(review.date)
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

  const filteredInvoices = invoices.filter((invoice) => {
    const haystack = `${invoice.customer} ${invoice.invoiceNo} ${invoice.package}`.toLowerCase()
    return haystack.includes(searchTerm.toLowerCase()) && (filterStatus === 'all' || invoice.status === filterStatus)
  })
  const filteredReviews = reviews.filter((review) => {
    const haystack = `${review.customer} ${review.package}`.toLowerCase()
    return haystack.includes(searchTerm.toLowerCase()) && (filterStatus === 'all' || review.status === filterStatus)
  })

  const handleDeleteInvoice = async (id) => {
    if (!window.confirm('Delete this invoice?')) return
    try {
      await api(`/admin/invoices/${id}`, { method: 'DELETE' })
      setInvoices(invoices.filter((invoice) => invoice.id !== id))
    } catch (err) {
      alert(err.message)
    }
  }

  const handleDeleteReview = async (id) => {
    if (!window.confirm('Delete this review?')) return
    try {
      await api(`/admin/reviews/${id}`, { method: 'DELETE' })
      setReviews(reviews.filter((review) => review.id !== id))
    } catch (err) {
      alert(err.message)
    }
  }

  const updateReviewStatus = async (id, status) => {
    try {
      await api(`/admin/reviews/${id}`, { method: 'PUT', body: JSON.stringify({ status }) })
      setReviews(reviews.map((review) => review.id === id ? { ...review, status } : review))
    } catch (err) {
      alert(err.message)
    }
  }

  const handleCreateReview = async (e) => {
    e.preventDefault()
    const values = formValues(e.target)
    try {
      await api('/admin/reviews', {
        method: 'POST',
        body: JSON.stringify({
          customer: values.customer,
          package: values.package,
          rating: Number(values.rating),
          comment: values.comment,
          status: values.status || 'approved'
        })
      })
      setShowReviewModal(false)
      load()
    } catch (err) {
      alert(err.message)
    }
  }

  const handleCreateInvoice = async (e) => {
    e.preventDefault()
    const values = formValues(e.target)
    try {
      await api('/admin/invoices', {
        method: 'POST',
        body: JSON.stringify({
          customer: values.customer,
          email: values.email,
          package: values.package,
          amount: Number(values.amount),
          dueDate: values.dueDate,
          status: 'pending'
        })
      })
      setShowAddModal(false)
      load()
    } catch (err) {
      alert(err.message)
    }
  }

  const downloadInvoice = (invoice) => {
    const text = [
      `Invoice ${invoice.invoiceNo}`,
      `Customer: ${invoice.customer}`,
      `Email: ${invoice.email}`,
      `Package: ${invoice.package}`,
      `Amount: ₹${invoice.amount}`,
      `Status: ${invoice.status}`,
      `Date: ${invoice.date}`,
      `Due: ${invoice.dueDate}`
    ].join('\n')
    const blob = new Blob([text], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `${invoice.invoiceNo}.txt`
    link.click()
    URL.revokeObjectURL(url)
  }

  const avgRating = reviews.length ? (reviews.reduce((sum, review) => sum + review.rating, 0) / reviews.length).toFixed(1) : '0.0'

  return (
    <AdminLayout
      active="invoices"
      title="Invoices & Reviews"
      actions={
        <>
          <button className="action-btn" onClick={() => {
            if (activeTab === 'invoices') downloadCsv('invoices.csv', ['Invoice', 'Customer', 'Email', 'Package', 'Amount', 'Status', 'Date', 'Due'], filteredInvoices.map((i) => [i.invoiceNo, i.customer, i.email, i.package, i.amount, i.status, i.date, i.dueDate]))
            else downloadCsv('reviews.csv', ['Customer', 'Package', 'Rating', 'Comment', 'Status', 'Date'], filteredReviews.map((r) => [r.customer, r.package, r.rating, r.comment, r.status, r.date]))
          }}><Download className="h-4 w-4" /> Export</button>
          {activeTab === 'invoices' && <button className="action-btn" onClick={() => setShowAddModal(true)}><Plus className="h-4 w-4" /> Create Invoice</button>}
          {activeTab === 'reviews' && <button className="action-btn" onClick={() => setShowReviewModal(true)}><Plus className="h-4 w-4" /> Add Review</button>}
        </>
      }
    >
      {error && <div className="error-message">{error}</div>}
      <div className="tabs">
        <button className={`tab ${activeTab === 'invoices' ? 'active' : ''}`} onClick={() => { setActiveTab('invoices'); setFilterStatus('all') }}><FileText className="h-4 w-4" /> Invoices</button>
        <button className={`tab ${activeTab === 'reviews' ? 'active' : ''}`} onClick={() => { setActiveTab('reviews'); setFilterStatus('all') }}><Star className="h-4 w-4" /> Reviews</button>
      </div>
      <div className="filters-section">
        <div className="search-bar">
          <Search className="search-icon" />
          <input value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} placeholder={`Search ${activeTab}...`} />
        </div>
        <div className="filter-controls">
          <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="filter-select">
            <option value="all">All Status</option>
            {activeTab === 'invoices' ? (
              <>
                <option value="paid">Paid</option>
                <option value="pending">Pending</option>
                <option value="overdue">Overdue</option>
              </>
            ) : (
              <>
                <option value="approved">Approved</option>
                <option value="pending">Pending</option>
                <option value="rejected">Rejected</option>
              </>
            )}
          </select>
        </div>
      </div>

      {activeTab === 'invoices' && (
        <>
          <div className="stats-grid">
            <div className="stat-card"><FileText className="stat-icon" /><div className="stat-content"><h3>Total Invoices</h3><p className="stat-number">{invoices.length}</p></div></div>
            <div className="stat-card"><DollarSign className="stat-icon" /><div className="stat-content"><h3>Total Amount</h3><p className="stat-number">{formatCurrency(invoices.reduce((sum, inv) => sum + inv.amount, 0))}</p></div></div>
            <div className="stat-card"><DollarSign className="stat-icon" /><div className="stat-content"><h3>Paid</h3><p className="stat-number">{formatCurrency(invoices.filter((i) => i.status === 'paid').reduce((sum, inv) => sum + inv.amount, 0))}</p></div></div>
            <div className="stat-card"><DollarSign className="stat-icon" /><div className="stat-content"><h3>Pending</h3><p className="stat-number">{formatCurrency(invoices.filter((i) => i.status !== 'paid').reduce((sum, inv) => sum + inv.amount, 0))}</p></div></div>
          </div>
          <div className="section-card full-width">
            <h3>Invoices ({filteredInvoices.length})</h3>
            {loading ? <div style={{ padding: '2rem', textAlign: 'center' }}>Loading...</div> : (
              <div className="table-container">
                <table className="data-table">
                  <thead><tr><th>Invoice No</th><th>Customer</th><th>Email</th><th>Package</th><th>Amount</th><th>Status</th><th>Date</th><th>Due Date</th><th>Actions</th></tr></thead>
                  <tbody>
                    {filteredInvoices.length === 0 ? <tr><td colSpan="9" style={{ textAlign: 'center', padding: '2rem' }}>No invoices found</td></tr> : filteredInvoices.map((invoice) => (
                      <tr key={invoice.id}>
                        <td className="invoice-no">{invoice.invoiceNo}</td>
                        <td>{invoice.customer}</td>
                        <td>{invoice.email}</td>
                        <td>{invoice.package}</td>
                        <td>₹{invoice.amount.toLocaleString()}</td>
                        <td>
                          <select className="status-select" value={invoice.status} onChange={(e) => api(`/admin/invoices/${invoice.id}`, { method: 'PUT', body: JSON.stringify({ status: e.target.value }) }).then(load).catch((err) => console.error('Status update failed:', err))}>
                            <option value="paid">paid</option>
                            <option value="pending">pending</option>
                            <option value="overdue">overdue</option>
                          </select>
                        </td>
                        <td>{invoice.date}</td>
                        <td>{invoice.dueDate}</td>
                        <td>
                          <div className="action-buttons">
                            <button className="icon-btn download" onClick={() => downloadInvoice(invoice)}><Download className="h-4 w-4" /></button>
                            <button className="icon-btn delete" onClick={() => handleDeleteInvoice(invoice.id)}><Trash2 className="h-4 w-4" /></button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {activeTab === 'reviews' && (
        <>
          <div className="stats-grid">
            <div className="stat-card"><Star className="stat-icon" /><div className="stat-content"><h3>Total Reviews</h3><p className="stat-number">{reviews.length}</p></div></div>
            <div className="stat-card"><Star className="stat-icon" /><div className="stat-content"><h3>Average Rating</h3><p className="stat-number">{avgRating}</p></div></div>
            <div className="stat-card"><FileText className="stat-icon" /><div className="stat-content"><h3>Pending Approval</h3><p className="stat-number">{reviews.filter((r) => r.status === 'pending').length}</p></div></div>
          </div>
          <div className="section-card full-width">
            <h3>Reviews ({filteredReviews.length})</h3>
            <div className="reviews-list">
              {filteredReviews.length === 0 && <div style={{ padding: '2rem', textAlign: 'center' }}>No reviews found</div>}
              {filteredReviews.map((review) => (
                <div key={review.id} className="review-item">
                  <div className="review-header">
                    <div className="reviewer-info">
                      <span className="reviewer">{review.customer}</span>
                      <span className="review-package">{review.package}</span>
                    </div>
                    <div className="review-meta">
                      <div className="rating">
                        {[...Array(5)].map((_, i) => <Star key={i} className={`h-4 w-4 ${i < review.rating ? 'fill' : ''}`} />)}
                      </div>
                      <span className={`status-badge ${review.status}`}>{review.status}</span>
                    </div>
                  </div>
                  <p className="review-text">{review.comment}</p>
                  <div className="review-footer">
                    <span className="review-date">{review.date}</span>
                    <div className="review-actions">
                      {review.status === 'pending' && (
                        <>
                          <button className="btn-approve" onClick={() => updateReviewStatus(review.id, 'approved')}>Approve</button>
                          <button className="btn-reject" onClick={() => updateReviewStatus(review.id, 'rejected')}>Reject</button>
                        </>
                      )}
                      <button className="icon-btn delete" onClick={() => handleDeleteReview(review.id)}><Trash2 className="h-4 w-4" /></button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {showReviewModal && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header"><h3>Add Review</h3><button className="modal-close" onClick={() => setShowReviewModal(false)}>×</button></div>
            <div className="modal-body">
              <form className="invoice-form" onSubmit={handleCreateReview}>
                <div className="form-group"><label>Customer Name</label><input name="customer" required /></div>
                <div className="form-group">
                  <label>Package</label>
                  <select name="package" required>
                    <option value="">Select Package</option>
                    {packages.map((pkg) => <option key={pkg._id} value={pkg.name}>{pkg.name}</option>)}
                  </select>
                </div>
                <div className="form-row">
                  <div className="form-group"><label>Rating (1-5)</label><input name="rating" type="number" min="1" max="5" defaultValue="5" required /></div>
                  <div className="form-group">
                    <label>Status</label>
                    <select name="status" defaultValue="approved">
                      <option value="approved">Approved</option>
                      <option value="pending">Pending</option>
                    </select>
                  </div>
                </div>
                <div className="form-group"><label>Comment</label><textarea name="comment" rows="3" required /></div>
                <div className="form-actions">
                  <button type="button" className="btn-secondary" onClick={() => setShowReviewModal(false)}>Cancel</button>
                  <button type="submit" className="btn-primary">Add Review</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {showAddModal && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header"><h3>Create Invoice</h3><button className="modal-close" onClick={() => setShowAddModal(false)}>×</button></div>
            <div className="modal-body">
              <form className="invoice-form" onSubmit={handleCreateInvoice}>
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
                  <div className="form-group"><label>Amount (₹)</label><input name="amount" type="number" required /></div>
                  <div className="form-group"><label>Due Date</label><input name="dueDate" type="date" required /></div>
                </div>
                <div className="form-actions">
                  <button type="button" className="btn-secondary" onClick={() => setShowAddModal(false)}>Cancel</button>
                  <button type="submit" className="btn-primary">Create Invoice</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  )
}

export default InvoicesReviews
