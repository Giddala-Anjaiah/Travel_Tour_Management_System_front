import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  ArrowLeft,
  Bus,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  Coffee,
  MapPin,
  Plus,
  Save,
  Sparkles,
  Trash2,
  Utensils,
  BedDouble,
  Compass
} from 'lucide-react'
import { api } from '../../api'
import '../Dashboard.css'

const ACTIVITY_TYPES = [
  { value: 'activity', label: 'Activity', icon: Sparkles },
  { value: 'sightseeing', label: 'Sightseeing', icon: Compass },
  { value: 'meal', label: 'Meal', icon: Utensils },
  { value: 'transport', label: 'Transport', icon: Bus },
  { value: 'hotel', label: 'Hotel', icon: BedDouble },
  { value: 'other', label: 'Other', icon: Clock }
]

const TYPE_META = Object.fromEntries(ACTIVITY_TYPES.map(type => [type.value, type]))

const emptyActivity = () => ({
  time: '',
  name: '',
  type: 'activity',
  location: '',
  description: ''
})

const emptyAccommodation = () => ({
  name: '',
  hotelName: '',
  checkInTime: '',
  checkOutTime: '',
  roomType: '',
  location: '',
  notes: ''
})

const emptyTransportation = () => ({
  mode: '',
  vehicle: '',
  departureTime: '',
  arrivalTime: '',
  departureLocation: '',
  arrivalLocation: '',
  details: ''
})

const emptyDay = (index = 0) => ({
  dayNumber: index + 1,
  title: '',
  date: '',
  location: '',
  description: '',
  notes: '',
  meals: [],
  activities: [],
  accommodation: emptyAccommodation(),
  transportation: emptyTransportation(),
  transport: []
})

// The API stores a day in its final shape, the editor keeps a predictable
// object for every field so the inputs never have to guard against undefined.
const dayFromApi = (day, index) => {
  const source = day || {}
  const meals = Array.isArray(source.meals)
    ? source.meals
    : (source.meals ? String(source.meals).split(',').map(meal => meal.trim()).filter(Boolean) : [])

  return {
    dayNumber: source.dayNumber || index + 1,
    title: source.title || '',
    date: source.date ? String(source.date).slice(0, 10) : '',
    location: source.location || '',
    description: source.description || '',
    notes: source.notes || '',
    meals,
    activities: (Array.isArray(source.activities) ? source.activities : []).map(activity => (
      typeof activity === 'string'
        ? { ...emptyActivity(), name: activity }
        : {
          time: activity.time || '',
          name: activity.name || '',
          type: activity.type || 'activity',
          location: activity.location || '',
          description: activity.description || ''
        }
    )),
    accommodation: { ...emptyAccommodation(), ...(source.accommodation || {}) },
    transportation: { ...emptyTransportation(), ...(source.transportation || {}) },
    transport: (Array.isArray(source.transport) ? source.transport : []).map(leg => ({
      time: leg.time || '',
      mode: leg.mode || '',
      from: leg.from || '',
      to: leg.to || '',
      details: leg.details || ''
    }))
  }
}

const nextDate = (dateValue) => {
  if (!dateValue) return ''
  const date = new Date(`${dateValue}T00:00:00`)
  if (Number.isNaN(date.getTime())) return ''
  date.setDate(date.getDate() + 1)
  return date.toISOString().slice(0, 10)
}

const formatDayDate = (dateValue) => {
  if (!dateValue) return 'No date set'
  const date = new Date(`${dateValue}T00:00:00`)
  if (Number.isNaN(date.getTime())) return 'No date set'
  return date.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' })
}

