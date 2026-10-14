import { useState, useEffect } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, MapPin, Calendar, Users, Star, Heart, Mountain, Waves, Landmark, Leaf, ExternalLink, Loader2, Share2, Bookmark } from 'lucide-react';
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
  const { id } = useParams();
  const [destinationId, setDestinationId] = useState(null);
  const [destination, setDestination] = useState(null);
  const [packages, setPackages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [favorites, setFavorites] = useState([]);
  const [coordinates, setCoordinates] = useState(null);

  useEffect(() => {
    if (id) {
      setDestinationId(id);
    }
  }, [id]);

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

  const handleShare = () => {
    if (navigator.share) {
      navigator.share({
        title: destination?.destination || destination?.name || 'Travel Destination',
        text: `Check out this amazing destination: ${destination?.destination || destination?.name}`,
        url: window.location.href,
      }).catch(() => {});
    } else {
      navigator.clipboard.writeText(window.location.href);
      alert('Link copied to clipboard!');
    }
  };

  if (loading && !destination) {
    return (
      <CustomerLayout
        active="destinations"
        title="Destination Details"
        subtitle="Loading..."
      >
        <div className="dd-loading">
          <Loader2 className="h-8 w-8 animate-spin" />
          <p>Loading destination...</p>
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
        <div className="dd-error">
          <p>{error}</p>
          <Link to="/customer/destinations" className="btn-primary">
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
        <div className="dd-error">
          <p>Destination not found</p>
          <Link to="/customer/destinations" className="btn-primary">
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
  const exclusions = Array.isArray(destination.exclusions) ? destination.exclusions : [];
  const images = Array.isArray(destination.images) ? destination.images : (destination.image ? [destination.image] : []);
  const hasPrice = destination.price && Number(destination.price) > 0;
  const priceValue = hasPrice ? Number(destination.price).toLocaleString() : null;
  const rating = Number(destination.rating) || 4.5;

  return (
    <CustomerLayout
      active="destinations"
      title={destName}
      subtitle={`Explore ${destName} — ${typeLabel} destination`}
      actions={
        <div className="dd-header-actions">
          <Link to="/customer/destinations" className="dd-icon-btn" aria-label="Back to Destinations">
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <button className="dd-icon-btn" onClick={handleShare} aria-label="Share destination">
            <Share2 className="h-4 w-4" />
          </button>
          <button
            className={`dd-icon-btn ${favorites.includes(destinationId) ? 'active' : ''}`}
            onClick={() => toggleFavorite(destinationId)}
            aria-label={favorites.includes(destinationId) ? 'Remove from wishlist' : 'Add to wishlist'}
          >
            <Bookmark className="h-4 w-4" />
          </button>
        </div>
      }
    >
      <div className="destination-detail">
        {/* Hero Section */}
        <section className="dd-hero" aria-labelledby="destination-title">
          {images.length > 0 && (
            <div className="dd-hero-image">
              <img src={images[0]} alt={destName} className="dd-hero-img" />
            </div>
          )}
          <div className="dd-hero-overlay">
            <div className="dd-hero-content">
              <div className="dd-hero-meta">
                <Link to="/customer/destinations" className="dd-back-link">
                  <ArrowLeft className="h-4 w-4" />
                  <span>Back to Destinations</span>
                </Link>
                <span className="dd-type-badge" style={{ backgroundColor: typeColor }}>
                  <TypeIcon className="h-4 w-4" />
                  <span>{typeLabel}</span>
                </span>
              </div>
              <h1 id="destination-title" className="dd-title">{destName}</h1>
              <div className="dd-rating-row">
                <div className="dd-rating">
                  <Star className="h-5 w-5 fill" aria-hidden="true" />
                  <span className="dd-rating-value">{rating.toFixed(1)}</span>
                  <span className="dd-rating-count">({Math.round(rating * 20)}+ reviews)</span>
                </div>
                <div className="dd-location">
                  <MapPin className="h-4 w-4" aria-hidden="true" />
                  <span>{destName}</span>
                  {coordinates && (
                    <>
                      <span className="dd-separator" aria-hidden="true">·</span>
                      <span className="dd-coords">{coordinates.lat.toFixed(4)}°, {coordinates.lng.toFixed(4)}°</span>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Main Content Grid */}
        <div className="dd-grid">
          {/* Left Column - Destination Info */}
          <main className="dd-main" role="main">
            {/* About Section */}
            <section className="dd-section" aria-labelledby="about-heading">
              <h2 id="about-heading" className="dd-section-title">About {destName}</h2>
              <div className="dd-description">
                <p>{destination.description || destination.shortDescription || 'Explore this amazing destination with our curated tour packages.'}</p>
              </div>
            </section>

            {/* Highlights Section */}
            {highlights.length > 0 && (
              <section className="dd-section" aria-labelledby="highlights-heading">
                <h2 id="highlights-heading" className="dd-section-title">Highlights</h2>
                <ul className="dd-highlights-grid" role="list">
                  {highlights.map((highlight, idx) => (
                    <li key={idx} className="dd-highlight-item">
                      <span className="dd-highlight-icon" aria-hidden="true">
                        <Star className="h-5 w-5" />
                      </span>
                      <span className="dd-highlight-text">{highlight}</span>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {/* Inclusions & Exclusions */}
            {(inclusions.length > 0 || exclusions.length > 0) && (
              <section className="dd-section" aria-labelledby="inclusions-heading">
                <h2 id="inclusions-heading" className="dd-section-title">What's Included</h2>
                <div className="dd-inclusions-grid">
                  {inclusions.length > 0 && (
                    <div className="dd-inclusion-group">
                      <h3 className="dd-inclusion-group-title">
                        <span className="dd-inclusion-icon" aria-hidden="true">✓</span>
                        Inclusions
                      </h3>
                      <ul className="dd-inclusion-list" role="list">
                        {inclusions.map((item, idx) => (
                          <li key={idx} className="dd-inclusion-item">
                            <span className="dd-check" aria-hidden="true">✓</span>
                            <span>{item}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {exclusions.length > 0 && (
                    <div className="dd-inclusion-group">
                      <h3 className="dd-inclusion-group-title">
                        <span className="dd-exclusion-icon" aria-hidden="true">✕</span>
                        Exclusions
                      </h3>
                      <ul className="dd-inclusion-list" role="list">
                        {exclusions.map((item, idx) => (
                          <li key={idx} className="dd-inclusion-item">
                            <span className="dd-cross" aria-hidden="true">✕</span>
                            <span>{item}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </section>
            )}

            {/* Quick Info */}
            <section className="dd-section" aria-labelledby="quick-info-heading">
              <h2 id="quick-info-heading" className="dd-section-title">Quick Info</h2>
              <div className="dd-quick-grid" role="list">
                <div className="dd-quick-item" role="listitem">
                  <div className="dd-quick-icon" aria-hidden="true">
                    <Calendar className="h-5 w-5" />
                  </div>
                  <div className="dd-quick-content">
                    <span className="dd-quick-label">Duration</span>
                    <span className="dd-quick-value">{destination.duration || '3–5 Days'}</span>
                  </div>
                </div>
                <div className="dd-quick-item" role="listitem">
                  <div className="dd-quick-icon" aria-hidden="true">
                    <Users className="h-5 w-5" />
                  </div>
                  <div className="dd-quick-content">
                    <span className="dd-quick-label">Group Size</span>
                    <span className="dd-quick-value">2–20 people</span>
                  </div>
                </div>
                <div className="dd-quick-item" role="listitem">
                  <div className="dd-quick-icon" aria-hidden="true">
                    <Star className="h-5 w-5" />
                  </div>
                  <div className="dd-quick-content">
                    <span className="dd-quick-label">Rating</span>
                    <span className="dd-quick-value">{rating.toFixed(1)}/5</span>
                  </div>
                </div>
                <div className="dd-quick-item" role="listitem">
                  <div className="dd-quick-icon" aria-hidden="true">
                    <MapPin className="h-5 w-5" />
                  </div>
                  <div className="dd-quick-content">
                    <span className="dd-quick-label">Best Time</span>
                    <span className="dd-quick-value">October – March</span>
                  </div>
                </div>
              </div>
            </section>

            {/* Map & Weather Section */}
            <section className="dd-section" aria-labelledby="map-weather-heading">
              <h2 id="map-weather-heading" className="dd-section-title">Location & Weather</h2>
              <div className="dd-map-weather-grid">
                <div className="dd-map-wrapper">
                  <MapComponent
                    destination={destName}
                    coordinates={coordinates}
                  />
                </div>
                <div className="dd-weather-wrapper">
                  {coordinates ? (
                    <WeatherComponent
                      latitude={coordinates.lat}
                      longitude={coordinates.lng}
                      destination={destName}
                      timezone="Asia/Kolkata"
                    />
                  ) : (
                    <div className="dd-weather-unavailable">
                      <MapPin className="h-10 w-10" aria-hidden="true" />
                      <p>Weather data unavailable</p>
                      <small>Coordinates not found for this destination</small>
                    </div>
                  )}
                </div>
              </div>
            </section>

            {/* Related Packages */}
            {packages.length > 0 && (
              <section className="dd-section" aria-labelledby="related-heading">
                <h2 id="related-heading" className="dd-section-title">Related Packages</h2>
                <div className="dd-related-grid" role="list">
                  {packages.map((pkg) => (
                    <Link key={pkg._id} to={`/customer/packages?id=${pkg._id}`} className="dd-related-card" role="listitem">
                      <div className="dd-related-image">
                        <img
                          src={pkg.image || images[0] || 'https://images.unsplash.com/photo-1488646953014-85cb44e25828?auto=format&fit=crop&w=800&q=80'}
                          alt={pkg.name}
                          loading="lazy"
                        />
                      </div>
                      <div className="dd-related-content">
                        <h3 className="dd-related-title">{pkg.name}</h3>
                        <p className="dd-related-meta">
                          <span>{pkg.duration}</span>
                          <span className="dd-separator" aria-hidden="true">·</span>
                          <span>₹{Number(pkg.price).toLocaleString()}</span>
                        </p>
                      </div>
                    </Link>
                  ))}
                </div>
                <div className="dd-related-footer">
                  <Link to={`/customer/packages?destination=${encodeURIComponent(destName)}`} className="btn-secondary">
                    View All Packages for {destName}
                    <ExternalLink className="h-4 w-4" aria-hidden="true" />
                  </Link>
                </div>
              </section>
            )}
          </main>

          {/* Right Column - Booking Summary Card */}
          <aside className="dd-sidebar" aria-labelledby="booking-summary-heading">
            <div className="dd-summary-card" id="booking-summary-heading">
              <div className="dd-summary-header">
                <h2 className="dd-summary-title">Book Your Trip</h2>
              </div>
              <div className="dd-price-section">
                {hasPrice ? (
                  <>
                    <span className="dd-price-label">Starting from</span>
                    <div className="dd-price-row">
                      <span className="dd-price-amount">₹{priceValue}</span>
                      <span className="dd-price-unit">/ person</span>
                    </div>
                  </>
                ) : (
                  <div className="dd-price-unavailable">
                    <span className="dd-price-label">Price unavailable</span>
                    <p className="dd-price-note">Contact us for custom package pricing</p>
                  </div>
                )}
              </div>
              <Link
                to={`/customer/packages?destination=${encodeURIComponent(destName)}`}
                className="dd-cta-primary"
              >
                View All Packages
              </Link>
              <button
                className={`dd-cta-secondary ${favorites.includes(destinationId) ? 'active' : ''}`}
                onClick={() => toggleFavorite(destinationId)}
              >
                <Heart className="h-4 w-4" aria-hidden="true" />
                <span>{favorites.includes(destinationId) ? 'Saved to Wishlist' : 'Save to Wishlist'}</span>
              </button>
              <div className="dd-summary-features">
                <div className="dd-feature">
                  <span className="dd-feature-icon" aria-hidden="true">✓</span>
                  <span>Free cancellation on most packages</span>
                </div>
                <div className="dd-feature">
                  <span className="dd-feature-icon" aria-hidden="true">✓</span>
                  <span>Best price guarantee</span>
                </div>
                <div className="dd-feature">
                  <span className="dd-feature-icon" aria-hidden="true">✓</span>
                  <span>24/7 customer support</span>
                </div>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </CustomerLayout>
  );
};

export default DestinationDetail;