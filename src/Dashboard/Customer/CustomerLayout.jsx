import { BarChart3, Compass, MapPin, Ticket, Calendar, Building, CreditCard, FileText, Heart, User, LogOut } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import '../Dashboard.css'

const navItems = [
  { to: '/customer/dashboard', match: 'dashboard', label: 'Dashboard', icon: BarChart3 },
  { to: '/customer/destinations', match: 'destinations', label: 'Destinations', icon: MapPin },
  { to: '/customer/packages', match: 'packages', label: 'Packages', icon: Ticket },
  { to: '/customer/itineraries', match: 'itineraries', label: 'Itineraries', icon: Calendar },
  { to: '/customer/hotels', match: 'hotels', label: 'Hotels', icon: Building },
  { to: '/customer/bookings', match: 'bookings', label: 'Bookings', icon: CreditCard },
  { to: '/customer/invoices', match: 'invoices', label: 'Invoices', icon: FileText },
  { to: '/customer/wishlist', match: 'wishlist', label: 'Wishlist', icon: Heart },
  { to: '/customer/profile', match: 'profile', label: 'Profile', icon: User }
]

const CustomerLayout = ({ active, title, subtitle, actions, children }) => {
  const navigate = useNavigate()
  const user = JSON.parse(localStorage.getItem('user') || '{}')
  const initials = (user.fullName || 'Customer')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join('')

  const handleLogout = () => {
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    navigate('/login')
  }

  return (
    <div className="dashboard-container customer-portal">
      <aside className="dashboard-sidebar">
        <div className="sidebar-header">
          <span className="cp-brand-mark">
            <Compass className="h-6 w-6" />
          </span>
          <div>
            <h2>Wanderlust</h2>
            <p className="cp-brand-sub">Customer portal</p>
          </div>
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
          <div>
            <h1>{title}</h1>
            {subtitle ? <p className="header-subtitle">{subtitle}</p> : null}
          </div>
          <div className="header-actions">
            {actions}
            <div className="user-info">
              <span className="cp-avatar">{initials}</span>
              <span>{user.fullName || 'Customer'}</span>
            </div>
          </div>
        </header>
        <div className="dashboard-content">{children}</div>
      </main>
    </div>
  )
}

export default CustomerLayout
