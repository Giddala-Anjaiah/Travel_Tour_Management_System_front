import { BarChart3, Building, Bed, Calendar, Users, DollarSign, Star, Settings, LogOut, CheckCircle } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import '../Dashboard.css'

const navItems = [
  { to: '/hotel-partner/dashboard', match: 'dashboard', label: 'Dashboard Analytics', icon: BarChart3 },
  { to: '/hotel-partner/profile', match: 'profile', label: 'Hotel Profile & Management', icon: Building },
  { to: '/hotel-partner/rooms', match: 'rooms', label: 'Room Management', icon: Bed },
  { to: '/hotel-partner/pricing', match: 'pricing', label: 'Pricing', icon: DollarSign },
  { to: '/hotel-partner/availability', match: 'availability', label: 'Room Availability', icon: Calendar },
  { to: '/hotel-partner/bookings', match: 'bookings', label: 'Hotel Bookings', icon: CheckCircle },
  { to: '/hotel-partner/checkin', match: 'checkin', label: 'Check-in / Check-out', icon: Users },
  { to: '/hotel-partner/guests', match: 'guests', label: 'Customer Information', icon: Users },
  { to: '/hotel-partner/reviews', match: 'reviews', label: 'Reviews, Revenue & Notifications', icon: Star },
  { to: '/hotel-partner/settings', match: 'settings', label: 'Settings', icon: Settings }
]

const HotelLayout = ({ active, title, actions, children }) => {
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
          {navItems.map((item) => {
            const Icon = item.icon
            return (
              <Link
                key={item.to}
                to={item.to}
                className={`nav-item ${active === item.match ? 'active' : ''}`}
              >
                <Icon className="h-5 w-5" />
                <span>{item.label}</span>
              </Link>
            )
          })}
        </nav>
      </aside>

      <button onClick={handleLogout} className="logout-btn">
        <LogOut className="h-5 w-5" />
        <span>Logout</span>
      </button>

      <main className="dashboard-main">
        <header className="dashboard-header">
          <h1>{title}</h1>
          <div className="header-actions">
            {actions}
            <div className="user-info">
              <span>Welcome, {user.fullName || 'Hotel Partner'}</span>
            </div>
          </div>
        </header>
        <div className="dashboard-content">{children}</div>
      </main>
    </div>
  )
}

export default HotelLayout
