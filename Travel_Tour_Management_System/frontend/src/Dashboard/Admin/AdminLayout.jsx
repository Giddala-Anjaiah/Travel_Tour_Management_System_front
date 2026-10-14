import { BarChart3, Users, MapPin, Calendar, Ticket, FileText, PieChart, Settings, Shield, LogOut, Bed, Bell, Menu, X, Sun, Moon } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import { useState, useEffect } from 'react'
import '../Dashboard.css'

const navItems = [
  { to: '/admin/dashboard', match: 'dashboard', label: 'Dashboard', icon: BarChart3 },
  { to: '/admin/users', match: 'users', label: 'User Management', icon: Users },
  { to: '/admin/destinations', match: 'destinations', label: 'Destinations & Packages', icon: MapPin },
  { to: '/admin/itinerary', match: 'itinerary', label: 'Itinerary & Hotels', icon: Calendar },
  { to: '/admin/rooms', match: 'rooms', label: 'Rooms & Availability', icon: Bed },
  { to: '/admin/bookings', match: 'bookings', label: 'Bookings & Payments', icon: Ticket },
  { to: '/admin/invoices', match: 'invoices', label: 'Invoices & Reviews', icon: FileText },
  { to: '/admin/notifications', match: 'notifications', label: 'Notifications', icon: Bell },
  { to: '/admin/reports', match: 'reports', label: 'Reports', icon: PieChart },
  { to: '/admin/settings', match: 'settings', label: 'Administration', icon: Settings }
]

const AdminLayout = ({ active, actions, children }) => {
  const navigate = useNavigate()
  const user = JSON.parse(localStorage.getItem('user') || '{}')
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [theme, setTheme] = useState(() => localStorage.getItem('theme') || 'light')

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    localStorage.setItem('theme', theme)
  }, [theme])

  const handleLogout = () => {
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    navigate('/login')
  }

  const toggleTheme = () => {
    setTheme(prev => prev === 'light' ? 'dark' : 'light')
  }

  const isMobile = () => window.matchMedia('(max-width: 900px)').matches

  const handleMenuToggle = () => {
    if (isMobile()) {
      setSidebarOpen(prev => !prev)
    } else {
      setSidebarCollapsed(prev => !prev)
    }
  }

  return (
    <div className="dashboard-container admin-portal">
      <aside className={'dashboard-sidebar ' + (sidebarOpen ? 'open ' : '') + (sidebarCollapsed ? 'collapsed' : '')}>
        <div className="sidebar-header">
          <Shield className="h-8 w-8" />
          <span className={sidebarCollapsed ? 'hidden' : ''}>Admin Panel</span>
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
                <span className={sidebarCollapsed ? 'hidden' : ''}>{item.label}</span>
              </Link>
            )
          })}
        </nav>
      </aside>

      <main className={'dashboard-main ' + (sidebarCollapsed ? 'collapsed' : '')}>
        <header className="dashboard-header">
          <button
            className="admin-header-hamburger header-icon-btn"
            onClick={handleMenuToggle}
            aria-label="Toggle sidebar"
            title="Toggle sidebar"
          >
            <Menu className="h-5 w-5" />
          </button>
          <div className="header-actions">
            {actions}
            <button onClick={toggleTheme} className="icon-btn header-icon-btn" aria-label={'Switch to ' + (theme === 'light' ? 'dark' : 'light') + ' mode'}>
              {theme === 'light' ? <Moon className="h-5 w-5" /> : <Sun className="h-5 w-5" />}
            </button>
            <button onClick={handleLogout} className="btn-logout-header">
              <LogOut className="h-4 w-4" />
              <span>Logout</span>
            </button>
            <div className="user-info">
              <span>Welcome, {user.fullName || 'Admin'}</span>
            </div>
          </div>
        </header>
        <div className="dashboard-content">{children}</div>
      </main>
    </div>
  )
}

export default AdminLayout
