import { MapPin, Users, Building, BarChart3, Settings, LogOut, Calendar, DollarSign, FileText, Ticket, Star, PieChart, User, Bell, TrendingUp } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import './Dashboard.css'

const TourOperatorDashboard = () => {
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
          <MapPin className="h-8 w-8" />
          <h2>Tour Operator</h2>
        </div>
        <nav className="sidebar-nav">
          <Link to="/tour-operator/dashboard" className="nav-item active">
            <BarChart3 className="h-5 w-5" />
            <span>Dashboard</span>
          </Link>
          <Link to="/tour-operator/profile" className="nav-item">
            <User className="h-5 w-5" />
            <span>Operator Profile</span>
          </Link>
          <Link to="/tour-operator/packages" className="nav-item">
            <Building className="h-5 w-5" />
            <span>Packages</span>
          </Link>
          <Link to="/tour-operator/itineraries" className="nav-item">
            <Calendar className="h-5 w-5" />
            <span>Itineraries</span>
          </Link>
          <Link to="/tour-operator/pricing" className="nav-item">
            <DollarSign className="h-5 w-5" />
            <span>Pricing & Availability</span>
          </Link>
          <Link to="/tour-operator/bookings" className="nav-item">
            <Ticket className="h-5 w-5" />
            <span>Bookings</span>
          </Link>
          <Link to="/tour-operator/customers" className="nav-item">
            <Users className="h-5 w-5" />
            <span>Customers</span>
          </Link>
          <Link to="/tour-operator/reviews" className="nav-item">
            <Star className="h-5 w-5" />
            <span>Reviews & Ratings</span>
          </Link>
          <Link to="/tour-operator/revenue" className="nav-item">
            <TrendingUp className="h-5 w-5" />
            <span>Revenue</span>
          </Link>
          <Link to="/tour-operator/notifications" className="nav-item">
            <Bell className="h-5 w-5" />
            <span>Notifications</span>
          </Link>
          <Link to="/tour-operator/settings" className="nav-item">
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
          <h1>Tour Operator Dashboard</h1>
          <div className="user-info">
            <span>Welcome, {user.fullName || 'Tour Operator'}</span>
          </div>
        </header>

        <div className="dashboard-content">
          <div className="stats-grid">
            <div className="stat-card">
              <Building className="stat-icon" />
              <div className="stat-content">
                <h3>Total Packages</h3>
                <p className="stat-number">12</p>
                <span className="stat-change positive">8 Active</span>
              </div>
            </div>
            <div className="stat-card">
              <Ticket className="stat-icon" />
              <div className="stat-content">
                <h3>Total Bookings</h3>
                <p className="stat-number">156</p>
                <span className="stat-change positive">+23 this month</span>
              </div>
            </div>
            <div className="stat-card">
              <Users className="stat-icon" />
              <div className="stat-content">
                <h3>Total Customers</h3>
                <p className="stat-number">89</p>
                <span className="stat-change positive">+15 new this month</span>
              </div>
            </div>
            <div className="stat-card">
              <DollarSign className="stat-icon" />
              <div className="stat-content">
                <h3>Revenue</h3>
                <p className="stat-number">₹25L</p>
                <span className="stat-change positive">+18% this month</span>
              </div>
            </div>
            <div className="stat-card">
              <Star className="stat-icon" />
              <div className="stat-content">
                <h3>Avg Rating</h3>
                <p className="stat-number">4.5</p>
                <span className="stat-change positive">+0.3 this month</span>
              </div>
            </div>
            <div className="stat-card">
              <PieChart className="stat-icon" />
              <div className="stat-content">
                <h3>Pending</h3>
                <p className="stat-number">23</p>
                <span className="stat-change neutral">Awaiting approval</span>
              </div>
            </div>
          </div>

          <div className="dashboard-sections">
            <div className="section-card full-width">
              <h3>Revenue Overview</h3>
              <div className="revenue-chart">
                <div className="chart-placeholder">
                  <TrendingUp className="chart-icon" />
                  <p>Revenue Analytics Chart</p>
                  <small>Monthly revenue breakdown by package</small>
                </div>
              </div>
            </div>

            <div className="section-card">
              <h3>Recent Activities</h3>
              <ul className="activity-list">
                <li><Ticket className="activity-icon" /> New booking: Goa Beach Paradise by John Doe</li>
                <li><DollarSign className="activity-icon" /> Payment received: ₹15,999 for Kerala Backwaters</li>
                <li><Star className="activity-icon" /> New review: 5 stars for Himalayan Adventure</li>
                <li><Building className="activity-icon" /> Package "Rajasthan Royal Tour" published successfully</li>
                <li><Users className="activity-icon" /> New customer registration: Jane Smith</li>
                <li><FileText className="activity-icon" /> Invoice generated: INV-2026-08-001</li>
              </ul>
            </div>

            <div className="section-card">
              <h3>Quick Actions</h3>
              <div className="quick-actions">
                <button className="action-btn"><Building className="h-4 w-4" /> Create Package</button>
                <button className="action-btn"><Calendar className="h-4 w-4" /> Add Itinerary</button>
                <button className="action-btn"><DollarSign className="h-4 w-4" /> Set Pricing</button>
                <button className="action-btn"><Ticket className="h-4 w-4" /> View Bookings</button>
                <button className="action-btn"><Star className="h-4 w-4" /> View Reviews</button>
              </div>
            </div>

            <div className="section-card">
              <h3>Upcoming Bookings</h3>
              <ul className="booking-list">
                <li>
                  <span className="booking-customer">John Doe</span>
                  <span className="booking-package">Goa Beach Paradise</span>
                  <span className="booking-dates">Sep 15-20, 2026</span>
                  <span className="booking-status confirmed">Confirmed</span>
                </li>
                <li>
                  <span className="booking-customer">Jane Smith</span>
                  <span className="booking-package">Kerala Backwaters</span>
                  <span className="booking-dates">Sep 22-25, 2026</span>
                  <span className="booking-status pending">Pending</span>
                </li>
                <li>
                  <span className="booking-customer">Mike Johnson</span>
                  <span className="booking-package">Himalayan Adventure</span>
                  <span className="booking-dates">Oct 5-12, 2026</span>
                  <span className="booking-status confirmed">Confirmed</span>
                </li>
              </ul>
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
                  <p className="review-text">Amazing Goa trip! The itinerary was perfect and hotels were excellent.</p>
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
                  <p className="review-text">Great Kerala experience. Would recommend to others.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}

export default TourOperatorDashboard
