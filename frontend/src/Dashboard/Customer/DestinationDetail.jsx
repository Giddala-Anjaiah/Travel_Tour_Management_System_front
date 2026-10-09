import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, MapPin, Calendar, Users, Star, Heart, Mountain, Waves, Landmark, Leaf, ExternalLink, Loader2 } from 'lucide-react';
import CustomerLayout from './CustomerLayout';
import { api } from '../../api';
import { getCoordinatesForDestination } from '../../utils/coordinates';
import MapComponent from '../../components/Map';
import WeatherComponent from '../../components/Weather';
import '../Dashboard.css';

const TYPE_ICONS = {
  beach: Waves,
  nature: Leaf,
  adventure: Mountain,
  heritage: Landmark,
  tour: MapPin,
};

const TYPE_COLORS = {
  beach: '#0e7490',
  nature: '#15803d',
  adventure: '#b45309',
  heritage: '#6d28d9',
  tour: '#475569',
};

const TYPE_LABELS = {
  beach: 'Beach',
  nature: 'Nature',
  adventure: 'Adventure',
  heritage: 'Heritage',
  tour: 'Tour',
};

const DestinationDetail = () => {
  const [destinationId, setDestinationId] = useState(null);
  const [destination, setDestination] = useState(null);
  const [packages, setPackages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [favorites, setFavorites] = useState([]);
  const [coordinates, setCoordinates] = useState(null);
  const [mapDirectionsOpened, setMapDirectionsOpened] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const id = params.get('id');
    const name = params.get('name');
    
    if (id) {
      setDestinationId(id);
    } else if (name) {
      loadDestinationByName(name);
    }
  }, []);

  const loadDestinationByName = async (name) => {
    try {
      setError('');
      setLoading(true);
      const data = await api('/packages', { params: { publishedOnly: 'true', limit: 'all' } });
      const pkg = (data.packages || []).find(p => 
        p.destination?.toLowerCase() === name.toLowerCase() || 
        p.name?.toLowerCase() === name.toLowerCase()
      );
      if (pkg) {
        setDestinationId(pkg._id);
        await loadDestination(pkg._id);
      } else {
        setError('Destination not found');
        setLoading(false);
      }
    } catch (err) {
      setError(err.message || 'Failed to load destination');
      setLoading(false);
    }
  };

  const loadDestination = async (id) => {
    try {
      setError('');
      setLoading(true);
      const data = await api(`/packages/${id}`);
      setDestination(data.package || data);
      
      if (data.package?.destination) {
        const coords = getCoordinatesForDestination(data.package.destination);
        setCoordinates(coords);
      }
      
      const packagesData = await api('/packages', { params: { publishedOnly: 'true', limit: 'all' } });
      const relatedPackages = (packagesData.packages || [])
        .filter(p => p.destination === (data.package?.destination || data.destination) && p._id !== id)
        .slice(0, 4);
      setPackages(relatedPackages);
    } catch (err) {
      setError(err.message || 'Failed to load destination');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (destinationId) {
      loadDestination(destinationId);
    }
  }, [destinationId]);

  const toggleFavorite = (id) => {
    setFavorites((prev) => (prev.includes(id) ? prev.filter((f) => f !== id) : [...prev, id]));
  };

  const handleGetDirections = () => {
    setMapDirectionsOpened(true);
  };

  if (loading && !destination) {
    return (
      <CustomerLayout
        active="destinations"
        title="Destination Details"
        subtitle="Loading..."
      >
        <div className="cd-card" style={{ textAlign: 'center', padding: '3rem' }}>
          <Loader2 className="h-8 w-8 animate-spin mx-auto" />
          <p style={{ color: '#64748b', marginTop: '1rem' }}>Loading destination...</p>
        </div>
      </CustomerLayout>
    );
  }

  if (error) {
    return (
      <CustomerLayout
        active="destinations"
        title="Destination Details"
        subtitle="Error"
      >
        <div className="cd-card cd-alert warning" style={{ textAlign: 'center', padding: '3rem' }}>
          <p>{error}</p>
          <Link to="/customer/destinations" className="btn-primary" style={{ marginTop: '1rem', display: 'inline-flex' }}>
            <ArrowLeft className="h-4 w-4" /> Back to Destinations
          </Link>
        </div>
      </CustomerLayout>
    );
  }

  if (!destination) {
    return (
      <CustomerLayout
        active="destinations"
        title="Destination Details"
        subtitle="Not found"
      >
        <div className="cd-card" style={{ textAlign: 'center', padding: '3rem' }}>
          <p style={{ color: '#64748b' }}>Destination not found</p>
          <Link to="/customer/destinations" className="btn-primary" style={{ marginTop: '1rem', display: 'inline-flex' }}>
            <ArrowLeft className="h-4 w-4" /> Back to Destinations
          </Link>
        </div>
      </CustomerLayout>
    );
  }

  const destName = destination.destination || destination.name;
  const destType = destination.category || 'tour';
  const TypeIcon = TYPE_ICONS[destType] || MapPin;
  const typeColor = TYPE_COLORS[destType] || '#475569';
  const typeLabel = TYPE_LABELS[destType] || 'Tour';

  const highlights = Array.isArray(destination.highlights) ? destination.highlights : [];
  const inclusions = Array.isArray(destination.inclusions) ? destination.inclusions : [];
  const images = Array.isArray(destination.images) ? destination.images : (destination.image ? [destination.image] : []);

  return (
    <CustomerLayout
      active="destinations"
      title={destName}
      subtitle={`Explore ${destName} - ${typeLabel} destination`}
      actions={
        <div className="header-stats">
          <div className="stat-badge">
            <ExternalLink className="h-4 w-4" />
            <span onClick={handleGetDirections} style={{ cursor: 'pointer' }}>Get Directions</span>
          </div>
        </div>
      }
    >
      <div className="destination-detail">
        <div className="detail-hero">
          {images.length > 0 && (
            <div className="hero-image">
              <img src={images[0]} alt={destName} className="detail-cover" />
            </div>
          )}
          <div className="detail-header-content">
            <div className="detail-meta-top">
              <Link to="/customer/destinations" className="back-link">
                <ArrowLeft className="h-4 w-4" /> Back to Destinations
              </Link>
              <div className="detail-type-badge" style={{ backgroundColor: typeColor }}>
                <TypeIcon className="h-4 w-4" />
                <span>{typeLabel}</span>
              </div>
            </div>
            <h1 className="detail-title">{destName}</h1>
            <div className="detail-rating">
              <Star className="h-5 w-5 fill" />
              <span>{Number(destination.rating) || 4.5}</span>
              <small>({Math.round((Number(destination.rating) || 4.5) * 20)} reviews)</small>
            </div>
            <div className="detail-location">
              <MapPin className="h-4 w-4" />
              <span>{destName}</span>
              {coordinates && (
                <>
                  <span className="coord-separator">·</span>
                  <span className="coordinates">{coordinates.lat.toFixed(4)}°, {coordinates.lng.toFixed(4)}°</span>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="detail-content">
          <div className="detail-main">
            <div className="detail-section">
              <h2>About</h2>
              <p className="detail-description">{destination.description || destination.shortDescription || 'Explore this amazing destination with our curated tour packages.'}</p>
            </div>

            {highlights.length > 0 && (
              <div className="detail-section">
                <h2>Highlights</h2>
                <div className="highlights-grid">
                  {highlights.map((highlight, idx) => (
                    <div key={idx} className="highlight-card">
                      <Star className="h-4 w-4" />
                      <span>{highlight}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {inclusions.length > 0 && (
              <div className="detail-section">
                <h2>Inclusions</h2>
                <ul className="inclusions-list">
                  {inclusions.map((item, idx) => (
                    <li key={idx}>{item}</li>
                  ))}
                </ul>
              </div>
            )}

            <div className="detail-section">
              <h2>Quick Info</h2>
              <div className="quick-info-grid">
                <div className="quick-info-item">
                  <Calendar className="h-5 w-5" />
                  <div>
                    <small>Duration</small>
                    <strong>{destination.duration || '3-5 Days'}</strong>
                  </div>
                </div>
                <div className="quick-info-item">
                  <Users className="h-5 w-5" />
                  <div>
                    <small>Group Size</small>
                    <strong>2-20 people</strong>
                  </div>
                </div>
                <div className="quick-info-item">
                  <Star className="h-5 w-5" />
                  <div>
                    <small>Rating</small>
                    <strong>{Number(destination.rating) || 4.5}/5</strong>
                  </div>
                </div>
                <div className="quick-info-item">
                  <MapPin className="h-5 w-5" />
                  <div>
                    <small>Best Time</small>
                    <strong>October - March</strong>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="detail-sidebar">
            <div className="detail-card price-card">
              <div className="detail-price">
                <small>Starting from</small>
                <strong>₹{Number(destination.price || 0).toLocaleString()}</strong>
                <span>/ person</span>
              </div>
              <Link to={`/customer/packages?destination=${encodeURIComponent(destName)}`} className="btn-primary full-width">
                View All Packages
              </Link>
              <button className={`favorite-btn-large ${favorites.includes(destinationId) ? 'active' : ''}`} onClick={() => toggleFavorite(destinationId)}>
                <Heart className="h-5 w-5" />
                <span>{favorites.includes(destinationId) ? 'Saved' : 'Save Destination'}</span>
              </button>
            </div>

            <div className="detail-card map-weather-card">
              <h3>Location & Weather</h3>
              <div className="map-weather-grid">
                <div className="map-section">
                  <MapComponent
                    destination={destName}
                    coordinates={coordinates}
                    onGetDirections={handleGetDirections}
                  />
                </div>
                <div className="weather-section-wrapper">
                  {coordinates && (
                    <WeatherComponent
                      latitude={coordinates.lat}
                      longitude={coordinates.lng}
                      destination={destName}
                      timezone="Asia/Kolkata"
                    />
                  )}
                  {!coordinates && (
                    <div className="weather-unavailable">
                      <MapPin className="h-12 w-12 text-gray-400" />
                      <p>Weather data not available for this destination</p>
                      <small>Coordinates not found in our database</small>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {packages.length > 0 && (
              <div className="detail-card related-packages">
                <h3>Related Packages</h3>
                <div className="related-packages-list">
                  {packages.map((pkg) => (
                    <Link key={pkg._id} to={`/customer/packages?id=${pkg._id}`} className="related-package-item">
                      <img src={pkg.image || images[0] || 'https://images.unsplash.com/photo-1488646953014-85cb44e25828?auto=format&fit=crop&w=800&q=80'} alt={pkg.name} className="related-package-image" />
                      <div className="related-package-info">
                        <h4>{pkg.name}</h4>
                        <p>{pkg.duration} • ₹{Number(pkg.price).toLocaleString()}</p>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </CustomerLayout>
  );
};

export default DestinationDetail;