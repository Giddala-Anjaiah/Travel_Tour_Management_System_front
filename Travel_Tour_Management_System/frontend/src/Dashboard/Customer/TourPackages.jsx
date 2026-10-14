import { useEffect, useMemo, useState } from 'react'
import { MapPin, Users, Star, Heart, Search, ArrowRight, Clock, Sparkles, Check, Zap, Shield, Award, Info, AlertTriangle } from 'lucide-react'
import { Link } from 'react-router-dom'
import CustomerLayout from './CustomerLayout'
import { api, readPagination } from '../../api'
import Pagination from '../../components/Pagination'
import '../Dashboard.css'

const FALLBACK_IMAGE = 'https://images.unsplash.com/photo-1488646953014-85cb44e25828?auto=format&fit=crop&w=1200&q=80'
const WISHLIST_KEY = 'customerWishlist'

const CATEGORY_BADGES = {
  beach: { label: 'Beach', color: 'var(--cp-type-beach)' },
  nature: { label: 'Nature', color: 'var(--cp-type-nature)' },
  adventure: { label: 'Adventure', color: 'var(--cp-type-adventure)' },
  heritage: { label: 'Heritage', color: 'var(--cp-type-heritage)' },
  hill: { label: 'Hill Station', color: 'var(--cp-type-hill)' },
  city: { label: 'City', color: 'var(--cp-type-city)' }
}

const parseDurationDays = (duration) => {
  if (!duration) return 0
  const match = String(duration).match(/(\d+)/)
  return match ? Number(match[1]) : 0
}

