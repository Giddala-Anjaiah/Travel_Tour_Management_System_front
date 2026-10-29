import { useEffect, useState } from 'react'
import { Ticket, ChevronRight, ShieldCheck, Clock, CheckCircle, AlertCircle } from 'lucide-react'
import { api, formatDate } from '../../api'
import CustomerLayout from './CustomerLayout'

const priorityLabel = (p) => ({ low: 'Low', medium: 'Medium', high: 'High', urgent: 'Urgent' }[p] || p)
const statusLabel = (s) => ({ open: 'Open', in_progress: 'In Progress', resolved: 'Resolved', closed: 'Closed', escalated: 'Escalated' }[s] || s)
const categoryLabel = (c) => ({ billing: 'Billing', booking: 'Booking', technical: 'Technical', account: 'Account', refund: 'Refund', cancellation: 'Cancellation', general: 'General' }[c] || c)

const priorityColors = { low: '#10b981', medium: '#3b82f6', high: '#f59e0b', urgent: '#ef4444' }
const statusColors = { open: '#6b7280', in_progress: '#3b82f6', resolved: '#10b981', closed: '#6b7280', escalated: '#ef4444' }

const CustomerSupport = () => {
  const [tickets, setTickets] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [creating, setCreating] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [showDetail, setShowDetail] = useState(false)
  const [selectedTicket, setSelectedTicket] = useState(null)
  const [newMessage, setNewMessage] = useState('')
  const [detailLoading, setDetailLoading] = useState(false)

  const [form, setForm] = useState({
    subject: '',
    category: 'general',
    priority: 'medium',
    description: ''
  })

  const loadTickets = async () => {
    try {
      setError('')
      const data = await api('/customer/tickets', {
        params: { page: 1, limit: 100 }
      })
      const mapped = (data.tickets || []).map((t) => ({
        id: t._id,
        ticketId: t.ticketId,
        subject: t.subject,
        category: t.category,
        priority: t.priority,
        status: t.status,
        createdAt: formatDate(t.createdAt),
        updatedAt: formatDate(t.updatedAt),
        messageCount: (t.messages || []).length,
        satisfactionRating: t.satisfactionRating,
        description: t.description,
        messages: (t.messages || []).map((m) => ({
          senderName: m.senderName,
          senderRole: m.senderRole,
          message: m.message,
          isInternal: m.isInternal,
          createdAt: formatDate(m.createdAt)
        }))
      }))
      setTickets(mapped)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const loadTicketDetail = async (ticketId) => {
    setDetailLoading(true)
    try {
      const data = await api(`/customer/tickets/${ticketId}`)
      const t = data.ticket
      setSelectedTicket({
        id: t._id,
        ticketId: t.ticketId,
        subject: t.subject,
        category: t.category,
        priority: t.priority,
        status: t.status,
        createdAt: formatDate(t.createdAt),
        updatedAt: formatDate(t.updatedAt),
        messageCount: (t.messages || []).length,
        satisfactionRating: t.satisfactionRating,
        description: t.description,
        messages: (t.messages || []).map((m) => ({
          senderName: m.senderName,
          senderRole: m.senderRole,
          message: m.message,
          isInternal: m.isInternal,
          createdAt: formatDate(m.createdAt)
        }))
      })
    } catch (err) {
      setError(err.message || 'Failed to load ticket details')
    } finally {
      setDetailLoading(false)
    }
  }

  useEffect(() => { Promise.resolve().then(() => loadTickets()) }, [])

  const totalTickets = tickets.length
  const activeTickets = tickets.filter(t => t.status === 'open' || t.status === 'in_progress').length
  const resolvedTickets = tickets.filter(t => t.status === 'resolved').length
  const pendingTickets = tickets.filter(t => t.status === 'open').length

  const handleSubmit = async (e) => {
    e.preventDefault()
    setCreating(true)
    setError('')
    setSuccess('')
    try {
      const user = JSON.parse(localStorage.getItem('user') || '{}')
      await api('/customer/tickets', {
        method: 'POST',
        body: JSON.stringify({
          customerName: user.fullName || 'Customer',
          customerEmail: user.email,
          subject: form.subject,
          category: form.category,
          priority: form.priority,
          description: form.description,
          tags: ['customer-portal']
        })
      })
      setSuccess('Ticket created successfully!')
      setShowForm(false)
      setForm({ subject: '', category: 'general', priority: 'medium', description: '' })
      await loadTickets()
    } catch (err) {
      setError(err.message || 'Failed to create ticket')
    } finally {
      setCreating(false)
    }
  }

  const handleAddCustomerReply = async () => {
    if (!newMessage.trim()) return
    try {
      await api(`/admin/tickets/${selectedTicket.id}/messages`, {
        method: 'POST',
        body: JSON.stringify({
          senderName: 'Customer',
          senderRole: 'customer',
          message: newMessage,
          isInternal: false
        })
      })
      setNewMessage('')
      setShowDetail(false)
      await loadTickets()
    } catch (err) { alert(err.message || 'Failed to send reply') }
  }

  return (
    <CustomerLayout active="support">
      <div className="support-page">
        {error && <div className="error-message">{error}</div>}
        {success && <div className="success-message">{success}</div>}

        <div className="section-header">
          <div>
            <Ticket className="h-5 w-5" />
            <div>
              <h2>Support & Help</h2>
              <p>Get help with your bookings, payments, or account.</p>
            </div>
          </div>
        </div>

        <div className="support-grid">
          <div className="support-card enhanced">
            <div className="card-header">
              <div className="card-icon support-card-icon">
                <Ticket className="h-5 w-5" />
              </div>
              <div>
                <h3>Submit a Support Ticket</h3>
                <p>Having an issue? Create a support ticket and our team will get back to you.</p>
              </div>
            </div>
            <button className="btn-primary enhanced" onClick={() => setShowForm(true)}>
              <Ticket className="h-4 w-4" /> New Ticket
            </button>
          </div>

          <div className="support-card enhanced">
            <div className="card-header">
              <div className="card-icon support-card-icon">
                <ShieldCheck className="h-5 w-5" />
              </div>
              <div>
                <h3>FAQs</h3>
                <p>Common questions and answers.</p>
              </div>
            </div>
            <ul className="faq-list">
              <li><strong>How do I cancel a booking?</strong> Go to Bookings and select Cancel.</li>
              <li><strong>How long do refunds take?</strong> Refunds are processed within 5-7 business days.</li>
              <li><strong>How can I change my travel dates?</strong> Contact support with your booking ID.</li>
            </ul>
          </div>
        </div>

        <div className="tickets-section-header">
          <div>
            <Ticket className="h-5 w-5" />
            <div>
              <h2>Your Support Tickets</h2>
              <p>Track your requests and get updates from our support team.</p>
            </div>
          </div>
          <span className="ticket-count-badge">{totalTickets} ticket{totalTickets !== 1 ? 's' : ''}</span>
        </div>

        {!loading && tickets.length > 0 && (
          <div className="support-stats">
            <div className="stat-card">
              <div className="stat-icon">
                <Ticket className="h-5 w-5" />
              </div>
              <div>
                <div className="stat-label">Total Tickets</div>
                <div className="stat-value">{totalTickets}</div>
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-icon">
                <Clock className="h-5 w-5" />
              </div>
              <div>
                <div className="stat-label">Open / In Progress</div>
                <div className="stat-value">{activeTickets}</div>
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-icon">
                <CheckCircle className="h-5 w-5" />
              </div>
              <div>
                <div className="stat-label">Resolved</div>
                <div className="stat-value">{resolvedTickets}</div>
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-icon">
                <AlertCircle className="h-5 w-5" />
              </div>
              <div>
                <div className="stat-label">Pending Response</div>
                <div className="stat-value">{pendingTickets}</div>
              </div>
            </div>
          </div>
        )}

        {showForm && (
          <div className="section-card enhanced form-card">
            <div className="form-header">
              <Ticket className="h-4 w-4" />
              <h3>Create New Ticket</h3>
            </div>
            <form onSubmit={handleSubmit} className="ticket-form">
              <div className="form-row">
                <div className="form-group">
                  <label>Subject</label>
                  <input type="text" required value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} />
                </div>
                <div className="form-group">
                  <label>Category</label>
                  <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
                    <option value="general">General</option>
                    <option value="booking">Booking</option>
                    <option value="billing">Billing</option>
                    <option value="refund">Refund</option>
                    <option value="cancellation">Cancellation</option>
                    <option value="technical">Technical</option>
                    <option value="account">Account</option>
                  </select>
                </div>
              </div>
              <div className="form-group">
                <label>Priority</label>
                <select value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })}>
                  <option value="medium">Medium</option>
                  <option value="low">Low</option>
                  <option value="high">High</option>
                  <option value="urgent">Urgent</option>
                </select>
              </div>
              <div className="form-group">
                <label>Description</label>
                <textarea required value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={5} placeholder="Describe your issue in detail..." />
              </div>
              <div className="form-actions">
                <button type="button" onClick={() => setShowForm(false)} className="btn-secondary">Cancel</button>
                <button type="submit" className="btn-primary enhanced" disabled={creating}>
                  {creating ? 'Creating...' : 'Create Ticket'}
                </button>
              </div>
            </form>
          </div>
        )}

        {loading ? (
          <div style={{ textAlign: 'center', padding: '3rem' }}>
            <div className="spinner" style={{ display: 'inline-block', marginBottom: '1rem' }}></div>
            <p>Loading tickets...</p>
          </div>
        ) : tickets.length === 0 ? (
          <div className="empty-state enhanced">
            <Ticket className="h-10 w-10" />
            <h3>No support tickets</h3>
            <p>You haven't submitted any support tickets yet. Create one to get help.</p>
          </div>
        ) : (
          <div className="ticket-list-container">
            <table className="data-table enhanced">
              <thead>
                <tr>
                  <th>Ticket ID</th><th>Subject</th><th>Category</th><th>Priority</th><th>Status</th><th>Created</th><th>Messages</th><th className="actions-col">Actions</th>
                </tr>
              </thead>
              <tbody>
                {tickets.map((t) => (
                  <tr key={t.id} className="ticket-row">
                    <td className="cell-ellipsis ticket-id-col" title={t.ticketId}>{t.ticketId}</td>
                    <td className="cell-ellipsis ticket-subject-col" title={t.subject}>{t.subject}</td>
                    <td className="cell-nowrap ticket-category-col">{categoryLabel(t.category)}</td>
                    <td><span className={`priority-badge enhanced ${t.priority}`} style={{ backgroundColor: `${priorityColors[t.priority]}15`, color: priorityColors[t.priority] }}>{priorityLabel(t.priority)}</span></td>
                    <td><span className={`status-badge enhanced ${t.status}`} style={{ backgroundColor: `${statusColors[t.status]}15`, color: statusColors[t.status] }}>{statusLabel(t.status)}</span></td>
                    <td>{t.createdAt}</td>
                    <td>{t.messageCount}</td>
                    <td className="ticket-actions-col">
                      <button onClick={() => { setSelectedTicket(null); setShowDetail(true); loadTicketDetail(t.id) }} className="icon-btn enhanced view" title="View Details"><ChevronRight className="h-4 w-4" /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="ticket-mobile-cards">
              {tickets.map((t) => (
                <div key={t.id} className="ticket-card mobile-card">
                  <div className="ticket-card-header">
                    <div className="ticket-id">{t.ticketId}</div>
                    <span className={`status-badge enhanced ${t.status}`} style={{ backgroundColor: `${statusColors[t.status]}15`, color: statusColors[t.status] }}>{statusLabel(t.status)}</span>
                  </div>
                  <div className="ticket-card-subject">{t.subject}</div>
                  <div className="ticket-card-meta">
                    <div className="meta-item">
                      <span className="meta-label">Category</span>
                      <span className="meta-value">{categoryLabel(t.category)}</span>
                    </div>
                    <div className="meta-item">
                      <span className="meta-label">Priority</span>
                      <span className={`priority-badge enhanced ${t.priority}`} style={{ backgroundColor: `${priorityColors[t.priority]}15`, color: priorityColors[t.priority] }}>{priorityLabel(t.priority)}</span>
                    </div>
                    <div className="meta-item">
                      <span className="meta-label">Created</span>
                      <span className="meta-value">{t.createdAt}</span>
                    </div>
                    <div className="meta-item">
                      <span className="meta-label">Messages</span>
                      <span className="meta-value">{t.messageCount}</span>
                    </div>
                  </div>
                  <button onClick={() => { setSelectedTicket(null); setShowDetail(true); loadTicketDetail(t.id) }} className="btn-primary enhanced" style={{ width: '100%', marginTop: '0.5rem' }}>
                    View Details
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {showDetail && (
          <div className="modal-overlay enhanced" onClick={() => setShowDetail(false)}>
            <div className="modal enhanced" style={{ width: '700px', maxWidth: '90vw' }} onClick={(e) => e.stopPropagation()}>
              {detailLoading ? (
                <div className="modal-body enhanced" style={{ textAlign: 'center', padding: '3rem' }}>
                  <div className="spinner" style={{ display: 'inline-block' }}></div>
                  <p>Loading ticket details...</p>
                </div>
              ) : selectedTicket ? (
                <>
                  <div className="modal-header enhanced">
                    <div>
                      <h3>Ticket #{selectedTicket.ticketId}</h3>
                      <p>{statusLabel(selectedTicket.status)}</p>
                    </div>
                    <button onClick={() => setShowDetail(false)} className="modal-close enhanced">×</button>
                  </div>
                  <div className="modal-body enhanced">
                    <div className="ticket-detail-grid">
                      <div className="detail-field">
                        <label>Subject</label>
                        <p>{selectedTicket.subject}</p>
                      </div>
                      <div className="detail-field">
                        <label>Category</label>
                        <p>{categoryLabel(selectedTicket.category)}</p>
                      </div>
                      <div className="detail-field">
                        <label>Priority</label>
                        <span className={`priority-badge enhanced ${selectedTicket.priority}`} style={{ backgroundColor: `${priorityColors[selectedTicket.priority]}15`, color: priorityColors[selectedTicket.priority] }}>{priorityLabel(selectedTicket.priority)}</span>
                      </div>
                      <div className="detail-field">
                        <label>Status</label>
                        <span className={`status-badge enhanced ${selectedTicket.status}`} style={{ backgroundColor: `${statusColors[selectedTicket.status]}15`, color: statusColors[selectedTicket.status] }}>{statusLabel(selectedTicket.status)}</span>
                      </div>
                      <div className="detail-field wide">
                        <label>Description</label>
                        <p style={{ whiteSpace: 'pre-wrap', margin: 0 }}>{selectedTicket.description || 'No description'}</p>
                      </div>
                      <div className="detail-field">
                        <label>Created</label>
                        <p>{selectedTicket.createdAt}</p>
                      </div>
                      {selectedTicket.updatedAt && (
                        <div className="detail-field">
                          <label>Last Updated</label>
                          <p>{selectedTicket.updatedAt}</p>
                        </div>
                      )}
                    </div>

                    <div className="ticket-messages">
                      <h4>Conversation ({selectedTicket.messages?.length || 0})</h4>
                      <div className="message-list">
                        {selectedTicket.messages && selectedTicket.messages.length > 0 ? (
                          selectedTicket.messages.map((m, i) => (
                            <div key={i} className={`message-item ${m.senderRole}-message ${m.isInternal ? 'internal' : ''}`}>
                              <div className="message-header">
                                <span className="message-sender">{m.senderName}</span>
                                <span className="message-role">{m.senderRole}</span>
                                {m.isInternal && <span className="message-internal">INTERNAL</span>}
                                <span className="message-time">{m.createdAt}</span>
                              </div>
                              <div className="message-body">{m.message}</div>
                            </div>
                          ))
                        ) : (
                          <div className="empty-messages">No messages yet.</div>
                        )}
                      </div>
                    </div>

                    <div className="ticket-reply">
                      <h4>Add Reply</h4>
                      <textarea
                        value={newMessage}
                        onChange={(e) => setNewMessage(e.target.value)}
                        placeholder="Type your reply..."
                        rows={3}
                        className="form-textarea"
                      />
                      <div className="reply-actions">
                        <button type="button" onClick={() => setShowDetail(false)} className="btn-secondary">Close</button>
                        <button type="button" onClick={handleAddCustomerReply} className="btn-primary enhanced">Send Reply</button>
                      </div>
                    </div>
                  </div>
                </>
              ) : null}
            </div>
          </div>
        )}
      </div>
    </CustomerLayout>
  )
}

export default CustomerSupport
