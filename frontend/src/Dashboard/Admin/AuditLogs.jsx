import { useEffect, useState } from 'react'
import { History, Search, Download, User, Settings, Package, Ticket, Tag, Calendar, FileText, Star, Building, Bed } from 'lucide-react'
import { api, downloadCsv, fetchAllPages, formatDate, readPagination } from '../../api'
import Pagination from '../../components/Pagination'
import AdminLayout from './AdminLayout'

const mapLog = (log) => ({
  id: log._id,
  timestamp: formatDate(log.timestamp),
  userName: log.userId?.fullName || 'Unknown',
  userEmail: log.userId?.email || '',
  userRole: log.userId?.role || log.userRole,
  action: log.action,
  entityType: log.entityType,
  entityName: log.entityName || '',
  changes: log.details?.changes || [],
  ip: log.details?.ip || ''
})

const emptyMeta = { page: 1, limit: 10, total: 0, totalPages: 1, hasNext: false, hasPrev: false }

const matchesFilters = (log, { searchTerm, filterEntity, filterAction, filterRole, dateFrom, dateTo }) => {
    const matchesSearch = searchTerm === '' || log.userName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.userEmail.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.entityName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.action.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesEntity = filterEntity === 'all' || log.entityType === filterEntity
    const matchesAction = filterAction === 'all' || log.action === filterAction
    const matchesRole = filterRole === 'all' || log.userRole === filterRole
    let matchesDate = true
    if (dateFrom && log.timestamp) {
      matchesDate = new Date(log.timestamp.replace(/-/g, '/')) >= new Date(dateFrom.replace(/-/g, '/'))
    }
    if (dateTo && log.timestamp) {
      matchesDate = matchesDate && new Date(log.timestamp.replace(/-/g, '/')) <= new Date(dateTo.replace(/-/g, '/'))
    }
    return matchesSearch && matchesEntity && matchesAction && matchesRole && matchesDate
}

