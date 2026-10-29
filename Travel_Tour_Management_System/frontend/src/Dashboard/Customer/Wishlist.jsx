import { useState, useEffect } from 'react'
import { Heart, Star, Bell, Trash2, MapPin as MapIcon, Calendar, Sparkles, Clock, CheckCircle, Check, Plus } from 'lucide-react'
import { Link } from 'react-router-dom'
import CustomerLayout from './CustomerLayout'
import { api } from '../../api'
import '../Dashboard.css'

const Wishlist = () => {
  const [activeTab, setActiveTab] = useState('wishlist')
  const [wishlist, setWishlist] = useState([])
  const [reviews, setReviews] = useState([])
  const [notifications, setNotifications] = useState([])
  const [packages, setPackages] = useState([])
  const [hotels, setHotels] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [reviewForm, setReviewForm] = useState({ packageId: '', packageName: '', rating: 5, comment: '' })
  const [showReviewModal, setShowReviewModal] = useState(false)
  const [saving, setSaving] = useState(false)

  const loadWishlist = async () => {
    try {
      setError('')
      const data = await api('/customer/wishlist', { params: { limit: 'all' } })
      setWishlist(data.wishlist || [])
    } catch (err) {
      setError(err.message || 'Failed to load wishlist')
    }
  }

  const loadPackages = async () => {
    try {
      const data = await api('/packages', { params: { limit: 'all' } })
      setPackages(data.packages || [])
    } catch (err) {
      console.error('Failed to load packages', err)
    }
  }

  const loadHotels = async () => {
    try {
      const data = await api('/public/hotels', { params: { limit: 'all' } })
      setHotels(data.hotels || data.docs || [])
    } catch (err) {
      console.error('Failed to load hotels', err)
    }
  }

  const loadReviews = async () => {
    try {
      const data = await api('/customer/reviews', { params: { limit: 'all' } })
      setReviews(data.reviews || [])
    } catch (err) {
      console.error('Failed to load reviews', err)
    }
  }

  const loadNotifications = async () => {
    try {
      const data = await api('/customer/notifications', { params: { limit: 'all' } })
      setNotifications(data.notifications || [])
    } catch (err) {
      console.error('Failed to load notifications', err)
    }
  }

  useEffect(() => {
    let cancelled = false
    const init = async () => {
      setLoading(true)
      await Promise.all([loadWishlist(), loadPackages(), loadHotels(), loadReviews(), loadNotifications()])
      if (!cancelled) setLoading(false)
    }
    init()
    return () => { cancelled = true }
  }, [])

  const addToWishlist = async (packageId) => {
    try {
      await api('/customer/wishlist', {
        method: 'POST',
        body: JSON.stringify({ packageId })
      })
      await loadWishlist()
    } catch (err) {
      alert(err.message || 'Failed to add to wishlist')
    }
  }

  const addHotelToWishlist = async (hotelId) => {
    try {
      await api('/customer/wishlist', {
        method: 'POST',
        body: JSON.stringify({ hotelId, itemType: 'hotel' })
      })
      await loadWishlist()
    } catch (err) {
      alert(err.message || 'Failed to add hotel to wishlist')
    }
  }

  const removeFromWishlist = async (id) => {
    try {
      await api(`/customer/wishlist/${id}`, { method: 'DELETE' })
      await loadWishlist()
    } catch (err) {
      alert(err.message || 'Failed to remove from wishlist')
    }
  }

  const togglePriceAlert = async (id, enabled, targetPrice) => {
    try {
      await api(`/customer/wishlist/${id}/alerts`, {
        method: 'PUT',
        body: JSON.stringify({ priceAlertEnabled: enabled, targetPrice })
      })
      await loadWishlist()
    } catch (err) {
      alert(err.message || 'Failed to update price alert')
    }
  }

  const handleAlertLabelClick = (id, enabled, targetPrice, e) => {
    if (e.target.tagName === 'INPUT') return
    togglePriceAlert(id, !enabled, targetPrice || '')
  }

  const submitReview = async (e) => {
    e.preventDefault()
    if (!reviewForm.packageName || !reviewForm.comment) {
      alert('Please fill in package and comment')
      return
    }
    setSaving(true)
    try {
      await api('/customer/reviews', {
        method: 'POST',
        body: JSON.stringify(reviewForm)
      })
      await loadReviews()
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
      await loadReviews()
    } catch (err) {
      alert(err.message || 'Failed to delete review')
    }
  }

  const markAsRead = async (id) => {
    try {
      await api(`/customer/notifications/${id}/read`, { method: 'PUT' })
      await loadNotifications()
    } catch (err) {
      alert(err.message || 'Failed to mark as read')
    }
  }

  const markAllAsRead = async () => {
    try {
      await api('/customer/notifications/read-all', { method: 'PUT' })
      await loadNotifications()
    } catch (err) {
      alert(err.message || 'Failed to mark all as read')
    }
  }

  const deleteNotification = async (id) => {
    if (!window.confirm('Delete this notification?')) return
    try {
      await api(`/customer/notifications/${id}`, { method: 'DELETE' })
      await loadNotifications()
    } catch (err) {
      alert(err.message || 'Failed to delete notification')
    }
  }

  const getCategoryBadge = (category) => {
    const badges = {
      beach: { label: 'Beach', color: '#0e7490' },
      nature: { label: 'Nature', color: '#15803d' },
      adventure: { label: 'Adventure', color: '#b45309' },
      heritage: { label: 'Heritage', color: '#6d28d9' },
      hotel: { label: 'Hotel', color: '#2563eb' }
    }
    return badges[category] || { label: 'Tour', color: '#475569' }
  }

  const renderStars = (rating) => {
    return Array.from({ length: 5 }, (_, i) => (
      <Star key={i} className={`h-4 w-4 ${i < rating ? 'fill' : ''}`} />
    ))
  }

  const isItemInWishlist = (id, type) => {
    return wishlist.some(i => (type === 'package' ? (i.packageId === id || i.itemId === id) : (i.hotelId === id || i.itemId === id)))
  }

  const unreadCount = notifications.filter(n => !n.read).length

  if (loading) {
    return (
      <CustomerLayout active="wishlist">
        <div className="page-head">
          <div className="page-head-row">
            <div>
              <h1>Wishlist & updates</h1>
              <p>Saved trips, reviews, and notifications</p>
            </div>
          </div>
        </div>
        <div className="cd-card" style={{ textAlign: 'center', padding: '3rem' }}>
          <Sparkles className="h-6 w-6 animate-spin" style={{ color: '#64748b' }} />
          <p style={{ color: '#64748b', marginTop: '0.5rem' }}>Loading your wishlist...</p>
        </div>
      </CustomerLayout>
    )
  }

  const availablePackages = packages.filter(pkg => !isItemInWishlist(pkg._id, 'package'))
  const availableHotels = hotels.filter(hotel => !isItemInWishlist(hotel._id, 'hotel'))

  return (
    <CustomerLayout active="wishlist">
      <div className="page-head">
        <div className="page-head-row">
          <div>
            <h1>Wishlist & updates</h1>
            <p>Saved trips, reviews, and notifications</p>
          </div>
          <div className="page-status-badges">
            <div className="stat-badge">
              <Heart className="h-4 w-4" />
              <span>{wishlist.length} saved</span>
            </div>
            <div className="stat-badge">
              <Bell className="h-4 w-4" />
              <span>{unreadCount} new</span>
            </div>
          </div>
        </div>
      </div>

      {error && <div className="cd-card cd-alert warning" style={{ marginBottom: '1rem' }}>{error}</div>}

      <div className="tabs enhanced">
        <button
          className={`tab-btn ${activeTab === 'wishlist' ? 'active' : ''}`}
          onClick={() => setActiveTab('wishlist')}
        >
          <Heart className="h-4 w-4" /> Wishlist ({wishlist.length})
        </button>
        <button
          className={`tab-btn ${activeTab === 'reviews' ? 'active' : ''}`}
          onClick={() => setActiveTab('reviews')}
        >
          <Star className="h-4 w-4" /> Reviews ({reviews.length})
        </button>
        <button
          className={`tab-btn ${activeTab === 'notifications' ? 'active' : ''}`}
          onClick={() => setActiveTab('notifications')}
        >
          <Bell className="h-4 w-4" /> Notifications ({unreadCount} new)
        </button>
      </div>

      {activeTab === 'wishlist' && (
        <>
          <div className="wishlist-add-section enhanced">
            <h3 style={{ margin: '0 0 1rem 0', fontSize: '1rem' }}>Add to Wishlist</h3>
            <div className="wishlist-add-grid enhanced">
              {availablePackages.map(pkg => (
                <div key={pkg._id} className="wishlist-add-card enhanced">
                  <div className="wishlist-image enhanced">
                    {pkg.image ? (
                      <img className="cp-cover" src={pkg.image} alt={pkg.name} />
                    ) : (
                      <Star className="h-8 w-8" style={{ color: '#cbd5e1' }} />
                    )}
                  </div>
                  <div className="wishlist-content enhanced">
                    <h4>{pkg.name}</h4>
                    <div className="wishlist-location enhanced">
                      <MapIcon className="h-4 w-4" />
                      <span>{pkg.destination || 'Unknown'}</span>
                    </div>
                    <div className="wishlist-price enhanced">
                      <strong>₹{Number(pkg.price || 0).toLocaleString()}</strong>
                    </div>
                    <button onClick={() => addToWishlist(pkg._id)} className="btn-secondary enhanced" style={{ marginTop: '0.5rem', width: '100%' }}>
                      <Heart className="h-4 w-4" /> Add
                    </button>
                  </div>
                </div>
              ))}
              {availableHotels.map(hotel => (
                <div key={`hotel-${hotel._id}`} className="wishlist-add-card enhanced">
                  <div className="wishlist-image enhanced">
                    {hotel.image ? (
                      <img className="cp-cover" src={hotel.image} alt={hotel.name} />
                    ) : (
                      <Star className="h-8 w-8" style={{ color: '#cbd5e1' }} />
                    )}
                  </div>
                  <div className="wishlist-content enhanced">
                    <h4>{hotel.name}</h4>
                    <div className="wishlist-location enhanced">
                      <MapIcon className="h-4 w-4" />
                      <span>{hotel.location || 'Unknown'}</span>
                    </div>
                    <div className="wishlist-price enhanced">
                      <strong>₹{Number(hotel.minPrice || hotel.price || 0).toLocaleString()} {hotel.minPrice ? '/ night' : ''}</strong>
                    </div>
                    <button onClick={() => addHotelToWishlist(hotel._id)} className="btn-secondary enhanced" style={{ marginTop: '0.5rem', width: '100%' }}>
                      <Heart className="h-4 w-4" /> Add Hotel
                    </button>
                  </div>
                </div>
              ))}
              {availablePackages.length === 0 && availableHotels.length === 0 && (
                <p style={{ color: '#64748b', gridColumn: '1 / -1', textAlign: 'center' }}>All packages and hotels are already in your wishlist.</p>
              )}
            </div>
          </div>

          {wishlist.length === 0 ? (
            <div className="cd-card cp-empty" style={{ textAlign: 'center', padding: '3rem' }}>
              <Heart className="h-10 w-10" style={{ color: '#cbd5e1', marginBottom: '1rem' }} />
              <h3>Your wishlist is empty</h3>
              <p style={{ color: '#64748b' }}>Save packages or hotels above to track them and receive price alerts.</p>
            </div>
          ) : (
            <div className="wishlist-grid enhanced">
              {wishlist.map((item) => {
                const categoryBadge = getCategoryBadge(item.category || 'tour')
                const isHotel = item.itemType === 'hotel' || Boolean(item.hotelId)
                const belowTarget = item.targetPrice && item.price <= item.targetPrice
                return (
                  <div key={item._id} className="wishlist-card enhanced">
                    <div className="wishlist-image enhanced">
                      <div className="wishlist-emoji-wrapper">
                        {item.image ? (
                          <img className="cp-cover" src={item.image} alt={item.name || item.packageName || item.hotelName} />
                        ) : (
                          <Star className="h-12 w-12" style={{ color: '#cbd5e1' }} />
                        )}
                      </div>
                      <div className="wishlist-category-badge">
                        <span className="badge-dot" style={{ backgroundColor: categoryBadge.color }} />
                        <span>{categoryBadge.label}</span>
                      </div>
                    </div>
                    <div className="wishlist-content enhanced">
                      <h3>{item.name || item.packageName || item.hotelName || 'Saved item'}</h3>
                      <div className="wishlist-location enhanced">
                        <MapIcon className="h-4 w-4" />
                        <span>{item.location || item.destination || 'Unknown'}</span>
                      </div>
                      <div className="wishlist-meta">
                        <span className="meta-item">
                          <Calendar className="h-4 w-4" />
                          <small>Added {item.addedAt ? new Date(item.addedAt).toLocaleDateString() : 'recently'}</small>
                        </span>
                      </div>

                      <div className={`wishlist-price-alerts-section ${belowTarget ? 'below-target' : ''}`}>
                        <div className="current-price">
                          <span className="amount">₹{Number(item.price || 0).toLocaleString()}{isHotel ? '/ night' : ''}</span>
                          <span className="label">{belowTarget ? 'BELOW TARGET' : 'Current price'}</span>
                        </div>
                        {item.targetPrice && (
                          <div className="target-price">
                            <Star className="h-3 w-3" style={{ color: '#94a3b8' }} />
                            <span>Target: ₹{Number(item.targetPrice).toLocaleString()}</span>
                          </div>
                        )}
                        <div className="alert-controls">
                          <label className={`alert-toggle ${item.priceAlertEnabled ? 'enabled' : ''}`} onClick={(e) => handleAlertLabelClick(item._id, item.priceAlertEnabled, item.targetPrice, e)}>
                            <input
                              type="checkbox"
                              checked={Boolean(item.priceAlertEnabled)}
                              onChange={(e) => togglePriceAlert(item._id, e.target.checked, item.targetPrice || '')}
                            />
                            <span className="label">Price alerts</span>
                          </label>
                          <div className="target-input-wrapper">
                            <input
                              type="number"
                              placeholder="Target price"
                              defaultValue={item.targetPrice || ''}
                              onBlur={(e) => togglePriceAlert(item._id, item.priceAlertEnabled, e.target.value)}
                            />
                          </div>
                        </div>
                      </div>

                      <div className="wishlist-footer enhanced">
                        <div className="wishlist-price enhanced">
                          <small>Starting from</small>
                          <strong style={{ color: 'var(--customer-primary-teal)' }}>
                            {item.price ? '₹' + item.price.toLocaleString() + (isHotel ? '/ night' : '') : 'Price on request'}
                          </strong>
                        </div>
                        <div className="wishlist-actions">
                          <Link
                            to={isHotel ? '/customer/hotels' : `/customer/packages?destination=${encodeURIComponent(item.name || item.packageName || '')}`}
                            state={!isHotel ? { package: { name: item.name || item.packageName, price: item.price, _id: item.packageId || item.itemId } } : undefined}
                            className="btn-primary enhanced"
                          >
                            {isHotel ? 'View Hotel' : 'View Package'}
                          </Link>
                          <button
                            onClick={() => removeFromWishlist(item._id)}
                            className="icon-btn delete"
                            title="Remove from wishlist"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </>
      )}

      {activeTab === 'reviews' && (
        <div className="reviews-section enhanced">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <div>
              <h3 style={{ margin: 0 }}>Your Reviews</h3>
              <p style={{ margin: '0.25rem 0 0 0', color: '#64748b' }}>{reviews.length} review{reviews.length !== 1 ? 's' : ''} submitted</p>
            </div>
            <button
              onClick={() => setShowReviewModal(true)}
              className="btn-primary enhanced"
            >
              <Plus className="h-4 w-4" /> Write a Review
            </button>
          </div>
          <div className="reviews-list enhanced">
            {reviews.length === 0 ? (
              <div className="cd-empty">No reviews yet.</div>
            ) : (
              reviews.map(review => (
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
                      <Clock className="h-4 w-4" />
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
            {notifications.length === 0 ? (
              <div className="cd-empty">No notifications yet.</div>
            ) : (
              notifications.map(notif => (
                <div key={notif._id} className={`notification-card enhanced ${!notif.read ? 'unread' : ''}`}>
                  <div className="notification-icon enhanced" style={{ backgroundColor: 'var(--customer-primary-teal)' }}>
                    <Bell className="h-4 w-4" />
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
        <div className="modal-overlay" onClick={() => setShowReviewModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
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
                      setReviewForm({ ...reviewForm, packageId: selectedId, packageName: selectedPkg ? selectedPkg.name : '' })
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
                    onChange={(e) => setReviewForm({ ...reviewForm, rating: Number(e.target.value) })}
                  >
                    {[5, 4, 3, 2, 1].map(n => (
                      <option key={n} value={n}>
                        {n} Star{n !== 1 ? 's' : ''}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label>Your Review</label>
                  <textarea
                    rows="4"
                    placeholder="Share your experience..."
                    value={reviewForm.comment}
                    onChange={(e) => setReviewForm({ ...reviewForm, comment: e.target.value })}
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

export default Wishlist
