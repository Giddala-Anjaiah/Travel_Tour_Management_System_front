import { useState, useEffect } from 'react'
import { Clock, Building, Star, Search, Eye, ArrowRight, Compass, Sparkles, CheckCircle, Info } from 'lucide-react'
import { Link } from 'react-router-dom'
import CustomerLayout from './CustomerLayout'
import { api, readPagination } from '../../api'
import Pagination from '../../components/Pagination'
import '../Dashboard.css'

const Itineraries = () => {
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedItinerary, setSelectedItinerary] = useState(null)
  const [showDetails, setShowDetails] = useState(false)
  const [packages, setPackages] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(12)
  const [meta, setMeta] = useState({ page: 1, limit: 12, total: 0, totalPages: 1, hasNext: false, hasPrev: false })

  // `/customer/itineraries` has no unsupported filters on this page — the search
  // box is the only control and the route filters server-side on it.
  const fetchItineraries = async (overrides = {}) => {
    const nextPage = overrides.page ?? page
    const nextLimit = overrides.limit ?? limit
    try {
      setError('')
      const data = await api('/customer/itineraries', {
        params: { page: nextPage, limit: nextLimit, search: searchTerm }
      })
      const rows = data.itineraries || []
      setPackages(rows)
      const next = readPagination(data, rows.length)
      setMeta(next)
      if (next.totalPages > 0 && nextPage > next.totalPages) {
        setLoading(true)
        setPage(next.totalPages)
      }
    } catch (err) {
      setError(err.message || 'Failed to load itineraries')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    Promise.resolve().then(() => fetchItineraries())
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, limit])

  useEffect(() => {
    const timer = setTimeout(() => {
      setPage(1)
      setLoading(true)
      fetchItineraries({ page: 1 })
    }, 350)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchTerm])

  const handlePageChange = (nextPage) => {
    setPage(nextPage)
    setLoading(true)
  }

  const handleLimitChange = (nextLimit) => {
    setLimit(nextLimit)
    setPage(1)
    setLoading(true)
  }

  const itineraries = packages.map(it => ({
    id: it._id,
    name: it.name,
    package: it.packageName || '',
    days: it.days || 3,
    hotels: it.hotels || 0,
    status: it.status || 'active',
    difficulty: (it.days || 3) <= 3 ? 'Easy' : (it.days || 3) <= 6 ? 'Moderate' : 'Hard',
    category: 'tour',
    image: 'https://images.unsplash.com/photo-1488646953014-85cb44e25828?auto=format&fit=crop&w=1200&q=80',
    highlights: [],
    schedule: it.dayDetails || []
  }))

  const filteredItineraries = itineraries

  const viewDetails = (itinerary) => {
    setSelectedItinerary(itinerary)
    setShowDetails(true)
  }

  const getDifficultyColor = (difficulty) => {
    const colors = {
      Easy: '#22c55e',
      Moderate: '#f59e0b',
      Hard: '#ef4444'
    }
    return colors[difficulty] || '#64748b'
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

  return (
    <CustomerLayout
      active="itineraries"
      title="Itineraries"
      subtitle="Day-by-day plans from arrival to departure"
      actions={
        <div className="header-stats">
          <div className="stat-badge">
            <Sparkles className="h-4 w-4" />
            <span>{meta.total} itineraries</span>
          </div>
        </div>
      }
    >
      {loading && <div className="cd-card" style={{ textAlign: 'center', padding: '3rem' }}><p style={{ color: '#64748b' }}>Loading itineraries…</p></div>}
      {error && <div className="cd-card cd-alert warning" style={{ marginBottom: '1rem' }}>{error}</div>}

      <div className="filters-section enhanced">
        <div className="search-bar enhanced">
          <Search className="search-icon" />
          <input
            type="text"
            placeholder="Search itineraries..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      <div className="itineraries-grid enhanced">
        {filteredItineraries.map(itinerary => {
          const categoryBadge = getCategoryBadge(itinerary.category)
          return (
            <div key={itinerary.id} className="itinerary-card enhanced">
              <div className="itinerary-header enhanced">
                <div className="itinerary-image-wrapper">
                  <img className="cp-cover" src={itinerary.image} alt={itinerary.name} />
                </div>
                <div className="itinerary-info">
                  <h3>{itinerary.name}</h3>
                  <div className="itinerary-package">
                    <Star className="h-4 w-4" />
                    <span>{itinerary.package}</span>
                  </div>
                </div>
                <div className="itinerary-badges">
                  <div className="itinerary-category-badge" style={{ backgroundColor: categoryBadge.color }}>
                    <span>{categoryBadge.label}</span>
                  </div>
                  <div className="itinerary-difficulty-badge" style={{ backgroundColor: getDifficultyColor(itinerary.difficulty) }}>
                    <Compass className="h-3 w-3" />
                    <span>{itinerary.difficulty}</span>
                  </div>
                  <span className={`status-badge ${itinerary.status}`}>
                    <CheckCircle className="h-3 w-3" />
                    {itinerary.status}
                  </span>
                </div>
              </div>

              {itinerary.highlights.length > 0 && (
                <div className="itinerary-highlights">
                  <h4>Trip Highlights</h4>
                  <div className="highlights-grid">
                    {itinerary.highlights.map((highlight, idx) => (
                      <span key={idx} className="highlight-tag">
                        <Sparkles className="h-3 w-3" />
                        {highlight}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              <div className="itinerary-meta enhanced">
                <span className="meta-item">
                  <Clock className="h-4 w-4" />
                  <div>
                    <small>Duration</small>
                    <strong>{itinerary.days} Days</strong>
                  </div>
                </span>
                <span className="meta-item">
                  <Building className="h-4 w-4" />
                  <div>
                    <small>Hotels</small>
                    <strong>{itinerary.hotels} Properties</strong>
                  </div>
                </span>
              </div>

              <div className="itinerary-preview">
                <h4>Daily Schedule Preview</h4>
                <div className="schedule-preview">
                  {itinerary.schedule.slice(0, 3).map((day, idx) => (
                    <div key={idx} className="day-preview">
                      <span className="day-number">Day {day.day}</span>
                      <span className="day-title">{day.title}</span>
                    </div>
                  ))}
                  {itinerary.schedule.length > 3 && (
                    <span className="more-days">+{itinerary.schedule.length - 3} more days</span>
                  )}
                </div>
              </div>

              <div className="itinerary-actions enhanced">
                <button onClick={() => viewDetails(itinerary)} className="btn-secondary enhanced">
                  <Eye className="h-4 w-4" /> View Full Itinerary
                </button>
                <Link to="/customer/bookings" state={{ package: { name: itinerary.name, price: 0, _id: itinerary.id } }} className="btn-primary enhanced">
                  Book This Trip <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            </div>
          )
        })}
      </div>

      <Pagination
        page={meta.page}
        totalPages={meta.totalPages}
        total={meta.total}
        limit={meta.limit}
        onPageChange={handlePageChange}
        onLimitChange={handleLimitChange}
        itemLabel="itineraries"
        disabled={loading}
      />

      {showDetails && selectedItinerary && (
        <div className="modal-overlay">
          <div className="modal itinerary-modal">
            <div className="modal-header">
              <div>
                <h3>{selectedItinerary.name} - Detailed Itinerary</h3>
                <p className="modal-subtitle">{selectedItinerary.package}</p>
              </div>
              <button onClick={() => setShowDetails(false)} className="modal-close">×</button>
            </div>
            <div className="modal-body">
              <div className="itinerary-details enhanced">
                <div className="itinerary-summary">
                  <div className="summary-item">
                    <Clock className="h-5 w-5" />
                    <div>
                      <small>Duration</small>
                      <strong>{selectedItinerary.days} Days</strong>
                    </div>
                  </div>
                  <div className="summary-item">
                    <Building className="h-5 w-5" />
                    <div>
                      <small>Hotels</small>
                      <strong>{selectedItinerary.hotels} Properties</strong>
                    </div>
                  </div>
                  <div className="summary-item">
                    <Compass className="h-5 w-5" />
                    <div>
                      <small>Difficulty</small>
                      <strong>{selectedItinerary.difficulty}</strong>
                    </div>
                  </div>
                </div>

                <div className="itinerary-timeline">
                  {selectedItinerary.schedule.map((day, idx) => (
                    <div key={idx} className="day-schedule enhanced">
                      <div className="day-header enhanced">
                        <div className="day-number-badge">Day {day.day}</div>
                        <h4>{day.title}</h4>
                        {day.meals && (
                          <div className="meals-info">
                            <Info className="h-4 w-4" />
                            <span>Meals: {day.meals.join(', ')}</span>
                          </div>
                        )}
                      </div>
                      <div className="activities-list enhanced">
                        {day.activities.map((activity, actIdx) => (
                          <div key={actIdx} className="activity-item">
                            <div className="activity-dot"></div>
                            <span>{activity}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="itinerary-modal-actions">
                  <button onClick={() => setShowDetails(false)} className="btn-secondary">
                    Close
                  </button>
                  <Link to="/customer/bookings" state={{ package: { name: selectedItinerary.name, price: 0, _id: selectedItinerary.id } }} className="btn-primary">
                    Book This Itinerary <ArrowRight className="h-4 w-4" />
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </CustomerLayout>
  )
}

export default Itineraries