import { useState, useEffect } from 'react'
import {
  Crown, Shield, Clock, RefreshCcw, CreditCard, ArrowRight, X as XIcon, CheckCircle,
  AlertCircle, Wallet, QrCode, RotateCcw, FileText
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import CustomerLayout from './CustomerLayout'
import { api, formatDate, formatCurrency } from '../../api'
import '../Dashboard.css'

const MEMBERSHIP_PLANS_DEFAULT = [
  {
    name: 'Basic',
    price: 0,
    duration: 'Lifetime',
    discount: 0,
    popular: false,
    benefits: [
      'Browse all travel destinations',
      'View travel packages',
      'Book available travel packages',
      'Access customer dashboard',
      'View booking history',
      'Download booking invoices',
      'Standard customer support',
      'Manage profile and account security'
    ],
    color: 'var(--customer-text-secondary)'
  },
  {
    name: 'Premium',
    price: 999,
    duration: '1 Year',
    discount: 5,
    popular: true,
    benefits: [
      'All Basic features',
      '5% discount on eligible travel packages',
      'Priority customer support',
      'Exclusive travel offers',
      'Early access to selected packages',
      'Special member-only deals',
      'Membership dashboard',
      'Membership payment history'
    ],
    color: 'var(--customer-primary-teal)'
  },
  {
    name: 'VIP / Elite',
    price: 1999,
    duration: '1 Year',
    discount: 10,
    popular: false,
    benefits: [
      'All Premium features',
      '10% discount on eligible travel packages',
      'Dedicated travel assistance',
      'Complimentary itinerary consultation',
      'Exclusive hotel deals',
      'Priority booking assistance',
      'VIP customer support',
      'Special cancellation benefits',
      'Exclusive member offers'
    ],
    color: 'var(--customer-primary-teal)'
  }
]

const MembershipPage = () => {
  const navigate = useNavigate()
  const [currentMembership, setCurrentMembership] = useState(null)
  const [plans, setPlans] = useState([])
  const [history, setHistory] = useState({ subscriptions: [], payments: [] })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [subscribing, setSubscribing] = useState(false)
  const [checkoutLoading, setCheckoutLoading] = useState(false)
  const [checkoutUrl, setCheckoutUrl] = useState(null)
  const [cancelLoading, setCancelLoading] = useState(false)
  const [renewLoading, setRenewLoading] = useState(false)

  // Checkout modal state
  const [showCheckoutModal, setShowCheckoutModal] = useState(false)
  const [selectedPlanForCheckout, setSelectedPlanForCheckout] = useState(null)
  const [paymentMethod, setPaymentMethod] = useState('stripe')
  const [upiQrLoading, setUpiQrLoading] = useState(false)
  const [qrDataUrl, setQrDataUrl] = useState(null)
  const [upiDetails, setUpiDetails] = useState(null)
  const [upiTransactionId, setUpiTransactionId] = useState('')
  const [upiNotes, setUpiNotes] = useState('')
  const [upiLoading, setUpiLoading] = useState(false)
  const [upiSuccess, setUpiSuccess] = useState('')
  const [upiError, setUpiError] = useState('')
  const [paymentStatus, setPaymentStatus] = useState(null)
  const [checkingStatus, setCheckingStatus] = useState(false)

  useEffect(() => {
    fetchMembershipData()
  }, [])

  const fetchMembershipData = async () => {
    setLoading(true)
    setError('')
    try {
      const [currentRes, plansRes, historyRes] = await Promise.all([
        api('/customer/membership/current'),
        api('/customer/membership/plans'),
        api('/customer/membership/history')
      ])
      setCurrentMembership(currentRes.membership || null)
      setPlans(plansRes.plans || MEMBERSHIP_PLANS_DEFAULT)
      setHistory(historyRes || { subscriptions: [], payments: [] })
    } catch (err) {
      setError(err.message || 'Failed to load membership data')
      setPlans(MEMBERSHIP_PLANS_DEFAULT)
    } finally {
      setLoading(false)
    }
  }

  const handleSubscribe = async (planId) => {
    setError('')
    setSuccess('')
    setSubscribing(true)
    try {
      const planIdStr = String(planId)
      const res = await api('/customer/membership/subscribe', {
        method: 'POST',
        body: JSON.stringify({ planId: planIdStr })
      })
      if (res.requiresPayment) {
        setSuccess(res.message)
        setSelectedPlanForCheckout(res.subscription || null)
        setPaymentMethod('stripe')
        setShowCheckoutModal(true)
        setQrDataUrl(null)
        setUpiDetails(null)
        setUpiTransactionId('')
        setUpiNotes('')
        setUpiSuccess('')
        setUpiError('')
        setPaymentStatus(null)
      } else {
        setSuccess(res.message)
        setTimeout(() => {
          setSuccess('')
          fetchMembershipData()
        }, 1500)
      }
    } catch (err) {
      setError(err.message || 'Failed to subscribe')
    } finally {
      setSubscribing(false)
    }
  }

  const createStripeCheckout = async () => {
    if (!selectedPlanForCheckout) return
    setCheckoutLoading(true)
    setError('')
    try {
      const res = await api('/customer/membership/checkout', {
        method: 'POST',
        body: JSON.stringify({ subscriptionId: String(selectedPlanForCheckout.id || '') })
      })
      if (res.checkoutUrl) {
        setCheckoutUrl(res.checkoutUrl)
      } else {
        throw new Error(res.message || 'Failed to create checkout session')
      }
    } catch (err) {
      setError(err.message || 'Failed to create checkout session')
    } finally {
      setCheckoutLoading(false)
    }
  }

  const generateUpiQr = async () => {
    if (!selectedPlanForCheckout) return
    setUpiQrLoading(true)
    setUpiError('')
    setQrDataUrl(null)
    setUpiDetails(null)
    try {
      const res = await api('/customer/membership/upi-qr', {
        method: 'POST',
        body: JSON.stringify({ subscriptionId: String(selectedPlanForCheckout.id || '') })
      })
      setQrDataUrl(res.qrDataUrl || null)
      setUpiDetails({
        upiId: res.upiId,
        merchantName: res.merchantName,
        amount: res.amount,
        bookingReference: res.bookingReference,
        paymentReference: res.paymentReference,
        upiUrl: res.upiUrl,
        planName: res.planName
      })
    } catch (err) {
      setUpiError(err.message || 'Failed to generate QR code')
    } finally {
      setUpiQrLoading(false)
    }
  }

  const submitUpiPayment = async () => {
    if (!selectedPlanForCheckout) return
    if (!upiTransactionId.trim()) {
      setUpiError('Please enter a UPI transaction reference ID')
      return
    }
    setUpiLoading(true)
    setUpiError('')
    setUpiSuccess('')
    try {
      const res = await api('/customer/membership/verify-upi', {
        method: 'POST',
        body: JSON.stringify({
          subscriptionId: String(selectedPlanForCheckout.id || ''),
          transactionId: upiTransactionId.trim(),
          notes: upiNotes.trim() || undefined
        })
      })
      setUpiSuccess(res.message || 'Payment submitted for verification')
      setPaymentStatus(res)
      setShowCheckoutModal(false)
      setTimeout(() => {
        setUpiSuccess('')
        fetchMembershipData()
      }, 2000)
    } catch (err) {
      setUpiError(err.message || 'Failed to submit UPI payment')
    } finally {
      setUpiLoading(false)
    }
  }

  const checkMembershipPaymentStatus = async () => {
    if (!selectedPlanForCheckout) return
    setCheckingStatus(true)
    try {
      const res = await api(`/customer/membership/history`)
      const latestPayment = (res.payments || []).find(
        p => String(p.subscriptionId) === String(selectedPlanForCheckout._id || selectedPlanForCheckout.id)
      ) || (res.payments || [])[0]
      setPaymentStatus(latestPayment || { paymentStatus: 'PENDING' })
      if (latestPayment && latestPayment.paymentStatus === 'paid') {
        setUpiSuccess('Payment confirmed! Membership activated.')
        setShowCheckoutModal(false)
        setTimeout(() => {
          setUpiSuccess('')
          fetchMembershipData()
        }, 1500)
      } else {
        setUpiError(`Payment status: ${latestPayment ? latestPayment.paymentStatus : 'PENDING'}. Awaiting verification.`)
      }
    } catch (err) {
      setUpiError(err.message || 'Failed to check payment status')
    } finally {
      setCheckingStatus(false)
    }
  }

  const handleCancel = async () => {
    setError('')
    setSuccess('')
    setCancelLoading(true)
    try {
      const res = await api('/customer/membership/cancel', {
        method: 'POST',
        body: JSON.stringify({})
      })
      setSuccess(res.message)
      setTimeout(() => {
        setSuccess('')
        fetchMembershipData()
      }, 1500)
    } catch (err) {
      setError(err.message || 'Failed to cancel membership')
    } finally {
      setCancelLoading(false)
    }
  }

  const handleRenew = async () => {
    setError('')
    setSuccess('')
    setRenewLoading(true)
    try {
      const res = await api('/customer/membership/renew', {
        method: 'POST',
        body: JSON.stringify({})
      })
      if (res.requiresPayment) {
        setSuccess(res.message)
        setSelectedPlanForCheckout(res.subscription || null)
        setPaymentMethod('stripe')
        setShowCheckoutModal(true)
        setQrDataUrl(null)
        setUpiDetails(null)
        setUpiTransactionId('')
        setUpiNotes('')
        setUpiSuccess('')
        setUpiError('')
        setPaymentStatus(null)
      } else {
        setSuccess(res.message)
        setTimeout(() => {
          setSuccess('')
          fetchMembershipData()
        }, 1500)
      }
    } catch (err) {
      setError(err.message || 'Failed to renew membership')
    } finally {
      setRenewLoading(false)
    }
  }

  const remainingDays = (endDate) => {
    if (!endDate) return 0
    const now = new Date()
    const end = new Date(endDate)
    const diff = end.getTime() - now.getTime()
    return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)))
  }

  const isActive = (membership) => {
    if (!membership) return false
    return membership.status === 'active' && new Date(membership.endDate) > new Date()
  }

  if (checkoutUrl) {
    window.location.href = checkoutUrl
  }

  const activePlan = currentMembership || null

  const planForCheckout = selectedPlanForCheckout || null
  const finalAmount = planForCheckout ? Number(planForCheckout.price || planForCheckout.priceSnapshot || 0) : 0

  return (
    <CustomerLayout active="membership">
      <div className="page-head">
        <div className="page-head-row">
          <div>
            <h1>My Membership</h1>
            <p>Manage your subscription plan, benefits, and payment history.</p>
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
        {/* Current Membership Summary */}
        <div className="membership-summary enhanced" style={{ marginBottom: '1.5rem' }}>
          <h3 style={{ margin: '0 0 0.75rem 0', color: 'var(--customer-text-main)' }}>
            <Shield className="h-4 w-4" style={{ marginRight: '0.5rem', color: 'var(--customer-primary-teal)' }} />
            Current Membership
          </h3>
          {loading ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--customer-text-secondary)' }}>
              <Clock className="h-4 w-4" style={{ animation: 'spin 1s linear infinite' }} />
              <span>Loading membership...</span>
            </div>
          ) : activePlan && isActive(activePlan) ? (
            <>
              <div className="summary-grid enhanced" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
                <div className="summary-item enhanced">
                  <span className="label" style={{ display: 'block', fontSize: '0.8rem', color: 'var(--customer-text-secondary)', marginBottom: '0.25rem' }}>Plan</span>
                  <span className="value" style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--customer-text-main)' }}>{activePlan.planNameSnapshot}</span>
                </div>
                <div className="summary-item enhanced">
                  <span className="label" style={{ display: 'block', fontSize: '0.8rem', color: 'var(--customer-text-secondary)', marginBottom: '0.25rem' }}>Status</span>
                  <span className="value" style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--customer-accent-emerald)' }}>Active</span>
                </div>
                <div className="summary-item enhanced">
                  <span className="label" style={{ display: 'block', fontSize: '0.8rem', color: 'var(--customer-text-secondary)', marginBottom: '0.25rem' }}>Started</span>
                  <span className="value" style={{ fontSize: '1.1rem', fontWeight: 700 }}>{formatDate(activePlan.startDate)}</span>
                </div>
                <div className="summary-item enhanced">
                  <span className="label" style={{ display: 'block', fontSize: '0.8rem', color: 'var(--customer-text-secondary)', marginBottom: '0.25rem' }}>Expires</span>
                  <span className="value" style={{ fontSize: '1.1rem', fontWeight: 700 }}>{formatDate(activePlan.endDate)}</span>
                </div>
                <div className="summary-item enhanced">
                  <span className="label" style={{ display: 'block', fontSize: '0.8rem', color: 'var(--customer-text-secondary)', marginBottom: '0.25rem' }}>Discount</span>
                  <span className="value" style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--customer-primary-teal)' }}>{activePlan.discountSnapshot}% off</span>
                </div>
                <div className="summary-item enhanced">
                  <span className="label" style={{ display: 'block', fontSize: '0.8rem', color: 'var(--customer-text-secondary)', marginBottom: '0.25rem' }}>Days Remaining</span>
                  <span className="value" style={{ fontSize: '1.1rem', fontWeight: 700, color: remainingDays(activePlan.endDate) <= 30 ? 'var(--cp-warning)' : 'var(--customer-text-main)' }}>{remainingDays(activePlan.endDate)} days</span>
                </div>
              </div>
              <div style={{ marginTop: '1rem', display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                <button
                  onClick={handleRenew}
                  disabled={renewLoading || remainingDays(activePlan.endDate) > 30}
                  className="btn-primary enhanced"
                  style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
                >
                  <RefreshCcw className="h-4 w-4" />
                  {renewLoading ? 'Renewing...' : remainingDays(activePlan.endDate) > 30 ? 'Renewal available in 30 days' : 'Renew Membership'}
                </button>
                <button
                  onClick={handleCancel}
                  disabled={cancelLoading}
                  className="btn-secondary enhanced"
                  style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
                >
                  <XIcon className="h-4 w-4" />
                  {cancelLoading ? 'Cancelling...' : 'Cancel Membership'}
                </button>
              </div>
            </>
          ) : activePlan ? (
            <>
              <div className="summary-grid enhanced" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
                <div className="summary-item enhanced">
                  <span className="label" style={{ display: 'block', fontSize: '0.8rem', color: 'var(--customer-text-secondary)', marginBottom: '0.25rem' }}>Plan</span>
                  <span className="value" style={{ fontSize: '1.1rem', fontWeight: 700 }}>{activePlan.planNameSnapshot}</span>
                </div>
                <div className="summary-item enhanced">
                  <span className="label" style={{ display: 'block', fontSize: '0.8rem', color: 'var(--customer-text-secondary)', marginBottom: '0.25rem' }}>Status</span>
                  <span className="value" style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--cp-warning)' }}>{activePlan.status}</span>
                </div>
              </div>
              <div style={{ marginTop: '1rem' }}>
                <button onClick={() => handleSubscribe(activePlan?.planId || activePlan?._id)} disabled={subscribing} className="btn-primary enhanced">
                  <ArrowRight className="h-4 w-4" />
                  {subscribing ? 'Subscribing...' : 'Activate Membership'}
                </button>
              </div>
            </>
          ) : (
            <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--customer-text-secondary)' }}>
              <Crown className="h-8 w-8" style={{ marginBottom: '0.5rem', opacity: 0.5 }} />
              <p>No membership found. Select a plan below to get started.</p>
            </div>
          )}
        </div>

        {/* Plan Cards */}
        <div className="membership-plans enhanced" style={{ marginBottom: '1.5rem' }}>
          <h3 style={{ margin: '0 0 0.75rem 0', color: 'var(--customer-text-main)' }}>
            <CreditCard className="h-4 w-4" style={{ marginRight: '0.5rem', color: 'var(--customer-primary-teal)' }} />
            Choose Your Plan
          </h3>
          <div className="plans-grid enhanced" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1rem' }}>
            {plans.map((plan) => {
              const isCurrent = activePlan && activePlan.planNameSnapshot === plan.name && isActive(activePlan)
              const isPopular = plan.popular
              const priceDisplay = plan.price === 0 ? 'Free' : formatCurrency(plan.price)
              return (
                <div
                  key={plan.name}
                  className={`plan-card enhanced ${isCurrent ? 'current' : ''} ${isPopular ? 'popular' : ''}`}
                  style={{
                    border: isCurrent ? '2px solid var(--customer-primary-teal)' : '1px solid var(--customer-border)',
                    borderRadius: '1rem',
                    padding: '1.25rem',
                    background: isCurrent ? 'var(--customer-muted-bg)' : 'var(--customer-card-bg)',
                    position: 'relative',
                    display: 'flex',
                    flexDirection: 'column'
                  }}
                >
                  {isCurrent && (
                    <div style={{
                      position: 'absolute',
                      top: '-0.75rem',
                      left: '1rem',
                      background: 'var(--customer-primary-teal)',
                      color: 'white',
                      fontSize: '0.7rem',
                      fontWeight: 700,
                      padding: '0.2rem 0.6rem',
                      borderRadius: '0.5rem'
                    }}>Current Plan</div>
                  )}
                  {isPopular && (
                    <div style={{
                      position: 'absolute',
                      top: '-0.75rem',
                      right: '1rem',
                      background: 'var(--customer-primary-teal)',
                      color: 'white',
                      fontSize: '0.7rem',
                      fontWeight: 700,
                      padding: '0.2rem 0.6rem',
                      borderRadius: '0.5rem'
                    }}>Popular</div>
                  )}
                  <h4 style={{ margin: '0 0 0.25rem 0', color: 'var(--customer-text-main)', fontSize: '1.25rem' }}>{plan.name}</h4>
                  <div style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--customer-text-main)', marginBottom: '0.25rem' }}>
                    {priceDisplay}
                    {plan.price > 0 && <span style={{ fontSize: '1rem', color: 'var(--customer-text-secondary)', fontWeight: 500 }}>{plan.duration === 'Lifetime' ? '' : '/year'}</span>}
                  </div>
                  <p style={{ fontSize: '0.85rem', color: 'var(--customer-text-secondary)', marginBottom: '1rem', lineHeight: 1.5 }}>{plan.description || `Membership plan with ${plan.discount}% discount on travel packages.`}</p>
                  <div style={{ marginBottom: '1rem', flex: 1 }}>
                    <h5 style={{ fontSize: '0.85rem', color: 'var(--customer-text-secondary)', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Benefits</h5>
                    <ul style={{ listStyle: 'none', padding: 0, margin: 0, fontSize: '0.85rem', color: 'var(--customer-text-main)' }}>
                      {plan.benefits.map((b, i) => (
                        <li key={i} style={{ marginBottom: '0.375rem', display: 'flex', alignItems: 'flex-start', gap: '0.5rem' }}>
                          <span style={{ color: 'var(--customer-accent-emerald)', fontWeight: 700, flexShrink: 0 }}>✓</span>
                          {b}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div style={{ marginTop: 'auto' }}>
                    <span className="label" style={{ display: 'block', fontSize: '0.8rem', color: 'var(--customer-text-secondary)', marginBottom: '0.25rem' }}>Your Discount</span>
                    <span className="value" style={{ fontSize: '1.25rem', fontWeight: 800, color: plan.discount > 0 ? 'var(--customer-primary-teal)' : 'var(--customer-text-secondary)' }}>{plan.discount}% off</span>
                    <button
                      onClick={() => handleSubscribe(String(plan._id || plan.slug || plan.name))}
                      disabled={subscribing || (isCurrent && isActive(activePlan))}
                      className="btn-primary enhanced"
                      style={{
                        width: '100%',
                        marginTop: '0.75rem',
                        background: (isCurrent && isActive(activePlan)) ? 'var(--customer-border)' : 'linear-gradient(135deg, var(--customer-primary-teal) 0%, var(--customer-accent-emerald) 100%)',
                        color: (isCurrent && isActive(activePlan)) ? 'var(--customer-text-secondary)' : 'white',
                        border: 'none',
                        cursor: (isCurrent && isActive(activePlan)) ? 'not-allowed' : 'pointer'
                      }}
                    >
                      {(isCurrent && isActive(activePlan)) ? 'Current Plan' : plan.price === 0 ? 'Activate Free' : `Pay ₹${Number(plan.price || 0).toLocaleString()}`}
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Membership History */}
        <div className="membership-history enhanced" style={{ marginBottom: '1.5rem' }}>
          <h3 style={{ margin: '0 0 0.75rem 0', color: 'var(--customer-text-main)' }}>
            <FileText className="h-4 w-4" style={{ marginRight: '0.5rem', color: 'var(--customer-primary-teal)' }} />
            Membership History
          </h3>
          {history.subscriptions.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--customer-text-secondary)' }}>
              <Clock className="h-6 w-6" style={{ marginBottom: '0.5rem', opacity: 0.5 }} />
              <p>No membership history yet.</p>
            </div>
          ) : (
            <div className="history-table enhanced" style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid var(--customer-border)' }}>
                    <th style={{ textAlign: 'left', padding: '0.75rem', fontSize: '0.8rem', color: 'var(--customer-text-secondary)', fontWeight: 700 }}>Plan</th>
                    <th style={{ textAlign: 'left', padding: '0.75rem', fontSize: '0.8rem', color: 'var(--customer-text-secondary)', fontWeight: 700 }}>Started</th>
                    <th style={{ textAlign: 'left', padding: '0.75rem', fontSize: '0.8rem', color: 'var(--customer-text-secondary)', fontWeight: 700 }}>Expires</th>
                    <th style={{ textAlign: 'right', padding: '0.75rem', fontSize: '0.8rem', color: 'var(--customer-text-secondary)', fontWeight: 700 }}>Amount Paid</th>
                    <th style={{ textAlign: 'left', padding: '0.75rem', fontSize: '0.8rem', color: 'var(--customer-text-secondary)', fontWeight: 700 }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {history.subscriptions.map((sub) => (
                    <tr key={sub.subscriptionId || sub._id} style={{ borderBottom: '1px solid var(--customer-border)' }}>
                      <td style={{ padding: '0.75rem', fontSize: '0.9rem', color: 'var(--customer-text-main)', fontWeight: 600 }}>{sub.planNameSnapshot}</td>
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
                          background: sub.status === 'active' ? 'var(--cp-success-bg)' : sub.status === 'expired' ? 'var(--danger-light)' : 'var(--customer-muted-bg)',
                          color: sub.status === 'active' ? 'var(--customer-accent-emerald)' : sub.status === 'expired' ? 'var(--danger)' : 'var(--customer-text-secondary)'
                        }}>
                          {sub.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {history.payments.length > 0 && (
            <div style={{ marginTop: '1rem' }}>
              <h5 style={{ fontSize: '0.85rem', color: 'var(--customer-text-secondary)', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Payment History</h5>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ borderBottom: '2px solid var(--customer-border)' }}>
                      <th style={{ textAlign: 'left', padding: '0.75rem', fontSize: '0.8rem', color: 'var(--customer-text-secondary)', fontWeight: 700 }}>Reference</th>
                      <th style={{ textAlign: 'left', padding: '0.75rem', fontSize: '0.8rem', color: 'var(--customer-text-secondary)', fontWeight: 700 }}>Amount</th>
                      <th style={{ textAlign: 'left', padding: '0.75rem', fontSize: '0.8rem', color: 'var(--customer-text-secondary)', fontWeight: 700 }}>Provider</th>
                      <th style={{ textAlign: 'left', padding: '0.75rem', fontSize: '0.8rem', color: 'var(--customer-text-secondary)', fontWeight: 700 }}>Status</th>
                      <th style={{ textAlign: 'left', padding: '0.75rem', fontSize: '0.8rem', color: 'var(--customer-text-secondary)', fontWeight: 700 }}>Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {history.payments.map((p) => (
                      <tr key={p.paymentId || p._id} style={{ borderBottom: '1px solid var(--customer-border)' }}>
                        <td style={{ padding: '0.75rem', fontSize: '0.9rem', color: 'var(--customer-text-main)', fontWeight: 600 }}>{p.paymentReference || p.paymentId}</td>
                        <td style={{ padding: '0.75rem', fontSize: '0.9rem', color: 'var(--customer-text-main)' }}>{formatCurrency(p.amount)}</td>
                        <td style={{ padding: '0.75rem', fontSize: '0.9rem', color: 'var(--customer-text-main)' }}>{p.paymentProvider}</td>
                        <td style={{ padding: '0.75rem' }}>
                          <span style={{
                            display: 'inline-block',
                            padding: '0.2rem 0.6rem',
                            borderRadius: '0.5rem',
                            fontSize: '0.75rem',
                            fontWeight: 600,
                            background: p.paymentStatus === 'paid' ? 'var(--cp-success-bg)' : p.paymentStatus === 'failed' ? 'var(--danger-light)' : 'var(--customer-muted-bg)',
                            color: p.paymentStatus === 'paid' ? 'var(--customer-accent-emerald)' : p.paymentStatus === 'failed' ? 'var(--danger)' : 'var(--customer-text-secondary)'
                          }}>
                            {p.paymentStatus}
                          </span>
                        </td>
                        <td style={{ padding: '0.75rem', fontSize: '0.9rem', color: 'var(--customer-text-main)' }}>{formatDate(p.paidAt || p.createdAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Membership Checkout Modal */}
      {showCheckoutModal && planForCheckout && (
        <div className="modal-overlay">
          <div className="modal payment-modal" style={{ maxWidth: '520px', width: '90%' }}>
            <div className="modal-header">
              <h3>Membership Checkout</h3>
              <button onClick={() => setShowCheckoutModal(false)} className="modal-close">×</button>
            </div>
            <div className="modal-body">
              {error && <div className="cd-alert warning" style={{ marginBottom: '0.75rem' }}>{error}</div>}

              {/* Plan Details */}
              <div className="checkout-plan enhanced" style={{ marginBottom: '1rem', padding: '1rem', background: 'var(--customer-muted-bg)', borderRadius: '0.75rem', border: '1px solid var(--customer-border)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
                  <Crown className="h-4 w-4" style={{ color: 'var(--customer-primary-teal)' }} />
                  <h4 style={{ margin: 0, color: 'var(--customer-text-main)', fontSize: '1.1rem' }}>{planForCheckout.planName || planForCheckout.planNameSnapshot || planForCheckout.name}</h4>
                </div>
                <p style={{ margin: '0 0 0.75rem 0', fontSize: '0.85rem', color: 'var(--customer-text-secondary)' }}>
                  {planForCheckout.durationMonths || '12'} months membership
                </p>

                {/* Price Breakdown */}
                <div style={{ marginBottom: '0.75rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', color: 'var(--customer-text-secondary)', marginBottom: '0.25rem' }}>
                    <span>Original Membership Price</span>
                    <span>₹{finalAmount.toLocaleString()}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', color: 'var(--customer-text-secondary)', marginBottom: '0.25rem' }}>
                    <span>Membership Promotional Discount</span>
                    <span>-₹0</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '1rem', fontWeight: 700, color: 'var(--customer-text-main)', marginTop: '0.25rem' }}>
                    <span>Final Membership Amount</span>
                    <span>₹{finalAmount.toLocaleString()}</span>
                  </div>
                </div>

                <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--customer-text-secondary)', fontStyle: 'italic' }}>
                  The 5%/10% membership benefit applies to travel package bookings, not to the membership price itself.
                </p>
              </div>

              {/* Payment Method Selection */}
              <div style={{ marginBottom: '1rem' }}>
                <h5 style={{ margin: '0 0 0.5rem 0', color: 'var(--customer-text-main)', fontSize: '0.9rem' }}>Select Payment Method</h5>
                <div style={{ display: 'flex', gap: '0.5rem', border: '1px solid var(--customer-border)', borderRadius: '0.75rem', overflow: 'hidden' }}>
                  <label
                    style={{
                      flex: 1,
                      padding: '0.75rem',
                      cursor: 'pointer',
                      borderRight: '1px solid var(--customer-border)',
                      background: paymentMethod === 'stripe' ? 'var(--customer-muted-bg)' : 'transparent',
                      color: paymentMethod === 'stripe' ? 'var(--customer-primary-teal)' : 'var(--customer-text-main)',
                      fontWeight: 600,
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                      fontSize: '0.85rem'
                    }}
                  >
                    <input
                      type="radio"
                      name="paymentMethod"
                      value="stripe"
                      checked={paymentMethod === 'stripe'}
                      onChange={() => setPaymentMethod('stripe')}
                    />
                    <CreditCard className="h-4 w-4" />
                    Stripe
                  </label>
                  <label
                    style={{
                      flex: 1,
                      padding: '0.75rem',
                      cursor: 'pointer',
                      background: paymentMethod === 'upi' ? 'var(--customer-muted-bg)' : 'transparent',
                      color: paymentMethod === 'upi' ? 'var(--customer-primary-teal)' : 'var(--customer-text-main)',
                      fontWeight: 600,
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                      fontSize: '0.85rem'
                    }}
                  >
                    <input
                      type="radio"
                      name="paymentMethod"
                      value="upi"
                      checked={paymentMethod === 'upi'}
                      onChange={() => {
                        setPaymentMethod('upi')
                        setQrDataUrl(null)
                        setUpiDetails(null)
                        setUpiTransactionId('')
                        setUpiNotes('')
                        setUpiSuccess('')
                        setUpiError('')
                        setPaymentStatus(null)
                      }}
                    />
                    <QrCode className="h-4 w-4" />
                    UPI QR
                  </label>
                </div>
              </div>

              {/* Stripe Payment Section */}
              {paymentMethod === 'stripe' && (
                <div style={{ marginBottom: '1rem' }}>
                  <button
                    onClick={createStripeCheckout}
                    disabled={checkoutLoading}
                    className="btn-primary enhanced"
                    style={{
                      width: '100%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '0.5rem',
                      background: 'linear-gradient(135deg, var(--customer-primary-teal) 0%, var(--customer-accent-emerald) 100%)',
                      border: 'none',
                      color: 'white'
                    }}
                  >
                    {checkoutLoading ? <><Clock className="h-4 w-4" /> Redirecting...</> : <><CreditCard className="h-4 w-4" /> Pay with Stripe</>}
                  </button>
                  <p style={{ margin: '0.5rem 0 0 0', fontSize: '0.75rem', color: 'var(--customer-text-secondary)' }}>
                    You will be redirected to Stripe's secure checkout page to complete the payment.
                  </p>
                </div>
              )}

              {/* UPI QR Payment Section */}
              {paymentMethod === 'upi' && (
                <div>
                  {upiQrLoading && (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem', padding: '2rem', color: 'var(--customer-text-secondary)' }}>
                      <Clock className="h-5 w-5" style={{ animation: 'spin 1s linear infinite' }} />
                      <span>Generating QR code...</span>
                    </div>
                  )}

                  {upiError && !qrDataUrl && (
                    <div className="cd-alert warning" style={{ marginBottom: '0.75rem', textAlign: 'center' }}>
                      <AlertCircle className="h-4 w-4" style={{ color: 'var(--customer-text-secondary)', marginRight: '0.5rem' }} />
                      <span style={{ color: 'var(--customer-text-main)', fontSize: '0.85rem' }}>{upiError}</span>
                    </div>
                  )}

                  {qrDataUrl && upiDetails && (
                    <>
                      <div style={{ textAlign: 'center', marginBottom: '1rem' }}>
                        <img
                          src={qrDataUrl}
                          alt="UPI QR Code"
                          style={{ width: '200px', height: '200px', borderRadius: '1rem', background: '#ffffff', padding: '0.5rem', border: '1px solid var(--customer-border)', display: 'block', margin: '0 auto 0.75rem auto' }}
                        />
                        <p style={{ fontSize: '0.8rem', color: 'var(--customer-text-secondary)', marginBottom: '0.25rem', textAlign: 'center' }}>
                          UPI ID: <strong style={{ color: 'var(--customer-primary-teal)', wordBreak: 'break-all', display: 'block' }}>{upiDetails.upiId || 'merchant@upi'}</strong>
                        </p>
                        <p style={{ fontSize: '0.8rem', color: 'var(--customer-text-secondary)', marginBottom: '0.25rem', textAlign: 'center' }}>
                          Amount: <strong style={{ color: 'var(--customer-primary-teal)' }}>₹{upiDetails.amount?.toLocaleString() || 0}</strong>
                        </p>
                        <p style={{ fontSize: '0.75rem', color: 'var(--customer-text-secondary)', textAlign: 'center', marginBottom: 0 }}>
                          Ref: {upiDetails.paymentReference || ''}
                        </p>
                      </div>

                      <div className="form-group enhanced">
                        <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--customer-text-secondary)', marginBottom: '0.375rem', fontWeight: 600 }}>Transaction Reference ID</label>
                        <input
                          type="text"
                          value={upiTransactionId}
                          onChange={(e) => setUpiTransactionId(e.target.value)}
                          placeholder="Enter UPI transaction reference ID"
                          style={{ width: '100%', padding: '0.625rem 0.75rem', borderRadius: '0.5rem', border: '1px solid var(--customer-border)', background: 'var(--customer-card-bg)', color: 'var(--customer-text-main)' }}
                        />
                      </div>

                      <div className="form-group enhanced">
                        <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--customer-text-secondary)', marginBottom: '0.375rem', fontWeight: 600 }}>Notes</label>
                        <textarea
                          value={upiNotes}
                          onChange={(e) => setUpiNotes(e.target.value)}
                          placeholder="Any payment notes (optional)"
                          rows={2}
                          style={{ width: '100%', padding: '0.625rem 0.75rem', borderRadius: '0.5rem', border: '1px solid var(--customer-border)', background: 'var(--customer-card-bg)', color: 'var(--customer-text-main)' }}
                        />
                      </div>

                      <button
                        type="button"
                        disabled={upiLoading || !upiTransactionId.trim()}
                        className="btn-primary enhanced"
                        style={{
                          width: '100%',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '0.5rem',
                          marginTop: '0.25rem',
                          background: 'linear-gradient(135deg, var(--customer-primary-teal) 0%, var(--customer-accent-emerald) 100%)',
                          border: 'none',
                          color: 'white'
                        }}
                        onClick={submitUpiPayment}
                      >
                        {upiLoading ? <><Clock className="h-4 w-4" /> Submitting...</> : <><Wallet className="h-4 w-4" /> Submit Payment</>}
                      </button>

                      {upiSuccess && (
                        <div className="cd-alert info" style={{ marginTop: '0.75rem', textAlign: 'center' }}>
                          <CheckCircle className="h-4 w-4" style={{ color: 'var(--customer-accent-emerald)', marginRight: '0.5rem' }} />
                          <span style={{ color: 'var(--customer-text-main)' }}>{upiSuccess}</span>
                        </div>
                      )}

                      {paymentStatus && (
                        <div style={{ marginTop: '0.75rem' }}>
                          <button
                            type="button"
                            disabled={checkingStatus}
                            className="btn-secondary enhanced"
                            style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}
                            onClick={checkMembershipPaymentStatus}
                          >
                            {checkingStatus ? <><RotateCcw className="h-4 w-4" /> Checking...</> : <><RefreshCcw className="h-4 w-4" /> Check Payment Status</>}
                          </button>
                        </div>
                      )}

                      <p style={{ fontSize: '0.75rem', marginTop: '0.5rem', color: 'var(--customer-text-secondary)', textAlign: 'center' }}>
                        Your payment will be verified manually. You will receive a confirmation once approved.
                      </p>
                    </>
                  )}

                  {!qrDataUrl && !upiError && !upiQrLoading && (
                    <button
                      type="button"
                      onClick={generateUpiQr}
                      className="btn-primary enhanced"
                      style={{
                        width: '100%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '0.5rem',
                        background: 'linear-gradient(135deg, var(--customer-primary-teal) 0%, var(--customer-accent-emerald) 100%)',
                        border: 'none',
                        color: 'white'
                      }}
                    >
                      <QrCode className="h-4 w-4" /> Generate UPI QR Code
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </CustomerLayout>
  )
}

export default MembershipPage
