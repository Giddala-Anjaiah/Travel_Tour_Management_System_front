import { User, MapPin, Calendar, CreditCard, Heart, LogOut, Search, Building, Ticket, FileText } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import './Dashboard.css'

const CustomerDashboard = () => {
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
          <User className="h-8 w-8" />
          <h2>Customer Portal</h2>
        </div>
        <nav className="sidebar-nav">
          <Link to="/customer/dashboard" className="nav-item active">
            <MapPin className="h-5 w-5" />
            <span>Destination Exploration</span>
          </Link>
          <Link to="/customer/packages" className="nav-item">
            <Ticket className="h-5 w-5" />
            <span>Tour Packages</span>
          </Link>
          <Link to="/customer/itineraries" className="nav-item">
            <Calendar className="h-5 w-5" />
            <span>Itineraries</span>
          </Link>
          <Link to="/customer/hotels" className="nav-item">
            <Building className="h-5 w-5" />
            <span>Hotel Search & Availability</span>
          </Link>
          <Link to="/customer/bookings" className="nav-item">
            <Calendar className="h-5 w-5" />
            <span>Bookings & Payments</span>
          </Link>
          <Link to="/customer/invoices" className="nav-item">
            <FileText className="h-5 w-5" />
            <span>Invoices & Booking History</span>
          </Link>
          <Link to="/customer/wishlist" className="nav-item">
            <Heart className="h-5 w-5" />
            <span>Wishlist, Reviews & Notifications</span>
          </Link>
          <Link to="/customer/profile" className="nav-item">
            <User className="h-5 w-5" />
            <span>Profile Management</span>
          </Link>
        </nav>
        <button onClick={handleLogout} className="logout-btn">
          <LogOut className="h-5 w-5" />
          <span>Logout</span>
        </button>
      </aside>

      <main className="dashboard-main">
        <header className="dashboard-header">
          <div>
            <h1>Customer Dashboard</h1>
            <p className="header-subtitle">Plan, book, and manage your perfect journey</p>
          </div>
          <div className="header-actions">
            <div className="user-info">
              <User className="h-5 w-5" />
              <span>Welcome, {user.fullName || 'Customer'}</span>
            </div>
            <button onClick={handleLogout} className="btn-logout-header">
              <LogOut className="h-4 w-4" />
              <span>Logout</span>
            </button>
          </div>
        </header>

        <div className="dashboard-content">
          <div className="search-section">
            <div className="search-bar">
              <Search className="search-icon" />
              <input type="text" placeholder="Search destinations, tours..." />
            </div>
          </div>

          <div className="stats-grid">
            <div className="stat-card">
              <Calendar className="stat-icon" />
              <div className="stat-content">
                <h3>My Bookings</h3>
                <p className="stat-number">3</p>
              </div>
            </div>
            <div className="stat-card">
              <Heart className="stat-icon" />
              <div className="stat-content">
                <h3>Wishlist</h3>
                <p className="stat-number">12</p>
              </div>
            </div>
            <div className="stat-card">
              <CreditCard className="stat-icon" />
              <div className="stat-content">
                <h3>Total Spent</h3>
                <p className="stat-number">₹45,000</p>
              </div>
            </div>
            <div className="stat-card">
              <MapPin className="stat-icon" />
              <div className="stat-content">
                <h3>Upcoming Trips</h3>
                <p className="stat-number">2</p>
              </div>
            </div>
          </div>

          <div className="dashboard-sections">
            <div className="section-card">
              <h3>Featured Tours</h3>
              <div className="tour-grid">
                <div className="tour-card">
                  <div className="tour-image">🏖️</div>
                  <h4>Goa Beach Paradise</h4>
                  <p>3 Days 2 Nights</p>
                  <span className="tour-price">₹15,999</span>
                </div>
                <div className="tour-card">
                  <div className="tour-image">🌴</div>
                  <h4>Kerala Backwaters</h4>
                  <p>5 Days 4 Nights</p>
                  <span className="tour-price">₹24,999</span>
                </div>
                <div className="tour-card">
                  <div className="tour-image">🏔️</div>
                  <h4>Himalayan Adventure</h4>
                  <p>7 Days 6 Nights</p>
                  <span className="tour-price">₹35,999</span>
                </div>
              </div>
            </div>

            <div className="section-card">
              <h3>Upcoming Trips</h3>
              <ul className="trip-list">
                <li>
                  <span className="trip-name">Kerala Backwaters</span>
                  <span className="trip-date">Sep 15-20, 2026</span>
                </li>
                <li>
                  <span className="trip-name">Rajasthan Royal Tour</span>
                  <span className="trip-date">Oct 10-15, 2026</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}

export default CustomerDashboard