const AuditLogs = () => {
  const [logs, setLogs] = useState([])
  const [filterOptions, setFilterOptions] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  const [filterEntity, setFilterEntity] = useState('all')
  const [filterAction, setFilterAction] = useState('all')
  const [filterRole, setFilterRole] = useState('all')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(10)
  const [meta, setMeta] = useState(emptyMeta)

  // No admin audit-log handler exists server-side, so every filter here
  // (including the search box) falls back to the full set plus local matching.
  const hasLocalFilters = searchTerm !== '' || filterEntity !== 'all' || filterAction !== 'all' ||
    filterRole !== 'all' || dateFrom !== '' || dateTo !== ''

  const load = async (overrides = {}) => {
    const nextPage = overrides.page ?? page
    const nextLimit = overrides.limit ?? limit
    try {
      setError('')
      setLoading(true)
      const data = await api('/admin/audit-logs', {
        params: {
          page: hasLocalFilters ? undefined : nextPage,
          limit: hasLocalFilters ? 'all' : nextLimit
        }
      })
      const mapped = (data.logs || []).map(mapLog)
      setLogs(mapped)
      setMeta(readPagination(data, mapped.length))
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

  // The entity/action/role dropdowns must not be limited to the current page.
  useEffect(() => {
    Promise.resolve().then(async () => {
      try {
        const data = await api('/admin/audit-logs', { params: { limit: 'all' } })
        setFilterOptions((data.logs || []).map(mapLog))
      } catch (err) {
        setError(err.message)
      }
    })
  }, [])

  useEffect(() => {
    const timer = setTimeout(() => {
      setPage(1)
      if (page === 1) Promise.resolve().then(() => load())
    }, 350)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchTerm, filterEntity, filterAction, filterRole, dateFrom, dateTo])

  const handlePageChange = (nextPage) => {
    setPage(nextPage)
    setLoading(true)
  }

  const handleLimitChange = (nextLimit) => {
    setLimit(nextLimit)
    setPage(1)
    setLoading(true)
  }

  const entityIcons = {
    user: User, package: Package, hotel: Building, room: Bed,
    booking: Ticket, invoice: FileText, review: Star, coupon: Tag,
    itinerary: Calendar, settings: Settings, notification: History
  }

  const actionLabels = {
    create: 'Created', update: 'Updated', delete: 'Deleted',
    status_change: 'Status Changed', login: 'Logged In',
    export: 'Exported', settings_update: 'Settings Updated'
  }

  const filters = { searchTerm, filterEntity, filterAction, filterRole, dateFrom, dateTo }
  const filteredLogs = hasLocalFilters ? logs.filter((log) => matchesFilters(log, filters)) : logs

  const handleExport = async () => {
    const rows = await fetchAllPages('/admin/audit-logs', { key: 'logs' })
    const exported = rows.map(mapLog).filter((log) => matchesFilters(log, filters))
    downloadCsv(
      'audit-logs.csv',
      ['Date', 'User', 'Email', 'Role', 'Action', 'Entity', 'Entity Name', 'Changes', 'IP'],
      exported.map((log) => [
        log.timestamp, log.userName, log.userEmail, log.userRole,
        actionLabels[log.action] || log.action, log.entityType,
        log.entityName, log.changes.join(', '), log.ip
      ])
    )
  }

  const entityTypes = [...new Set(filterOptions.map(l => l.entityType))]
  const actions = [...new Set(filterOptions.map(l => l.action))]
  const roles = [...new Set(filterOptions.map(l => l.userRole))]

  return (
    <AdminLayout
      active="audit"
      title="Audit Logs"
      actions={
        <>
          <button className="action-btn" onClick={handleExport}><Download className="h-4 w-4" /> Export</button>
        </>
      }
    >
      {error && <div className="error-message">{error}</div>}
      <div className="filters-section">
        <div className="search-bar">
          <Search className="search-icon" />
          <input value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} placeholder="Search by user, action, or entity..." />
        </div>
        <div className="filter-controls">
          <select value={filterEntity} onChange={(e) => setFilterEntity(e.target.value)} className="filter-select">
            <option value="all">All Entities</option>
            {entityTypes.map((e) => <option key={e} value={e}>{e.replace('_', ' ')}</option>)}
          </select>
          <select value={filterAction} onChange={(e) => setFilterAction(e.target.value)} className="filter-select">
            <option value="all">All Actions</option>
            {actions.map((a) => <option key={a} value={a}>{actionLabels[a] || a}</option>)}
          </select>
          <select value={filterRole} onChange={(e) => setFilterRole(e.target.value)} className="filter-select">
            <option value="all">All Roles</option>
            {roles.map((r) => <option key={r} value={r}>{r.replace('_', ' ')}</option>)}
          </select>
          <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="filter-select" style={{ width: '140px' }} />
          <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="filter-select" style={{ width: '140px' }} />
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '2rem', color: '#64748b' }}>Loading audit logs...</div>
      ) : (
        <div className="section-card full-width">
          <h3>Audit Log Entries ({hasLocalFilters ? filteredLogs.length : meta.total})</h3>
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Date & Time</th>
                  <th>User</th>
                  <th>Role</th>
                  <th>Action</th>
                  <th>Entity</th>
                  <th>Details</th>
                  <th>IP Address</th>
                </tr>
              </thead>
              <tbody>
                {filteredLogs.length === 0 ? (
                  <tr>
                    <td colSpan="7" style={{ textAlign: 'center', padding: '2rem', color: '#64748b' }}>No audit logs found</td>
                  </tr>
                ) : filteredLogs.map((log) => {
                  const Icon = entityIcons[log.entityType] || History
                  return (
                    <tr key={log.id}>
                      <td style={{ whiteSpace: 'nowrap', fontSize: '0.85rem' }}>{log.timestamp}</td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <Icon className="h-4 w-4" />
                          <div>
                            <div style={{ fontWeight: '600' }}>{log.userName}</div>
                            <div style={{ fontSize: '0.8rem', color: '#64748b' }}>{log.userEmail}</div>
                          </div>
                        </div>
                      </td>
                      <td><span className={`role-badge ${log.userRole}`}>{log.userRole.replace('_', ' ')}</span></td>
                      <td>{actionLabels[log.action] || log.action}</td>
                      <td><span style={{ textTransform: 'capitalize' }}>{log.entityType.replace('_', ' ')}</span> {log.entityName && <span style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: '500' }}>{log.entityName}</span>}</td>
                      <td>
                        {log.changes.length > 0 ? (
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.25rem' }}>
                            {log.changes.map((c, i) => (
                              <span key={i} style={{ fontSize: '0.75rem', padding: '0.125rem 0.5rem', background: '#e0e7ff', borderRadius: '3px', color: '#4338ca' }}>{c}</span>
                            ))}
                          </div>
                        ) : <span style={{ color: '#94a3b8' }}>—</span>}
                      </td>
                      <td style={{ fontSize: '0.85rem' }}>{log.ip || '—'}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            <Pagination
              page={meta.page}
              totalPages={meta.totalPages}
              total={meta.total}
              limit={meta.limit}
              onPageChange={handlePageChange}
              onLimitChange={handleLimitChange}
              itemLabel="audit log entries"
              disabled={loading || hasLocalFilters}
            />
          </div>
        </div>
      )}
    </AdminLayout>
  )
}

export default AuditLogs