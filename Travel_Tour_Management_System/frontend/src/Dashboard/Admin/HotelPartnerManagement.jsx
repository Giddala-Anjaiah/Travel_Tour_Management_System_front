import { useEffect, useState } from 'react'
import { Search, UserCheck, UserX, Mail, Phone, Building, ShieldCheck } from 'lucide-react'
import { api, formatDate, readPagination } from '../../api'
import Pagination from '../../components/Pagination'
import AdminLayout from './AdminLayout'

const HotelPartnerManagement = () => {
  const [partners, setPartners] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(10)
  const [meta, setMeta] = useState({ page: 1, limit: 10, total: 0, totalPages: 1, hasNext: false, hasPrev: false })
  const [stats, setStats] = useState(null)

  const fetchPartners = async (overrides = {}) => {
    const nextPage = overrides.page ?? page
    const nextLimit = overrides.limit ?? limit
    try {
      setError('')
      const data = await api('/admin/hotel-partners', {
        params: { page: nextPage, limit: nextLimit, search: searchTerm }
      })
      const mapped = (data.hotelPartners || []).map((p) => ({
        id: p.id,
        name: p.fullName,
        email: p.email,
        phone: p.phone,
        hotelName: p.profile?.hotelName || '—',
        registrationNumber: p.profile?.registrationNumber || '—',
        taxId: p.profile?.taxId || '—',
        hotelCount: p.hotelCount || 0,
        status: p.status || 'inactive',
        joinDate: formatDate(p.createdAt)
      }))
      setPartners(mapped)
      setMeta(readPagination(data, mapped.length))
      if (data.stats) setStats(data.stats)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { Promise.resolve().then(() => fetchPartners()) }, [page, limit])
  useEffect(() => {
    const t = setTimeout(() => { setPage(1); fetchPartners({ page: 1 }) }, 350)
    return () => clearTimeout(t)
  }, [searchTerm])

  const handleToggleStatus = async (id) => {
    const partner = partners.find((p) => p.id === id)
    const newStatus = partner.status === 'active' ? 'inactive' : 'active'
    try {
      await api(`/admin/hotel-partners/${id}/approve`, {
        method: 'PUT',
        body: JSON.stringify({ status: newStatus })
      })
      setPartners(partners.map((p) => p.id === id ? { ...p, status: newStatus } : p))
    } catch (err) { alert(err.message) }
  }

  const total = stats?.total ?? meta.total
  const active = stats?.active ?? partners.filter((p) => p.status === 'active').length
  const inactive = stats?.inactive ?? partners.filter((p) => p.status === 'inactive').length

  return (
    <AdminLayout active="hotel-partners">
      {error && <div className="error-message">{error}</div>}
      <div className="filters-section enhanced">
        <div className="search-bar enhanced">
          <Search className="search-icon" />
          <input type="text" placeholder="Search hotel partners..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
        </div>
      </div>
      <div className="stats-grid enhanced">
        <div className="stat-card"><div className="stat-icon"><Building /></div><div className="stat-content"><h3>Total Partners</h3><p className="stat-number">{total}</p></div></div>
        <div className="stat-card"><div className="stat-icon"><UserCheck /></div><div className="stat-content"><h3>Approved</h3><p className="stat-number">{active}</p></div></div>
        <div className="stat-card"><div className="stat-icon"><UserX /></div><div className="stat-content"><h3>Pending</h3><p className="stat-number">{inactive}</p></div></div>
      </div>
      <div className="section-card enhanced full-width">
        <h3><ShieldCheck className="h-5 w-5" /> Hotel Partners ({meta.total})</h3>
        {loading ? <div style={{ textAlign: 'center', padding: '2rem' }}>Loading...</div> : (
          <div className="table-container enhanced">
            <table className="data-table enhanced">
              <thead>
                <tr>
                  <th>Partner Name</th>
                  <th>Hotel Name</th>
                  <th>Email</th>
                  <th>Phone</th>
                  <th>Registration No.</th>
                  <th>Tax ID</th>
                  <th>Hotels</th>
                  <th>Status</th>
                  <th>Joined</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {partners.length === 0 ? <tr><td colSpan="10" style={{ textAlign: 'center', padding: '3rem' }}>No hotel partners found</td></tr> : partners.map((p) => (
                  <tr key={p.id}>
                    <td className="user-name-cell enhanced"><div className="user-avatar enhanced">{p.name?.charAt(0)}</div><span>{p.name}</span></td>
                    <td>{p.hotelName}</td>
                    <td><Mail className="h-4 w-4 inline-icon" />{p.email}</td>
                    <td><Phone className="h-4 w-4 inline-icon" />{p.phone}</td>
                    <td>{p.registrationNumber}</td>
                    <td>{p.taxId}</td>
                    <td>{p.hotelCount}</td>
                    <td><span className={`status-badge enhanced ${p.status}`}>{p.status === 'active' ? 'Approved' : 'Pending'}</span></td>
                    <td>{p.joinDate}</td>
                    <td>
                      <div className="action-buttons enhanced">
                        <button onClick={() => handleToggleStatus(p.id)} className="icon-btn enhanced toggle" title={p.status === 'active' ? 'Reject' : 'Approve'}>
                          {p.status === 'active' ? <UserX className="h-4 w-4" /> : <UserCheck className="h-4 w-4" />}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <Pagination page={page} totalPages={meta.totalPages} total={meta.total} limit={meta.limit} onPageChange={setPage} onLimitChange={(l) => { setLimit(l); setPage(1) }} itemLabel="partners" disabled={loading} />
          </div>
        )}
      </div>
    </AdminLayout>
  )
}

export default HotelPartnerManagement
