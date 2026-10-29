import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import {
  User, Star, Link as LinkIcon, Share2, Award, Wallet,
  CopyIcon, CheckCircle, Clock, Gift, Rocket, Target, Flame
} from 'lucide-react'
import CustomerLayout from './CustomerLayout'
import { api } from '../../api'
import '../Dashboard.css'

const ReferralRewards = () => {
  const user = JSON.parse(localStorage.getItem('user') || '{}')

  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)

  const load = async () => {
    try {
      setError('')
      const res = await api('/customer/referral-rewards')
      setData(res.data || res)
    } catch {
      const referralCode = String(user.email || 'user').split('@')[0].toUpperCase() + 'TRAVEL'
      setData({
        points: 0,
        tier: 'Explorer',
        referralCode,
        referrals: [],
        rewards: [
          { id: 'r1', title: '₹500 Off', cost: 500, type: 'discount', minBooking: 2000, redeemed: false },
          { id: 'r2', title: '₹1000 Off', cost: 1000, type: 'discount', minBooking: 5000, redeemed: false },
          { id: 'r3', title: 'Free Upgrade', cost: 1500, type: 'upgrade', minBooking: 0, redeemed: false }
        ],
        earnings: [
          { label: 'Points per booking', value: '10 pts / ₹1000 spent' },
          { label: 'Referral bonus', value: '200 pts per friend' },
          { label: 'Friend bonus', value: '100 pts on signup' }
        ]
      })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const pointsToRupees = (points) => Math.floor(points / 10)

  const copyCode = () => {
    if (!data?.referralCode) return
    navigator.clipboard.writeText(data.referralCode).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  const shareWhatsApp = () => {
    if (!data?.referralCode) return
    const text = `Join my trips! Use my referral code ${data.referralCode} to get 100 points on signup.`
    const url = `https://wa.me/?text=${encodeURIComponent(text)}`
    window.open(url, '_blank')
  }

  const copyReferralLink = () => {
    if (!data?.referralCode) return
    const link = `${window.location.origin}/signup?ref=${data.referralCode}`
    navigator.clipboard.writeText(link).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  const redeem = async (reward) => {
    if (!data || reward.redeemed) return
    if (data.points < reward.cost) {
      setError('Not enough points')
      return
    }
    try {
      const res = await api('/customer/rewards/redeem', {
        method: 'POST',
        body: JSON.stringify({ rewardId: reward.id })
      })
      if (res.success || res.ok) {
        setData(prev => ({
          ...prev,
          points: prev.points - reward.cost,
          rewards: prev.rewards.map(r => r.id === reward.id ? { ...r, redeemed: true } : r)
        }))
        setError('')
      }
    } catch {
      setError('Redemption failed')
    }
  }

  if (loading) return (
    <CustomerLayout active="referral">
      <div className="cd-card" style={{ textAlign: 'center', padding: '4rem' }}>
        <div className="bt-spinner" style={{ margin: '0 auto 1.5rem', width: '40px', height: '40px' }} />
        <p style={{ color: 'var(--cp-muted)', fontSize: '1.1rem' }}>Loading your rewards...</p>
      </div>
    </CustomerLayout>
  )

  if (error && !data) return (
    <CustomerLayout active="referral">
      <div className="cd-card" style={{ textAlign: 'center', padding: '4rem' }}>
        <Award size={48} style={{ color: 'var(--cp-danger)', marginBottom: '1rem' }} />
        <h3 style={{ color: 'var(--cp-ink)' }}>Unable to load rewards</h3>
        <p style={{ color: 'var(--cp-muted)' }}>{error}</p>
        <Link to="/customer/dashboard" className="btn bt-btn-primary" style={{ marginTop: '1.5rem' }}>
          Back to Dashboard
        </Link>
      </div>
    </CustomerLayout>
  )

  const d = data

  return (
    <CustomerLayout active="referral">
      {error && <div className="cd-card cd-alert warning" style={{ marginBottom: '1rem' }}>{error}</div>}

      <div className="rr-page">
        <div className="rr-header">
          <div className="rr-header-left">
            <div className="rr-header-icon">
              <Gift className="h-6 w-6" style={{ color: 'var(--customer-primary-teal)' }} />
            </div>
            <div>
              <h1 className="rr-page-title">Referral & Rewards</h1>
              <p className="rr-page-sub">Earn points on every booking and refer friends to unlock discounts.</p>
            </div>
          </div>
          <div className="rr-points-pill">
            <Star className="h-5 w-5" style={{ color: 'var(--customer-accent-emerald)' }} />
            <span className="rr-points-value">{d.points}</span>
            <span className="rr-points-label">Points</span>
          </div>
        </div>

        <div className="rr-tiers">
          <div className="rr-tier-card">
            <div className="rr-tier-header">
              <div className="rr-tier-avatar">
                <Rocket className="h-5 w-5" style={{ color: 'var(--customer-primary-teal)' }} />
              </div>
              <span className="rr-tier-name">Explorer</span>
            </div>
            <div className="rr-tier-body">
              <div className="rr-tier-progress">
                <div className="rr-progress-track">
                  <div className={`rr-progress-fill ${d.tier === 'Explorer' ? 'rr-progress-active' : ''}`} style={{ width: `${Math.min((d.points / 500) * 100, 100)}%` }} />
                </div>
                <span className="rr-tier-points">{d.points} / 500 pts</span>
              </div>
              <p className="rr-tier-note">Spend ₹50,000 to reach Silver</p>
            </div>
          </div>
          <div className="rr-tier-card">
            <div className="rr-tier-header">
              <div className="rr-tier-avatar">
                <Target className="h-5 w-5" style={{ color: 'var(--customer-primary-teal)' }} />
              </div>
              <span className="rr-tier-name rr-tier-name-silver">Silver</span>
            </div>
            <div className="rr-tier-body">
              <div className="rr-tier-progress">
                <div className="rr-progress-track">
                  <div className={`rr-progress-fill ${d.tier === 'Silver' ? 'rr-progress-active' : ''}`} style={{ width: `${d.tier === 'Silver' ? Math.min(((d.points - 500) / 500) * 100, 100) : 0}%` }} />
                </div>
                <span className="rr-tier-points">{d.tier === 'Silver' ? Math.max(d.points - 500, 0) : 0} / 500 pts</span>
              </div>
              <p className="rr-tier-note">Spend ₹1,00,000 to reach Gold</p>
            </div>
          </div>
          <div className="rr-tier-card">
            <div className="rr-tier-header">
              <div className="rr-tier-avatar">
                <Flame className="h-5 w-5" style={{ color: 'var(--customer-accent-emerald)' }} />
              </div>
              <span className="rr-tier-name rr-tier-name-gold">Gold</span>
            </div>
            <div className="rr-tier-body">
              <div className="rr-tier-progress">
                <div className="rr-progress-track">
                  <div className={`rr-progress-fill ${d.tier === 'Gold' ? 'rr-progress-active' : ''}`} style={{ width: `${d.tier === 'Gold' ? 100 : 0}%` }} />
                </div>
                <span className="rr-tier-points">Max tier</span>
              </div>
              <p className="rr-tier-note">Top tier benefits unlocked</p>
            </div>
          </div>
        </div>

        <div className="rr-grid-2">
          <div className="rr-card">
            <div className="rr-card-head">
              <h3 className="rr-card-title"><User className="h-5 w-5" style={{ color: 'var(--cp-accent)' }} /> Your Referral Code</h3>
            </div>
            <div className="rr-referral-box">
              <div className="rr-code-row">
                <input type="text" readOnly value={d.referralCode} className="rr-code-input" />
                <button onClick={copyCode} className="rr-copy-btn">
                  {copied ? <CheckCircle size={16} style={{ color: 'var(--customer-accent-emerald)' }} /> : <CopyIcon size={16} style={{ color: 'var(--customer-primary-teal)' }} />}
                  <span>{copied ? 'Copied!' : 'Copy code'}</span>
                </button>
              </div>
              <p className="rr-code-hint">Your friends get 100 points on signup. You earn 200 points when they complete their first booking.</p>
              <div className="rr-share">
                <button className="rr-share-btn rr-share-wa" onClick={shareWhatsApp} title="Share on WhatsApp">
                  <Share2 className="h-5 w-5" />
                </button>
                <button className="rr-share-btn rr-share-copy" onClick={copyReferralLink} title="Copy referral link">
                  <LinkIcon className="h-5 w-5" />
                </button>
              </div>
            </div>
          </div>

          <div className="rr-card">
            <div className="rr-card-head">
              <h3 className="rr-card-title"><Wallet className="h-5 w-5" style={{ color: 'var(--customer-accent-emerald)' }} /> How You Earn</h3>
            </div>
            <div className="rr-earnings-grid">
              {d.earnings.map((e, i) => (
                <div key={i} className="rr-earning-card">
                  <div className="rr-earning-icon">{e.icon ? <e.icon className="h-4 w-4" style={{ color: 'var(--cp-accent)' }} /> : <Star className="h-4 w-4" style={{ color: 'var(--cp-accent)' }} />}</div>
                  <div className="rr-earning-text">
                    <span className="rr-earning-label">{e.label}</span>
                    <span className="rr-earning-value">{e.value}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="rr-grid-2">
          <div className="rr-card">
            <div className="rr-card-head">
              <h3 className="rr-card-title"><Award className="h-5 w-5" style={{ color: 'var(--customer-accent-emerald)' }} /> Redeem Rewards</h3>
              <span className="rr-redeem-value">{pointsToRupees(d.points)} rupees value</span>
            </div>
            <div className="rr-rewards-list">
              {d.rewards.map(r => (
                <div key={r.id} className={`rr-reward-card ${r.redeemed ? 'redeemed' : ''}`}>
                  <div className="rr-reward-body">
                    <div className="rr-reward-main">
                      <h4 className="rr-reward-title">{r.title}</h4>
                      <span className={`rr-reward-tag ${r.type}`}>{r.type}</span>
                    </div>
                    <p className="rr-reward-desc">{r.type === 'discount' ? `Save ₹${r.cost} on bookings of ₹${r.minBooking}+` : 'Complimentary upgrade on your next trip'}</p>
                    <div className="rr-reward-cost-row">
                      <span className="rr-reward-cost">{r.cost} pts</span>
                    </div>
                  </div>
                  <div className="rr-reward-action">
                    {r.redeemed ? (
                      <span className="rr-badge-redeemed">Redeemed</span>
                    ) : d.points < r.cost ? (
                      <button className="rr-btn rr-btn-disabled" disabled>Not enough</button>
                    ) : (
                      <button className="rr-btn rr-btn-primary" onClick={() => redeem(r)}>Redeem</button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="rr-card">
            <div className="rr-card-head">
              <h3 className="rr-card-title"><Clock className="h-5 w-5" style={{ color: 'var(--customer-accent-emerald)' }} /> Recent Referrals</h3>
            </div>
            <div className="rr-referrals-wrap">
              {(d.referrals || []).length === 0 ? (
                <div className="rr-empty-state">
                  <Star className="h-8 w-8" style={{ color: 'var(--customer-accent-emerald)', marginBottom: '0.75rem' }} />
                  <p className="rr-empty-title">No referrals yet</p>
                  <p className="rr-empty-sub">Share your referral code to start earning points.</p>
                </div>
              ) : (
                <div className="rr-referrals-list">
                  {d.referrals.map((r, i) => (
                    <div key={i} className="rr-list-item">
                      <div className="rr-list-avatar">
                        <User className="h-4 w-4" style={{ color: 'var(--customer-accent-emerald)' }} />
                      </div>
                      <div className="rr-list-info">
                        <span className="rr-list-name">{r.name || 'Friend'}</span>
                        <span className="rr-list-status">{r.status}</span>
                      </div>
                      <span className="rr-list-points">+{r.points || 200}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </CustomerLayout>
  )
}

export default ReferralRewards
