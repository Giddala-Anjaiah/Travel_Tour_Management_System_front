import { useState, useEffect } from 'react'
import { Clock, Building, Star, Search, Eye, ArrowRight, Compass, Sparkles, CheckCircle, Info, MapPin, BedDouble, Bus, Utensils } from 'lucide-react'
import { Link } from 'react-router-dom'
import CustomerLayout from './CustomerLayout'
import { api, readPagination } from '../../api'
import Pagination from '../../components/Pagination'
import '../Dashboard.css'

const DIFFICULTY_COLORS = {
  Easy: 'var(--cp-success)',
  Moderate: 'var(--cp-warning)',
  Hard: 'var(--cp-danger)'
}

const CATEGORY_BADGES = {
  beach: { label: 'Beach', color: 'var(--cp-type-beach)' },
  nature: { label: 'Nature', color: 'var(--cp-type-nature)' },
  adventure: { label: 'Adventure', color: 'var(--cp-type-adventure)' },
  heritage: { label: 'Heritage', color: 'var(--cp-type-heritage)' }
}

const ACTIVITY_ICONS = {
  activity: Sparkles,
  sightseeing: Compass,
  meal: Utensils,
  transport: Bus,
  hotel: BedDouble,
  other: Clock
}

// One day of the plan: the hotel, the transport and the activities with the
// time they happen. Activities are shown in clock order, untimed ones last.
const ItineraryDay = ({ day, index }) => {
  const stay = day.accommodation?.name || day.accommodation?.hotelName
    ? day.accommodation
    : (day.hotel?.name ? day.hotel : null)
  const transport = day.transportation || null
  const legs = Array.isArray(day.transport) ? day.transport : []
  const meals = Array.isArray(day.meals) ? day.meals : []

  const activities = (Array.isArray(day.activities) ? day.activities : [])
    .map(activity => (typeof activity === 'string'
      ? { time: '', name: activity.trim(), type: 'activity', location: '', description: '' }
      : {
        time: activity.time || '',
        name: activity.name || activity.title || '',
        type: activity.type || 'activity',
        location: activity.location || '',
        description: activity.description || ''
      }))
    .filter(activity => activity.name)
    .sort((a, b) => {
      if (!a.time && !b.time) return 0
      if (!a.time) return 1
      if (!b.time) return -1
      return a.time.localeCompare(b.time)
    })

  return (
    <article className="cd-day">
      <header className="cd-day-head">
        <span className="cd-day-chip">Day {day.dayNumber ?? index + 1}</span>
        <div className="cd-day-head-text">
          <h4>{day.title || 'Untitled day'}</h4>
          <span className="cd-day-where">
            {day.location && <><MapPin className="h-3 w-3" /> {day.location}</>}
            {day.location && day.date && ' · '}
            {day.date && new Date(day.date).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}
          </span>
        </div>
      </header>

      {day.description && <p className="cd-day-desc">{day.description}</p>}

      {(stay || transport || legs.length > 0) && (
        <div className="cd-day-cards">
          {stay && (
            <div className="cd-day-card is-hotel">
              <div className="cd-day-card-title"><BedDouble className="h-4 w-4" /> Hotel</div>
              <strong>{stay.name || stay.hotelName}</strong>
              <span className="cd-day-card-meta">
                {stay.roomType ? `${stay.roomType}` : 'Room not specified'}
                {stay.checkInTime ? ` · in ${stay.checkInTime}` : ''}
                {stay.checkOutTime ? ` · out ${stay.checkOutTime}` : ''}
              </span>
              {stay.location && <span className="cd-day-card-meta"><MapPin className="h-3 w-3" /> {stay.location}</span>}
              {stay.notes && <span className="cd-day-card-note">{stay.notes}</span>}
            </div>
          )}
          {(transport || legs.length > 0) && (
            <div className="cd-day-card is-transport">
              <div className="cd-day-card-title"><Bus className="h-4 w-4" /> Transport</div>
              {transport?.mode && <strong>{transport.mode}{transport.vehicle ? ` · ${transport.vehicle}` : ''}</strong>}
              {(transport?.departureTime || transport?.arrivalTime) && (
                <span className="cd-day-card-meta">
                  {transport.departureTime ? `departs ${transport.departureTime}` : ''}
                  {transport.departureTime && transport.arrivalTime ? ' · ' : ''}
                  {transport.arrivalTime ? `arrives ${transport.arrivalTime}` : ''}
                </span>
              )}
              {(transport?.departureLocation || transport?.arrivalLocation) && (
                <span className="cd-day-card-meta">
                  <MapPin className="h-3 w-3" /> {transport.departureLocation || '—'} → {transport.arrivalLocation || '—'}
                </span>
              )}
              {transport?.details && <span className="cd-day-card-note">{transport.details}</span>}
              {legs.map((leg, legIdx) => (
                <span key={legIdx} className="cd-day-card-meta">
                  {leg.time ? `${leg.time} · ` : ''}{leg.mode || 'Transfer'}
                  {leg.from || leg.to ? ` · ${leg.from || '—'} → ${leg.to || '—'}` : ''}
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      {meals.length > 0 && (
        <div className="cd-day-meals">
          <Utensils className="h-3.5 w-3.5" /> Meals: {meals.join(' · ')}
        </div>
      )}

      {activities.length === 0 ? (
        <div className="cd-day-empty">No activities scheduled for this day.</div>
      ) : (
        <ol className="cd-timeline">
          {activities.map((activity, actIdx) => {
            const Icon = ACTIVITY_ICONS[activity.type] || ACTIVITY_ICONS.activity
            return (
              <li key={actIdx} className="cd-timeline-item">
                <span className="cd-timeline-time">
                  {activity.time || '—'}
                </span>
                <span className="cd-timeline-marker"><Icon className="h-3 w-3" /></span>
                <div className="cd-timeline-body">
                  <span className="cd-timeline-name">{activity.name}</span>
                  {activity.location && (
                    <span className="cd-timeline-meta"><MapPin className="h-3 w-3" /> {activity.location}</span>
                  )}
                  {activity.description && <span className="cd-timeline-desc">{activity.description}</span>}
                </div>
                {activity.type && activity.type !== 'activity' && (
                  <span className="cd-timeline-type">{activity.type}</span>
                )}
              </li>
            )
          })}
        </ol>
      )}

      {day.notes && (
        <div className="cd-day-notes">
          <Info className="h-3.5 w-3.5" />
          <span>{day.notes}</span>
        </div>
      )}
    </article>
  )
}

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
  }, [page, limit])

  useEffect(() => {
    const timer = setTimeout(() => {
      setPage(1)
      setLoading(true)
      fetchItineraries({ page: 1 })
    }, 350)
    return () => clearTimeout(timer)
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
    return DIFFICULTY_COLORS[difficulty] || 'var(--cp-muted)'
  }

  const getCategoryBadge = (category) => {
    return CATEGORY_BADGES[category] || { label: 'Tour', color: 'var(--cp-type-tour)' }
  }

  return (
    <CustomerLayout active="itineraries">
      <div className="page-head">
        <div className="page-head-row">
          <div>
            <h1>Itineraries</h1>
            <p>Day-by-day plans from arrival to departure</p>
          </div>
          <div className="page-status-badges">
            <div className="stat-badge">
              <Sparkles className="h-4 w-4" />
              <span>{meta.total} itineraries</span>
            </div>
          </div>
        </div>
      </div>

      {loading && <div className="cd-skeleton-grid">{[1,2,3,4].map(i => <div key={i} className="cd-skeleton-card" />)}</div>}
      {error && <div className="cd-card cd-alert warning" style={{ marginBottom: '1rem' }}>{error}</div>}

      <div className="cd-hero">
        <div className="cd-hero-copy">
          <p>Your travel plans</p>
          <h2>Itineraries <span style={{ color: 'var(--cp-accent)' }}>🗓️</span></h2>
          <span>Browse detailed day-by-day schedules for your upcoming trips.</span>
        </div>
        <div className="cd-hero-stats">
          <div className="cd-hero-stat">
            <small>Total Trips</small>
            <strong>{meta.total}</strong>
          </div>
          <div className="cd-hero-stat">
            <small>Active</small>
            <strong>{filteredItineraries.filter(i => i.status === 'active').length}</strong>
          </div>
          <div className="cd-hero-stat">
            <small>Completed</small>
            <strong>{filteredItineraries.filter(i => i.status === 'completed').length}</strong>
          </div>
          <div className="cd-hero-stat">
            <small>Avg Duration</small>
            <strong>{filteredItineraries.length ? Math.round(filteredItineraries.reduce((s, i) => s + i.days, 0) / filteredItineraries.length) : 0} days</strong>
          </div>
        </div>
      </div>

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

      {filteredItineraries.length === 0 ? (
        <div className="cd-card cp-empty">
          <MapPin className="cp-empty-icon" size={48} />
          <h3>No itineraries found</h3>
          <p>Try adjusting your search to find your travel plans.</p>
          <Link to="/customer/packages" className="btn-primary enhanced" style={{ display: 'inline-flex', marginTop: '1rem' }}>
            <Sparkles className="h-4 w-4" /> Browse Packages
          </Link>
        </div>
      ) : (
        <div className="itineraries-grid enhanced">
          {filteredItineraries.map(itinerary => {
            const categoryBadge = getCategoryBadge(itinerary.category)
            return (
              <div key={itinerary.id} className="itinerary-card enhanced">
                <div className="itinerary-banner enhanced">
                  <img className="cp-cover" src={itinerary.image} alt={itinerary.name} />
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

                <div className="itinerary-header enhanced">
                  <div className="itinerary-info">
                    <h3 style={{ color: 'var(--cp-ink)' }}>{itinerary.name}</h3>
                    <div className="itinerary-package">
                      <Star className="h-4 w-4" style={{ color: 'var(--cp-gold)' }} />
                      <span style={{ color: 'var(--cp-muted)' }}>{itinerary.package}</span>
                    </div>
                  </div>
                </div>

                {itinerary.highlights.length > 0 && (
                  <div className="itinerary-highlights">
                    <h4 style={{ color: 'var(--cp-ink)' }}>Trip Highlights</h4>
                    <div className="highlights-grid">
                      {itinerary.highlights.map((highlight, idx) => (
                        <span key={idx} className="highlight-tag" style={{ background: 'var(--cp-surface)', color: 'var(--cp-ink)', borderColor: 'var(--cp-line)' }}>
                          <Sparkles className="h-3 w-3" style={{ color: 'var(--cp-accent)' }} />
                          {highlight}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                <div className="itinerary-meta enhanced" style={{ borderTopColor: 'var(--cp-line)' }}>
                  <span className="meta-item">
                    <Clock className="h-4 w-4" style={{ color: 'var(--cp-accent)' }} />
                    <div>
                      <small style={{ color: 'var(--cp-muted)' }}>Duration</small>
                      <strong style={{ color: 'var(--cp-ink)' }}>{itinerary.days} Days</strong>
                    </div>
                  </span>
                  <span className="meta-item">
                    <Building className="h-4 w-4" style={{ color: 'var(--cp-purple)' }} />
                    <div>
                      <small style={{ color: 'var(--cp-muted)' }}>Hotels</small>
                      <strong style={{ color: 'var(--cp-ink)' }}>{itinerary.hotels} Properties</strong>
                    </div>
                  </span>
                </div>

                <div className="itinerary-preview" style={{ borderTopColor: 'var(--cp-line)' }}>
                  <h4 style={{ color: 'var(--cp-ink)' }}>Daily Schedule Preview</h4>
                  <div className="schedule-preview">
                    {itinerary.schedule.slice(0, 3).map((day, idx) => (
                      <div key={idx} className="day-preview">
                        <span className="day-number">Day {day.dayNumber ?? idx + 1}</span>
                        <span className="day-title">{day.title || 'Untitled day'}</span>
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
      )}

      <Pagination
        page={page}
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
                    <Clock className="h-5 w-5" style={{ color: 'var(--cp-accent)' }} />
                    <div>
                      <small style={{ color: 'var(--cp-muted)' }}>Duration</small>
                      <strong style={{ color: 'var(--cp-ink)' }}>{selectedItinerary.days} Days</strong>
                    </div>
                  </div>
                  <div className="summary-item">
                    <Building className="h-5 w-5" style={{ color: 'var(--cp-purple)' }} />
                    <div>
                      <small style={{ color: 'var(--cp-muted)' }}>Hotels</small>
                      <strong style={{ color: 'var(--cp-ink)' }}>{selectedItinerary.hotels} Properties</strong>
                    </div>
                  </div>
                  <div className="summary-item">
                    <Compass className="h-5 w-5" style={{ color: getDifficultyColor(selectedItinerary.difficulty) }} />
                    <div>
                      <small style={{ color: 'var(--cp-muted)' }}>Difficulty</small>
                      <strong style={{ color: 'var(--cp-ink)' }}>{selectedItinerary.difficulty}</strong>
                    </div>
                  </div>
                </div>

                <div className="itinerary-timeline">
                  {(selectedItinerary.schedule || []).map((day, idx) => (
                    <ItineraryDay key={idx} day={day} index={idx} />
                  ))}
                  {(selectedItinerary.schedule || []).length === 0 && (
                    <div className="cd-card cd-alert info">No daily schedule available for this itinerary.</div>
                  )}
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