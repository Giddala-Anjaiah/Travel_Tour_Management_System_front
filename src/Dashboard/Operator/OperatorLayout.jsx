import { BarChart3, Users, MapPin, Calendar, Ticket, PieChart, Settings, LogOut, Building, TrendingUp, Star, User } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import '../Dashboard.css'

const navItems = [
  { to: '/tour-operator/dashboard', match: 'dashboard', label: 'Dashboard Analytics', icon: BarChart3 },
  { to: '/tour-operator/profile', match: 'profile', label: 'Operator Profile', icon: User },
  { to: '/tour-operator/packages', match: 'packages', label: 'Package Management', icon: Building },
  { to: '/tour-operator/itineraries', match: 'itineraries', label: 'Itinerary Management', icon: Calendar },
  { to: '/tour-operator/pricing', match: 'pricing', label: 'Pricing & Availability', icon: TrendingUp },
  { to: '/tour-operator/bookings', match: 'bookings', label: 'Booking Management', icon: Ticket },
  { to: '/tour-operator/customers', match: 'customers', label: 'Customer Information', icon: Users },
  { to: '/tour-operator/reviews', match: 'reviews', label: 'Reviews & Ratings', icon: Star },
  { to: '/tour-operator/revenue', match: 'revenue', label: 'Revenue & Notifications', icon: PieChart },
  { to: '/tour-operator/settings', match: 'settings', label: 'Settings', icon: Settings }
]

const OperatorLayout = ({ active, title, actions, children }) => {
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
        <div className="sidebar-footer">
          <button onClick={handleLogout} className="sidebar-logout-btn">
            <LogOut className="h-5 w-5" />
            <span>Logout</span>
          </button>
        </div>
      </aside>

      <main className="dashboard-main">
        <header className="dashboard-header">
          <h1>{title}</h1>
          <div className="header-actions">
            {actions}
            <div className="user-info">
              <span>Welcome, {user.fullName || 'Tour Operator'}</span>
            </div>
          </div>
        </header>
        <div className="dashboard-content">{children}</div>
      </main>
    </div>
  )
}

export default OperatorLayout