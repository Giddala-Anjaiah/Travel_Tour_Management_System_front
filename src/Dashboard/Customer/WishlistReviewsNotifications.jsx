import { useState, useEffect } from 'react'
import { Heart, Star, Bell, Search, Trash2, Check, Calendar, Sparkles, Shield, Award, Clock, CheckCircle, AlertCircle, Star as StarIcon, Bell as BellIcon, MapPin as MapIcon, Plus } from 'lucide-react'
import { Link } from 'react-router-dom'
import CustomerLayout from './CustomerLayout'
import { api } from '../../api'
import '../Dashboard.css'

const WishlistReviewsNotifications = () => {
  const [activeTab, setActiveTab] = useState('wishlist')
  const [searchTerm, setSearchTerm] = useState('')
  const [showReviewModal, setShowReviewModal] = useState(false)

  const switchTab = (tab) => {
    setActiveTab(tab)
    setSearchTerm('')
  }
  const [wishlist, setWishlist] = useState([])
  const [reviews, setReviews] = useState([])
  const [notifications, setNotifications] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [reviewForm, setReviewForm] = useState({ packageId: '', packageName: '', rating: 5, comment: '' })
  const [saving, setSaving] = useState(false)
  const [packages, setPackages] = useState([])

  const loadPackages = async () => {
    try {
      const data = await api('/packages')
      setPackages(data.packages || [])
    } catch (err) {
      console.error('Failed to load packages', err)
    }
  }

  const loadWishlist = async () => {
    try {
      const data = await api('/customer/wishlist')
      setWishlist(data.wishlist || [])
    } catch (err) {
      console.error('Failed to load wishlist', err)
    }
  }

  const loadReviews = async () => {
    try {
      const data = await api('/customer/reviews')
      setReviews(data.reviews || [])
    } catch (err) {
      console.error('Failed to load reviews', err)
    }
  }

  const loadNotifications = async () => {
    try {
      const data = await api('/customer/notifications')
      setNotifications(data.notifications || [])
    } catch (err) {
      console.error('Failed to load notifications', err)
    }
  }

  useEffect(() => {
    const loadAll = async () => {
      setLoading(true)
      setError('')
      try {
        await Promise.all([loadWishlist(), loadReviews(), loadNotifications(), loadPackages()])
      } catch (err) {
        setError(err.message || 'Failed to load data')
      } finally {
        setLoading(false)
      }
    }
    loadAll()
  }, [])

  const removeFromWishlist = async (id) => {
    if (!window.confirm('Remove this item from wishlist?')) return
    try {
      await api(`/customer/wishlist/${id}`, { method: 'DELETE' })
      setWishlist(prev => prev.filter(item => item._id !== id))
    } catch (err) {
      alert(err.message || 'Failed to remove from wishlist')
    }
  }

  const submitReview = async (e) => {
    e.preventDefault()
    if (!reviewForm.packageName || !reviewForm.comment) {
      alert('Please fill in package and comment')
      return
    }
    setSaving(true)
    try {
      const data = await api('/customer/reviews', {
        method: 'POST',
        body: JSON.stringify(reviewForm)
      })
      setReviews(prev => [data.review, ...prev])
      await loadNotifications()
      setShowReviewModal(false)
      setReviewForm({ packageId: '', packageName: '', rating: 5, comment: '' })
      alert('Review submitted successfully!')
    } catch (err) {
      alert(err.message || 'Failed to submit review')
    } finally {
      setSaving(false)
    }
  }

  const deleteReview = async (id) => {
    if (!window.confirm('Delete this review?')) return
    try {
      await api(`/customer/reviews/${id}`, { method: 'DELETE' })
      setReviews(prev => prev.filter(r => r._id !== id))
    } catch (err) {
      alert(err.message || 'Failed to delete review')
    }
  }

  const markAsRead = async (id) => {
    try {
      await api(`/customer/notifications/${id}/read`, { method: 'PUT' })
      setNotifications(prev => prev.map(n => n._id === id ? { ...n, read: true } : n))
    } catch (err) {
      alert(err.message || 'Failed to mark as read')
    }
  }

  const markAllAsRead = async () => {
    try {
      await api('/customer/notifications/read-all', { method: 'PUT' })
      setNotifications(prev => prev.map(n => ({ ...n, read: true })))
    } catch (err) {
      alert(err.message || 'Failed to mark all as read')
    }
  }

  const deleteNotification = async (id) => {
    if (!window.confirm('Delete this notification?')) return
    try {
      await api(`/customer/notifications/${id}`, { method: 'DELETE' })
      setNotifications(prev => prev.filter(n => n._id !== id))
    } catch (err) {
      alert(err.message || 'Failed to delete notification')
    }
  }

  const renderStars = (rating) => {
    return Array.from({ length: 5 }, (_, i) => (
      <Star key={i} className={`h-4 w-4 ${i < rating ? 'fill' : ''}`} />
    ))
  }

  const getCategoryBadge = (category) => {
    const badges = {
      beach: { label: 'Beach', color: '#0e7490' },
      nature: { label: 'Nature', color: '#15803d' },
      adventure: { label: 'Adventure', color: '#b45309' },
      heritage: { label: 'Heritage', color: '#6d28d9' }
    }
    return badges[category] || { label: 'Tour', color: '#475569' }
  }

  const getNotificationTypeColor = (type) => {
    const colors = {
      booking: '#22c55e',
      payment: '#f59e0b',
      offer: '#8b5cf6',
      review: '#0ea5e9',
      system: '#64748b',
      availability: '#06b6d4'
    }
    return colors[type] || '#64748b'
  }

  const filteredWishlist = wishlist.filter(item =>
    (item.packageName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (item.destination || '').toLowerCase().includes(searchTerm.toLowerCase())
  )

  const filteredReviews = reviews.filter(review =>
    (review.package || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (review.comment || '').toLowerCase().includes(searchTerm.toLowerCase())
  )

  const filteredNotifications = notifications.filter(notif =>
    (notif.message || '').toLowerCase().includes(searchTerm.toLowerCase())
  )

  if (loading) {
    return (
      <CustomerLayout active="wishlist" title="Wishlist & updates" subtitle="Saved trips, reviews, and notifications">
        <div className="cd-card" style={{ textAlign: 'center', padding: '3rem' }}>
          <p style={{ color: '#64748b' }}>Loading…</p>
        </div>
      </CustomerLayout>
    )
  }

  return (
    <CustomerLayout
      active="wishlist"
      title="Wishlist & updates"
      subtitle="Saved trips, reviews, and notifications"
      actions={
        <div className="header-stats">
          <div className="stat-badge">
            <Sparkles className="h-4 w-4" />
            <span>{wishlist.length} saved</span>
          </div>
          <div className="stat-badge">
            <BellIcon className="h-4 w-4" />
            <span>{notifications.filter(n => !n.read).length} new</span>
          </div>
        </div>
      }
    >
      {error && <div className="cd-card cd-alert warning" style={{ marginBottom: '1rem' }}>{error}</div>}

      <div className="tabs enhanced">
        <button
          className={`tab-btn ${activeTab === 'wishlist' ? 'active' : ''}`}
          onClick={() => switchTab('wishlist')}
        >
          <Heart className="h-4 w-4" /> Wishlist ({wishlist.length})
        </button>
        <button
          className={`tab-btn ${activeTab === 'reviews' ? 'active' : ''}`}
          onClick={() => switchTab('reviews')}
        >
          <Star className="h-4 w-4" /> Reviews ({reviews.length})
        </button>
        <button
          className={`tab-btn ${activeTab === 'notifications' ? 'active' : ''}`}
          onClick={() => switchTab('notifications')}
        >
          <Bell className="h-4 w-4" /> Notifications ({notifications.filter(n => !n.read).length} new)
        </button>
      </div>

      <div className="filters-section enhanced">
        <div className="search-bar enhanced">
          <Search className="search-icon" />
          <input
            type="text"
            placeholder={`Search ${activeTab}...`}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      {activeTab === 'wishlist' && (
        <div className="wishlist-grid enhanced">
          {filteredWishlist.length === 0 ? (
            <div className="cd-empty">No wishlist items yet.</div>
          ) : (
            filteredWishlist.map(item => {
              const categoryBadge = getCategoryBadge(item.category || 'tour')
              return (
                <div key={item._id} className="wishlist-card enhanced">
                  <div className="wishlist-image enhanced">
                    <div className="wishlist-emoji-wrapper">
                      {item.image ? <img className="cp-cover" src={item.image} alt={item.packageName} /> : <Star className="h-12 w-12" style={{ color: '#cbd5e1' }} />}
                    </div>
                    <div className="wishlist-category-badge" style={{ backgroundColor: categoryBadge.color }}>
                      <span>{categoryBadge.label}</span>
                    </div>
                  </div>
                  <div className="wishlist-content enhanced">
                    <h3>{item.packageName}</h3>
                    <div className="wishlist-location enhanced">
                      <MapIcon className="h-4 w-4" />
                      <span>{item.destination || 'Unknown'}</span>
                    </div>
                    <div className="wishlist-rating enhanced">
                      <Star className="h-4 w-4 fill" />
                      <span>{item.rating || '—'}</span>
                    </div>
                    <div className="wishlist-meta">
                      <span className="meta-item">
                        <Calendar className="h-4 w-4" />
                        <small>Added {item.addedAt ? new Date(item.addedAt).toLocaleDateString() : 'recently'}</small>
                      </span>
                    </div>
                    <div className="wishlist-footer enhanced">
                      <div className="wishlist-price enhanced">
                        <small>Starting from</small>
                        <strong>{item.price ? '₹' + item.price.toLocaleString() : 'Price on request'}</strong>
                      </div>
                      <div className="wishlist-actions">
                        <Link to="/customer/bookings" state={{ package: { name: item.packageName, price: item.price, _id: item._id } }} className="btn-primary enhanced">
                          Book Now
                        </Link>
                        <button
                          onClick={() => removeFromWishlist(item._id)}
                          className="icon-btn delete"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )
            })
          )}
        </div>
      )}

      {activeTab === 'reviews' && (
        <div className="reviews-section enhanced">
          <button
            onClick={() => setShowReviewModal(true)}
            className="btn-primary enhanced"
          >
            <Plus className="h-4 w-4" /> Write a Review
          </button>
          <div className="reviews-list enhanced">
            {filteredReviews.length === 0 ? (
              <div className="cd-empty">No reviews yet.</div>
            ) : (
              filteredReviews.map(review => (
                <div key={review._id} className="review-card enhanced">
                  <div className="review-header enhanced">
                    <div className="review-info">
                      <h3>{review.package}</h3>
                      <div className="review-rating enhanced">
                        {renderStars(review.rating)}
                      </div>
                    </div>
                    <div className="review-status-badge">
                      <CheckCircle className="h-4 w-4" />
                      <span>{review.status}</span>
                    </div>
                  </div>
                  <p className="review-comment enhanced">{review.comment}</p>
                  <div className="review-footer enhanced">
                    <span className="review-date">
                      <Calendar className="h-4 w-4" />
                      {review.date ? new Date(review.date).toLocaleDateString() : '—'}
                    </span>
                    <div className="review-actions">
                      <button onClick={() => deleteReview(review._id)} className="icon-btn delete">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {activeTab === 'notifications' && (
        <div className="notifications-section enhanced">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h3 style={{ margin: 0 }}>Notifications</h3>
            <button onClick={markAllAsRead} className="btn-secondary enhanced">Mark All as Read</button>
          </div>
          <div className="notifications-list enhanced">
            {filteredNotifications.length === 0 ? (
              <div className="cd-empty">No notifications yet.</div>
            ) : (
              filteredNotifications.map(notif => (
                <div key={notif._id} className={`notification-card enhanced ${!notif.read ? 'unread' : ''}`}>
                  <div className="notification-icon enhanced" style={{ backgroundColor: getNotificationTypeColor(notif.type) }}>
                    {notif.type === 'booking' && <CheckCircle className="h-4 w-4" />}
                    {notif.type === 'payment' && <AlertCircle className="h-4 w-4" />}
                    {notif.type === 'offer' && <Award className="h-4 w-4" />}
                    {notif.type === 'review' && <StarIcon className="h-4 w-4" />}
                    {notif.type === 'system' && <Shield className="h-4 w-4" />}
                    {notif.type === 'availability' && <Clock className="h-4 w-4" />}
                  </div>
                  <div className="notification-content enhanced">
                    <p>{notif.message}</p>
                    <span className="notification-date">
                      <Clock className="h-4 w-4" />
                      {notif.createdAt ? new Date(notif.createdAt).toLocaleDateString() : '—'}
                    </span>
                  </div>
                  <div className="notification-actions enhanced">
                    {!notif.read && (
                      <button onClick={() => markAsRead(notif._id)} className="icon-btn">
                        <Check className="h-4 w-4" />
                      </button>
                    )}
                    <button onClick={() => deleteNotification(notif._id)} className="icon-btn delete">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {showReviewModal && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <h3>Write a Review</h3>
              <button onClick={() => setShowReviewModal(false)} className="modal-close">×</button>
            </div>
            <div className="modal-body">
              <form className="review-form enhanced" onSubmit={submitReview}>
                <div className="form-group">
                  <label>Package Name</label>
                  <select
                    value={reviewForm.packageId}
                    onChange={(e) => {
                      const selectedId = e.target.value
                      const selectedPkg = packages.find(p => p._id === selectedId)
                      setReviewForm({...reviewForm, packageId: selectedId, packageName: selectedPkg ? selectedPkg.name : ''})
                    }}
                    required
                  >
                    <option value="">Select a package</option>
                    {packages.map(pkg => (
                      <option key={pkg._id} value={pkg._id}>{pkg.name}</option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label>Rating</label>
                  <select
                    value={reviewForm.rating}
                    onChange={(e) => setReviewForm({...reviewForm, rating: Number(e.target.value)})}
                  >
                    {[5,4,3,2,1].map(n => <option key={n} value={n}>{n} Star{n !== 1 ? 's' : ''}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label>Your Review</label>
                  <textarea
                    rows="4"
                    placeholder="Share your experience..."
                    value={reviewForm.comment}
                    onChange={(e) => setReviewForm({...reviewForm, comment: e.target.value})}
                    required
                  />
                </div>
                <div className="form-actions">
                  <button type="button" onClick={() => setShowReviewModal(false)} className="btn-secondary">
                    Cancel
                  </button>
                  <button type="submit" className="btn-primary enhanced" disabled={saving}>
                    <Star className="h-4 w-4" /> {saving ? 'Submitting...' : 'Submit Review'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </CustomerLayout>
  )
}

export default WishlistReviewsNotifications