const OperatorItineraryBuilder = () => {
  const { id } = useParams()
  const navigate = useNavigate()
  const isEditing = Boolean(id)

  const [form, setForm] = useState({
    name: '',
    packageId: '',
    packageName: '',
    status: 'active',
    highlights: [],
    dayDetails: [emptyDay(0)]
  })
  const [activeDay, setActiveDay] = useState(0)
  const [packages, setPackages] = useState([])
  const [loading, setLoading] = useState(isEditing)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const loadPackages = useCallback(async () => {
    try {
      const data = await api('/operator/packages', { params: { limit: 'all' } })
      setPackages(data.packages || [])
    } catch (err) {
      console.error('Error fetching packages:', err)
    }
  }, [])

  const loadItinerary = useCallback(async () => {
    if (!id) return
    try {
      const data = await api(`/operator/itineraries/${id}`)
      const itinerary = data.itinerary
      if (!itinerary) return
      setForm({
        name: itinerary.name || '',
        packageId: itinerary.packageId || '',
        packageName: itinerary.packageName || '',
        status: itinerary.status || 'active',
        highlights: Array.isArray(itinerary.highlights) ? itinerary.highlights : [],
        dayDetails: (itinerary.dayDetails || []).map(dayFromApi)
      })
    } catch (err) {
      setError(err.message || 'Could not load this itinerary')
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    Promise.resolve().then(() => loadPackages())
  }, [loadPackages])

  useEffect(() => {
    Promise.resolve().then(() => loadItinerary())
  }, [loadItinerary])

  const days = form.dayDetails
  const day = days[activeDay] || days[0] || emptyDay(0)

  const daySummary = useMemo(() => ({
    activities: day?.activities?.filter(activity => activity.name?.trim()).length || 0,
    stay: day?.accommodation?.name?.trim() || day?.accommodation?.hotelName?.trim() || '',
    transport: day?.transportation?.mode?.trim() || day?.transport?.length || 0
  }), [day])

  const updateDay = (index, patch) => {
    setForm(prev => ({
      ...prev,
      dayDetails: prev.dayDetails.map((item, i) => (i === index ? { ...item, ...patch } : item))
    }))
  }

  const addDay = () => {
    setForm(prev => {
      const insertAt = activeDay + 1
      const previous = prev.dayDetails[activeDay]
      const fresh = emptyDay(insertAt)
      fresh.date = nextDate(previous?.date)
      const dayDetails = [...prev.dayDetails]
      dayDetails.splice(insertAt, 0, fresh)
      setActiveDay(insertAt)
      return {
        ...prev,
        dayDetails: dayDetails.map((item, i) => ({ ...item, dayNumber: i + 1 }))
      }
    })
  }

  const removeDay = (index) => {
    setForm(prev => {
      const dayDetails = prev.dayDetails.filter((_, i) => i !== index)
        .map((item, i) => ({ ...item, dayNumber: i + 1 }))
      return { ...prev, dayDetails }
    })
    setActiveDay(prev => Math.max(0, Math.min(prev, days.length - 2)))
  }

  const moveDay = (index, direction) => {
    setForm(prev => {
      const target = index + direction
      if (target < 0 || target >= prev.dayDetails.length) return prev
      const dayDetails = [...prev.dayDetails]
      const [moved] = dayDetails.splice(index, 1)
      dayDetails.splice(target, 0, moved)
      return {
        ...prev,
        dayDetails: dayDetails.map((item, i) => ({ ...item, dayNumber: i + 1 }))
      }
    })
    setActiveDay(prev => {
      const target = prev + direction
      if (target < 0 || target >= days.length) return prev
      return target
    })
  }

  const updateActivity = (activityIndex, patch) => {
    updateDay(activeDay, {
      activities: day.activities.map((activity, i) => (i === activityIndex ? { ...activity, ...patch } : activity))
    })
  }

  const addActivity = () => {
    updateDay(activeDay, { activities: [...day.activities, emptyActivity()] })
  }

  const removeActivity = (activityIndex) => {
    updateDay(activeDay, {
      activities: day.activities.filter((_, i) => i !== activityIndex)
    })
  }

  const moveActivity = (activityIndex, direction) => {
    const target = activityIndex + direction
    if (target < 0 || target >= day.activities.length) return
    const activities = [...day.activities]
    const [moved] = activities.splice(activityIndex, 1)
    activities.splice(target, 0, moved)
    updateDay(activeDay, { activities })
  }

  const updateAccommodation = (patch) => {
    updateDay(activeDay, { accommodation: { ...day.accommodation, ...patch } })
  }

  const updateTransportation = (patch) => {
    updateDay(activeDay, { transportation: { ...day.transportation, ...patch } })
  }

  const updateLeg = (legIndex, patch) => {
    updateDay(activeDay, {
      transport: day.transport.map((leg, i) => (i === legIndex ? { ...leg, ...patch } : leg))
    })
  }

  const addLeg = () => {
    updateDay(activeDay, {
      transport: [...day.transport, { time: '', mode: '', from: '', to: '', details: '' }]
    })
  }

  const removeLeg = (legIndex) => {
    updateDay(activeDay, {
      transport: day.transport.filter((_, i) => i !== legIndex)
    })
  }

  const handleMeals = (value) => {
    updateDay(activeDay, {
      meals: value.split(',').map(meal => meal.trim()).filter(Boolean)
    })
  }

  const handleSave = async () => {
    setSaving(true)
    setError('')
    setNotice('')
    try {
      if (!form.name.trim()) {
        setError('Give the itinerary a name')
        return
      }
      if (!form.packageId) {
        setError('Choose the package this itinerary belongs to')
        return
      }

      const payload = {
        name: form.name.trim(),
        packageId: form.packageId,
        packageName: form.packageName,
        status: form.status,
        highlights: form.highlights,
        dayDetails: days.map((item, index) => ({
          ...item,
          dayNumber: index + 1,
          date: item.date || undefined
        }))
      }

      const data = isEditing
        ? await api(`/operator/itineraries/${id}`, { method: 'PUT', body: JSON.stringify(payload) })
        : await api('/operator/itineraries', { method: 'POST', body: JSON.stringify(payload) })

      setNotice(data.message || 'Itinerary saved')
      if (!isEditing && data.itinerary?._id) {
        navigate(`/tour-operator/itineraries/builder/${data.itinerary._id}`, { replace: true })
      }
    } catch (err) {
      setError(err.message || 'Could not save this itinerary')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return <div className="ib-loading">Loading itinerary...</div>
  }

  return (
    <div className="ib-wrap">
      <div className="ib-topbar">
        <button type="button" className="ib-back" onClick={() => navigate('/tour-operator/itineraries')}>
          <ArrowLeft className="h-4 w-4" /> Itineraries
        </button>
        <div className="ib-topbar-actions">
          {notice && <span className="ib-notice"><CheckCircle2 className="h-4 w-4" /> {notice}</span>}
          {error && <span className="ib-error">{error}</span>}
          <button type="button" className="btn-primary enhanced" onClick={handleSave} disabled={saving}>
            <Save className="h-4 w-4" /> {saving ? 'Saving...' : 'Save itinerary'}
          </button>
        </div>
      </div>

      <div className="ib-head">
        <div className="ib-head-field">
          <label>Itinerary name</label>
          <input
            type="text"
            value={form.name}
            onChange={(e) => setForm(prev => ({ ...prev, name: e.target.value }))}
            placeholder="e.g., Manali Honeymoon Escape"
          />
        </div>
        <div className="ib-head-field">
          <label>Package</label>
          <select
            value={form.packageId}
            onChange={(e) => {
              const pkg = packages.find(item => item._id === e.target.value)
              setForm(prev => ({
                ...prev,
                packageId: e.target.value,
                packageName: pkg?.name || ''
              }))
            }}
          >
            <option value="">Select a package...</option>
            {packages.map(pkg => (
              <option key={pkg._id} value={pkg._id}>{pkg.name}{pkg.destination ? ` - ${pkg.destination}` : ''}</option>
            ))}
          </select>
        </div>
        <div className="ib-head-field ib-head-field-narrow">
          <label>Status</label>
          <select
            value={form.status}
            onChange={(e) => setForm(prev => ({ ...prev, status: e.target.value }))}
          >
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </div>
      </div>

      <div className="ib-body">
        <aside className="ib-days">
          <div className="ib-days-head">
            <span>Days</span>
            <span className="ib-days-count">{days.length}</span>
          </div>
          <div className="ib-days-list">
            {days.map((item, index) => (
              <button
                type="button"
                key={index}
                className={`ib-day ${index === activeDay ? 'active' : ''}`}
                onClick={() => setActiveDay(index)}
              >
                <span className="ib-day-number">Day {index + 1}</span>
                <span className="ib-day-title">{item.title || 'Untitled day'}</span>
                <span className="ib-day-meta">
                  <CalendarDays className="h-3 w-3" /> {formatDayDate(item.date)}
                </span>
                <span className="ib-day-meta">
                  <Sparkles className="h-3 w-3" /> {item.activities.filter(a => a.name?.trim()).length} activities
                </span>
              </button>
            ))}
          </div>
          <button type="button" className="ib-add-day" onClick={addDay}>
            <Plus className="h-4 w-4" /> Add day
          </button>
        </aside>

        <section className="ib-editor">
          <div className="ib-editor-head">
            <div>
              <h2>Day {activeDay + 1}</h2>
              <p>{daySummary.activities} activities · {daySummary.stay ? `stay at ${daySummary.stay}` : 'no stay listed'}</p>
            </div>
            <div className="ib-editor-head-actions">
              <button
                type="button"
                className="icon-btn"
                onClick={() => moveDay(activeDay, -1)}
                disabled={activeDay === 0}
                title="Move day up"
              >
                <ChevronUp className="h-4 w-4" />
              </button>
              <button
                type="button"
                className="icon-btn"
                onClick={() => moveDay(activeDay, 1)}
                disabled={activeDay === days.length - 1}
                title="Move day down"
              >
                <ChevronDown className="h-4 w-4" />
              </button>
              <button
                type="button"
                className="icon-btn delete"
                onClick={() => removeDay(activeDay)}
                disabled={days.length <= 1}
                title="Remove day"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="ib-panel">
            <h3 className="ib-panel-title">Day overview</h3>
            <div className="form-grid">
              <div className="form-group">
                <label>Day title</label>
                <input
                  type="text"
                  value={day.title}
                  onChange={(e) => updateDay(activeDay, { title: e.target.value })}
                  placeholder="e.g., Arrival in Manali"
                />
              </div>
              <div className="form-group">
                <label>Date</label>
                <input
                  type="date"
                  value={day.date}
                  onChange={(e) => updateDay(activeDay, { date: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label>Location</label>
                <input
                  type="text"
                  value={day.location}
                  onChange={(e) => updateDay(activeDay, { location: e.target.value })}
                  placeholder="e.g., Manali, Himachal Pradesh"
                />
              </div>
              <div className="form-group">
                <label>Meals (comma-separated)</label>
                <input
                  type="text"
                  value={day.meals.join(', ')}
                  onChange={(e) => handleMeals(e.target.value)}
                  placeholder="Breakfast, Lunch, Dinner"
                />
              </div>
              <div className="form-group ib-span-2">
                <label>Description</label>
                <textarea
                  rows={2}
                  value={day.description}
                  onChange={(e) => updateDay(activeDay, { description: e.target.value })}
                  placeholder="What happens on this day?"
                />
              </div>
              <div className="form-group ib-span-2">
                <label>Notes for travellers</label>
                <textarea
                  rows={2}
                  value={day.notes}
                  onChange={(e) => updateDay(activeDay, { notes: e.target.value })}
                  placeholder="Anything travellers should pack, wear or watch out for."
                />
              </div>
            </div>
          </div>

          <div className="ib-panel">
            <div className="ib-panel-head">
              <h3 className="ib-panel-title">
                <Sparkles className="h-4 w-4" /> Activities & timestamps
              </h3>
              <button type="button" className="btn-secondary enhanced" onClick={addActivity}>
                <Plus className="h-4 w-4" /> Add activity
              </button>
            </div>

            {day.activities.length === 0 ? (
              <div className="ib-empty">No activities yet. Add the first one with a time.</div>
            ) : (
              <div className="ib-timeline">
                {day.activities.map((activity, index) => {
                  const typeMeta = TYPE_META[activity.type] || TYPE_META.activity
                  const TypeIcon = typeMeta.icon
                  return (
                    <div key={index} className="ib-activity">
                      <div className="ib-activity-rail">
                        <span className="ib-activity-dot"><TypeIcon className="h-3 w-3" /></span>
                      </div>
                      <div className="ib-activity-body">
                        <div className="ib-activity-row">
                          <div className="form-group ib-time-field">
                            <label>Time</label>
                            <input
                              type="time"
                              value={activity.time}
                              onChange={(e) => updateActivity(index, { time: e.target.value })}
                            />
                          </div>
                          <div className="form-group ib-grow">
                            <label>Activity</label>
                            <input
                              type="text"
                              value={activity.name}
                              onChange={(e) => updateActivity(index, { name: e.target.value })}
                              placeholder="e.g., Visit Hadimba Temple"
                            />
                          </div>
                          <div className="form-group ib-type-field">
                            <label>Type</label>
                            <select
                              value={activity.type}
                              onChange={(e) => updateActivity(index, { type: e.target.value })}
                            >
                              {ACTIVITY_TYPES.map(type => (
                                <option key={type.value} value={type.value}>{type.label}</option>
                              ))}
                            </select>
                          </div>
                        </div>
                        <div className="ib-activity-row">
                          <div className="form-group ib-grow">
                            <label>Location</label>
                            <input
                              type="text"
                              value={activity.location}
                              onChange={(e) => updateActivity(index, { location: e.target.value })}
                              placeholder="e.g., Old Manali"
                            />
                          </div>
                          <div className="form-group ib-grow">
                            <label>Description</label>
                            <input
                              type="text"
                              value={activity.description}
                              onChange={(e) => updateActivity(index, { description: e.target.value })}
                              placeholder="Short note for the traveller"
                            />
                          </div>
                          <div className="ib-activity-actions">
                            <button
                              type="button"
                              className="icon-btn"
                              onClick={() => moveActivity(index, -1)}
                              disabled={index === 0}
                              title="Move up"
                            >
                              <ChevronUp className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              className="icon-btn"
                              onClick={() => moveActivity(index, 1)}
                              disabled={index === day.activities.length - 1}
                              title="Move down"
                            >
                              <ChevronDown className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              className="icon-btn delete"
                              onClick={() => removeActivity(index)}
                              title="Remove activity"
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
          </div>

          <div className="ib-panel">
            <h3 className="ib-panel-title">
              <BedDouble className="h-4 w-4" /> Hotel & stay
            </h3>
            <div className="form-grid">
              <div className="form-group">
                <label>Hotel name</label>
                <input
                  type="text"
                  value={day.accommodation.name}
                  onChange={(e) => updateAccommodation({ name: e.target.value })}
                  placeholder="e.g., Hotel Snow View"
                />
              </div>
              <div className="form-group">
                <label>Room type</label>
                <input
                  type="text"
                  value={day.accommodation.roomType}
                  onChange={(e) => updateAccommodation({ roomType: e.target.value })}
                  placeholder="e.g., Deluxe double"
                />
              </div>
              <div className="form-group">
                <label>Check-in</label>
                <input
                  type="time"
                  value={day.accommodation.checkInTime}
                  onChange={(e) => updateAccommodation({ checkInTime: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label>Check-out</label>
                <input
                  type="time"
                  value={day.accommodation.checkOutTime}
                  onChange={(e) => updateAccommodation({ checkOutTime: e.target.value })}
                />
              </div>
              <div className="form-group ib-span-2">
                <label>Address</label>
                <input
                  type="text"
                  value={day.accommodation.location}
                  onChange={(e) => updateAccommodation({ location: e.target.value })}
                  placeholder="Street, city"
                />
              </div>
              <div className="form-group ib-span-2">
                <label>Stay notes</label>
                <textarea
                  rows={2}
                  value={day.accommodation.notes}
                  onChange={(e) => updateAccommodation({ notes: e.target.value })}
                  placeholder="Check-in instructions, amenities, extra beds."
                />
              </div>
            </div>
          </div>

          <div className="ib-panel">
            <h3 className="ib-panel-title">
              <Bus className="h-4 w-4" /> Transport
            </h3>
            <div className="form-grid">
              <div className="form-group">
                <label>Mode</label>
                <input
                  type="text"
                  value={day.transportation.mode}
                  onChange={(e) => updateTransportation({ mode: e.target.value })}
                  placeholder="e.g., Private cab"
                />
              </div>
              <div className="form-group">
                <label>Vehicle</label>
                <input
                  type="text"
                  value={day.transportation.vehicle}
                  onChange={(e) => updateTransportation({ vehicle: e.target.value })}
                  placeholder="e.g., Innova Crysta"
                />
              </div>
              <div className="form-group">
                <label>Departs at</label>
                <input
                  type="time"
                  value={day.transportation.departureTime}
                  onChange={(e) => updateTransportation({ departureTime: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label>Arrives at</label>
                <input
                  type="time"
                  value={day.transportation.arrivalTime}
                  onChange={(e) => updateTransportation({ arrivalTime: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label>From</label>
                <input
                  type="text"
                  value={day.transportation.departureLocation}
                  onChange={(e) => updateTransportation({ departureLocation: e.target.value })}
                  placeholder="Pickup point"
                />
              </div>
              <div className="form-group">
                <label>To</label>
                <input
                  type="text"
                  value={day.transportation.arrivalLocation}
                  onChange={(e) => updateTransportation({ arrivalLocation: e.target.value })}
                  placeholder="Drop-off point"
                />
              </div>
              <div className="form-group ib-span-2">
                <label>Transport details</label>
                <textarea
                  rows={2}
                  value={day.transportation.details}
                  onChange={(e) => updateTransportation({ details: e.target.value })}
                  placeholder="Driver contact, tolls, wait time, luggage notes."
                />
              </div>
            </div>

            <div className="ib-legs">
              <div className="ib-panel-head">
                <h4 className="ib-subtitle">Transfer legs</h4>
                <button type="button" className="btn-secondary enhanced" onClick={addLeg}>
                  <Plus className="h-4 w-4" /> Add leg
                </button>
              </div>
              {day.transport.length === 0 ? (
                <div className="ib-empty">No transfer legs for this day.</div>
              ) : (
                day.transport.map((leg, index) => (
                  <div key={index} className="ib-leg">
                    <div className="form-group ib-time-field">
                      <label>Time</label>
                      <input
                        type="time"
                        value={leg.time}
                        onChange={(e) => updateLeg(index, { time: e.target.value })}
                      />
                    </div>
                    <div className="form-group">
                      <label>Mode</label>
                      <input
                        type="text"
                        value={leg.mode}
                        onChange={(e) => updateLeg(index, { mode: e.target.value })}
                        placeholder="Flight / bus / cab"
                      />
                    </div>
                    <div className="form-group ib-grow">
                      <label>From</label>
                      <input
                        type="text"
                        value={leg.from}
                        onChange={(e) => updateLeg(index, { from: e.target.value })}
                      />
                    </div>
                    <div className="form-group ib-grow">
                      <label>To</label>
                      <input
                        type="text"
                        value={leg.to}
                        onChange={(e) => updateLeg(index, { to: e.target.value })}
                      />
                    </div>
                    <button
                      type="button"
                      className="icon-btn delete ib-leg-remove"
                      onClick={() => removeLeg(index)}
                      title="Remove leg"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="ib-preview">
            <h3 className="ib-panel-title">
              <MapPin className="h-4 w-4" /> Traveller preview
            </h3>
            <div className="ib-preview-card">
              <div className="ib-preview-head">
                <span className="ib-preview-day">Day {activeDay + 1}</span>
                <span className="ib-preview-title">{day.title || 'Untitled day'}</span>
                <span className="ib-preview-date">{formatDayDate(day.date)}</span>
              </div>
              {day.location && <p className="ib-preview-location"><MapPin className="h-3 w-3" /> {day.location}</p>}
              {day.activities.filter(a => a.name?.trim()).length === 0 ? (
                <p className="ib-preview-empty">No activities scheduled yet.</p>
              ) : (
                <ul className="ib-preview-list">
                  {day.activities.filter(a => a.name?.trim()).map((activity, index) => (
                    <li key={index}>
                      <span className="ib-preview-time">
                        <Clock className="h-3 w-3" /> {activity.time || 'Any time'}
                      </span>
                      <span className="ib-preview-name">
                        {activity.name}
                        {activity.location ? <em> · {activity.location}</em> : null}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
              <div className="ib-preview-foot">
                {day.accommodation.name && (
                  <span><BedDouble className="h-3 w-3" /> {day.accommodation.name}
                    {day.accommodation.checkInTime ? ` · in ${day.accommodation.checkInTime}` : ''}
                    {day.accommodation.checkOutTime ? ` · out ${day.accommodation.checkOutTime}` : ''}
                  </span>
                )}
                {day.transportation.mode && (
                  <span><Bus className="h-3 w-3" /> {day.transportation.mode}
                    {day.transportation.departureTime ? ` · ${day.transportation.departureTime}` : ''}
                  </span>
                )}
                {day.meals.length > 0 && (
                  <span><Coffee className="h-3 w-3" /> {day.meals.join(', ')}</span>
                )}
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}

export default OperatorItineraryBuilder
