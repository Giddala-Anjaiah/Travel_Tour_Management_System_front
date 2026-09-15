import { useState, useEffect } from 'react'
import { Search, Star, Heart, Calendar, Users, ArrowRight, Compass, Mountain, Leaf, Landmark, Waves, Sparkles } from 'lucide-react'
import { Link } from 'react-router-dom'
import CustomerLayout from './CustomerLayout'
import { api } from '../../api'
import '../Dashboard.css'

const TYPE_ICONS = {
  beach: Waves,
  nature: Leaf,
  adventure: Mountain,
  heritage: Landmark
}

const DestinationExploration = () => {
  const [searchTerm, setSearchTerm] = useState('')
  const [filterType, setFilterType] = useState('all')
  const [favorites, setFavorites] = useState([])
  const [packages, setPackages] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    const load = async () => {
      try {
        setError('')
        const data = await api('/packages?publishedOnly=true')
        setPackages(data.packages || [])
      } catch (err) {
        setError(err.message || 'Failed to load destinations')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const destinations = packages.map(pkg => ({
    id: pkg._id,
    name: pkg.destination || pkg.name,
    photo: pkg.image || (Array.isArray(pkg.images) && pkg.images[0]) || 'https://images.unsplash.com/photo-1488646953014-85cb44e25828?auto=format&fit=crop&w=1200&q=80',
    type: pkg.category || 'tour',
    rating: Number(pkg.rating) || 4.5,
    price: Number(pkg.price) || 0,
    duration: pkg.duration || '3 Days',
    description: pkg.shortDescription || pkg.description || 'Explore this amazing destination',
    highlights: Array.isArray(pkg.highlights) ? pkg.highlights.slice(0, 4) : [],
    bestTime: 'October - March',
    packageName: pkg.name
  }))

  const filteredDestinations = destinations.filter((dest) => {
    const matchesSearch =
      (dest.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (dest.description || '').toLowerCase().includes(searchTerm.toLowerCase())
    const matchesType = filterType === 'all' || dest.type === filterType
    return matchesSearch && matchesType
  })

  const toggleFavorite = (id) => {
    setFavorites((prev) => (prev.includes(id) ? prev.filter((f) => f !== id) : [...prev, id]))
  }

  const getTypeLabel = (type) => {
    const labels = {
      beach: 'Beach',
      nature: 'Nature',
      adventure: 'Adventure',
      heritage: 'Heritage',
      tour: 'Tour'
    }
    return labels[type] || type
  }

  const getTypeColor = (type) => {
    const colors = {
      beach: '#0e7490',
      nature: '#15803d',
      adventure: '#b45309',
      heritage: '#6d28d9',
      tour: '#475569'
    }
    return colors[type] || '#475569'
  }

  const types = [
    { id: 'all', label: 'All destinations' },
    { id: 'beach', label: 'Beach' },
    { id: 'nature', label: 'Nature' },
    { id: 'adventure', label: 'Adventure' },
    { id: 'heritage', label: 'Heritage' }
  ]

  const IconComponent = (type) => TYPE_ICONS[type] || Compass

  return (
    <CustomerLayout
      active="dashboard"
      title="Explore destinations"
      subtitle="Handpicked places for your next journey"
      actions={
        <div className="header-stats">
          <div className="stat-badge">
            <Sparkles className="h-4 w-4" />
            <span>{destinations.length} destinations</span>
          </div>
        </div>
      }
    >
      {loading && <div className="cd-card" style={{ textAlign: 'center', padding: '3rem' }}><p style={{ color: '#64748b' }}>Loading destinations…</p></div>}
      {error && <div className="cd-card cd-alert warning" style={{ marginBottom: '1rem' }}>{error}</div>}

      <div className="cp-hero">
        <div className="cp-hero-copy">
          <p>Travel, planned with care</p>
          <h2>Find a destination that fits your pace</h2>
          <span>Browse curated trips, compare packages, and book hotels from one workspace.</span>
        </div>
        <div className="cp-hero-stats">
          <div className="cp-hero-stat">
            <small>Saved trips</small>
            <strong>{favorites.length}</strong>
          </div>
          <div className="cp-hero-stat">
            <small>Packages</small>
            <strong>{packages.length}</strong>
          </div>
          <div className="cp-hero-stat">
            <small>Regions</small>
            <strong>{destinations.length}</strong>
          </div>
          <div className="cp-hero-stat">
            <small>Best rated</small>
            <strong>{destinations.length ? (destinations.reduce((s, d) => s + d.rating, 0) / destinations.length).toFixed(1) : '—'}</strong>
          </div>
        </div>
      </div>

      <div className="filters-section enhanced">
        <div className="search-bar enhanced">
          <Search className="search-icon" />
          <input
            type="text"
            placeholder="Search destinations or experiences"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="cp-chips">
          {types.map((type) => (
            <button
              key={type.id}
              type="button"
              className={`cp-chip ${filterType === type.id ? 'active' : ''}`}
              onClick={() => setFilterType(type.id)}
            >
              {type.label}
            </button>
          ))}
        </div>
      </div>

      {filteredDestinations.length === 0 ? (
        <div className="cp-empty">No destinations match your search.</div>
      ) : (
        <div className="destinations-grid enhanced">
          {filteredDestinations.map((dest) => {
            const TypeIcon = IconComponent(dest.type)
            return (
              <div key={dest.id} className="destination-card enhanced">
                <div className="destination-image enhanced">
                  <div className="destination-emoji-wrapper">
                    <img className="cp-cover" src={dest.photo} alt={dest.name} />
                  </div>
                  <button
                    onClick={() => toggleFavorite(dest.id)}
                    className={`favorite-btn enhanced ${favorites.includes(dest.id) ? 'active' : ''}`}
                  >
                    <Heart className="h-5 w-5" />
                  </button>
                  <div className="destination-type-badge" style={{ backgroundColor: getTypeColor(dest.type) }}>
                    <TypeIcon className="h-4 w-4" />
                    <span>{getTypeLabel(dest.type)}</span>
                  </div>
                </div>
                <div className="destination-content enhanced">
                  <div className="destination-header enhanced">
                    <h3>{dest.name}</h3>
                    <div className="destination-rating enhanced">
                      <Star className="h-4 w-4 fill" />
                      <span>{dest.rating}</span>
                      <small>({Math.round(dest.rating * 20)} reviews)</small>
                    </div>
                  </div>
                  <p className="destination-description enhanced">{dest.description}</p>

                  {dest.highlights.length > 0 && (
                    <div className="destination-highlights">
                      <h4>Highlights</h4>
                      <div className="highlights-grid">
                        {dest.highlights.map((highlight, idx) => (
                          <span key={idx} className="highlight-tag">
                            <Sparkles className="h-3 w-3" />
                            {highlight}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="destination-meta enhanced">
                    <span className="meta-item">
                      <Calendar className="h-4 w-4" />
                      <div>
                        <small>Duration</small>
                        <strong>{dest.duration}</strong>
                      </div>
                    </span>
                    <span className="meta-item">
                      <Users className="h-4 w-4" />
                      <div>
                        <small>Group size</small>
                        <strong>2-20 people</strong>
                      </div>
                    </span>
                  </div>

                  <div className="destination-best-time">
                    <Compass className="h-4 w-4" />
                    <span>Best time: {dest.bestTime}</span>
                  </div>

                  <div className="destination-footer enhanced">
                    <div className="destination-price enhanced">
                      <div>
                        <small>Starting from</small>
                        <strong>₹{dest.price.toLocaleString()}</strong>
                      </div>
                    </div>
                    <Link to={`/customer/packages?destination=${encodeURIComponent(dest.name)}`} className="btn-primary enhanced">
                      View packages <ArrowRight className="h-4 w-4" />
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

export default DestinationExploration