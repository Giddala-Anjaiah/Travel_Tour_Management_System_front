import { API_BASE, api, readPagination } from '../../api'
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import usePolling from '../../hooks/usePolling'
import Pagination from '../../components/Pagination'
import {
  Building,
  CalendarDays,
  ListOrdered,
  Pencil,
  Plus,
  Search,
  Sparkles,
  Trash2,
  BedDouble,
  Bus,
  CheckCircle2,
  PauseCircle
} from 'lucide-react'
import '../Dashboard.css'

const formatDayDate = (value) => {
  if (!value) return 'No date'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'No date'
  return date.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' })
}

const OperatorItineraries = () => {
  const navigate = useNavigate()
  const [itineraries, setItineraries] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(10)
  const [meta, setMeta] = useState({ page: 1, limit: 10, total: 0, totalPages: 1, hasNext: false, hasPrev: false })

  const fetchItineraries = async (overrides = {}) => {
    const nextPage = overrides.page ?? page
    const nextLimit = overrides.limit ?? limit
    try {
      const data = await api('/operator/itineraries', {
        params: {
          page: nextPage,
          limit: nextLimit,
          search: searchTerm
        }
      })
      if (data.itineraries) {
        setItineraries(data.itineraries)
      }
      setMeta(readPagination(data, data.itineraries?.length || 0))
    } catch (error) {
      console.error('Error fetching itineraries:', error)
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
      fetchItineraries({ page: 1 })
    }, 350)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchTerm])

  usePolling(fetchItineraries, 15000)

  const handlePageChange = (nextPage) => {
    setPage(nextPage)
    setLoading(true)
  }

  const handleLimitChange = (nextLimit) => {
    setLimit(nextLimit)
    setPage(1)
    setLoading(true)
  }

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this itinerary?')) return
    try {
      const token = localStorage.getItem('token')
      const response = await fetch(`${API_BASE}/operator/itineraries/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })
      if (response.ok) {
        alert('Itinerary deleted successfully')
        if (itineraries.length === 1 && page > 1) {
          setPage(page - 1)
        } else {
          fetchItineraries()
        }
      } else {
        alert('Error deleting itinerary')
      }
    } catch (error) {
      console.error('Error deleting itinerary:', error)
      alert('Error deleting itinerary')
    }
  }

  const countActivities = (itinerary) => (itinerary.dayDetails || [])
    .reduce((total, day) => total + (Array.isArray(day.activities) ? day.activities.length : 0), 0)

  const countTransport = (itinerary) => (itinerary.dayDetails || [])
    .reduce((total, day) => total + (day.transportation?.mode ? 1 : 0) + (Array.isArray(day.transport) ? day.transport.length : 0), 0)

  const totals = itineraries.reduce((acc, itinerary) => {
    acc.days += itinerary.days || 0
    acc.stays += itinerary.hotels || 0
    acc.activities += countActivities(itinerary)
    return acc
  }, { days: 0, stays: 0, activities: 0 })

  return (
    <div className="op-itin-page">
      <div className="op-itin-head">
        <div className="op-itin-head-copy">
          <h1>Itinerary Management</h1>
          <p>Build the day-by-day plan travellers see: hotel, transport and activities with timings.</p>
        </div>
        <div className="op-itin-head-stats">
          <div className="op-itin-stat">
            <small>Itineraries</small>
            <strong>{meta.total}</strong>
          </div>
          <div className="op-itin-stat">
            <small>Days planned</small>
            <strong>{totals.days}</strong>
          </div>
          <div className="op-itin-stat">
            <small>Activities</small>
            <strong>{totals.activities}</strong>
          </div>
        </div>
      </div>

      <div className="op-itin-toolbar">
        <div className="op-itin-search">
          <Search className="h-4 w-4" />
          <input
            type="text"
            placeholder="Search itineraries or packages..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <button onClick={() => navigate('/tour-operator/itineraries/builder')} className="btn-primary enhanced">
          <Plus className="h-4 w-4" />
          Build Itinerary
        </button>
      </div>

      {loading ? (
        <div className="op-itin-grid">
          {[1, 2, 3].map(item => <div key={item} className="op-itin-card is-skeleton" />)}
        </div>
      ) : itineraries.length === 0 ? (
        <div className="op-itin-empty">
          <CalendarDays className="h-10 w-10" />
          <h3>No itineraries yet</h3>
          <p>Create a day-by-day plan so travellers know exactly what each day looks like.</p>
          <button onClick={() => navigate('/tour-operator/itineraries/builder')} className="btn-primary enhanced">
            <Plus className="h-4 w-4" /> Build Itinerary
          </button>
        </div>
      ) : (
        <div className="op-itin-grid">
          {itineraries.map(itinerary => {
            const days = Array.isArray(itinerary.dayDetails) ? itinerary.dayDetails : []
            const isActive = itinerary.status !== 'inactive'
            return (
              <article key={itinerary._id} className="op-itin-card">
                <header className="op-itin-card-head">
                  <div className="op-itin-card-title">
                    <h3>{itinerary.name}</h3>
                    <span className="op-itin-package">
                      <Building className="h-3.5 w-3.5" />
                      {itinerary.packageName || 'Unlinked package'}
                    </span>
                  </div>
                  <span className={`op-itin-status ${isActive ? 'is-active' : 'is-paused'}`}>
                    {isActive ? <CheckCircle2 className="h-3.5 w-3.5" /> : <PauseCircle className="h-3.5 w-3.5" />}
                    {isActive ? 'Active' : 'Inactive'}
                  </span>
                </header>

                <div className="op-itin-days">
                  {days.length === 0 ? (
                    <p className="op-itin-days-empty">No days planned yet.</p>
                  ) : (
                    days.slice(0, 4).map((day, index) => (
                      <div key={index} className="op-itin-day">
                        <span className="op-itin-day-num">Day {day.dayNumber ?? index + 1}</span>
                        <span className="op-itin-day-title">{day.title || 'Untitled day'}</span>
                        <span className="op-itin-day-date">{formatDayDate(day.date)}</span>
                      </div>
                    ))
                  )}
                  {days.length > 4 && (
                    <span className="op-itin-days-more">+{days.length - 4} more days</span>
                  )}
                </div>

                <div className="op-itin-stats">
                  <span><ListOrdered className="h-3.5 w-3.5" /> {itinerary.days || 0} days</span>
                  <span><Sparkles className="h-3.5 w-3.5" /> {countActivities(itinerary)} activities</span>
                  <span><BedDouble className="h-3.5 w-3.5" /> {itinerary.hotels || 0} stays</span>
                  <span><Bus className="h-3.5 w-3.5" /> {countTransport(itinerary)} transfers</span>
                </div>

                <footer className="op-itin-card-actions">
                  <button
                    onClick={() => navigate(`/tour-operator/itineraries/builder/${itinerary._id}`)}
                    className="btn-secondary enhanced"
                  >
                    <Pencil className="h-4 w-4" /> Open builder
                  </button>
                  <button onClick={() => handleDelete(itinerary._id)} className="icon-btn delete" title="Delete itinerary">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </footer>
              </article>
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
    </div>
  )
}

export default OperatorItineraries
