import { useState, useEffect, useCallback } from 'react'
import { useParams } from 'react-router-dom'
import {
  Package, Calendar, Users, Clock, CreditCard, AlertCircle,
  CheckCircle, XCircle, MapPin, ArrowLeft, RotateCcw, Info
} from 'lucide-react'
import { Link } from 'react-router-dom'
import CustomerLayout from './CustomerLayout'
import { api } from '../../api'
import '../Dashboard.css'

const STEPS = ['pending', 'confirmed', 'completed']

const STEP_ICON = {
  pending: Clock,
  confirmed: CheckCircle,
  completed: CheckCircle
}

const BookingTracker = () => {
  const { id } = useParams()
  const [booking, setBooking] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    try {
      setError('')
      const data = await api(`/customer/bookings/${id}`)
      setBooking(data.booking)
      setError('')
    } catch {
      setError('Failed to load booking')
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    Promise.resolve().then(() => load())
    const t = setInterval(load, 10000)
    return () => clearInterval(t)
  }, [id, load])

  if (loading) return (
    <CustomerLayout>
      <div className="bt-loading">
        <div className="bt-spinner" />
        <p>Loading your booking details...</p>
      </div>
    </CustomerLayout>
  )
  if (error || !booking) return (
    <CustomerLayout>
      <div className="bt-error">
        <AlertCircle size={48} />
        <p>{error || 'Booking not found'}</p>
        <Link to="/customer/dashboard" className="btn bt-btn-primary">
          <ArrowLeft size={16} /> Back to Dashboard
        </Link>
      </div>
    </CustomerLayout>
  )

  const currentIdx = STEPS.indexOf(booking.status) === -1 ? 0 : STEPS.indexOf(booking.status)
  const cancelled = booking.status === 'cancelled' || booking.status === 'rejected'
  const pkg = booking.packageId || {}
  const dates = booking.dates || ''
  const travelers = booking.travelers || 1
  const amount = Number(booking.amount || 0).toFixed(2)
  const paidAmount = Number(booking.paidAmount || 0).toFixed(2)
  const paymentStatus = booking.paymentStatus || 'pending'

  // Cancellation & refund figures, resolved once so the section can render
  // without repeating the fallback logic for every field.
  const cancellation = booking.cancellation || null
  const refund = booking.refund || {}
  const bookingAmount = Number(cancellation?.bookingAmount ?? amount)
  const refundAmount = Number(cancellation?.refundAmount || 0)
  const cancellationFee = Number(cancellation?.cancellationFee || 0)
  const refundStatus = refund.status ? refund.status.toLowerCase() : 'pending'
  const refundStatusLabel = refund.status
    ? refund.status.charAt(0).toUpperCase() + refund.status.slice(1)
    : 'Pending'
  const refundStatusClass = {
    processed: 'completed',
    refunded: 'completed',
    completed: 'completed',
    pending: 'pending',
    processing: 'pending',
    failed: 'rejected',
    rejected: 'rejected'
  }[refundStatus] || 'pending'

  const formatStatus = (s) => s.charAt(0).toUpperCase() + s.slice(1)

  return (
    <CustomerLayout>
      <div className="bt-container">
        <Link to="/customer/dashboard" className="bt-back">
          <ArrowLeft size={16} /> Back
        </Link>

        <div className="bt-card">
          <div className="bt-card-header">
            <div className="bt-card-title">
              <div className="bt-card-icon"><Package size={22} /></div>
              <div>
                <h2>{pkg.name || booking.package || 'Tour Package'}</h2>
                <span className="bt-booking-id">Booking ID: {booking.bookingId}</span>
              </div>
            </div>
            <span className={`bt-status bt-status-${booking.status}`}>
              {formatStatus(booking.status)}
            </span>
          </div>

          <div className="bt-card-grid">
            <div className="bt-info">
              <Calendar size={16} />
              <div>
                <span>Trip Dates</span>
                <strong>{dates || '—'}</strong>
              </div>
            </div>
            <div className="bt-info">
              <Users size={16} />
              <div>
                <span>Travelers</span>
                <strong>{travelers}</strong>
              </div>
            </div>
            <div className="bt-info">
              <CreditCard size={16} />
              <div>
                <span>Payment</span>
                <strong className={`bt-payment bt-payment-${paymentStatus}`}>
                  {formatStatus(paymentStatus)}
                </strong>
              </div>
            </div>
            <div className="bt-info">
              <MapPin size={16} />
              <div>
                <span>Destination</span>
                <strong>{pkg.destination || '—'}</strong>
              </div>
            </div>
          </div>

          <div className="bt-amounts">
            <div>
              <span>Total Amount</span>
              <strong>${amount}</strong>
            </div>
            <div>
              <span>Paid</span>
              <strong>${paidAmount}</strong>
            </div>
            <div>
              <span>Balance</span>
              <strong>${(amount - paidAmount).toFixed(2)}</strong>
            </div>
          </div>
        </div>

        {!cancelled && (
          <div className="bt-card">
            <div className="bt-card-header">
              <h3 className="bt-card-subtitle">Booking Progress</h3>
              <span className={`bt-status bt-status-${booking.status}`} style={{ fontSize: '0.875rem', padding: '0.35rem 0.75rem' }}>
                {formatStatus(booking.status)}
              </span>
            </div>
            <div className="bt-steps" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', marginTop: '1.25rem', position: 'relative' }}>
              <div style={{ position: 'absolute', left: '30px', right: '30px', top: '22px', height: '2px', background: 'var(--cp-line)' }} />
              {STEPS.map((s, i) => {
                const Icon = STEP_ICON[s]
                const done = i <= currentIdx
                const active = i === currentIdx
                return (
                  <div key={s} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem', position: 'relative', zIndex: 1, flex: 1 }}>
                    <div style={{ width: '40px', height: '40px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: active ? 'var(--cp-accent)' : done ? 'var(--cp-success)' : 'var(--cp-surface)', border: `2px solid ${active ? 'var(--cp-accent)' : done ? 'var(--cp-success)' : 'var(--cp-line)'}`, color: '#fff', boxShadow: active ? '0 0 0 4px rgba(16, 185, 129, 0.2)' : done ? '0 0 0 4px rgba(34, 197, 94, 0.2)' : 'none' }}>
                      <Icon size={18} strokeWidth={2.5} />
                    </div>
                    <span style={{ fontSize: '0.75rem', fontWeight: '600', color: active ? 'var(--cp-accent)' : done ? 'var(--cp-success)' : 'var(--cp-muted)' }}>{formatStatus(s)}</span>
                    {active && <span style={{ fontSize: '0.65rem', background: 'rgba(16, 185, 129, 0.1)', color: 'var(--cp-accent)', padding: '0.1rem 0.5rem', borderRadius: '12px', fontWeight: '700' }}>Current</span>}
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {cancelled && cancellation && (
          <div className="bt-card bt-refund-card">
            <div className="bt-card-header">
              <div className="bt-card-title">
                <span className="bt-card-icon bt-refund-icon">
                  <RotateCcw size={20} />
                </span>
                <div>
                  <h2>Cancellation & Refund</h2>
                  <span className="bt-booking-id">How this cancellation was settled</span>
                </div>
              </div>
              <span className={`bt-status bt-status-${refundStatusClass}`}>
                {refundStatusLabel}
              </span>
            </div>

            <div className="bt-refund-summary">
              <div className="bt-refund-tile">
                <span className="bt-refund-tile-label">Booking Amount</span>
                <strong className="bt-refund-tile-value">${bookingAmount.toFixed(2)}</strong>
              </div>
              <div className="bt-refund-tile is-refund">
                <span className="bt-refund-tile-label">Refund Amount</span>
                <strong className="bt-refund-tile-value">${refundAmount.toFixed(2)}</strong>
              </div>
              <div className="bt-refund-tile is-fee">
                <span className="bt-refund-tile-label">Cancellation Fee</span>
                <strong className="bt-refund-tile-value">${cancellationFee.toFixed(2)}</strong>
              </div>
            </div>

            <div className="bt-refund-grid">
              <div className="bt-refund-item">
                <span className="bt-refund-label">Cancelled At</span>
                <strong className="bt-refund-value">
                  {cancellation.cancelledAt ? new Date(cancellation.cancelledAt).toLocaleString() : '—'}
                </strong>
              </div>
              <div className="bt-refund-item">
                <span className="bt-refund-label">Days Before Trip</span>
                <strong className="bt-refund-value">
                  {cancellation.daysBeforeTrip ?? '—'}
                </strong>
              </div>
              <div className="bt-refund-item">
                <span className="bt-refund-label">Applicable Refund</span>
                <strong className="bt-refund-value">
                  {cancellation.refundPercentage != null ? `${cancellation.refundPercentage}%` : '—'}
                </strong>
              </div>
              <div className="bt-refund-item">
                <span className="bt-refund-label">Refund Reference</span>
                <strong className="bt-refund-value bt-refund-mono">
                  {refund.transactionId || '—'}
                </strong>
              </div>
              {refund.processedAt && (
                <div className="bt-refund-item">
                  <span className="bt-refund-label">Processed At</span>
                  <strong className="bt-refund-value">
                    {new Date(refund.processedAt).toLocaleString()}
                  </strong>
                </div>
              )}
            </div>

            {cancellation.reason && (
              <div className="bt-refund-note">
                <Info size={16} />
                <div>
                  <span className="bt-refund-label">Cancellation Reason</span>
                  <p>{cancellation.reason}</p>
                </div>
              </div>
            )}
          </div>
        )}
        {cancelled && (
          <div className="bt-cancelled">
            <XCircle size={20} />
            <span>This booking was {booking.status}.</span>
          </div>
        )}

        <div className="bt-card">
          <div className="bt-card-header">
            <h3 className="bt-card-subtitle">Timeline</h3>
            <span className={`bt-status bt-status-${booking.status}`} style={{ fontSize: '0.875rem', padding: '0.35rem 0.75rem' }}>
              {formatStatus(booking.status)}
            </span>
          </div>
          <ul className="bt-timeline" style={{ marginTop: '1.25rem', paddingLeft: 0, listStyle: 'none' }}>
            {(booking.timeline || []).slice().reverse().map((t, i) => (
              <li key={i} className="bt-timeline-item" style={{ position: 'relative', paddingLeft: '2.25rem', marginBottom: '1.5rem', borderLeft: `2px solid var(--cp-line)` }}>
                <span className="bt-timeline-dot" style={{ position: 'absolute', left: '-2px', top: '2px', width: '12px', height: '12px', borderRadius: '50%', background: t.status === booking.status ? 'var(--cp-accent)' : 'var(--cp-success)', border: '2px solid #fff', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }} />
                <div className="bt-timeline-content">
                  <div className="bt-timeline-status" style={{ display: 'flex', alignItems: 'baseline', gap: '0.75rem', marginBottom: '0.25rem' }}>
                    <strong style={{ color: 'var(--cp-ink)', fontSize: '0.95rem' }}>{t.status.charAt(0).toUpperCase() + t.status.slice(1)}</strong>
                    <span className="bt-timeline-date" style={{ color: 'var(--cp-muted)', fontSize: '0.85rem' }}>{new Date(t.date).toLocaleString()}</span>
                  </div>
                  {t.note && <div className="bt-timeline-note" style={{ color: 'var(--cp-muted)', fontSize: '0.9rem', lineHeight: '1.5' }}>{t.note}</div>}
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </CustomerLayout>
  )
}

export default BookingTracker