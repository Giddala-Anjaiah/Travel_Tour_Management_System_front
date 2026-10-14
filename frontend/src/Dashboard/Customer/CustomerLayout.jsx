import { BarChart3, Compass, MapPin, Ticket, Calendar, Building, CreditCard, FileText, Heart, User, LogOut, Menu, Sun, Moon } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import { useState, useEffect } from 'react'
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

const CustomerLayout = ({ active, actions, children }) => {
  const navigate = useNavigate()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [theme, setTheme] = useState(() => localStorage.getItem('theme') || 'light')
  const user = JSON.parse(localStorage.getItem('user') || '{}')
  const initials = (user.fullName || 'Customer')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join('')

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    document.documentElement.style.colorScheme = theme
    localStorage.setItem('theme', theme)
  }, [theme])

  const toggleTheme = () => {
    setTheme((prev) => (prev === 'light' ? 'dark' : 'light'))
  }

  const isMobile = () => window.matchMedia('(max-width: 900px)').matches

  const handleMenuToggle = () => {
    if (isMobile()) {
      setSidebarOpen((prev) => !prev)
    } else {
      setSidebarCollapsed((prev) => !prev)
    }
  }

  const handleLogout = () => {
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    navigate('/login')
  }

  return (
    <div className="dashboard-container customer-portal">
      <aside className={'dashboard-sidebar ' + (sidebarOpen ? 'open ' : '') + (sidebarCollapsed ? 'collapsed' : '')}>
        <div className="sidebar-header">
          <span className="cp-brand-mark">
            <Compass className="h-6 w-6" />
          </span>
          <div className="cp-brand-text">
            <h2>My Trips</h2>
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
                className={'nav-item ' + (active === item.match ? 'active' : '')}
                title={sidebarCollapsed ? item.label : ''}
                onClick={() => setSidebarOpen(false)}
              >
                <Icon className="h-5 w-5" />
                <span>{item.label}</span>
              </Link>
            )
          })}
        </nav>
      </aside>

      <main className={'dashboard-main ' + (sidebarCollapsed ? 'collapsed' : '')}>
        <header className="dashboard-header">
          <button
            className="cp-header-hamburger header-icon-btn"
            onClick={handleMenuToggle}
            aria-label="Toggle sidebar"
            title="Toggle sidebar"
          >
            <Menu className="h-5 w-5" />
          </button>
          <div className="header-actions">
            {actions}
            <button onClick={toggleTheme} className="icon-btn header-icon-btn" aria-label={'Switch to ' + (theme === 'light' ? 'dark' : 'light') + ' mode'} title={theme === 'light' ? 'Dark mode' : 'Light mode'}>
              {theme === 'light' ? <Moon className="h-5 w-5" /> : <Sun className="h-5 w-5" />}
            </button>
            <button onClick={handleLogout} className="btn-logout-header">
              <LogOut className="h-4 w-4" />
              <span>Logout</span>
            </button>
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
