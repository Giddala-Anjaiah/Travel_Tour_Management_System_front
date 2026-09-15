import { API_BASE } from '../../api'
import { useState, useEffect } from 'react'
import usePolling from '../../hooks/usePolling'
import { Users, Search, Eye, DollarSign, Calendar } from 'lucide-react'
import '../Dashboard.css'

const OperatorCustomers = () => {
  const [customers, setCustomers] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedCustomer, setSelectedCustomer] = useState(null)

  const fetchCustomers = async () => {
    try {
      const token = localStorage.getItem('token')
      const response = await fetch(API_BASE + '/operator/customers', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })
      const data = await response.json()
      if (data.customers) {
        setCustomers(data.customers)
      }
    } catch (error) {
      console.error('Error fetching customers:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    Promise.resolve().then(() => fetchCustomers())
  }, [])

  usePolling(fetchCustomers, 15000)

  const filteredCustomers = customers.filter(customer =>
    customer.fullName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    customer.email?.toLowerCase().includes(searchTerm.toLowerCase())
  )

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
