import { Shield, Users, MapPin, Building, BarChart3, Settings, LogOut, Calendar, DollarSign, FileText, Ticket, Bed, Star, PieChart } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import './Dashboard.css'

const AdminDashboard = () => {
  const navigate = useNavigate()
  const user = JSON.parse(localStorage.getItem('user') || '{}')

  const handleLogout = () => {
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    navigate('/login')
  }

  return (
    <div className="dashboard-container">
      <aside className="dashboard-sidebar">
        <div className="sidebar-header">
          <Shield className="h-8 w-8" />
          <h2>Admin Panel</h2>
        </div>
        <nav className="sidebar-nav">
          <Link to="/admin/dashboard" className="nav-item active">
            <BarChart3 className="h-5 w-5" />
            <span>Dashboard Analytics</span>
          </Link>
          <Link to="/admin/users" className="nav-item">
            <Users className="h-5 w-5" />
            <span>User Management</span>
          </Link>
          <Link to="/admin/destinations" className="nav-item">
            <MapPin className="h-5 w-5" />
            <span>Destinations & Packages</span>
          </Link>
          <Link to="/admin/itinerary" className="nav-item">
            <Calendar className="h-5 w-5" />
            <span>Itinerary & Hotels</span>
          </Link>
          <Link to="/admin/rooms" className="nav-item">
            <Bed className="h-5 w-5" />
            <span>Rooms & Availability</span>
          </Link>
          <Link to="/admin/bookings" className="nav-item">
            <Ticket className="h-5 w-5" />
            <span>Bookings & Payments</span>
          </Link>
          <Link to="/admin/invoices" className="nav-item">
            <FileText className="h-5 w-5" />
            <span>Invoices & Reviews</span>
          </Link>
          <Link to="/admin/reports" className="nav-item">
            <PieChart className="h-5 w-5" />
            <span>Reports & Coupons</span>
          </Link>
          <Link to="/admin/settings" className="nav-item">
            <Settings className="h-5 w-5" />
            <span>Settings</span>
          </Link>
        </nav>
      </aside>
      <button onClick={handleLogout} className="logout-btn">
        <LogOut className="h-5 w-5" />
        <span>Logout</span>
      </button>

      <main className="dashboard-main">
        <header className="dashboard-header">
          <h1>Admin Dashboard</h1>
          <div className="user-info">
            <span>Welcome, {user.fullName || 'Admin'}</span>
          </div>
        </header>

        <div className="dashboard-content">
          <div className="stats-grid">
            <div className="stat-card">
              <Users className="stat-icon" />
              <div className="stat-content">
                <h3>Total Users</h3>
                <p className="stat-number">1,234</p>
                <span className="stat-change positive">+12% this month</span>
              </div>
            </div>
            <div className="stat-card">
              <MapPin className="stat-icon" />
              <div className="stat-content">
                <h3>Active Tours</h3>
                <p className="stat-number">56</p>
                <span className="stat-change positive">+8 new this week</span>
              </div>
            </div>
            <div className="stat-card">
              <Building className="stat-icon" />
              <div className="stat-content">
                <h3>Partner Hotels</h3>
                <p className="stat-number">89</p>
                <span className="stat-change positive">+5 new partners</span>
              </div>
            </div>
            <div className="stat-card">
              <Ticket className="stat-icon" />
              <div className="stat-content">
                <h3>Total Bookings</h3>
                <p className="stat-number">2,456</p>
                <span className="stat-change positive">+23% this month</span>
              </div>
            </div>
            <div className="stat-card">
              <DollarSign className="stat-icon" />
              <div className="stat-content">
                <h3>Revenue</h3>
                <p className="stat-number">₹45.2L</p>
                <span className="stat-change positive">+18% this month</span>
              </div>
            </div>
            <div className="stat-card">
              <Star className="stat-icon" />
              <div className="stat-content">
                <h3>Avg Rating</h3>
                <p className="stat-number">4.8</p>
                <span className="stat-change positive">+0.2 this month</span>
              </div>
            </div>
          </div>

          <div className="dashboard-sections">
            <div className="section-card full-width">
              <h3>Revenue Overview</h3>
              <div className="revenue-chart">
                <div className="chart-placeholder">
                  <PieChart className="chart-icon" />
                  <p>Revenue Analytics Chart</p>
                  <small>Monthly revenue breakdown by category</small>
                </div>
              </div>
            </div>

            <div className="section-card">
              <h3>Recent Activities</h3>
              <ul className="activity-list">
                <li><Users className="activity-icon" /> New user registration: John Doe (Customer)</li>
                <li><Ticket className="activity-icon" /> Tour booking: Kerala Backwaters by Jane Smith</li>
                <li><Building className="activity-icon" /> Hotel partner registration: Taj Hotels</li>
                <li><DollarSign className="activity-icon" /> Payment received: ₹45,000 for Goa Tour</li>
                <li><Star className="activity-icon" /> New review: 5 stars for Himalayan Adventure</li>
                <li><FileText className="activity-icon" /> Invoice generated: INV-2026-08-001</li>
              </ul>
            </div>

            <div className="section-card">
              <h3>Quick Actions</h3>
              <div className="quick-actions">
                <button className="action-btn"><Users className="h-4 w-4" /> Add New User</button>
                <button className="action-btn"><MapPin className="h-4 w-4" /> Create Tour Package</button>
                <button className="action-btn"><Building className="h-4 w-4" /> Add Hotel Partner</button>
                <button className="action-btn"><PieChart className="h-4 w-4" /> View Reports</button>
                <button className="action-btn"><Ticket className="h-4 w-4" /> Create Coupon</button>
              </div>
            </div>

            <div className="section-card">
              <h3>Upcoming Bookings</h3>
              <ul className="booking-list">
                <li>
                  <span className="booking-customer">John Doe</span>
                  <span className="booking-package">Kerala Backwaters</span>
                  <span className="booking-dates">Sep 15-20, 2026</span>
                  <span className="booking-status confirmed">Confirmed</span>
                </li>
                <li>
                  <span className="booking-customer">Jane Smith</span>
                  <span className="booking-package">Goa Beach Paradise</span>
                  <span className="booking-dates">Sep 22-25, 2026</span>
                  <span className="booking-status pending">Pending</span>
                </li>
                <li>
                  <span className="booking-customer">Mike Johnson</span>
                  <span className="booking-package">Rajasthan Royal Tour</span>
                  <span className="booking-dates">Oct 5-12, 2026</span>
                  <span className="booking-status confirmed">Confirmed</span>
                </li>
              </ul>
            </div>

            <div className="section-card">
              <h3>Room Availability</h3>
              <div className="room-grid">
                <div className="room-card">
                  <div className="room-type">Deluxe Suite</div>
                  <div className="room-details">
                    <span>Available: 25</span>
                    <span>Booked: 15</span>
                  </div>
                  <span className="room-price">₹8,999/night</span>
                </div>
                <div className="room-card">
                  <div className="room-type">Standard Room</div>
                  <div className="room-details">
                    <span>Available: 45</span>
                    <span>Booked: 30</span>
                  </div>
                  <span className="room-price">₹4,999/night</span>
                </div>
              </div>
            </div>

            <div className="section-card">
              <h3>Recent Reviews</h3>
              <div className="reviews-list">
                <div className="review-item">
                  <div className="review-header">
                    <span className="reviewer">John Doe</span>
                    <div className="rating">
                      <Star className="h-4 w-4 fill" />
                      <Star className="h-4 w-4 fill" />
                      <Star className="h-4 w-4 fill" />
                      <Star className="h-4 w-4 fill" />
                      <Star className="h-4 w-4 fill" />
                    </div>
                  </div>
                  <p className="review-text">Amazing Kerala trip! The itinerary was perfect and hotels were excellent.</p>
                </div>
                <div className="review-item">
                  <div className="review-header">
                    <span className="reviewer">Jane Smith</span>
                    <div className="rating">
                      <Star className="h-4 w-4 fill" />
                      <Star className="h-4 w-4 fill" />
                      <Star className="h-4 w-4 fill" />
                      <Star className="h-4 w-4 fill" />
                      <Star className="h-4 w-4" />
                    </div>
                  </div>
                  <p className="review-text">Great experience overall. Would recommend to others.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}

export default AdminDashboard
