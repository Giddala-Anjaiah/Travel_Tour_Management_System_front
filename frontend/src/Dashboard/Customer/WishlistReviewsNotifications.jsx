import { useRef, useState, useEffect } from 'react'
import { Heart, Star, Bell, Search, Trash2, Check, Calendar, Sparkles, Shield, Award, Clock, CheckCircle, AlertCircle, Star as StarIcon, Bell as BellIcon, MapPin as MapIcon, Plus } from 'lucide-react'
import { Link } from 'react-router-dom'
import CustomerLayout from './CustomerLayout'
import { api, readPagination } from '../../api'
import Pagination from '../../components/Pagination'
import '../Dashboard.css'

const emptyMeta = { page: 1, limit: 10, total: 0, totalPages: 1, hasNext: false, hasPrev: false }

const WishlistReviewsNotifications = () => {
  const [activeTab, setActiveTab] = useState('wishlist')
  const [searchTerm, setSearchTerm] = useState('')
  const [showReviewModal, setShowReviewModal] = useState(false)

  // Each tab pages independently — switching tabs never shares or resets
  // another tab's position in its own list.
  const [pages, setPages] = useState({ wishlist: 1, reviews: 1, notifications: 1 })
  const [limits, setLimits] = useState({ wishlist: 10, reviews: 10, notifications: 10 })
  const [metas, setMetas] = useState({ wishlist: emptyMeta, reviews: emptyMeta, notifications: emptyMeta })
  const [wishlistStats, setWishlistStats] = useState(null)
  const [wishlistSynced, setWishlistSynced] = useState(false)

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
  const localWishlistRef = useRef([])

  const loadPackages = async () => {
    try {
      const data = await api('/packages', { params: { limit: 'all' } })
      setPackages(data.packages || [])
    } catch (err) {
      console.error('Failed to load packages', err)
    }
  }

  const loadWishlist = async (page = pages.wishlist, limit = limits.wishlist) => {
    try {
      const data = await api('/customer/wishlist', { params: { page, limit, search: searchTerm } })
      const backendWishlist = data.wishlist || []
      const next = readPagination(data, backendWishlist.length)
      setMetas(prev => ({ ...prev, wishlist: next }))
      if (data.stats) setWishlistStats(data.stats)
      let merged = [...backendWishlist]
      // Legacy localStorage favourites are pushed to the server once, on the first
      // page only, so paging never re-posts them.
      if (!wishlistSynced && page === 1) {
        setWishlistSynced(true)
        try {
          const localWishlist = JSON.parse(localStorage.getItem('customerWishlist') || '[]')
          const backendPackageIds = (backendWishlist.map(item => item.packageId) || []).filter(Boolean)
          for (const localItem of localWishlist) {
            if (!backendPackageIds.includes(localItem._id)) {
              try {
                await api('/customer/wishlist', {
                  method: 'POST',
                  body: JSON.stringify({ packageId: localItem._id })
                })
                const pkg = packages.find(p => p._id === localItem._id)
                merged.push({
                  _id: localItem._id,
                  packageId: localItem._id,
                  packageName: pkg?.name || localItem.name || '',
                  destination: pkg?.destination || '',
                  image: pkg?.image || '',
                  price: pkg?.price || localItem.price || 0,
                  rating: pkg?.rating || 0,
                  category: pkg?.category || 'tour',
                  addedAt: new Date().toISOString()
                })
              } catch (syncErr) {
                console.error('Failed to sync local wishlist item', syncErr)
              }
            }
          }
        } catch (parseErr) {
          console.error('Failed to parse local wishlist', parseErr)
        }
      }
      setWishlist(merged)
      localWishlistRef.current = merged.map(item => ({
        _id: item.packageId || item._id,
        name: item.packageName,
        price: item.price
      }))
      localStorage.setItem('customerWishlist', JSON.stringify(localWishlistRef.current))
    } catch (err) {
      console.error('Failed to load wishlist', err)
    }
  }

  const addToWishlist = async (packageId) => {
    try {
      await api('/customer/wishlist', {
        method: 'POST',
        body: JSON.stringify({ packageId })
      })
      alert('Added to wishlist!')
      await loadWishlist()
    } catch (err) {
      alert(err.message || 'Failed to add to wishlist')
    }
  }

  const loadReviews = async (page = pages.reviews, limit = limits.reviews) => {
    try {
      const data = await api('/customer/reviews', { params: { page, limit, search: searchTerm } })
      const rows = data.reviews || []
      setReviews(rows)
      setMetas(prev => ({ ...prev, reviews: readPagination(data, rows.length) }))
    } catch (err) {
      console.error('Failed to load reviews', err)
    }
  }

  const loadNotifications = async (page = pages.notifications, limit = limits.notifications) => {
    try {
      const data = await api('/customer/notifications', { params: { page, limit, search: searchTerm } })
      const rows = data.notifications || []
      setNotifications(rows)
      setMetas(prev => ({ ...prev, notifications: readPagination(data, rows.length) }))
    } catch (err) {
      console.error('Failed to load notifications', err)
    }
  }

  // Every tab supports `search` server-side, so the shared search box refetches
  // all three tabs at their own current page whenever it (or a page) changes.
  useEffect(() => {
    Promise.resolve().then(() => {
      setLoading(true)
      setError('')
      return Promise.all([loadWishlist(), loadReviews(), loadNotifications(), loadPackages()])
    })
      .catch((err) => setError(err.message || 'Failed to load data'))
      .finally(() => setLoading(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pages, limits, searchTerm, activeTab])

  const handlePageChange = (tab) => (nextPage) => {
    setPages(prev => ({ ...prev, [tab]: nextPage }))
    setLoading(true)
  }

  const handleLimitChange = (tab) => (nextLimit) => {
    setLimits(prev => ({ ...prev, [tab]: nextLimit }))
    setPages(prev => ({ ...prev, [tab]: 1 }))
    setLoading(true)
  }

  // Deleting the only row on a page steps back one page instead of showing nothing.
  const stepBackAfterDelete = (tab, rows) => {
    if (pages[tab] > 1 && rows.length <= 1) {
      setLoading(true)
      setPages(prev => ({ ...prev, [tab]: prev[tab] - 1 }))
      return true
    }
    return false
  }

  const removeFromWishlist = async (id) => {
    if (!window.confirm('Remove this item from wishlist?')) return
    try {
      await api(`/customer/wishlist/${id}`, { method: 'DELETE' })
      if (!stepBackAfterDelete('wishlist', wishlist)) await loadWishlist()
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
      void data
      await Promise.all([loadReviews(), loadNotifications()])
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
      if (!stepBackAfterDelete('reviews', reviews)) await loadReviews()
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
      if (!stepBackAfterDelete('notifications', notifications)) await loadNotifications()
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

  // `search` is applied server-side on every one of these tabs.
  const filteredWishlist = wishlist
  const filteredReviews = reviews
  const filteredNotifications = notifications

  const wishlistTotal = wishlistStats?.total ?? metas.wishlist.total
  const unreadCount = notifications.filter(n => !n.read).length

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
            <span>{wishlistTotal} saved</span>
          </div>
          <div className="stat-badge">
            <BellIcon className="h-4 w-4" />
            <span>{unreadCount} new</span>
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
          <Heart className="h-4 w-4" /> Wishlist ({wishlistTotal})
        </button>
        <button
          className={`tab-btn ${activeTab === 'reviews' ? 'active' : ''}`}
          onClick={() => switchTab('reviews')}
        >
          <Star className="h-4 w-4" /> Reviews ({metas.reviews.total})
        </button>
        <button
          className={`tab-btn ${activeTab === 'notifications' ? 'active' : ''}`}
          onClick={() => switchTab('notifications')}
        >
          <Bell className="h-4 w-4" /> Notifications ({unreadCount} new)
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
        <>
          <div className="wishlist-section enhanced">
          <div className="wishlist-add-section enhanced">
            <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '1rem' }}>Add to Wishlist</h3>
            <div className="wishlist-add-grid enhanced">
              {packages.filter(pkg => !wishlist.some(w => w.packageId === pkg._id)).map(pkg => (
                <div key={pkg._id} className="wishlist-add-card enhanced">
                  <div className="wishlist-image enhanced" style={{ height: '120px' }}>
                    {pkg.image ? <img className="cp-cover" src={pkg.image} alt={pkg.name} /> : <Star className="h-8 w-8" style={{ color: '#cbd5e1' }} />}
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
                    <button onClick={() => addToWishlist(pkg._id)} className="btn-secondary enhanced" style={{ marginTop: '0.5rem' }}>
                      <Heart className="h-4 w-4" /> Add
                    </button>
                  </div>
                </div>
              ))}
              {packages.filter(pkg => !wishlist.some(w => w.packageId === pkg._id)).length === 0 && (
                <p style={{ color: '#64748b' }}>All packages are in your wishlist or no packages available.</p>
              )}
            </div>
          </div>
        </div>
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
                        <Link to="/customer/bookings" state={{ package: { name: item.packageName, price: item.price, _id: item.packageId || item._id } }} className="btn-primary enhanced">
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
        <Pagination
          page={pages.wishlist}
          totalPages={metas.wishlist.totalPages}
          total={metas.wishlist.total}
          limit={metas.wishlist.limit}
          onPageChange={handlePageChange('wishlist')}
          onLimitChange={handleLimitChange('wishlist')}
          itemLabel="saved packages"
          disabled={loading}
        />
        </>
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
          <Pagination
            page={pages.reviews}
            totalPages={metas.reviews.totalPages}
            total={metas.reviews.total}
            limit={metas.reviews.limit}
            onPageChange={handlePageChange('reviews')}
            onLimitChange={handleLimitChange('reviews')}
            itemLabel="reviews"
            disabled={loading}
          />
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
          <Pagination
            page={pages.notifications}
            totalPages={metas.notifications.totalPages}
            total={metas.notifications.total}
            limit={metas.notifications.limit}
            onPageChange={handlePageChange('notifications')}
            onLimitChange={handleLimitChange('notifications')}
            itemLabel="notifications"
            disabled={loading}
          />
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