import { useEffect, useState } from 'react'
import {
  Users, Crown, Shield, Clock, CreditCard, TrendingUp, Percent, Search, Filter,
  Edit as EditIcon, UserCheck, UserX, Mail, AlertCircle, CheckCircle, RefreshCcw,
  ChevronLeft, ChevronRight, Wallet, Rocket
} from 'lucide-react'
import { api, formatDate, formatCurrency, readPagination } from '../../api'
import Pagination from '../../components/Pagination'
import AdminLayout from './AdminLayout'

const AdminMembershipManagement = () => {
  const [stats, setStats] = useState({
    totalMembers: 0,
    basicMembers: 0,
    premiumMembers: 0,
    vipMembers: 0,
    activeSubscriptions: 0,
    expiredSubscriptions: 0,
    membershipRevenue: 0,
    renewals: 0
  })
  const [subscriptions, setSubscriptions] = useState([])
  const [plans, setPlans] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  const [filterStatus, setFilterStatus] = useState('all')
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(20)
  const [meta, setMeta] = useState({ page: 1, limit: 20, total: 0, totalPages: 1, hasNext: false, hasPrev: false })
  const [showPlanModal, setShowPlanModal] = useState(false)
  const [showStatusModal, setShowStatusModal] = useState(false)
  const [selectedPlan, setSelectedPlan] = useState(null)
  const [selectedSubscription, setSelectedSubscription] = useState(null)
  const [planLoading, setPlanLoading] = useState(false)
  const [statusLoading, setStatusLoading] = useState(false)
  const [editingPlan, setEditingPlan] = useState(false)

  const hasLocalFilters = filterStatus !== 'all' || searchTerm.trim() !== ''

  const fetchStats = async () => {
    try {
      const data = await api('/admin/membership/analytics')
      setStats({
        totalMembers: data.totalMembers || 0,
        basicMembers: data.basicMembers || 0,
        premiumMembers: data.premiumMembers || 0,
        vipMembers: data.vipMembers || 0,
        activeSubscriptions: data.activeSubscriptions || 0,
        expiredSubscriptions: data.expiredSubscriptions || 0,
        membershipRevenue: data.membershipRevenue || 0,
        renewals: data.renewals || 0
      })
    } catch (err) {
      console.error('Fetch analytics error:', err.message)
    }
  }

  const fetchSubscriptions = async (overrides = {}) => {
    const nextPage = overrides.page ?? page
    const nextLimit = overrides.limit ?? limit
    try {
      setError('')
      const data = await api('/admin/membership/subscriptions', {
        params: {
          page: hasLocalFilters ? undefined : nextPage,
          limit: hasLocalFilters ? 'all' : nextLimit,
          search: searchTerm,
          status: filterStatus === 'all' ? undefined : filterStatus
        }
      })
      setSubscriptions(data.subscriptions || [])
      setMeta(readPagination(data, data.subscriptions ? data.subscriptions.length : 0))
    } catch (err) {
      setError(err.message || 'Failed to fetch subscriptions')
    } finally {
      setLoading(false)
    }
  }

  const fetchPlans = async () => {
    try {
      const data = await api('/admin/membership/plans')
      setPlans(data.plans || [])
    } catch (err) {
      console.error('Fetch plans error:', err.message)
    }
  }

  useEffect(() => {
    fetchStats()
    fetchPlans()
    Promise.resolve().then(() => fetchSubscriptions())
  }, [page, limit, searchTerm, filterStatus])

  const handlePlanSubmit = async (e) => {
    e.preventDefault()
    setPlanLoading(true)
    try {
      const formData = new FormData(e.target)
      const payload = {
        name: formData.get('name'),
        slug: formData.get('slug'),
        description: formData.get('description'),
        price: Number(formData.get('price')) || 0,
        currency: formData.get('currency') || 'INR',
        billingInterval: formData.get('billingInterval') || 'yearly',
        durationMonths: Number(formData.get('durationMonths')) || 12,
        discountPercentage: Number(formData.get('discountPercentage')) || 0,
        maxDiscountLimit: formData.get('maxDiscountLimit') ? Number(formData.get('maxDiscountLimit')) : undefined,
        benefits: formData.getAll('benefits').filter(Boolean),
        isActive: formData.get('isActive') === 'on',
        isPopular: formData.get('isPopular') === 'on',
        sortOrder: Number(formData.get('sortOrder')) || 0
      }

      if (editingPlan && selectedPlan) {
        await api(`/admin/membership/plans/${selectedPlan._id}`, {
          method: 'PUT',
          body: JSON.stringify(payload)
        })
        setSuccess('Membership plan updated successfully')
      } else {
        await api('/admin/membership/plans', {
          method: 'POST',
          body: JSON.stringify(payload)
        })
        setSuccess('Membership plan created successfully')
      }

      setShowPlanModal(false)
      setSelectedPlan(null)
      setEditingPlan(false)
      setTimeout(() => {
        setSuccess('')
        fetchPlans()
        fetchStats()
        fetchSubscriptions({ page: 1 })
      }, 1500)
    } catch (err) {
      setError(err.message || 'Failed to save membership plan')
    } finally {
      setPlanLoading(false)
    }
  }

  const handleEditPlan = (plan) => {
    setSelectedPlan(plan)
    setEditingPlan(true)
    setShowPlanModal(true)
  }

  const handleCreatePlan = () => {
    setSelectedPlan(null)
    setEditingPlan(false)
    setShowPlanModal(true)
  }

  const handleDeletePlan = async (plan) => {
    if (!window.confirm(`Are you sure you want to delete the "${plan.name}" plan?`)) return
    try {
      await api(`/admin/membership/plans/${plan._id}`, { method: 'DELETE' })
      setSuccess('Membership plan deleted successfully')
      setTimeout(() => {
        setSuccess('')
        fetchPlans()
      }, 1500)
    } catch (err) {
      setError(err.message || 'Failed to delete plan')
    }
  }

  const handleStatusChange = async (e) => {
    e.preventDefault()
    setStatusLoading(true)
    try {
      const formData = new FormData(e.target)
      const payload = {
        status: formData.get('status'),
        notes: formData.get('notes') || ''
      }
      await api(`/admin/membership/subscriptions/${selectedSubscription._id}/status`, {
        method: 'PUT',
        body: JSON.stringify(payload)
      })
      setSuccess(`Membership status updated to ${payload.status}`)
      setShowStatusModal(false)
      setSelectedSubscription(null)
      setTimeout(() => {
        setSuccess('')
        fetchSubscriptions({ page: 1 })
        fetchStats()
      }, 1500)
    } catch (err) {
      setError(err.message || 'Failed to update subscription status')
    } finally {
      setStatusLoading(false)
    }
  }

  const remainingDays = (endDate) => {
    if (!endDate) return 0
    const now = new Date()
    const end = new Date(endDate)
    const diff = end.getTime() - now.getTime()
    return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)))
  }

  const statusColor = (status) => {
    switch (status) {
      case 'active': return 'var(--customer-accent-emerald)'
      case 'expired': return 'var(--cp-danger)'
      case 'cancelled': return 'var(--cp-warning)'
      case 'suspended': return 'var(--cp-warning)'
      case 'pending': return 'var(--customer-text-secondary)'
      default: return 'var(--customer-text-secondary)'
    }
  }

  return (
    <AdminLayout active="membership-management">
      <div className="page-head">
        <div className="page-head-row">
          <div>
            <h1>Membership Management</h1>
            <p>Manage membership plans, customer subscriptions, and membership analytics.</p>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button onClick={handleCreatePlan} className="btn-primary enhanced">
              <Crown className="h-4 w-4" />
              Add Plan
            </button>
          </div>
        </div>
      </div>

      {error && (
        <div className="cd-alert warning" style={{ marginBottom: '1rem' }}>
          <AlertCircle className="h-4 w-4" style={{ marginRight: '0.5rem' }} />
          {error}
        </div>
      )}
      {success && (
        <div className="cd-alert info" style={{ marginBottom: '1rem' }}>
          <CheckCircle className="h-4 w-4" style={{ marginRight: '0.5rem', color: 'var(--customer-accent-emerald)' }} />
          {success}
        </div>
      )}

      <div className="dashboard-page" style={{ padding: '0 2rem 2rem 2rem' }}>
        {/* Analytics Cards */}
        <div className="analytics-grid enhanced" style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '1rem',
          marginBottom: '1.5rem'
        }}>
          <div className="stat-card enhanced" style={{
            background: 'var(--customer-card-bg)',
            border: '1px solid var(--customer-border)',
            borderRadius: '0.75rem',
            padding: '1.25rem',
            boxShadow: 'var(--shadow-sm)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
              <div>
                <Crown className="h-4 w-4" style={{ color: 'var(--customer-primary-teal)' }} />
              </div>
              <div style={{ textAlign: 'right' }}>
                <Rocket className="h-4 w-4" style={{ color: 'var(--customer-accent-emerald)', marginLeft: '0.5rem' }} />
              </div>
            </div>
            <div style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--customer-text-main)' }}>{stats.totalMembers}</div>
            <div style={{ fontSize: '0.8rem', color: 'var(--customer-text-secondary)' }}>Total Members</div>
          </div>
          <div className="stat-card enhanced" style={{
            background: 'var(--customer-card-bg)',
            border: '1px solid var(--customer-border)',
            borderRadius: '0.75rem',
            padding: '1.25rem',
            boxShadow: 'var(--shadow-sm)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
              <Shield className="h-4 w-4" style={{ color: 'var(--customer-primary-teal)' }} />
            </div>
            <div style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--customer-text-main)' }}>{stats.activeSubscriptions}</div>
            <div style={{ fontSize: '0.8rem', color: 'var(--customer-text-secondary)' }}>Active Subscriptions</div>
          </div>
          <div className="stat-card enhanced" style={{
            background: 'var(--customer-card-bg)',
            border: '1px solid var(--customer-border)',
            borderRadius: '0.75rem',
            padding: '1.25rem',
            boxShadow: 'var(--shadow-sm)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
              <Clock className="h-4 w-4" style={{ color: 'var(--cp-warning)' }} />
            </div>
            <div style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--customer-text-main)' }}>{stats.expiredSubscriptions}</div>
            <div style={{ fontSize: '0.8rem', color: 'var(--customer-text-secondary)' }}>Expired Subscriptions</div>
          </div>
          <div className="stat-card enhanced" style={{
            background: 'var(--customer-card-bg)',
            border: '1px solid var(--customer-border)',
            borderRadius: '0.75rem',
            padding: '1.25rem',
            boxShadow: 'var(--shadow-sm)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
              <CreditCard className="h-4 w-4" style={{ color: 'var(--cp-gold)' }} />
            </div>
            <div style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--customer-text-main)' }}>{formatCurrency(stats.membershipRevenue)}</div>
            <div style={{ fontSize: '0.8rem', color: 'var(--customer-text-secondary)' }}>Membership Revenue</div>
          </div>
        </div>

        {/* Quick Stats Row */}
        <div className="quick-stats enhanced" style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: '1rem',
          marginBottom: '1.5rem'
        }}>
          {[
            { label: 'Basic Members', value: stats.basicMembers, icon: <Users className="h-4 w-4" />, color: 'var(--customer-text-secondary)' },
            { label: 'Premium Members', value: stats.premiumMembers, icon: <Crown className="h-4 w-4" />, color: 'var(--customer-primary-teal)' },
            { label: 'VIP Members', value: stats.vipMembers, icon: <Shield className="h-4 w-4" />, color: 'var(--cp-gold)' },
            { label: 'Renewals', value: stats.renewals, icon: <RefreshCcw className="h-4 w-4" />, color: 'var(--customer-accent-emerald)' }
          ].map((stat, i) => (
            <div key={i} className="stat-item enhanced" style={{
              background: 'var(--customer-card-bg)',
              border: '1px solid var(--customer-border)',
              borderRadius: '0.75rem',
              padding: '1rem',
              textAlign: 'center'
            }}>
              <div style={{ color: stat.color, marginBottom: '0.5rem' }}>{stat.icon}</div>
              <div style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--customer-text-main)' }}>{stat.value}</div>
              <div style={{ fontSize: '0.8rem', color: 'var(--customer-text-secondary)' }}>{stat.label}</div>
            </div>
          ))}
        </div>

        {/* Plans Management */}
        <div className="plans-section enhanced" style={{ marginBottom: '1.5rem' }}>
          <div className="section-header enhanced" style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '1rem'
          }}>
            <h3 style={{ margin: 0, color: 'var(--customer-text-main)' }}>
              <Crown className="h-4 w-4" style={{ marginRight: '0.5rem' }} />
              Membership Plans
            </h3>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid var(--customer-border)' }}>
                  <th style={{ textAlign: 'left', padding: '0.75rem', fontSize: '0.8rem', color: 'var(--customer-text-secondary)', fontWeight: 700 }}>Plan</th>
                  <th style={{ textAlign: 'left', padding: '0.75rem', fontSize: '0.8rem', color: 'var(--customer-text-secondary)', fontWeight: 700 }}>Price</th>
                  <th style={{ textAlign: 'left', padding: '0.75rem', fontSize: '0.8rem', color: 'var(--customer-text-secondary)', fontWeight: 700 }}>Duration</th>
                  <th style={{ textAlign: 'left', padding: '0.75rem', fontSize: '0.8rem', color: 'var(--customer-text-secondary)', fontWeight: 700 }}>Discount</th>
                  <th style={{ textAlign: 'left', padding: '0.75rem', fontSize: '0.8rem', color: 'var(--customer-text-secondary)', fontWeight: 700 }}>Status</th>
                  <th style={{ textAlign: 'right', padding: '0.75rem', fontSize: '0.8rem', color: 'var(--customer-text-secondary)', fontWeight: 700 }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {plans.length === 0 && (
                  <tr>
                    <td colSpan={6} style={{ padding: '2rem', textAlign: 'center', color: 'var(--customer-text-secondary)' }}>
                      No membership plans found. Click "Add Plan" to create one.
                    </td>
                  </tr>
                )}
                {plans.map((plan) => (
                  <tr key={plan._id} style={{ borderBottom: '1px solid var(--customer-border)' }}>
                    <td style={{ padding: '0.75rem', fontSize: '0.9rem', color: 'var(--customer-text-main)', fontWeight: 600 }}>
                      {plan.name} {plan.isPopular && <span style={{ marginLeft: '0.5rem', fontSize: '0.7rem', background: 'var(--cp-gold)', color: 'white', padding: '0.1rem 0.4rem', borderRadius: '0.3rem' }}>Popular</span>}
                    </td>
                    <td style={{ padding: '0.75rem', fontSize: '0.9rem', color: 'var(--customer-text-main)' }}>{plan.price === 0 ? 'Free' : formatCurrency(plan.price)}</td>
                    <td style={{ padding: '0.75rem', fontSize: '0.9rem', color: 'var(--customer-text-main)' }}>{plan.durationMonths} months</td>
                    <td style={{ padding: '0.75rem', fontSize: '0.9rem', color: 'var(--customer-text-main)' }}>{plan.discountPercentage}%</td>
                    <td style={{ padding: '0.75rem' }}>
                      <span style={{
                        display: 'inline-block',
                        padding: '0.2rem 0.6rem',
                        borderRadius: '0.5rem',
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        background: plan.isActive ? 'var(--cp-success-bg)' : 'var(--danger-light)',
                        color: plan.isActive ? 'var(--customer-accent-emerald)' : 'var(--cp-danger)'
                      }}>
                        {plan.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td style={{ padding: '0.75rem', textAlign: 'right' }}>
                      <button
                        onClick={() => handleEditPlan(plan)}
                        className="icon-btn enhanced"
                        style={{ padding: '0.4rem', marginRight: '0.25rem', background: 'var(--customer-muted-bg)', border: 'none', borderRadius: '0.5rem', cursor: 'pointer' }}
                        title="Edit Plan"
                      >
                        <EditIcon className="h-4 w-4" style={{ color: 'var(--customer-primary-teal)' }} />
                      </button>
                      <button
                        onClick={() => handleDeletePlan(plan)}
                        className="icon-btn enhanced"
                        style={{ padding: '0.4rem', background: 'var(--danger-light)', border: 'none', borderRadius: '0.5rem', cursor: 'pointer' }}
                        title="Delete Plan"
                      >
                        <UserX className="h-4 w-4" style={{ color: 'var(--cp-danger)' }} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Customer Subscriptions */}
        <div className="subscriptions-section enhanced">
          <div className="section-header enhanced" style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '1rem'
          }}>
            <div>
              <h3 style={{ margin: 0, color: 'var(--customer-text-main)' }}>
                <Users className="h-4 w-4" style={{ marginRight: '0.5rem' }} />
                Customer Subscriptions
              </h3>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                style={{ padding: '0.5rem', borderRadius: '0.5rem', border: '1px solid var(--customer-border)', background: 'var(--customer-card-bg)', color: 'var(--customer-text-main)', fontSize: '0.85rem' }}
              >
                <option value="all">All Status</option>
                <option value="active">Active</option>
                <option value="expired">Expired</option>
                <option value="cancelled">Cancelled</option>
                <option value="suspended">Suspended</option>
                <option value="pending">Pending</option>
              </select>
              <input
                type="text"
                placeholder="Search by name or email..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                style={{ padding: '0.5rem', borderRadius: '0.5rem', border: '1px solid var(--customer-border)', background: 'var(--customer-card-bg)', color: 'var(--customer-text-main)', fontSize: '0.85rem', minWidth: '200px' }}
              />
            </div>
          </div>
          {loading ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '2rem', color: 'var(--customer-text-secondary)' }}>
              <Clock className="h-4 w-4" style={{ animation: 'spin 1s linear infinite' }} />
              <span>Loading subscriptions...</span>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid var(--customer-border)' }}>
                    <th style={{ textAlign: 'left', padding: '0.75rem', fontSize: '0.8rem', color: 'var(--customer-text-secondary)', fontWeight: 700 }}>Customer</th>
                    <th style={{ textAlign: 'left', padding: '0.75rem', fontSize: '0.8rem', color: 'var(--customer-text-secondary)', fontWeight: 700 }}>Email</th>
                    <th style={{ textAlign: 'left', padding: '0.75rem', fontSize: '0.8rem', color: 'var(--customer-text-secondary)', fontWeight: 700 }}>Plan</th>
                    <th style={{ textAlign: 'left', padding: '0.75rem', fontSize: '0.8rem', color: 'var(--customer-text-secondary)', fontWeight: 700 }}>Start Date</th>
                    <th style={{ textAlign: 'left', padding: '0.75rem', fontSize: '0.8rem', color: 'var(--customer-text-secondary)', fontWeight: 700 }}>Expiry Date</th>
                    <th style={{ textAlign: 'right', padding: '0.75rem', fontSize: '0.8rem', color: 'var(--customer-text-secondary)', fontWeight: 700 }}>Amount</th>
                    <th style={{ textAlign: 'left', padding: '0.75rem', fontSize: '0.8rem', color: 'var(--customer-text-secondary)', fontWeight: 700 }}>Status</th>
                    <th style={{ textAlign: 'right', padding: '0.75rem', fontSize: '0.8rem', color: 'var(--customer-text-secondary)', fontWeight: 700 }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {subscriptions.length === 0 && (
                    <tr>
                      <td colSpan={8} style={{ padding: '2rem', textAlign: 'center', color: 'var(--customer-text-secondary)' }}>
                        No subscriptions found.
                      </td>
                    </tr>
                  )}
                  {subscriptions.map((sub) => (
                    <tr key={sub.subscriptionId || sub._id} style={{ borderBottom: '1px solid var(--customer-border)' }}>
                      <td style={{ padding: '0.75rem', fontSize: '0.9rem', color: 'var(--customer-text-main)', fontWeight: 600 }}>{sub.customerName || 'Unknown'}</td>
                      <td style={{ padding: '0.75rem', fontSize: '0.9rem', color: 'var(--customer-text-main)' }}>{sub.customerEmail || '—'}</td>
                      <td style={{ padding: '0.75rem', fontSize: '0.9rem', color: 'var(--customer-text-main)' }}>{sub.planNameSnapshot}</td>
                      <td style={{ padding: '0.75rem', fontSize: '0.9rem', color: 'var(--customer-text-main)' }}>{formatDate(sub.startDate)}</td>
                      <td style={{ padding: '0.75rem', fontSize: '0.9rem', color: 'var(--customer-text-main)' }}>{formatDate(sub.endDate)}</td>
                      <td style={{ padding: '0.75rem', fontSize: '0.9rem', color: 'var(--customer-text-main)', textAlign: 'right' }}>{sub.priceSnapshot > 0 ? formatCurrency(sub.priceSnapshot) : 'Free'}</td>
                      <td style={{ padding: '0.75rem' }}>
                        <span style={{
                          display: 'inline-block',
                          padding: '0.2rem 0.6rem',
                          borderRadius: '0.5rem',
                          fontSize: '0.75rem',
                          fontWeight: 600,
                          background: sub.status === 'active' ? 'var(--cp-success-bg)' : sub.status === 'expired' ? 'var(--danger-light)' : sub.status === 'cancelled' ? 'var(--warning-light)' : 'var(--customer-muted-bg)',
                          color: sub.status === 'active' ? 'var(--customer-accent-emerald)' : sub.status === 'expired' ? 'var(--cp-danger)' : sub.status === 'cancelled' ? 'var(--cp-warning)' : 'var(--customer-text-secondary)'
                        }}>
                          {sub.status}
                        </span>
                        {remainingDays(sub.endDate) <= 7 && sub.status === 'active' && (
                          <span style={{ marginLeft: '0.5rem', fontSize: '0.7rem', color: 'var(--cp-warning)' }}>{remainingDays(sub.endDate)} days left</span>
                        )}
                      </td>
                      <td style={{ padding: '0.75rem', textAlign: 'right' }}>
                        <button
                          onClick={() => { setSelectedSubscription(sub); setShowStatusModal(true) }}
                          className="icon-btn enhanced"
                          style={{ padding: '0.4rem', marginRight: '0.25rem', background: 'var(--customer-muted-bg)', border: 'none', borderRadius: '0.5rem', cursor: 'pointer' }}
                          title="Change Status"
                        >
                          <Wallet className="h-4 w-4" style={{ color: 'var(--customer-primary-teal)' }} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <Pagination
            currentPage={meta.page}
            totalPages={meta.totalPages}
            onChange={(p) => fetchSubscriptions({ page: p })}
          />
        </div>
      </div>

      {/* Add/Edit Plan Modal */}
      {showPlanModal && (
        <div className="modal-overlay">
          <div className="modal payment-modal">
            <div className="modal-header">
              <h3>{editingPlan ? 'Edit Membership Plan' : 'Add Membership Plan'}</h3>
              <button onClick={() => setShowPlanModal(false)} className="modal-close">×</button>
            </div>
            <div className="modal-body">
              <form onSubmit={handlePlanSubmit} style={{ display: 'grid', gap: '1rem' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
                  <div className="form-group enhanced">
                    <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--customer-text-secondary)', marginBottom: '0.375rem', fontWeight: 600 }}>Plan Name</label>
                    <input
                      type="text"
                      name="name"
                      defaultValue={selectedPlan?.name || ''}
                      required
                      style={{ width: '100%', padding: '0.625rem 0.75rem', borderRadius: '0.5rem', border: '1px solid var(--customer-border)', background: 'var(--customer-card-bg)', color: 'var(--customer-text-main)' }}
                    />
                  </div>
                  <div className="form-group enhanced">
                    <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--customer-text-secondary)', marginBottom: '0.375rem', fontWeight: 600 }}>Slug</label>
                    <input
                      type="text"
                      name="slug"
                      defaultValue={selectedPlan?.slug || ''}
                      required
                      placeholder="basic, premium, vip"
                      style={{ width: '100%', padding: '0.625rem 0.75rem', borderRadius: '0.5rem', border: '1px solid var(--customer-border)', background: 'var(--customer-card-bg)', color: 'var(--customer-text-main)' }}
                    />
                  </div>
                  <div className="form-group enhanced">
                    <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--customer-text-secondary)', marginBottom: '0.375rem', fontWeight: 600 }}>Price (₹)</label>
                    <input
                      type="number"
                      name="price"
                      defaultValue={selectedPlan?.price || ''}
                      min="0"
                      required
                      style={{ width: '100%', padding: '0.625rem 0.75rem', borderRadius: '0.5rem', border: '1px solid var(--customer-border)', background: 'var(--customer-card-bg)', color: 'var(--customer-text-main)' }}
                    />
                  </div>
                  <div className="form-group enhanced">
                    <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--customer-text-secondary)', marginBottom: '0.375rem', fontWeight: 600 }}>Billing Interval</label>
                    <select
                      name="billingInterval"
                      defaultValue={selectedPlan?.billingInterval || 'yearly'}
                      style={{ width: '100%', padding: '0.625rem 0.75rem', borderRadius: '0.5rem', border: '1px solid var(--customer-border)', background: 'var(--customer-card-bg)', color: 'var(--customer-text-main)' }}
                    >
                      <option value="yearly">Yearly</option>
                      <option value="monthly">Monthly</option>
                      <option value="lifetime">Lifetime</option>
                    </select>
                  </div>
                  <div className="form-group enhanced">
                    <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--customer-text-secondary)', marginBottom: '0.375rem', fontWeight: 600 }}>Duration (Months)</label>
                    <input
                      type="number"
                      name="durationMonths"
                      defaultValue={selectedPlan?.durationMonths || 12}
                      min="1"
                      style={{ width: '100%', padding: '0.625rem 0.75rem', borderRadius: '0.5rem', border: '1px solid var(--customer-border)', background: 'var(--customer-card-bg)', color: 'var(--customer-text-main)' }}
                    />
                  </div>
                  <div className="form-group enhanced">
                    <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--customer-text-secondary)', marginBottom: '0.375rem', fontWeight: 600 }}>Discount %</label>
                    <input
                      type="number"
                      name="discountPercentage"
                      defaultValue={selectedPlan?.discountPercentage || 0}
                      min="0"
                      max="100"
                      style={{ width: '100%', padding: '0.625rem 0.75rem', borderRadius: '0.5rem', border: '1px solid var(--customer-border)', background: 'var(--customer-card-bg)', color: 'var(--customer-text-main)' }}
                    />
                  </div>
                  <div className="form-group enhanced">
                    <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--customer-text-secondary)', marginBottom: '0.375rem', fontWeight: 600 }}>Max Discount Limit (₹)</label>
                    <input
                      type="number"
                      name="maxDiscountLimit"
                      defaultValue={selectedPlan?.maxDiscountLimit || ''}
                      min="0"
                      style={{ width: '100%', padding: '0.625rem 0.75rem', borderRadius: '0.5rem', border: '1px solid var(--customer-border)', background: 'var(--customer-card-bg)', color: 'var(--customer-text-main)' }}
                    />
                  </div>
                  <div className="form-group enhanced">
                    <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--customer-text-secondary)', marginBottom: '0.375rem', fontWeight: 600 }}>Benefits (one per line)</label>
                    <textarea
                      name="benefits"
                      rows={4}
                      defaultValue={selectedPlan?.benefits?.join('\n') || ''}
                      style={{ width: '100%', padding: '0.625rem 0.75rem', borderRadius: '0.5rem', border: '1px solid var(--customer-border)', background: 'var(--customer-card-bg)', color: 'var(--customer-text-main)' }}
                    />
                  </div>
                  <div className="form-group enhanced" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <input
                      type="checkbox"
                      name="isActive"
                      defaultChecked={selectedPlan?.isActive !== false}
                    />
                    <label style={{ margin: 0, fontSize: '0.85rem', color: 'var(--customer-text-main)', cursor: 'pointer' }}>Is Active</label>
                  </div>
                  <div className="form-group enhanced" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <input
                      type="checkbox"
                      name="isPopular"
                      defaultChecked={selectedPlan?.isPopular === true}
                    />
                    <label style={{ margin: 0, fontSize: '0.85rem', color: 'var(--customer-text-main)', cursor: 'pointer' }}>Featured/Popular Plan</label>
                  </div>
                  <div className="form-group enhanced">
                    <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--customer-text-secondary)', marginBottom: '0.375rem', fontWeight: 600 }}>Sort Order</label>
                    <input
                      type="number"
                      name="sortOrder"
                      defaultValue={selectedPlan?.sortOrder || 0}
                      style={{ width: '100%', padding: '0.625rem 0.75rem', borderRadius: '0.5rem', border: '1px solid var(--customer-border)', background: 'var(--customer-card-bg)', color: 'var(--customer-text-main)' }}
                    />
                  </div>
                  <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
                    <button
                      type="button"
                      onClick={() => setShowPlanModal(false)}
                      className="btn-secondary enhanced"
                      disabled={planLoading}
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="btn-primary enhanced"
                      disabled={planLoading}
                    >
                      {planLoading ? 'Saving...' : editingPlan ? 'Update Plan' : 'Create Plan'}
                    </button>
                  </div>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Change Status Modal */}
      {showStatusModal && selectedSubscription && (
        <div className="modal-overlay">
          <div className="modal payment-modal">
            <div className="modal-header">
              <h3>Change Membership Status</h3>
              <button onClick={() => setShowStatusModal(false)} className="modal-close">×</button>
            </div>
            <div className="modal-body">
              <p style={{ marginBottom: '1rem', color: 'var(--customer-text-secondary)' }}>
                Subscription: <strong>{selectedSubscription.planNameSnapshot}</strong> for <strong>{selectedSubscription.customerName}</strong>
              </p>
              <form onSubmit={handleStatusChange} style={{ display: 'grid', gap: '1rem' }}>
                <div className="form-group enhanced">
                  <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--customer-text-secondary)', marginBottom: '0.375rem', fontWeight: 600 }}>New Status</label>
                  <select
                    name="status"
                    defaultValue={selectedSubscription.status}
                    style={{ width: '100%', padding: '0.625rem 0.75rem', borderRadius: '0.5rem', border: '1px solid var(--customer-border)', background: 'var(--customer-card-bg)', color: 'var(--customer-text-main)' }}
                  >
                    <option value="active">Active</option>
                    <option value="suspended">Suspended</option>
                    <option value="cancelled">Cancelled</option>
                    <option value="expired">Expired</option>
                  </select>
                </div>
                <div className="form-group enhanced">
                  <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--customer-text-secondary)', marginBottom: '0.375rem', fontWeight: 600 }}>Notes (optional)</label>
                  <textarea
                    name="notes"
                    rows={2}
                    placeholder="Reason for status change..."
                    style={{ width: '100%', padding: '0.625rem 0.75rem', borderRadius: '0.5rem', border: '1px solid var(--customer-border)', background: 'var(--customer-card-bg)', color: 'var(--customer-text-main)' }}
                  />
                </div>
                <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
                  <button
                    type="button"
                    onClick={() => setShowStatusModal(false)}
                    className="btn-secondary enhanced"
                    disabled={statusLoading}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="btn-primary enhanced"
                    disabled={statusLoading}
                  >
                    {statusLoading ? 'Updating...' : 'Update Status'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  )
}

export default AdminMembershipManagement