const TourPackages = () => {
  const [packages, setPackages] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  const [filterPrice, setFilterPrice] = useState('all')
  const [filterDuration, setFilterDuration] = useState('all')
  const [favorites, setFavorites] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem(WISHLIST_KEY) || '[]')
    } catch {
      return []
    }
  })
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(12)
  const [meta, setMeta] = useState({ page: 1, limit: 12, total: 0, totalPages: 1, hasNext: false, hasPrev: false })

  // `/packages` filters server-side on `search` only. Price and duration bands are
  // not supported, so when either is active we ask for the full set and filter the
  // rendered rows locally instead of paging a partial match.
  const hasLocalFilters = filterPrice !== 'all' || filterDuration !== 'all'

  const fetchPackages = async (overrides = {}) => {
    const nextPage = overrides.page ?? page
    const nextLimit = overrides.limit ?? limit
    try {
      setError('')
      const data = await api('/packages', {
        params: {
          publishedOnly: 'true',
          page: hasLocalFilters ? undefined : nextPage,
          limit: hasLocalFilters ? 'all' : nextLimit,
          search: searchTerm
        }
      })
      setPackages(data.packages || [])
      const next = readPagination(data, data.packages?.length || 0)
      setMeta(next)
      // A delete or a shrinking dataset can strand us past the last page.
      if (!hasLocalFilters && next.totalPages > 0 && nextPage > next.totalPages) {
        setLoading(true)
        setPage(next.totalPages)
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    Promise.resolve().then(() => fetchPackages())
  }, [page, limit])

  // Fire-and-forget browsing signal for the recommendation engine.
  // Failures are swallowed on purpose — tracking must never break browsing.
  const trackActivity = (payload) => {
    api('/customer/activity', { method: 'POST', body: JSON.stringify(payload) }).catch(() => {})
  }

  useEffect(() => {
    const timer = setTimeout(() => {
      setPage(1)
      setLoading(true)
      fetchPackages({ page: 1 })
      const term = searchTerm.trim()
      if (term.length >= 2) {
        trackActivity({ activityType: 'PACKAGE_SEARCH', itemType: 'package', metadata: { term } })
      }
    }, 350)
    return () => clearTimeout(timer)
  }, [searchTerm, filterPrice, filterDuration])

  const handlePageChange = (nextPage) => {
    setPage(nextPage)
    setLoading(true)
  }

  const handleLimitChange = (nextLimit) => {
    setLimit(nextLimit)
    setPage(1)
    setLoading(true)
  }

  useEffect(() => {
    localStorage.setItem(WISHLIST_KEY, JSON.stringify(favorites))
  }, [favorites])

  const normalized = useMemo(() => packages.map((pkg) => ({
    id: pkg._id,
    name: pkg.name,
    destination: pkg.destination,
    image: pkg.image || (Array.isArray(pkg.images) && pkg.images[0]) || FALLBACK_IMAGE,
    duration: pkg.duration,
    durationDays: parseDurationDays(pkg.duration),
    price: Number(pkg.price) || 0,
    rating: Number(pkg.rating) || 0,
    inclusions: Array.isArray(pkg.inclusions) ? pkg.inclusions : [],
    maxPeople: pkg.maxTravelers || 20,
    highlights: Array.isArray(pkg.highlights) && pkg.highlights.length
      ? pkg.highlights
      : (Array.isArray(pkg.inclusions) ? pkg.inclusions.slice(0, 4) : []),
    difficulty: 'Easy',
    category: (pkg.category || '').toLowerCase() || 'tour'
  })), [packages])

  // `search` is applied server-side (name/destination/category), so only the
  // unsupported price/duration bands are resolved here.
  const filteredPackages = normalized.filter(pkg => {
    const matchesPrice = filterPrice === 'all' ||
                        (filterPrice === 'low' && pkg.price < 20000) ||
                        (filterPrice === 'medium' && pkg.price >= 20000 && pkg.price < 35000) ||
                        (filterPrice === 'high' && pkg.price >= 35000)
    const matchesDuration = filterDuration === 'all' ||
                          (filterDuration === 'short' && pkg.durationDays <= 4) ||
                          (filterDuration === 'medium' && pkg.durationDays > 4 && pkg.durationDays <= 6) ||
                          (filterDuration === 'long' && pkg.durationDays > 6)
    return matchesPrice && matchesDuration
  })

  const toggleFavorite = (id) => {
    setFavorites(prev =>
      prev.includes(id) ? prev.filter(f => f !== id) : [...prev, id]
    )
  }

  const getCategoryBadge = (category) => {
    return CATEGORY_BADGES[category] || { label: 'Tour', color: 'var(--cp-type-tour)' }
  }

  return (
    <CustomerLayout
      active="packages"
      title="Tour packages"
      subtitle="Curated experiences for every traveler"
      actions={
        <div className="header-stats">
          <div className="stat-badge">
            <Sparkles className="h-4 w-4" />
            <span>{meta.total} packages</span>
          </div>
          <div className="stat-badge">
            <Award className="h-4 w-4" />
            <span>Best price guarantee</span>
          </div>
        </div>
      }
    >
      {loading && <div className="cd-skeleton-grid">{[1,2,3,4,5,6].map(i => <div key={i} className="cd-skeleton-card" />)}</div>}
      {error && <div className="cd-card cd-alert warning" style={{ marginBottom: '1rem' }}>{error}</div>}

      <div className="cd-hero">
        <div className="cd-hero-copy">
          <p>Your next adventure</p>
          <h2>Tour Packages <span style={{ color: 'var(--cp-accent)' }}>🌍</span></h2>
          <span>Discover curated experiences from verified operators. Filter by price, duration or destination.</span>
        </div>
        <div className="cd-hero-stats">
          <div className="cd-hero-stat">
            <small>Total Packages</small>
            <strong>{meta.total}</strong>
          </div>
          <div className="cd-hero-stat">
            <small>Destinations</small>
            <strong>{new Set(normalized.map(p => p.destination)).size}</strong>
          </div>
          <div className="cd-hero-stat">
            <small>Saved</small>
            <strong>{favorites.length}</strong>
          </div>
          <div className="cd-hero-stat">
            <small>Avg Rating</small>
            <strong>{normalized.length ? (normalized.reduce((s, p) => s + p.rating, 0) / normalized.length).toFixed(1) : '—'}</strong>
          </div>
        </div>
      </div>

      <div className="package-section-header">
        <div className="lead">
          <h2>Find your next journey</h2>
          <p>Curated tour packages from verified operators. Filter by price, duration or destination to narrow down your pick.</p>
        </div>
        <div className="result-count">
          <strong>{hasLocalFilters ? filteredPackages.length : meta.total}</strong>
          {filteredPackages.length === 1 ? 'package' : 'packages'} available
        </div>
      </div>

      <div className="filters-section enhanced">
        <div className="search-bar enhanced">
          <Search className="search-icon" />
          <input
            type="text"
            placeholder="Search packages, destinations..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="filter-controls enhanced">
          <div className="filter-group">
            <label style={{ color: 'var(--cp-ink)' }}>Price Range</label>
            <select
              value={filterPrice}
              onChange={(e) => setFilterPrice(e.target.value)}
              className="filter-select"
              style={{ background: 'var(--cp-surface)', borderColor: 'var(--cp-line)', color: 'var(--cp-ink)' }}
            >
              <option value="all">All Prices</option>
              <option value="low">Under ₹20,000</option>
              <option value="medium">₹20,000 - ₹35,000</option>
              <option value="high">Above ₹35,000</option>
            </select>
          </div>
          <div className="filter-group">
            <label style={{ color: 'var(--cp-ink)' }}>Duration</label>
            <select
              value={filterDuration}
              onChange={(e) => setFilterDuration(e.target.value)}
              className="filter-select"
              style={{ background: 'var(--cp-surface)', borderColor: 'var(--cp-line)', color: 'var(--cp-ink)' }}
            >
              <option value="all">All Durations</option>
              <option value="short">Short (≤4 days)</option>
              <option value="medium">Medium (5-6 days)</option>
              <option value="long">Long (7+ days)</option>
            </select>
          </div>
        </div>
      </div>

      {filteredPackages.length === 0 ? (
        <div className="cd-card cp-empty">
          <Award className="cp-empty-icon" size={48} />
          <h3>No packages found</h3>
          <p>Try a different search or check back later for new tours.</p>
        </div>
      ) : (
        <div className="packages-grid enhanced">
          {filteredPackages.map(pkg => {
            const categoryBadge = getCategoryBadge(pkg.category)
            return (
              <div key={pkg.id} className="package-card enhanced">
                <div className="package-image enhanced">
                  <div className="package-emoji-wrapper">
                    <img className="cp-cover" src={pkg.image} alt={pkg.name}
                      onError={(e) => { e.currentTarget.src = FALLBACK_IMAGE }} />
                  </div>
                  <div className="cp-image-top">
                    <button
                      onClick={() => toggleFavorite(pkg.id)}
                      className={`favorite-btn enhanced ${favorites.includes(pkg.id) ? 'active' : ''}`}
                      aria-label="Toggle favorite"
                    >
                      <Heart />
                    </button>
                    <div className="package-category-badge" style={{ backgroundColor: categoryBadge.color }}>
                      <span>{categoryBadge.label}</span>
                    </div>
                    <div className="package-difficulty-badge" style={{ backgroundColor: 'var(--cp-success)' }}>
                      <Zap className="h-3 w-3" />
                      <span>{pkg.difficulty}</span>
                    </div>
                  </div>
                </div>
                <div className="package-content enhanced">
                  <div className="package-header enhanced">
                    <h3 style={{ color: 'var(--cp-ink)' }}>{pkg.name}</h3>
                    <div className="package-rating enhanced">
                      <Star className="h-4 w-4 fill" style={{ color: 'var(--cp-gold)' }} />
                      <span style={{ color: 'var(--cp-ink)' }}>{pkg.rating.toFixed(1)}</span>
                    </div>
                  </div>
                  <div className="package-destination enhanced">
                    <MapPin className="h-4 w-4" style={{ color: 'var(--cp-accent)' }} />
                    <span style={{ color: 'var(--cp-muted)' }}>{pkg.destination}</span>
                  </div>

                  {pkg.highlights.length > 0 && (
                    <div className="package-highlights">
                      <h4 style={{ color: 'var(--cp-ink)' }}>Package Highlights</h4>
                      <div className="highlights-grid">
                        {pkg.highlights.slice(0, 4).map((highlight, idx) => (
                          <span key={idx} className="highlight-tag" style={{ background: 'var(--cp-surface)', color: 'var(--cp-ink)', borderColor: 'var(--cp-line)' }}>
                            <Sparkles className="h-3 w-3" style={{ color: 'var(--cp-accent)' }} />
                            {highlight}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="package-meta enhanced" style={{ borderTopColor: 'var(--cp-line)' }}>
                    <span className="meta-item">
                      <Clock className="h-4 w-4" style={{ color: 'var(--cp-accent)' }} />
                      <div>
                        <small style={{ color: 'var(--cp-muted)' }}>Duration</small>
                        <strong style={{ color: 'var(--cp-ink)' }}>{pkg.duration}</strong>
                      </div>
                    </span>
                    <span className="meta-item">
                      <Users className="h-4 w-4" style={{ color: 'var(--cp-purple)' }} />
                      <div>
                        <small style={{ color: 'var(--cp-muted)' }}>Group Size</small>
                        <strong style={{ color: 'var(--cp-ink)' }}>Max {pkg.maxPeople}</strong>
                      </div>
                    </span>
                  </div>

                  {pkg.inclusions.length > 0 && (
                    <div className="package-inclusions enhanced" style={{ borderTopColor: 'var(--cp-line)' }}>
                      <h4 style={{ color: 'var(--cp-ink)' }}>What's Included</h4>
                      <div className="inclusions-list">
                        {pkg.inclusions.map((inc, idx) => (
                          <span key={idx} className="inclusion-item" style={{ background: 'var(--cp-surface)', color: 'var(--cp-ink)', borderColor: 'var(--cp-line)' }}>
                            <Check className="h-3 w-3" style={{ color: 'var(--cp-success)' }} />
                            {inc}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {pkg.cancellationPolicy && pkg.cancellationPolicy.enabled && pkg.cancellationPolicy.rules && pkg.cancellationPolicy.rules.length > 0 && (
                    <div className="package-cancellation-policy" style={{ marginTop: '1rem', padding: '0.75rem', background: 'rgba(245, 158, 11, 0.1)', border: '1px solid rgba(245, 158, 11, 0.3)', borderRadius: '0.5rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem', color: 'var(--cp-warning)' }}>
                        <AlertTriangle className="h-4 w-4" />
                        <strong>Cancellation Policy</strong>
                      </div>
                      <div style={{ fontSize: '0.85rem', color: 'var(--cp-muted)' }}>
                        {pkg.cancellationPolicy.rules
                          .sort((a, b) => b.minDaysBeforeTrip - a.minDaysBeforeTrip)
                          .map((rule, idx) => (
                            <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.25rem 0' }}>
                              <span>{rule.minDaysBeforeTrip}+ days before trip</span>
                              <strong>{rule.refundPercentage}% refund</strong>
                            </div>
                          ))}
                      </div>
                    </div>
                  )}

                  <div className="package-footer enhanced" style={{ borderTopColor: 'var(--cp-line)' }}>
                    <div className="package-price enhanced">
                      <div>
                        <small style={{ color: 'var(--cp-muted)' }}>Per person</small>
                        <strong style={{ color: 'var(--cp-ink)' }}>₹{pkg.price.toLocaleString()}</strong>
                      </div>
                    </div>
                    <div className="package-features">
                      <span className="feature-badge" style={{ background: 'rgba(16, 185, 129, 0.1)', color: 'var(--cp-success)', borderColor: 'rgba(16, 185, 129, 0.3)' }}>
                        <Shield className="h-3 w-3" />
                        Secure Booking
                      </span>
                    </div>
                    <Link
                      to={`/customer/bookings?packageId=${pkg.id}`}
                      state={{ package: pkg }}
                      className="btn-primary enhanced"
                    >
                      Book Now <ArrowRight className="h-4 w-4" />
                    </Link>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      <Pagination
        page={page}
        totalPages={meta.totalPages}
        total={hasLocalFilters ? filteredPackages.length : meta.total}
        limit={meta.limit}
        onPageChange={handlePageChange}
        onLimitChange={handleLimitChange}
        itemLabel="packages"
        disabled={loading}
      />
    </CustomerLayout>
  )
}

export default TourPackages