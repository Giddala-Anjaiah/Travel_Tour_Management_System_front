import { BarChart3, Users, MapPin, Calendar, Ticket, FileText, PieChart, Settings, Shield, LogOut, Bed, Bell } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import '../Dashboard.css'

const navItems = [
  { to: '/admin/dashboard', match: 'dashboard', label: 'Dashboard Analytics', icon: BarChart3 },
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

const AdminLayout = ({ active, title, actions, children }) => {
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
          <Shield className="h-8 w-8" />
          <h2>Admin Panel</h2>
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
