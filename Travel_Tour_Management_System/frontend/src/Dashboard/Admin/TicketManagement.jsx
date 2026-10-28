import { useEffect, useState } from 'react'
import { Search, Ticket, Clock, CheckCircle, XCircle, AlertCircle, Download, User, FolderKanban, RefreshCw } from 'lucide-react'
import { api, downloadCsv, fetchAllPages, formatDate, readPagination } from '../../api'
import Pagination from '../../components/Pagination'
import AdminLayout from './AdminLayout'

const priorityBadge = (p) => {
  const styles = {
    low: { label: 'Low', color: '#10b981' },
    medium: { label: 'Medium', color: '#3b82f6' },
    high: { label: 'High', color: '#f59e0b' },
    urgent: { label: 'Urgent', color: '#ef4444' }
  }
  return styles[p] || styles.medium
}

const statusBadge = (s) => {
  const styles = {
    open: { label: 'Open', color: '#6b7280' },
    in_progress: { label: 'In Progress', color: '#3b82f6' },
    resolved: { label: 'Resolved', color: '#10b981' },
    closed: { label: 'Closed', color: '#6b7280' },
    escalated: { label: 'Escalated', color: '#ef4444' }
  }
  return styles[s] || styles.open
}

const TicketManagement = () => {
  const [tickets, setTickets] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  const [filterStatus, setFilterStatus] = useState('all')
  const [filterPriority, setFilterPriority] = useState('all')
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(10)
  const [meta, setMeta] = useState({ page: 1, limit: 10, total: 0, totalPages: 1, hasNext: false, hasPrev: false })
  const [stats, setStats] = useState(null)
  const [selectedTicket, setSelectedTicket] = useState(null)
  const [showDetailModal, setShowDetailModal] = useState(false)
  const [newMessage, setNewMessage] = useState('')
  const [messageIsInternal, setMessageIsInternal] = useState(false)

  const loadTickets = async (overrides = {}) => {
    const nextPage = overrides.page ?? page
    const nextLimit = overrides.limit ?? limit
    try {
      setError('')
      const data = await api('/admin/tickets', {
        params: {
          page: nextPage,
          limit: nextLimit,
          search: searchTerm,
          status: filterStatus !== 'all' ? filterStatus : undefined,
          priority: filterPriority !== 'all' ? filterPriority : undefined
        }
      })
      const mapped = (data.tickets || []).map((t) => ({
        id: t._id,
        ticketId: t.ticketId,
        customerName: t.customerName,
        customerEmail: t.customerEmail,
        subject: t.subject,
        description: t.description,
        category: t.category,
        priority: t.priority,
        status: t.status,
        assignedToName: t.assignedToName || 'Unassigned',
        responseTarget: t.responseTarget,
        firstResponseAt: t.firstResponseAt,
        resolvedAt: t.resolvedAt,
        escalationCount: t.escalationCount || 0,
        messageCount: (t.messages || []).length,
        tags: t.tags || [],
        satisfactionRating: t.satisfactionRating,
        feedback: t.feedback,
        createdAt: formatDate(t.createdAt),
        updatedAt: formatDate(t.updatedAt),
        messages: (t.messages || []).map((m) => ({
          id: m._id || Math.random().toString(),
          senderName: m.senderName,
          senderRole: m.senderRole,
          message: m.message,
          isInternal: m.isInternal,
          createdAt: formatDate(m.createdAt)
        }))
      }))
      setTickets(mapped)
      setMeta(readPagination(data, mapped.length))
      if (data.stats) setStats(data.stats)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { Promise.resolve().then(() => loadTickets()) }, [page, limit])
  useEffect(() => {
    const t = setTimeout(() => { setPage(1); loadTickets({ page: 1 }) }, 350)
    return () => clearTimeout(t)
  }, [searchTerm, filterStatus, filterPriority])

  const handleUpdateTicket = async (id, updates) => {
    try {
      await api(`/admin/tickets/${id}`, { method: 'PUT', body: JSON.stringify(updates) })
      loadTickets()
    } catch (err) { alert(err.message || 'Failed to update ticket') }
  }

  const handleAddMessage = async () => {
    if (!newMessage.trim()) return
    try {
      await api(`/admin/tickets/${selectedTicket.id}/messages`, {
        method: 'POST',
        body: JSON.stringify({ senderName: 'Admin', senderRole: 'admin', message: newMessage, isInternal: messageIsInternal })
      })
      setNewMessage('')
      setMessageIsInternal(false)
      setShowDetailModal(false)
      loadTickets()
    } catch (err) { alert(err.message || 'Failed to add message') }
  }

  const handleDeleteTicket = async (id) => {
    if (!window.confirm('Are you sure you want to delete this ticket?')) return
    try {
      await api(`/admin/tickets/${id}`, { method: 'DELETE' })
      loadTickets()
    } catch (err) { alert(err.message || 'Failed to delete ticket') }
  }

  const handleExport = async () => {
    try {
      const rows = await fetchAllPages('/admin/tickets', { key: 'tickets', params: { search: searchTerm } })
      downloadCsv('tickets.csv', ['Ticket ID', 'Customer', 'Email', 'Subject', 'Category', 'Priority', 'Status', 'Assigned To', 'Created', 'Messages'], rows.map(r => [r.ticketId, r.customerName, r.customerEmail, r.subject, r.category, r.priority, r.status, r.assignedToName || 'Unassigned', formatDate(r.createdAt), r.messageCount || 0]))
    } catch (err) { alert(err.message || 'Export failed') }
  }

  const isOverdue = (ticket) => {
    if (ticket.status === 'resolved' || ticket.status === 'closed') return false
    if (!ticket.responseTarget) return false
    return new Date(ticket.responseTarget) < new Date()
  }

  const total = stats?.total ?? meta.total
  const openCount = stats?.open ?? tickets.filter((t) => t.status === 'open').length
  const inProgressCount = stats?.inProgress ?? tickets.filter((t) => t.status === 'in_progress').length
  const resolvedCount = stats?.resolved ?? tickets.filter((t) => t.status === 'resolved').length
  const escalatedCount = stats?.escalated ?? tickets.filter((t) => t.status === 'escalated').length
  const overdueCount = stats?.overdue ?? tickets.filter((t) => isOverdue(t)).length

  const filteredTickets = tickets.filter((t) =>
    (filterStatus === 'all' || t.status === filterStatus) &&
    (filterPriority === 'all' || t.priority === filterPriority)
  )

  return (
    <AdminLayout active="tickets">
      {error && <div className="error-message">{error}</div>}
      <div className="filters-section enhanced">
        <div className="search-bar enhanced">
          <Search className="search-icon" />
          <input type="text" placeholder="Search by ticket ID, customer, email, subject..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
        </div>
        <div className="filter-controls enhanced">
          <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="filter-select enhanced">
            <option value="all">All Status</option>
            <option value="open">Open</option>
            <option value="in_progress">In Progress</option>
            <option value="resolved">Resolved</option>
            <option value="closed">Closed</option>
            <option value="escalated">Escalated</option>
          </select>
          <select value={filterPriority} onChange={(e) => setFilterPriority(e.target.value)} className="filter-select enhanced">
            <option value="all">All Priority</option>
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
            <option value="urgent">Urgent</option>
          </select>
          <div className="page-actions">
            <button className="action-btn secondary" onClick={handleExport}><Download className="h-4 w-4" /> Export</button>
            <button className="action-btn" onClick={loadTickets}><RefreshCw className="h-4 w-4" /></button>
          </div>
        </div>
      </div>

      <div className="stats-grid enhanced">
        <div className="stat-card"><Ticket className="stat-icon" /><div className="stat-content"><h3>Total Tickets</h3><p className="stat-number">{total}</p></div></div>
        <div className="stat-card"><AlertCircle className="stat-icon" /><div className="stat-content"><h3>Open</h3><p className="stat-number">{openCount}</p></div></div>
        <div className="stat-card"><Clock className="stat-icon" /><div className="stat-content"><h3>In Progress</h3><p className="stat-number">{inProgressCount}</p></div></div>
        <div className="stat-card"><CheckCircle className="stat-icon" /><div className="stat-content"><h3>Resolved</h3><p className="stat-number">{resolvedCount}</p></div></div>
        <div className="stat-card"><XCircle className="stat-icon" /><div className="stat-content"><h3>Escalated</h3><p className="stat-number">{escalatedCount}</p></div></div>
        <div className="stat-card"><FolderKanban className="stat-icon" /><div className="stat-content"><h3>Overdue</h3><p className="stat-number">{overdueCount}</p></div></div>
      </div>

      <div className="section-card enhanced full-width">
        <h3><Ticket className="h-5 w-5" /> Support Tickets ({filteredTickets.length})</h3>
        {loading ? (
          <div style={{ textAlign: 'center', padding: '2rem' }}>Loading...</div>
        ) : (
          <>
            <div className="table-container enhanced">
              <table className="data-table enhanced">
                <thead>
                  <tr>
                    <th>Ticket ID</th><th>Customer</th><th>Email</th><th>Subject</th><th>Category</th><th>Priority</th><th>Status</th><th>Assigned To</th><th>Response Target</th><th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredTickets.length === 0 ? (
                    <tr>
                      <td colSpan="10">
                        <div className="empty-state enhanced">
                          <AlertCircle className="h-8 w-8" />
                          <h3>No tickets found</h3>
                          <p>Try adjusting your search or filters.</p>
                        </div>
                      </td>
                    </tr>
                  ) : filteredTickets.map((t) => (
                    <tr key={t.id}>
                      <td className="cell-ellipsis" title={t.ticketId}>{t.ticketId}</td>
                      <td className="cell-ellipsis" title={t.customerName}>{t.customerName}</td>
                      <td className="cell-ellipsis" title={t.customerEmail}>{t.customerEmail}</td>
                      <td className="cell-ellipsis" title={t.subject}>{t.subject}</td>
                      <td className="cell-nowrap">{t.category}</td>
                      <td><span className={`priority-badge enhanced ${t.priority}`}>{priorityBadge(t.priority).label}</span></td>
                      <td><span className={`status-badge enhanced ${t.status}`}>{statusBadge(t.status).label}</span></td>
                      <td className="cell-ellipsis" title={t.assignedToName}>{t.assignedToName}</td>
                      <td className="cell-nowrap {isOverdue(t) ? 'overdue' : ''}">{t.responseTarget ? formatDate(t.responseTarget) : '—'}</td>
                      <td>
                        <div className="action-buttons enhanced">
                          <button onClick={() => { setSelectedTicket(t); setShowDetailModal(true) }} className="icon-btn enhanced view" title="View Details"><User className="h-4 w-4" /></button>
                          <button onClick={() => handleUpdateTicket(t.id, { status: t.status === 'open' ? 'in_progress' : 'open' })} className="icon-btn enhanced toggle" title={t.status === 'open' ? 'Start' : 'Reopen'}><Clock className="h-4 w-4" /></button>
                          <button onClick={() => handleDeleteTicket(t.id)} className="icon-btn enhanced delete" title="Delete"><XCircle className="h-4 w-4" /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination page={page} totalPages={meta.totalPages} total={meta.total} limit={meta.limit} onPageChange={setPage} onLimitChange={(l) => { setLimit(l); setPage(1) }} itemLabel="tickets" disabled={loading} />
          </>
        )}
      </div>

      {showDetailModal && selectedTicket && (
        <div className="modal-overlay enhanced" onClick={() => setShowDetailModal(false)}>
          <div className="modal enhanced" style={{ width: '700px', maxWidth: '90vw' }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header enhanced">
              <h3>Ticket #{selectedTicket.ticketId}</h3>
              <button onClick={() => setShowDetailModal(false)} className="modal-close enhanced">×</button>
            </div>
            <div className="modal-body enhanced">
              <div className="ticket-detail-grid">
                <div className="detail-field">
                  <label>Customer</label>
                  <p>{selectedTicket.customerName}</p>
                </div>
                <div className="detail-field">
                  <label>Email</label>
                  <p>{selectedTicket.customerEmail}</p>
                </div>
                <div className="detail-field">
                  <label>Subject</label>
                  <p>{selectedTicket.subject}</p>
                </div>
                <div className="detail-field">
                  <label>Category</label>
                  <p>{selectedTicket.category}</p>
                </div>
                <div className="detail-field">
                  <label>Priority</label>
                  <span className={`priority-badge enhanced ${selectedTicket.priority}`}>{priorityBadge(selectedTicket.priority).label}</span>
                </div>
                <div className="detail-field">
                  <label>Status</label>
                  <span className={`status-badge enhanced ${selectedTicket.status}`}>{statusBadge(selectedTicket.status).label}</span>
                </div>
                <div className="detail-field wide">
                  <label>Assigned To</label>
                  <p>{selectedTicket.assignedToName || 'Unassigned'}</p>
                </div>
                <div className="detail-field wide">
                  <label>Description</label>
                  <p style={{ whiteSpace: 'pre-wrap', margin: 0 }}>{selectedTicket.description}</p>
                </div>
                {selectedTicket.tags && selectedTicket.tags.length > 0 && (
                  <div className="detail-field">
                    <label>Tags</label>
                    <p>{selectedTicket.tags.join(', ')}</p>
                  </div>
                )}
                <div className="detail-field">
                  <label>Created</label>
                  <p>{selectedTicket.createdAt}</p>
                </div>
                {selectedTicket.responseTarget && (
                  <div className="detail-field">
                    <label>Response Target</label>
                    <p style={{ color: isOverdue(selectedTicket) ? 'var(--danger)' : 'inherit' }}>{formatDate(selectedTicket.responseTarget)} {isOverdue(selectedTicket) && '(OVERDUE)'}</p>
                  </div>
                )}
                {selectedTicket.firstResponseAt && (
                  <div className="detail-field">
                    <label>First Response</label>
                    <p>{formatDate(selectedTicket.firstResponseAt)}</p>
                  </div>
                )}
                {selectedTicket.resolvedAt && (
                  <div className="detail-field">
                    <label>Resolved At</label>
                    <p>{formatDate(selectedTicket.resolvedAt)}</p>
                  </div>
                )}
                {selectedTicket.satisfactionRating && (
                  <div className="detail-field">
                    <label>Satisfaction Rating</label>
                    <p>{'★'.repeat(selectedTicket.satisfactionRating)}${'☆'.repeat(5 - selectedTicket.satisfactionRating)} ({selectedTicket.satisfactionRating}/5)</p>
                  </div>
                )}
                {selectedTicket.feedback && (
                  <div className="detail-field wide">
                    <label>Feedback</label>
                    <p>{selectedTicket.feedback}</p>
                  </div>
                )}
              </div>

              <div className="ticket-messages">
                <h4>Conversation ({selectedTicket.messageCount || 0})</h4>
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
                <div className="reply-options">
                  <label className="checkbox-label">
                    <input type="checkbox" checked={messageIsInternal} onChange={(e) => setMessageIsInternal(e.target.checked)} />
                    Internal note (customer cannot see)
                  </label>
                </div>
                <div className="reply-actions">
                  <button type="button" onClick={() => setShowDetailModal(false)} className="btn-secondary">Cancel</button>
                  <button type="button" onClick={handleAddMessage} className="btn-primary enhanced">Send Reply</button>
                </div>
              </div>

              <div className="ticket-actions">
                <h4>Ticket Actions</h4>
                <div className="action-buttons-row">
                  <button onClick={() => handleUpdateTicket(selectedTicket.id, { status: 'open' })} className="btn-secondary">Reopen</button>
                  <button onClick={() => handleUpdateTicket(selectedTicket.id, { status: 'in_progress' })} className="btn-secondary">Start Progress</button>
                  <button onClick={() => handleUpdateTicket(selectedTicket.id, { status: 'resolved' })} className="btn-secondary">Mark Resolved</button>
                  <button onClick={() => handleUpdateTicket(selectedTicket.id, { status: 'escalated', escalationCount: (selectedTicket.escalationCount || 0) + 1 })} className="btn-secondary">Escalate</button>
                  <button onClick={() => handleUpdateTicket(selectedTicket.id, { status: 'closed' })} className="btn-secondary">Close</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  )
}

export default TicketManagement
