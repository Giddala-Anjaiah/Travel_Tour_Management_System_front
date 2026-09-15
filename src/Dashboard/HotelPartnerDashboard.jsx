import { Building, Calendar, Users, DollarSign, Star, LogOut, Bed, Settings } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import './Dashboard.css'

const HotelPartnerDashboard = () => {
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
          <Building className="h-8 w-8" />
          <h2>Hotel Partner</h2>
        </div>
        <nav className="sidebar-nav">
          <Link to="/hotel-partner/dashboard" className="nav-item active">
            <Building className="h-5 w-5" />
            <span>Dashboard</span>
          </Link>
          <Link to="/hotel-partner/rooms" className="nav-item">
            <Bed className="h-5 w-5" />
            <span>My Rooms</span>
          </Link>
          <Link to="/hotel-partner/bookings" className="nav-item">
            <Calendar className="h-5 w-5" />
            <span>Bookings</span>
          </Link>
          <Link to="/hotel-partner/guests" className="nav-item">
            <Users className="h-5 w-5" />
            <span>Guests</span>
          </Link>
          <Link to="/hotel-partner/reviews" className="nav-item">
            <Star className="h-5 w-5" />
            <span>Reviews</span>
          </Link>
          <Link to="/hotel-partner/earnings" className="nav-item">
            <DollarSign className="h-5 w-5" />
            <span>Earnings</span>
          </Link>
          <Link to="/hotel-partner/settings" className="nav-item">
            <Settings className="h-5 w-5" />
            <span>Settings</span>
          </Link>
        </nav>
        <button onClick={handleLogout} className="logout-btn">
          <LogOut className="h-5 w-5" />
          <span>Logout</span>
        </button>
      </aside>

      <main className="dashboard-main">
        <header className="dashboard-header">
          <h1>Hotel Partner Dashboard</h1>
          <div className="user-info">
            <span>Welcome, {user.fullName || 'Hotel Partner'}</span>
          </div>
        </header>

        <div className="dashboard-content">
          <div className="stats-grid">
            <div className="stat-card">
              <Bed className="stat-icon" />
              <div className="stat-content">
                <h3>Total Rooms</h3>
                <p className="stat-number">45</p>
              </div>
            </div>
            <div className="stat-card">
              <Calendar className="stat-icon" />
              <div className="stat-content">
                <h3>Today's Bookings</h3>
                <p className="stat-number">12</p>
              </div>
            </div>
            <div className="stat-card">
              <Users className="stat-icon" />
              <div className="stat-content">
                <h3>Current Guests</h3>
                <p className="stat-number">38</p>
              </div>
            </div>
            <div className="stat-card">
              <DollarSign className="stat-icon" />
              <div className="stat-content">
                <h3>Monthly Revenue</h3>
                <p className="stat-number">₹1.8L</p>
              </div>
            </div>
          </div>

          <div className="dashboard-sections">
            <div className="section-card">
              <h3>Room Availability</h3>
              <div className="room-grid">
                <div className="room-card">
                  <div className="room-type">Deluxe Suite</div>
                  <div className="room-details">
                    <span>Available: 5</span>
                    <span>Occupied: 3</span>
                  </div>
                  <span className="room-price">₹8,999/night</span>
                </div>
                <div className="room-card">
                  <div className="room-type">Standard Room</div>
                  <div className="room-details">
                    <span>Available: 12</span>
                    <span>Occupied: 8</span>
                  </div>
                  <span className="room-price">₹4,999/night</span>
                </div>
                <div className="room-card">
                  <div className="room-type">Premium Suite</div>
                  <div className="room-details">
                    <span>Available: 2</span>
                    <span>Occupied: 1</span>
                  </div>
                  <span className="room-price">₹15,999/night</span>
                </div>
              </div>
            </div>

            <div className="section-card">
              <h3>Recent Bookings</h3>
              <ul className="booking-list">
                <li>
                  <span className="booking-guest">John Doe</span>
                  <span className="booking-room">Deluxe Suite</span>
                  <span className="booking-dates">Aug 28-30</span>
                  <span className="booking-status confirmed">Confirmed</span>
                </li>
                <li>
                  <span className="booking-guest">Jane Smith</span>
                  <span className="booking-room">Standard Room</span>
                  <span className="booking-dates">Aug 29-Sep 1</span>
                  <span className="booking-status pending">Pending</span>
                </li>
                <li>
                  <span className="booking-guest">Mike Johnson</span>
                  <span className="booking-room">Premium Suite</span>
                  <span className="booking-dates">Sep 5-8</span>
                  <span className="booking-status confirmed">Confirmed</span>
                </li>
              </ul>
            </div>

            <div className="section-card">
              <h3>Guest Reviews</h3>
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
                  <p className="review-text">Excellent service and beautiful rooms!</p>
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
                  <p className="review-text">Great location, friendly staff.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}

export default HotelPartnerDashboard
