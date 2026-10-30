import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { CheckCircle, Clock, Ticket, ArrowRight } from 'lucide-react'
import CustomerLayout from './CustomerLayout'
import { api } from '../../api'
import '../Dashboard.css'

const StripeSuccess = () => {
  // Read session_id directly from window.location (works on full page reloads
  // after Stripe redirects back to the success page).
  let sessionId = new URLSearchParams(window.location.search).get('session_id') || ''
  const [verifying, setVerifying] = useState(true)
  const [payment, setPayment] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    let mounted = true
    const verify = async () => {
      try {
        if (!sessionId) {
          if (mounted) { setError('No payment session found'); setVerifying(false) }
          return
        }
        const data = await api(`/stripe/verify-session/${sessionId}`)
        if (mounted) setPayment(data)
      } catch (err) {
        if (mounted) { setError(err.message || 'Verification failed'); setVerifying(false) }
      }
      if (mounted) setVerifying(false)
    }
    verify()
    return () => { mounted = false }
  }, [sessionId])

  if (verifying) {
    return (
      <CustomerLayout active="bookings">
        <div className="page-head">
          <div className="page-head-row">
            <div><h1>Verifying Payment</h1><p>Please wait while we confirm your payment with Stripe.</p></div></div>
        </div>
        <div className="dashboard-page" style={{ padding: '2rem' }}>
          <div className="cd-card cp-empty" style={{ maxWidth: '500px', margin: '0 auto', textAlign: 'center' }}>
            <Clock size={48} /><h3 style={{ margin: '0.5rem 0 0 0' }}>Verifying Payment...</h3>
            <p style={{ color: 'var(--cp-text-secondary)' }}>We are confirming your payment status. Please do not refresh this page.</p>
          </div>
        </div>
      </CustomerLayout>
    )
  }

  if (error) {
    return (
      <CustomerLayout active="bookings">
        <div className="page-head">
          <div className="page-head-row">
            <div><h1>Verification Failed</h1><p>We could not confirm your payment. Please contact support if you were charged.</p></div></div>
        </div>
        <div className="dashboard-page" style={{ padding: '2rem' }}>
          <div className="cd-card cd-alert warning" style={{ maxWidth: '500px', margin: '0 auto' }}>{error}</div>
          <div style={{ textAlign: 'center', marginTop: '1.5rem' }}>
            <Link to="/customer/bookings" className="btn-primary enhanced"><ArrowRight size={20} /> Return to Bookings</Link>
          </div>
        </div>
      </CustomerLayout>
    )
  }

  const paid = payment?.paymentStatus === 'paid'
  const b = payment?.booking || {}

  return (
    <CustomerLayout active="bookings">
      <div className="page-head">
        <div className="page-head-row">
          <div><h1>{paid ? 'Payment Confirmed' : 'Payment Pending'}</h1><p>{paid ? 'Your Stripe payment has been verified and your booking is confirmed.' : 'Your payment is still being processed. You can check the status below.'}</p></div></div>
      </div>
      <div className="dashboard-page" style={{ padding: '2rem' }}>
        {paid ? (
          <div className="cd-card enhanced" style={{ maxWidth: '500px', margin: '0 auto', border: '2px solid var(--cp-success)', background: 'var(--cp-success-bg, #f0fdf4)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
              <CheckCircle size={24} style={{ color: 'var(--cp-success)' }} /><h3 style={{ margin: 0, color: 'var(--cp-success)' }}>Payment Successful</h3>
            </div>
            <div className="detail-item" style={{ marginBottom: '0.75rem' }}>
              <span style={{ color: 'var(--cp-muted)' }}>Booking Reference</span>
              <p style={{ margin: '0.25rem 0 0 0', fontWeight: 700 }}>{b.bookingReference || '—'}</p>
            </div>
            <div className="detail-item" style={{ marginBottom: '0.75rem' }}>
              <span style={{ color: 'var(--cp-muted)' }}>Payment Reference</span>
              <p style={{ margin: '0.25rem 0 0 0', fontWeight: 700, wordBreak: 'break-all' }}>{sessionId}</p>
            </div>
            <div className="detail-item" style={{ marginBottom: '0.75rem' }}>
              <span style={{ color: 'var(--cp-muted)' }}>Amount Paid</span>
              <p style={{ margin: '0.25rem 0 0 0', fontWeight: 700 }}>₹{(b.paidAmount || 0).toLocaleString()}</p>
            </div>
            <div className="detail-item" style={{ marginBottom: '0.75rem' }}>
              <span style={{ color: 'var(--cp-muted)' }}>Status</span>
              <p style={{ margin: '0.25rem 0 0 0', fontWeight: 700, color: 'var(--cp-success)' }}>{b.status}</p>
            </div>
            <div style={{ textAlign: 'center', marginTop: '1.5rem' }}>
              <Link to="/customer/bookings" className="btn-primary enhanced"><Ticket size={20} /> View My Bookings</Link>
            </div>
          </div>
        ) : (
          <div className="cd-card enhanced" style={{ maxWidth: '500px', margin: '0 auto' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
              <Clock size={24} style={{ color: 'var(--cp-warning)' }} /><h3 style={{ margin: 0, color: 'var(--cp-warning)' }}>Payment Processing</h3>
            </div>
            <p style={{ marginBottom: '1rem', color: 'var(--cp-text-secondary)' }}>Your payment is still being processed by Stripe. This can take a few moments for some payment methods.</p>
            <div className="detail-item" style={{ marginBottom: '0.75rem' }}>
              <span style={{ color: 'var(--cp-muted)' }}>Booking Reference</span>
              <p style={{ margin: '0.25rem 0 0 0', fontWeight: 700 }}>{b.bookingReference || '—'}</p>
            </div>
            <div className="detail-item" style={{ marginBottom: '0.75rem' }}>
              <span style={{ color: 'var(--cp-muted)' }}>Session</span>
              <p style={{ margin: '0.25rem 0 0 0', fontWeight: 700, wordBreak: 'break-all' }}>{sessionId}</p>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center', marginTop: '1.5rem' }}>
              <button onClick={() => window.location.reload()} className="btn-primary enhanced"><ArrowRight size={20} /> Refresh Status</button>
              <Link to="/customer/bookings" className="btn-secondary">Return to Bookings</Link>
            </div>
          </div>
        )}
      </div>
    </CustomerLayout>
  )
}

export default StripeSuccess
