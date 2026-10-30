import { useState, useEffect } from 'react'
import {
  BarChart3, Building, Bed, Calendar, Users, DollarSign, Star, Settings,
  LogOut, CheckCircle, Sun, Moon, Menu
} from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import { API_HOST } from '../../api'
import '../Dashboard.css'
import './HotelDashboard.css'

const navItems = [
  { to: '/hotel-partner/dashboard', match: 'dashboard', label: 'Dashboard', icon: BarChart3 },
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

const HotelLayout = ({ active, actions, children }) => {
  const navigate = useNavigate()
  const [theme, setTheme] = useState(() => localStorage.getItem('theme') || 'light')
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [user, setUser] = useState(() => JSON.parse(localStorage.getItem('user') || '{}'))
  const [sidebarShowIcon, setSidebarShowIcon] = useState(
    !user.avatar || user.avatar.startsWith('data:')
  )

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    document.documentElement.style.colorScheme = theme
    localStorage.setItem('theme', theme)
  }, [theme])

  useEffect(() => {
    const handleUserUpdate = () => {
      const next = JSON.parse(localStorage.getItem('user') || '{}')
      setUser(next)
      setSidebarShowIcon(!next.avatar || next.avatar.startsWith('data:'))
    }
    window.addEventListener('user-updated', handleUserUpdate)
    return () => window.removeEventListener('user-updated', handleUserUpdate)
  }, [])

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

  const handleLogout = () => {
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    navigate('/login')
  }

  const sidebarClassName = 'dashboard-sidebar ' +
    (sidebarOpen ? 'open ' : '') +
    (sidebarCollapsed ? 'collapsed' : '')

  const mainClassName = 'dashboard-main ' +
    (sidebarCollapsed ? 'collapsed' : '')

  const linkClassName = (match) =>
    'nav-item ' + (active === match ? 'active' : '')

  return (
    <div className="dashboard-container hotel-partner">
        <aside className={sidebarClassName}>
        <div className="sidebar-header">
          {sidebarShowIcon ? (
            <Building className="h-8 w-8" />
          ) : (
            <img
              src={`${API_HOST}${user.avatar}`}
              alt="Hotel Partner"
              className="hotel-sidebar-avatar"
              onError={(e) => {
                e.target.style.display = 'none'
                setSidebarShowIcon(true)
              }}
            />
          )}
          <h2>Hotel Partner</h2>
        </div>
        <nav className="sidebar-nav">
          {navItems.map((item) => {
            const Icon = item.icon
            return (
              <Link
                key={item.to}
                to={item.to}
                className={linkClassName(item.match)}
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

      <main className={mainClassName}>
        <header className="dashboard-header">
          <button
            className="hr-header-hamburger header-icon-btn"
            onClick={handleMenuToggle}
            aria-label="Toggle sidebar"
            title="Toggle sidebar"
          >
            <Menu className="h-5 w-5" />
          </button>
          <div className="header-actions">
            {actions}
            <button
              onClick={toggleTheme}
              className="header-icon-btn"
              aria-label={'Switch to ' + (theme === 'light' ? 'dark' : 'light') + ' mode'}
              title={theme === 'light' ? 'Dark mode' : 'Light mode'}
            >
              {theme === 'light' ? <Moon className="h-5 w-5" /> : <Sun className="h-5 w-5" />}
            </button>
            <button onClick={handleLogout} className="btn-logout-header">
              <LogOut className="h-4 w-4" />
              <span>Logout</span>
            </button>
            <div className="user-info">
              {user.avatar && !user.avatar.startsWith('data:') && (
                <img
                  src={`${API_HOST}${user.avatar}`}
                  alt="Profile"
                  className="hotel-header-avatar"
                  onError={(e) => {
                    e.target.style.display = 'none'
                  }}
                />
              )}
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
