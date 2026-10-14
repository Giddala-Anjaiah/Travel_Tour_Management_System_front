import { Navigate } from 'react-router-dom'

const ProtectedRoute = ({ children, allowedRoles }) => {
  const token = localStorage.getItem('token')
  const user = JSON.parse(localStorage.getItem('user') || '{}')

  if (!token) {
    return <Navigate to="/login" replace />
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    // Redirect to appropriate dashboard based on user's role
    const roleRedirects = {
      admin: '/admin/dashboard',
      customer: '/customer/dashboard',
      tour_operator: '/tour-operator/dashboard',
      hotel_partner: '/hotel-partner/dashboard'
    }
    return <Navigate to={roleRedirects[user.role] || '/'} replace />
  }

  return children
}

export default ProtectedRoute
