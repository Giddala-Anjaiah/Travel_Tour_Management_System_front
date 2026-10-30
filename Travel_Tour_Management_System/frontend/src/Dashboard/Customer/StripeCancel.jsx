import { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Link } from 'react-router-dom'
import { XCircle, CreditCard, Ticket, ArrowRight } from 'lucide-react'
import CustomerLayout from './CustomerLayout'
import '../Dashboard.css'

const StripeCancel = () => {
  const [searchParams] = useSearchParams()
  const sessionId = searchParams.get('session_id') || ''

  return (
    <CustomerLayout active="bookings">
      <div className="page-head">
        <div className="page-head-row">
          <div>
            <h1>Payment Cancelled</h1>
            <p>You cancelled the Stripe checkout. Your booking is still available for payment.</p>
          </div>
        </div>
      </div>
      <div className="dashboard-page">
        <div className="cd-card enhanced" style={{ maxWidth: '500px', margin: '2rem auto', textAlign: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
            <XCircle className="h-6 w-6" style={{ color: '#ef4444' }} />
            <h3 style={{ margin: 0 }}>Payment Cancelled</h3>
          </div>
          <p style={{ marginBottom: '1.5rem', color: 'var(--cp-text-secondary)' }}>
            Your Stripe checkout was cancelled. No charges were made. Your booking remains pending and can be paid again.
          </p>
          {sessionId && (
            <div style={{ marginBottom: '1rem', fontSize: '0.85rem', color: 'var(--cp-muted)', wordBreak: 'break-all' }}>
              Session: {sessionId}
            </div>
          )}
          <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center' }}>
            <button onClick={() => window.location.reload()} className="btn-primary enhanced">
              <ArrowRight className="h-4 w-4" /> Retry Payment
            </button>
            <Link to="/customer/bookings" className="btn-secondary">
              <Ticket className="h-4 w-4" /> View Bookings
            </Link>
          </div>
          </div>
        </div>
      </CustomerLayout>
  )
}

export default StripeCancel
