import { BarChart3, Users, MapPin, Calendar, Ticket, PieChart, Settings, LogOut, Building, TrendingUp, Star, User, Menu, X, Sun, Moon, Mail } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import { useState, useEffect } from 'react'
import '../Dashboard.css'

const navItems = [
  { to: '/tour-operator/dashboard', match: 'dashboard', label: 'Dashboard', icon: BarChart3 },
  { to: '/tour-operator/profile', match: 'profile', label: 'Operator Profile', icon: User },
  { to: '/tour-operator/packages', match: 'packages', label: 'Package Management', icon: Building },
  { to: '/tour-operator/itineraries', match: 'itineraries', label: 'Itinerary Management', icon: Calendar },
  { to: '/tour-operator/pricing', match: 'pricing', label: 'Pricing & Availability', icon: TrendingUp },
  { to: '/tour-operator/bookings', match: 'bookings', label: 'Booking Management', icon: Ticket },
  { to: '/tour-operator/customers', match: 'customers', label: 'Customer Information', icon: Users },
  { to: '/tour-operator/communication', match: 'communication', label: 'Customer Communication', icon: Mail },
  { to: '/tour-operator/reviews', match: 'reviews', label: 'Reviews & Ratings', icon: Star },
  { to: '/tour-operator/revenue', match: 'revenue', label: 'Revenue & Notifications', icon: PieChart },
  { to: '/tour-operator/settings', match: 'settings', label: 'Settings', icon: Settings }
]

const OperatorLayout = ({ active, actions, children }) => {  const navigate = useNavigate()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [theme, setTheme] = useState(() => localStorage.getItem('theme') || 'light')
  const user = JSON.parse(localStorage.getItem('user') || '{}')
  const initials = (user.fullName || 'Operator')
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
    <div className="dashboard-container operator-portal">
      <aside className={'dashboard-sidebar ' + (sidebarOpen ? 'open ' : '') + (sidebarCollapsed ? 'collapsed' : '')}>
        <div className="sidebar-header">
          <span className="op-brand-mark">
            <MapPin className="h-6 w-6" />
          </span>
          <div className="op-brand-text">
            <h2>Tour Operator</h2>
            <p className="op-brand-sub">Operator portal</p>
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
            className="op-header-hamburger header-icon-btn"
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
              <span>{user.fullName || 'Tour Operator'}</span>
            </div>
          </div>
        </header>
        <div className="dashboard-content">{children}</div>
      </main>
    </div>
  )
}

export default OperatorLayout
