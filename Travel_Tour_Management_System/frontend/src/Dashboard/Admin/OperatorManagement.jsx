import { useEffect, useState } from 'react'
import { Users, Search, Pencil as Edit, Trash2, UserCheck, UserX, Mail, Phone, ChevronLeft, ChevronRight } from 'lucide-react'
import { api, formatDate, readPagination } from '../../api'
import Pagination from '../../components/Pagination'
import AdminLayout from './AdminLayout'

const OperatorManagement = () => {
  const [operators, setOperators] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(10)
  const [meta, setMeta] = useState({ page: 1, limit: 10, total: 0, totalPages: 1, hasNext: false, hasPrev: false })
  const [stats, setStats] = useState(null)
  const [showEditModal, setShowEditModal] = useState(false)
  const [selected, setSelected] = useState(null)

  const fetchOperators = async (overrides = {}) => {
    const nextPage = overrides.page ?? page
    const nextLimit = overrides.limit ?? limit
    try {
      setError('')
      const data = await api('/admin/operators', { params: { page: nextPage, limit: nextLimit, search: searchTerm } })
      const mapped = (data.users || []).map((u) => ({
        id: u._id,
        name: u.fullName,
        email: u.email,
        phone: u.phone,
        status: u.status || 'active',
        joinDate: formatDate(u.createdAt),
        commissionRate: u.commissionRate,
      }))
      setOperators(mapped)
      setMeta(readPagination(data, mapped.length))
      if (data.stats) setStats(data.stats)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { Promise.resolve().then(() => fetchOperators()) }, [page, limit])
  useEffect(() => {
    const t = setTimeout(() => { setPage(1); fetchOperators({ page: 1 }) }, 350)
    return () => clearTimeout(t)
  }, [searchTerm])

  const handleToggleStatus = async (id) => {
    const op = operators.find((o) => o.id === id)
    const newStatus = op.status === 'active' ? 'inactive' : 'active'
    try {
      await api(`/admin/operators/${id}`, { method: 'PUT', body: JSON.stringify({ status: newStatus }) })
      setOperators(operators.map((o) => o.id === id ? { ...o, status: newStatus } : o))
    } catch (err) { alert(err.message) }
  }

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this operator?')) return
    try { await api(`/admin/operators/${id}`, { method: 'DELETE' }); fetchOperators() }
    catch (err) { alert(err.message) }
  }

  const handleUpdate = async (e) => {
    e.preventDefault()
    const fd = new FormData(e.target)
    const body = {
      fullName: fd.get('fullName'),
      email: fd.get('email'),
      phone: fd.get('phone'),
      status: fd.get('status'),
      commissionRate: Number(fd.get('commissionRate')),
      commissionType: fd.get('commissionType'),
      verificationStatus: fd.get('verificationStatus'),
    }
    try {
      await api(`/admin/operators/${selected.id}`, { method: 'PUT', body: JSON.stringify(body) })
      setShowEditModal(false)
      fetchOperators()
    } catch (err) { alert(err.message) }
  }

  const total = stats?.total ?? meta.total
  const active = stats?.active ?? operators.filter((o) => o.status === 'active').length
  const inactive = stats?.inactive ?? operators.filter((o) => o.status === 'inactive').length

  return (
    <AdminLayout active="operators">
      {error && <div className="error-message">{error}</div>}
      <div className="filters-section enhanced">
        <div className="search-bar enhanced">
          <Search className="search-icon" />
          <input type="text" placeholder="Search operators..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
        </div>
      </div>
      <div className="stats-grid enhanced">
        <div className="stat-card"><div className="stat-icon"><Users /></div><div className="stat-content"><h3>Total</h3><p className="stat-number">{total}</p></div></div>
        <div className="stat-card"><div className="stat-icon"><UserCheck /></div><div className="stat-content"><h3>Active</h3><p className="stat-number">{active}</p></div></div>
        <div className="stat-card"><div className="stat-icon"><UserX /></div><div className="stat-content"><h3>Inactive</h3><p className="stat-number">{inactive}</p></div></div>
      </div>
      <div className="section-card enhanced full-width">
        <h3><Users className="h-5 w-5" /> Operators ({meta.total})</h3>
        {loading ? <div style={{ textAlign: 'center', padding: '2rem' }}>Loading...</div> : (
          <div className="table-container enhanced">
            <table className="data-table enhanced">
              <thead><tr><th>Name</th><th>Email</th><th>Phone</th><th>Status</th><th>Join Date</th><th>Actions</th></tr></thead>
              <tbody>
                {operators.length === 0 ? <tr><td colSpan="6" style={{ textAlign: 'center', padding: '3rem' }}>No operators found</td></tr> : operators.map((o) => (
                  <tr key={o.id}>
                    <td className="user-name-cell enhanced"><div className="user-avatar enhanced">{o.name?.charAt(0)}</div><span>{o.name}</span></td>
                    <td><Mail className="h-4 w-4 inline-icon" />{o.email}</td>
                    <td><Phone className="h-4 w-4 inline-icon" />{o.phone}</td>
                    <td><span className={`status-badge enhanced ${o.status}`}>{o.status}</span></td>
                    <td>{o.joinDate}</td>
                    <td>
                      <div className="action-buttons enhanced">
                        <button onClick={() => { setSelected(o); setShowEditModal(true) }} className="icon-btn enhanced edit" title="Edit"><Edit className="h-4 w-4" /></button>
                        <button onClick={() => handleToggleStatus(o.id)} className="icon-btn enhanced toggle" title="Toggle">{o.status === 'active' ? <UserX className="h-4 w-4" /> : <UserCheck className="h-4 w-4" />}</button>
                        <button onClick={() => handleDelete(o.id)} className="icon-btn enhanced delete" title="Delete"><Trash2 className="h-4 w-4" /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <Pagination page={page} totalPages={meta.totalPages} total={meta.total} limit={meta.limit} onPageChange={setPage} onLimitChange={(l) => { setLimit(l); setPage(1) }} itemLabel="operators" disabled={loading} />
          </div>
        )}
      </div>

      {showEditModal && selected && (
        <div className="modal-overlay enhanced" onClick={() => setShowEditModal(false)}>
          <div className="modal enhanced" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header enhanced"><h3>Edit Operator</h3><button onClick={() => setShowEditModal(false)} className="modal-close enhanced">×</button></div>
            <div className="modal-body enhanced">
              <form className="user-form" onSubmit={handleUpdate}>
                <div className="form-group enhanced"><label>Full Name</label><input name="fullName" type="text" defaultValue={selected.name} required /></div>
                <div className="form-group enhanced"><label>Email</label><input name="email" type="email" defaultValue={selected.email} required /></div>
                <div className="form-group enhanced"><label>Phone</label><input name="phone" type="tel" defaultValue={selected.phone} required /></div>
                <div className="form-group enhanced">
                  <label>Status</label>
                  <select name="status" defaultValue={selected.status}><option value="active">Active</option><option value="inactive">Inactive</option></select>
                </div>
                <div className="form-group enhanced"><label>Commission Rate</label><input name="commissionRate" type="number" min="0" max="100" defaultValue={selected.commissionRate || 0} /></div>
                <div className="form-group enhanced">
                  <label>Commission Type</label>
                  <select name="commissionType" defaultValue="percentage"><option value="percentage">Percentage</option><option value="fixed">Fixed</option></select>
                </div>
                <div className="form-group enhanced">
                  <label>Verification Status</label>
                  <select name="verificationStatus" defaultValue="pending"><option value="pending">Pending</option><option value="approved">Approved</option><option value="rejected">Rejected</option></select>
                </div>
                <div className="form-actions enhanced">
                  <button type="button" onClick={() => setShowEditModal(false)} className="btn-secondary enhanced">Cancel</button>
                  <button type="submit" className="btn-primary enhanced">Update</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  )
}

export default OperatorManagement
