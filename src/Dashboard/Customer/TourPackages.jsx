import { useEffect, useMemo, useState } from 'react'
import { MapPin, Users, Star, Heart, Search, ArrowRight, Clock, Sparkles, Check, Zap, Shield, Award } from 'lucide-react'
import { Link } from 'react-router-dom'
import CustomerLayout from './CustomerLayout'
import { api } from '../../api'
import '../Dashboard.css'

const FALLBACK_IMAGE = 'https://images.unsplash.com/photo-1488646953014-85cb44e25828?auto=format&fit=crop&w=1200&q=80'
const WISHLIST_KEY = 'customerWishlist'

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

  useEffect(() => {
    const load = async () => {
      try {
        setError('')
        const data = await api('/packages?publishedOnly=true')
        setPackages(data.packages || [])
      } catch (err) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

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

  const filteredPackages = normalized.filter(pkg => {
    const matchesSearch = pkg.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         pkg.destination.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesPrice = filterPrice === 'all' ||
                        (filterPrice === 'low' && pkg.price < 20000) ||
                        (filterPrice === 'medium' && pkg.price >= 20000 && pkg.price < 35000) ||
                        (filterPrice === 'high' && pkg.price >= 35000)
    const matchesDuration = filterDuration === 'all' ||
                          (filterDuration === 'short' && pkg.durationDays <= 4) ||
                          (filterDuration === 'medium' && pkg.durationDays > 4 && pkg.durationDays <= 6) ||
                          (filterDuration === 'long' && pkg.durationDays > 6)
    return matchesSearch && matchesPrice && matchesDuration
  })

  const toggleFavorite = (id) => {
    setFavorites(prev =>
      prev.includes(id) ? prev.filter(f => f !== id) : [...prev, id]
    )
  }

  const getCategoryBadge = (category) => {
    const badges = {
      beach: { label: 'Beach', color: '#0e7490' },
      nature: { label: 'Nature', color: '#15803d' },
      adventure: { label: 'Adventure', color: '#b45309' },
      heritage: { label: 'Heritage', color: '#6d28d9' },
      hill: { label: 'Hill Station', color: '#0369a1' },
      city: { label: 'City', color: '#475569' }
    }
    return badges[category] || { label: 'Tour', color: '#475569' }
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
            <span>{normalized.length} packages</span>
          </div>
          <div className="stat-badge">
            <Award className="h-4 w-4" />
            <span>Best price guarantee</span>
          </div>
        </div>
      }
    >
      {error && <div className="error-message">{error}</div>}

      <div className="package-section-header">
        <div className="lead">
          <h2>Find your next journey</h2>
          <p>Curated tour packages from verified operators. Filter by price, duration or destination to narrow down your pick.</p>
        </div>
        <div className="result-count">
          <strong>{filteredPackages.length}</strong>
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
            <label>Price Range</label>
            <select
              value={filterPrice}
              onChange={(e) => setFilterPrice(e.target.value)}
              className="filter-select"
            >
              <option value="all">All Prices</option>
              <option value="low">Under ₹20,000</option>
              <option value="medium">₹20,000 - ₹35,000</option>
              <option value="high">Above ₹35,000</option>
            </select>
          </div>
          <div className="filter-group">
            <label>Duration</label>
            <select
              value={filterDuration}
              onChange={(e) => setFilterDuration(e.target.value)}
              className="filter-select"
            >
              <option value="all">All Durations</option>
              <option value="short">Short (≤4 days)</option>
              <option value="medium">Medium (5-6 days)</option>
              <option value="long">Long (7+ days)</option>
            </select>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="cp-loading">Loading packages…</div>
      ) : filteredPackages.length === 0 ? (
        <div className="cp-empty-state">
          <Award className="h-12 w-12" />
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
                    <div className="package-difficulty-badge" style={{ backgroundColor: '#22c55e' }}>
                      <Zap className="h-3 w-3" />
                      <span>{pkg.difficulty}</span>
                    </div>
                  </div>
                </div>
                <div className="package-content enhanced">
                  <div className="package-header enhanced">
                    <h3>{pkg.name}</h3>
                    <div className="package-rating enhanced">
                      <Star className="h-4 w-4 fill" />
                      <span>{pkg.rating.toFixed(1)}</span>
                    </div>
                  </div>
                  <div className="package-destination enhanced">
                    <MapPin className="h-4 w-4" />
                    <span>{pkg.destination}</span>
                  </div>

                  {pkg.highlights.length > 0 && (
                    <div className="package-highlights">
                      <h4>Package Highlights</h4>
                      <div className="highlights-grid">
                        {pkg.highlights.slice(0, 4).map((highlight, idx) => (
                          <span key={idx} className="highlight-tag">
                            <Sparkles className="h-3 w-3" />
                            {highlight}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="package-meta enhanced">
                    <span className="meta-item">
                      <Clock className="h-4 w-4" />
                      <div>
                        <small>Duration</small>
                        <strong>{pkg.duration}</strong>
                      </div>
                    </span>
                    <span className="meta-item">
                      <Users className="h-4 w-4" />
                      <div>
                        <small>Group Size</small>
                        <strong>Max {pkg.maxPeople}</strong>
                      </div>
                    </span>
                  </div>

                  {pkg.inclusions.length > 0 && (
                    <div className="package-inclusions enhanced">
                      <h4>What's Included</h4>
                      <div className="inclusions-list">
                        {pkg.inclusions.map((inc, idx) => (
                          <span key={idx} className="inclusion-item">
                            <Check className="h-3 w-3" />
                            {inc}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="package-footer enhanced">
                    <div className="package-price enhanced">
                      <div>
                        <small>Per person</small>
                        <strong>₹{pkg.price.toLocaleString()}</strong>
                      </div>
                    </div>
                    <div className="package-features">
                      <span className="feature-badge">
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
    </CustomerLayout>
  )
}

export default TourPackages
