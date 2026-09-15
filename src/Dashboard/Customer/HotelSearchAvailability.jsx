import { useState, useEffect } from 'react'
import { MapPin, Star, Search, Heart, Bed, Wifi, Coffee, Sparkles, Shield, CheckCircle, Utensils, Dumbbell, Waves, AlertCircle, X } from 'lucide-react'
import { Link } from 'react-router-dom'
import CustomerLayout from './CustomerLayout'
import { api } from '../../api'
import '../Dashboard.css'

const HotelSearchAvailability = () => {
  const [hotels, setHotels] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  const [filterRating, setFilterRating] = useState('all')
  const [filterPrice, setFilterPrice] = useState('all')
  const [filterLocation, setFilterLocation] = useState('all')
  const [checkIn, setCheckIn] = useState('')
  const [checkOut, setCheckOut] = useState('')
  const [guests, setGuests] = useState(2)
  const [favorites, setFavorites] = useState([])
  const [selectedHotel, setSelectedHotel] = useState(null)
  const [refreshKey, setRefreshKey] = useState(0)

  useEffect(() => {
    let cancelled = false
    const stored = JSON.parse(localStorage.getItem('favorites_hotels') || '[]')
    Promise.resolve().then(() => setFavorites(stored))
    const load = async () => {
      try {
        setLoading(true)
        setError('')
        const data = await api('/public/hotels')
        if (!cancelled) setHotels(data.hotels || [])
      } catch (err) {
        if (!cancelled) setError(err.message || 'Failed to load hotels')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    Promise.resolve().then(() => load())
    return () => { cancelled = true }
  }, [refreshKey])

  useEffect(() => {
    localStorage.setItem('favorites_hotels', JSON.stringify(favorites))
  }, [favorites])

  const locations = [...new Set(hotels.map(h => h.location).filter(Boolean))]

  const filteredHotels = hotels.filter(hotel => {
    const q = searchTerm.toLowerCase()
    const matchesSearch = !q ||
      hotel.name.toLowerCase().includes(q) ||
      hotel.location.toLowerCase().includes(q) ||
      (hotel.partner || '').toLowerCase().includes(q)
    const matchesRating = filterRating === 'all' ||
                        (filterRating === '3plus' && hotel.rating >= 3) ||
                        (filterRating === '4plus' && hotel.rating >= 4) ||
                        (filterRating === '4.5plus' && hotel.rating >= 4.5)
    const price = hotel.minPrice || 0
    const matchesPrice = filterPrice === 'all' ||
                       (filterPrice === 'budget' && price > 0 && price < 5000) ||
                       (filterPrice === 'mid' && price >= 5000 && price < 10000) ||
                       (filterPrice === 'luxury' && price >= 10000)
    const matchesLocation = filterLocation === 'all' || hotel.location === filterLocation
    return matchesSearch && matchesRating && matchesPrice && matchesLocation
  })

  const toggleFavorite = (id) => {
    setFavorites(prev => prev.includes(id) ? prev.filter(f => f !== id) : [...prev, id])
  }

  const getAmenityIcon = (amenity) => {
    const key = (amenity || '').toLowerCase()
    if (key.includes('wifi')) return <Wifi className="h-3 w-3" />
    if (key.includes('pool')) return <Waves className="h-3 w-3" />
    if (key.includes('spa')) return <Coffee className="h-3 w-3" />
    if (key.includes('gym')) return <Dumbbell className="h-3 w-3" />
    if (key.includes('restaurant') || key.includes('dining')) return <Utensils className="h-3 w-3" />
    return <CheckCircle className="h-3 w-3" />
  }

  const getCategoryBadge = (category) => {
    const badges = {
      luxury: { label: 'Luxury', color: '#8b5cf6' },
      premium: { label: 'Premium', color: '#0ea5e9' },
      boutique: { label: 'Boutique', color: '#f59e0b' },
      heritage: { label: 'Heritage', color: '#ef4444' },
      resort: { label: 'Resort', color: '#22c55e' },
      standard: { label: 'Standard', color: '#64748b' }
    }
    return badges[category] || badges.standard
  }

  const getAvailabilityColor = (available, total) => {
    if (total === 0) return '#94a3b8'
    const percentage = (available / total) * 100
    if (percentage > 50) return '#22c55e'
    if (percentage > 20) return '#f59e0b'
    return '#ef4444'
  }

  return (
    <CustomerLayout
      active="hotels"
      title="Hotels"
      subtitle="Search availability and book your stay"
      actions={
        <div className="header-stats">
          <div className="stat-badge">
            <Sparkles className="h-4 w-4" />
            <span>{hotels.length} properties</span>
          </div>
          <div className="stat-badge">
            <Shield className="h-4 w-4" />
            <span>Verified stays</span>
          </div>
        </div>
      }
    >
      <div className="hotel-search-toolbar">
        <div className="filter-group">
          <label>Check-in</label>
          <input type="date" value={checkIn} onChange={(e) => setCheckIn(e.target.value)} />
        </div>
        <div className="filter-group">
          <label>Check-out</label>
          <input type="date" value={checkOut} onChange={(e) => setCheckOut(e.target.value)} />
        </div>
        <div className="filter-group">
          <label>Guests</label>
          <input type="number" min="1" value={guests} onChange={(e) => setGuests(parseInt(e.target.value) || 1)} />
        </div>
        <button className="btn-primary enhanced" onClick={() => setRefreshKey(k => k + 1)}>
          <Search className="h-4 w-4" /> Search
        </button>
      </div>

      <div className="filters-section enhanced">
        <div className="search-bar enhanced">
          <Search className="search-icon" />
          <input type="text" placeholder="Search hotels by name or location..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
        </div>
        <div className="filter-controls enhanced">
          <div className="filter-group">
            <label>Rating</label>
            <select value={filterRating} onChange={(e) => setFilterRating(e.target.value)} className="filter-select">
              <option value="all">All Ratings</option>
              <option value="3plus">3+ Stars</option>
              <option value="4plus">4+ Stars</option>
              <option value="4.5plus">4.5+ Stars</option>
            </select>
          </div>
          <div className="filter-group">
            <label>Price Range</label>
            <select value={filterPrice} onChange={(e) => setFilterPrice(e.target.value)} className="filter-select">
              <option value="all">All Prices</option>
              <option value="budget">Budget (&lt;₹5k)</option>
              <option value="mid">Mid-Range (₹5k-₹10k)</option>
              <option value="luxury">Luxury (₹10k+)</option>
            </select>
          </div>
          {locations.length > 0 && (
            <div className="filter-group">
              <label>Location</label>
              <select value={filterLocation} onChange={(e) => setFilterLocation(e.target.value)} className="filter-select">
                <option value="all">All Locations</option>
                {locations.map(loc => <option key={loc} value={loc}>{loc}</option>)}
              </select>
            </div>
          )}
        </div>
      </div>

      {loading && <div className="hotel-loading">Loading hotels...</div>}
      {error && <div className="hotel-error"><AlertCircle size={18} /> {error}</div>}
      {!loading && !error && hotels.length === 0 && (
        <div className="hotel-empty">
          <Bed size={48} style={{ color: '#cbd5e1' }} />
          <h4>No hotels available yet</h4>
          <p>Hotel partners haven't listed any properties yet. Check back soon!</p>
        </div>
      )}

      {!loading && !error && filteredHotels.length === 0 && hotels.length > 0 && (
        <div className="hotel-empty">
          <Search size={48} style={{ color: '#cbd5e1' }} />
          <h4>No hotels match your filters</h4>
          <p>Try adjusting your search or filters.</p>
          <button className="btn-secondary" onClick={() => { setSearchTerm(''); setFilterRating('all'); setFilterPrice('all'); setFilterLocation('all') }}>Clear filters</button>
        </div>
      )}

      <div className="hotels-grid enhanced">
        {filteredHotels.map(hotel => {
          const categoryBadge = getCategoryBadge(hotel.category)
          const isFavorite = favorites.includes(hotel._id)
          return (
            <div key={hotel._id} className="hotel-card enhanced">
              <div className="hotel-image enhanced">
                <img className="cp-cover" src={hotel.image} alt={hotel.name} onError={(e) => { e.target.src = 'https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=1200&q=80' }} />
                <button onClick={() => toggleFavorite(hotel._id)} className={`favorite-btn enhanced ${isFavorite ? 'active' : ''}`}>
                  <Heart className="h-5 w-5" fill={isFavorite ? '#ef4444' : 'none'} />
                </button>
                <div className="hotel-category-badge" style={{ backgroundColor: categoryBadge.color }}>
                  <span>{categoryBadge.label}</span>
                </div>
              </div>
              <div className="hotel-content enhanced">
                <div className="hotel-header enhanced">
                  <h3>{hotel.name}</h3>
                  <div className="hotel-rating enhanced">
                    <Star className="h-4 w-4 fill" style={{ color: '#fbbf24', fill: '#fbbf24' }} />
                    <span>{hotel.rating}</span>
                    <small>({hotel.reviewCount} reviews)</small>
                  </div>
                </div>
                <div className="hotel-location enhanced">
                  <MapPin className="h-4 w-4" />
                  <span>{hotel.location}</span>
                </div>
                <p className="hotel-description enhanced">{hotel.description}</p>

                {hotel.amenities && hotel.amenities.length > 0 && (
                  <div className="hotel-amenities enhanced">
                    <h4>Amenities</h4>
                    <div className="amenities-grid">
                      {hotel.amenities.slice(0, 6).map((amenity, idx) => (
                        <span key={idx} className="amenity-tag enhanced">
                          {getAmenityIcon(amenity)}
                          {amenity}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {hotel.totalRooms > 0 && (
                  <div className="hotel-availability enhanced">
                    <div className="availability-header">
                      <Bed className="h-4 w-4" />
                      <span>Room Availability</span>
                    </div>
                    <div className="availability-bar-container">
                      <div className="availability-bar">
                        <div className="availability-fill" style={{ width: `${(hotel.availableRooms / hotel.totalRooms) * 100}%`, backgroundColor: getAvailabilityColor(hotel.availableRooms, hotel.totalRooms) }}></div>
                      </div>
                      <span className="availability-text">{hotel.availableRooms} / {hotel.totalRooms} rooms available</span>
                    </div>
                  </div>
                )}

                <div className="hotel-footer enhanced">
                  <div className="hotel-price enhanced">
                    <div>
                      <small>{hotel.minPrice && hotel.maxPrice && hotel.minPrice !== hotel.maxPrice ? 'Starting from' : 'Per night'}</small>
                      <strong>{hotel.minPrice ? `₹${hotel.minPrice.toLocaleString()}` : 'Price on request'}</strong>
                      {hotel.maxPrice && hotel.minPrice !== hotel.maxPrice && (
                        <small style={{ display: 'block', color: '#64748b' }}>up to ₹{hotel.maxPrice.toLocaleString()}</small>
                      )}
                    </div>
                  </div>
                  <button onClick={() => setSelectedHotel(hotel)} className="btn-secondary enhanced">
                    View Details
                  </button>
                  <Link to="/customer/bookings" className="btn-primary enhanced" state={{ hotel }}>
                    Book Now
                  </Link>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {selectedHotel && (
        <div className="modal-overlay" onClick={() => setSelectedHotel(null)}>
          <div className="modal hotel-detail-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{selectedHotel.name}</h3>
              <button className="modal-close" onClick={() => setSelectedHotel(null)}><X size={18} /></button>
            </div>
            <div className="modal-body">
              <img src={selectedHotel.image} alt={selectedHotel.name} style={{ width: '100%', height: '200px', objectFit: 'cover', borderRadius: '8px', marginBottom: '1rem' }} onError={(e) => { e.target.src = 'https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=1200&q=80' }} />
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem 1rem', marginBottom: '1rem' }}>
                <div><strong>Location:</strong> {selectedHotel.location}</div>
                <div><strong>Rating:</strong> {selectedHotel.rating} ★ ({selectedHotel.reviewCount} reviews)</div>
                <div><strong>Partner:</strong> {selectedHotel.partner || 'Verified'}</div>
                <div><strong>Category:</strong> {getCategoryBadge(selectedHotel.category).label}</div>
              </div>
              <p style={{ color: '#475569', marginBottom: '1rem' }}>{selectedHotel.description}</p>

              {selectedHotel.amenities && selectedHotel.amenities.length > 0 && (
                <div style={{ marginBottom: '1rem' }}>
                  <h4 style={{ margin: '0 0 0.5rem', color: '#0f172a' }}>Amenities</h4>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                    {selectedHotel.amenities.map((a, i) => (
                      <span key={i} style={{ padding: '0.25rem 0.6rem', background: '#f1f5f9', borderRadius: '6px', fontSize: '0.85rem', color: '#334155' }}>{a}</span>
                    ))}
                  </div>
                </div>
              )}

              {selectedHotel.rooms && selectedHotel.rooms.length > 0 && (
                <div style={{ marginBottom: '1rem' }}>
                  <h4 style={{ margin: '0 0 0.5rem', color: '#0f172a' }}>Available Rooms</h4>
                  <table className="data-table">
                    <thead><tr><th>Type</th><th>Price/night</th><th>Available</th></tr></thead>
                    <tbody>
                      {selectedHotel.rooms.map((r, i) => (
                        <tr key={i}>
                          <td>{r.type}</td>
                          <td>₹{(r.price || 0).toLocaleString()}</td>
                          <td>{r.available} / {r.total}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              <div className="form-actions" style={{ justifyContent: 'flex-end', display: 'flex', gap: '0.5rem' }}>
                <button className="btn-secondary" onClick={() => setSelectedHotel(null)}>Close</button>
                <Link to="/customer/bookings" className="btn-primary enhanced" state={{ hotel: selectedHotel }} onClick={() => setSelectedHotel(null)}>
                  Book Now
                </Link>
              </div>
            </div>
          </div>
        </div>
      )}
    </CustomerLayout>
  )
}

export default HotelSearchAvailability