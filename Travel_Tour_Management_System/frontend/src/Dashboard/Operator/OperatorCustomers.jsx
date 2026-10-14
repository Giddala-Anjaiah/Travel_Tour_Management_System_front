import { api, readPagination } from '../../api'
import { useState, useEffect } from 'react'
import usePolling from '../../hooks/usePolling'
import Pagination from '../../components/Pagination'
import { Users, Search, Eye, DollarSign, Calendar } from 'lucide-react'
import '../Dashboard.css'

const OperatorCustomers = () => {
  const [customers, setCustomers] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedCustomer, setSelectedCustomer] = useState(null)
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(10)
  const [meta, setMeta] = useState({ page: 1, limit: 10, total: 0, totalPages: 1, hasNext: false, hasPrev: false })

  const hasLocalFilters = searchTerm !== ''

  const fetchCustomers = async (overrides = {}) => {
    const nextPage = overrides.page ?? page
    const nextLimit = overrides.limit ?? limit
    try {
      const data = await api('/operator/customers', {
        params: {
          page: hasLocalFilters ? undefined : nextPage,
          limit: hasLocalFilters ? 'all' : nextLimit,
          search: searchTerm
        }
      })
      if (data.customers) {
        setCustomers(data.customers)
      }
      setMeta(readPagination(data, data.customers?.length || 0))
    } catch (error) {
      console.error('Error fetching customers:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    Promise.resolve().then(() => fetchCustomers())
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, limit])

  useEffect(() => {
    const timer = setTimeout(() => {
      setPage(1)
      fetchCustomers({ page: 1 })
    }, 350)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchTerm])

  usePolling(fetchCustomers, 15000)

  const handlePageChange = (nextPage) => {
    setPage(nextPage)
    setLoading(true)
  }

  const handleLimitChange = (nextLimit) => {
    setLimit(nextLimit)
    setPage(1)
    setLoading(true)
  }

  const filteredCustomers = hasLocalFilters
    ? customers.filter(customer =>
        customer.fullName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        customer.email?.toLowerCase().includes(searchTerm.toLowerCase())
      )
    : customers

  return (
    <>
          <div className="filters-section enhanced">
            <div className="search-bar enhanced">
              <Search className="search-icon" />
              <input
                type="text"
                placeholder="Search customers..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>

          {loading ? (
            <div className="loading-state">Loading customers...</div>
          ) : filteredCustomers.length === 0 ? (
            <div className="empty-state">
              <Users className="h-12 w-12" />
              <h3>No customers found</h3>
              <p>Customers will appear here when they book your packages</p>
            </div>
          ) : (
              <>
              <div className="customers-grid enhanced">
                {filteredCustomers.map(customer => (
                  <div key={customer._id} className="customer-card enhanced">
                    <div className="customer-avatar">
                      {customer.fullName?.charAt(0).toUpperCase()}
                    </div>
                    <div className="customer-info">
                      <h3>{customer.fullName}</h3>
                      <p>{customer.email}</p>
                      {customer.phone && (
                        <p style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.75rem' }}>
                          <span style={{ fontSize: '0.875rem', color: '#64748b' }}>📞 {customer.phone}</span>
                        </p>
                      )}
                      <div className="customer-stats">
                        <div className="stat-item">
                          <Calendar className="h-4 w-4" />
                          <span>{customer.totalBookings || 0} bookings</span>
                        </div>
                        <div className="stat-item">
                          <DollarSign className="h-4 w-4" />
                          <span>₹{(customer.totalSpent || 0).toLocaleString()}</span>
                        </div>
                      </div>
                    </div>
                    <button onClick={() => setSelectedCustomer(customer)} className="icon-btn">
                      <Eye className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
              <Pagination
                page={page}
                totalPages={meta.totalPages}
                total={meta.total}
                limit={meta.limit}
                onPageChange={handlePageChange}
                onLimitChange={handleLimitChange}
                itemLabel="customers"
                disabled={loading}
              />
              </>
          )}
      {selectedCustomer && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <h3>Customer Details</h3>
              <button onClick={() => setSelectedCustomer(null)} className="modal-close">×</button>
            </div>
            <div className="modal-body">
              <div className="customer-detail-section">
                <h4>Personal Information</h4>
                <div className="detail-row">
                  <span>Name:</span>
                  <strong>{selectedCustomer.fullName}</strong>
                </div>
                <div className="detail-row">
                  <span>Email:</span>
                  <strong>{selectedCustomer.email}</strong>
                </div>
                <div className="detail-row">
                  <span>Phone:</span>
                  <strong>{selectedCustomer.phone || 'N/A'}</strong>
                </div>
              </div>
              <div className="customer-detail-section">
                <h4>Booking Summary</h4>
                <div className="detail-row">
                  <span>Total Bookings:</span>
                  <strong>{selectedCustomer.totalBookings || 0}</strong>
                </div>
                <div className="detail-row">
                  <span>Total Spent:</span>
                  <strong>₹{(selectedCustomer.totalSpent || 0).toLocaleString()}</strong>
                </div>
                <div className="detail-row">
                  <span>Last Booking:</span>
                  <strong>{selectedCustomer.lastBooking ? new Date(selectedCustomer.lastBooking).toLocaleDateString() : 'N/A'}</strong>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

export default OperatorCustomers
