import { useState, useEffect } from 'react'
import { Clock, Building, Star, Search, Eye, ArrowRight, Compass, Sparkles, CheckCircle, Info, MapPin, Calendar as CalendarIcon } from 'lucide-react'
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

  const getActivityLabel = (activity) => {
    if (typeof activity === 'string') return activity.trim() || 'Untitled Activity'
    if (activity && typeof activity === 'object') {
      return (
        activity.name ||
        activity.title ||
        activity.description ||
        activity.time ||
        activity.location ||
        'Untitled Activity'
      )
    }
    return 'Untitled Activity'
  }

  const getCategoryBadge = (category) => {
    return CATEGORY_BADGES[category] || { label: 'Tour', color: 'var(--cp-type-tour)' }
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
                      <div key={idx} className="day-preview" style={{ borderLeftColor: 'var(--cp-accent)' }}>
                        <span className="day-number" style={{ color: 'var(--cp-accent)' }}>Day {day.day}</span>
                        <span className="day-title" style={{ color: 'var(--cp-ink)' }}>{day.title}</span>
                      </div>
                    ))}
                    {itinerary.schedule.length > 3 && (
                      <span className="more-days" style={{ color: 'var(--cp-muted)' }}>+{itinerary.schedule.length - 3} more days</span>
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
                    <div key={idx} className="day-schedule enhanced" style={{ borderColor: 'var(--cp-line)', background: 'var(--cp-card)', marginBottom: '1.5rem', overflow: 'hidden' }}>
                      <div className="day-header enhanced" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '1rem 1.25rem', borderBottom: '1px solid var(--cp-line)', background: 'var(--cp-surface)' }}>
                        <div className="day-number-badge" style={{ background: 'var(--cp-accent)', color: '#fff', fontWeight: '700', padding: '0.25rem 0.75rem', borderRadius: '6px', fontSize: '0.875rem' }}>Day {day.day ?? idx + 1}</div>
                        <h4 style={{ color: 'var(--cp-ink)', margin: 0, fontSize: '1.125rem', flex: 1 }}>{day.title || 'Untitled Day'}</h4>
                        {day.date && (
                          <span style={{ fontSize: '0.875rem', color: 'var(--cp-muted)', whiteSpace: 'nowrap' }}>
                            {new Date(day.date).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}
                          </span>
                        )}
                      </div>
                      <div style={{ padding: '1rem 1.25rem' }}>
                        {day.meals && (
                          <div className="meals-info" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem', color: 'var(--cp-muted)', fontSize: '0.875rem' }}>
                            <Info className="h-4 w-4" style={{ color: 'var(--cp-info)' }} />
                            <span>Meals: {Array.isArray(day.meals) ? day.meals.join(', ') : day.meals}</span>
                          </div>
                        )}
                        <div className="activities-list enhanced" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                          {(day.activities || []).length === 0 ? (
                            <div style={{ padding: '1rem', color: 'var(--cp-muted)', fontSize: '0.875rem', textAlign: 'center', background: 'var(--cp-surface)', borderRadius: '8px', border: '1px dashed var(--cp-line)' }}>
                              No activities scheduled for this day.
                            </div>
                          ) : (
                            (day.activities || []).map((activity, actIdx) => {
                              const isStr = typeof activity === 'string'
                              const actName = getActivityLabel(activity)
                              const actTime = isStr ? '' : activity?.time
                              const actDesc = isStr ? '' : activity?.description
                              const actLoc = isStr ? '' : activity?.location
                              const actType = isStr ? '' : (activity?.type && activity?.type !== 'activity' ? activity?.type : '')
                              return (
                                <div key={actIdx} className="activity-item" style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem', padding: '0.75rem', background: '#fff', border: '1px solid var(--cp-line)', borderRadius: '10px' }}>
                                  <div className="activity-dot" style={{ background: 'var(--cp-accent)', width: '8px', height: '8px', borderRadius: '50%', marginTop: '0.25rem', flexShrink: 0 }} />
                                  <div style={{ flex: 1 }}>
                                    {actTime && (
                                      <span style={{ display: 'inline-block', fontSize: '0.75rem', fontWeight: '600', color: 'var(--cp-accent)', background: 'rgba(16, 185, 129, 0.1)', padding: '0.125rem 0.5rem', borderRadius: '4px', marginBottom: '0.25rem' }}>
                                        {actTime}
                                      </span>
                                    )}
                                    <span style={{ color: 'var(--cp-ink)', fontWeight: '600', fontSize: '0.95rem', display: 'block', marginBottom: actDesc ? '0.25rem' : 0 }}>
                                      {actName}
                                    </span>
                                    {actDesc && (
                                      <span style={{ color: 'var(--cp-muted)', fontSize: '0.875rem', lineHeight: '1.4', display: 'block' }}>{actDesc}</span>
                                    )}
                                    {actLoc && (
                                      <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', marginTop: '0.5rem', color: 'var(--cp-muted)', fontSize: '0.8rem' }}>
                                        <MapPin className="h-3 w-3" />
                                        {actLoc}
                                      </span>
                                    )}
                                    {actType && (
                                      <span style={{ display: 'inline-block', fontSize: '0.7rem', fontWeight: '600', color: 'var(--cp-accent)', textTransform: 'uppercase', letterSpacing: '0.05em', border: '1px solid var(--cp-accent)', padding: '0.125rem 0.5rem', borderRadius: '4px', marginTop: '0.5rem' }}>
                                        {actType}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              )
                            })
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                  {(selectedItinerary.schedule || []).length === 0 && (
                    <div style={{ padding: '2rem', color: 'var(--cp-muted)', textAlign: 'center', background: 'var(--cp-surface)', borderRadius: '12px', border: '1px solid var(--cp-line)' }}>
                      No daily schedule available for this itinerary.
                    </div>
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