import { useEffect, useState } from 'react'
import { Users, Search, Plus, Pencil as Edit, Trash2, Download, UserCheck, UserX, Mail, Phone } from 'lucide-react'
import { api, downloadCsv, formValues, formatDate } from '../../api'
import AdminLayout from './AdminLayout'

const UserManagement = () => {
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  const [filterRole, setFilterRole] = useState('all')
  const [filterStatus, setFilterStatus] = useState('all')
  const [showAddModal, setShowAddModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [selectedUser, setSelectedUser] = useState(null)

  const fetchUsers = async () => {
    try {
      setError('')
      const data = await api('/admin/users')
      setUsers((data.users || []).map((user) => ({
        id: user._id,
        name: user.fullName,
        email: user.email,
        phone: user.phone,
        role: user.role,
        status: user.status || 'active',
        joinDate: formatDate(user.createdAt),
        lastLogin: user.lastLogin ? formatDate(user.lastLogin) : 'Never'
      })))
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    Promise.resolve().then(() => fetchUsers())
  }, [])

  const filteredUsers = users.filter((user) => {
    const matchesSearch = user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.email.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesRole = filterRole === 'all' || user.role === filterRole
    const matchesStatus = filterStatus === 'all' || user.status === filterStatus
    return matchesSearch && matchesRole && matchesStatus
  })

  const handleDeleteUser = async (userId) => {
    if (!window.confirm('Are you sure you want to delete this user?')) return
    try {
      await api(`/admin/users/${userId}`, { method: 'DELETE' })
      setUsers(users.filter((user) => user.id !== userId))
    } catch (err) {
      alert(err.message)
    }
  }

  const handleToggleStatus = async (userId) => {
    const user = users.find((item) => item.id === userId)
    const newStatus = user.status === 'active' ? 'inactive' : 'active'
    try {
      await api(`/admin/users/${userId}`, {
        method: 'PUT',
        body: JSON.stringify({ status: newStatus })
      })
      setUsers(users.map((item) => item.id === userId ? { ...item, status: newStatus } : item))
    } catch (err) {
      alert(err.message)
    }
  }

  const handleAddUser = async (e) => {
    e.preventDefault()
    const values = formValues(e.target)
    try {
      await api('/admin/users', { method: 'POST', body: JSON.stringify(values) })
      setShowAddModal(false)
      fetchUsers()
    } catch (err) {
      alert(err.message)
    }
  }

  const handleUpdateUser = async (e) => {
    e.preventDefault()
    const values = formValues(e.target)
    try {
      await api(`/admin/users/${selectedUser.id}`, { method: 'PUT', body: JSON.stringify(values) })
      setShowEditModal(false)
      fetchUsers()
    } catch (err) {
      alert(err.message)
    }
  }

  return (
    <AdminLayout
      active="users"
      title="User Management"
      actions={
        <>
          <button
            onClick={() => downloadCsv('users.csv', ['Name', 'Email', 'Phone', 'Role', 'Status', 'Join Date', 'Last Login'], filteredUsers.map((u) => [u.name, u.email, u.phone, u.role, u.status, u.joinDate, u.lastLogin]))}
            className="action-btn"
          >
            <Download className="h-4 w-4" />
            Export
          </button>
          <button onClick={() => setShowAddModal(true)} className="action-btn">
            <Plus className="h-4 w-4" />
            Add User
          </button>
        </>
      }
    >
      {error && <div className="error-message">{error}</div>}
      <div className="filters-section">
        <div className="search-bar">
          <Search className="search-icon" />
          <input type="text" placeholder="Search users by name or email..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
        </div>
        <div className="filter-controls">
          <select value={filterRole} onChange={(e) => setFilterRole(e.target.value)} className="filter-select">
            <option value="all">All Roles</option>
            <option value="admin">Admin</option>
            <option value="customer">Customer</option>
            <option value="tour_operator">Tour Operator</option>
            <option value="hotel_partner">Hotel Partner</option>
          </select>
          <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="filter-select">
            <option value="all">All Status</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </div>
      </div>

      <div className="stats-grid">
        <div className="stat-card">
          <Users className="stat-icon" />
          <div className="stat-content">
            <h3>Total Users</h3>
            <p className="stat-number">{users.length}</p>
          </div>
        </div>
        <div className="stat-card">
          <UserCheck className="stat-icon" />
          <div className="stat-content">
            <h3>Active Users</h3>
            <p className="stat-number">{users.filter((u) => u.status === 'active').length}</p>
          </div>
        </div>
        <div className="stat-card">
          <UserX className="stat-icon" />
          <div className="stat-content">
            <h3>Inactive Users</h3>
            <p className="stat-number">{users.filter((u) => u.status === 'inactive').length}</p>
          </div>
        </div>
      </div>

      <div className="section-card full-width">
        <h3>Users List ({filteredUsers.length})</h3>
        {loading ? (
          <div style={{ textAlign: 'center', padding: '2rem', color: '#64748b' }}>Loading users...</div>
        ) : (
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Phone</th>
                  <th>Role</th>
                  <th>Status</th>
                  <th>Join Date</th>
                  <th>Last Login</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.length === 0 ? (
                  <tr>
                    <td colSpan="8" style={{ textAlign: 'center', padding: '2rem', color: '#64748b' }}>No users found</td>
                  </tr>
                ) : filteredUsers.map((user) => (
                  <tr key={user.id}>
                    <td className="user-name-cell">
                      <div className="user-avatar">{user.name.charAt(0)}</div>
                      <span>{user.name}</span>
                    </td>
                    <td><Mail className="h-4 w-4 inline-icon" />{user.email}</td>
                    <td><Phone className="h-4 w-4 inline-icon" />{user.phone}</td>
                    <td><span className={`role-badge ${user.role}`}>{user.role.replace('_', ' ')}</span></td>
                    <td><span className={`status-badge ${user.status}`}>{user.status}</span></td>
                    <td>{user.joinDate}</td>
                    <td>{user.lastLogin}</td>
                    <td>
                      <div className="action-buttons">
                        <button onClick={() => { setSelectedUser(user); setShowEditModal(true) }} className="icon-btn edit"><Edit className="h-4 w-4" /></button>
                        <button onClick={() => handleToggleStatus(user.id)} className="icon-btn toggle">
                          {user.status === 'active' ? <UserX className="h-4 w-4" /> : <UserCheck className="h-4 w-4" />}
                        </button>
                        <button onClick={() => handleDeleteUser(user.id)} className="icon-btn delete"><Trash2 className="h-4 w-4" /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showAddModal && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <h3>Add New User</h3>
              <button onClick={() => setShowAddModal(false)} className="modal-close">×</button>
            </div>
            <div className="modal-body">
              <form className="user-form" onSubmit={handleAddUser}>
                <div className="form-group"><label>Full Name</label><input name="fullName" type="text" required /></div>
                <div className="form-group"><label>Email</label><input name="email" type="email" required /></div>
                <div className="form-group"><label>Phone</label><input name="phone" type="tel" required /></div>
                <div className="form-group">
                  <label>Role</label>
                  <select name="role" required defaultValue="customer">
                    <option value="customer">Customer</option>
                    <option value="tour_operator">Tour Operator</option>
                    <option value="hotel_partner">Hotel Partner</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>
                <div className="form-group"><label>Password</label><input name="password" type="password" required /></div>
                <div className="form-actions">
                  <button type="button" onClick={() => setShowAddModal(false)} className="btn-secondary">Cancel</button>
                  <button type="submit" className="btn-primary">Add User</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {showEditModal && selectedUser && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <h3>Edit User</h3>
              <button onClick={() => setShowEditModal(false)} className="modal-close">×</button>
            </div>
            <div className="modal-body">
              <form className="user-form" onSubmit={handleUpdateUser}>
                <div className="form-group"><label>Full Name</label><input name="fullName" type="text" defaultValue={selectedUser.name} required /></div>
                <div className="form-group"><label>Email</label><input name="email" type="email" defaultValue={selectedUser.email} required /></div>
                <div className="form-group"><label>Phone</label><input name="phone" type="tel" defaultValue={selectedUser.phone} required /></div>
                <div className="form-group">
                  <label>Role</label>
                  <select name="role" defaultValue={selectedUser.role} required>
                    <option value="customer">Customer</option>
                    <option value="tour_operator">Tour Operator</option>
                    <option value="hotel_partner">Hotel Partner</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>
                <div className="form-actions">
                  <button type="button" onClick={() => setShowEditModal(false)} className="btn-secondary">Cancel</button>
                  <button type="submit" className="btn-primary">Update User</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  )
}

export default UserManagement
