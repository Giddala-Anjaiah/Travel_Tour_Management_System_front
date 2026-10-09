import { useEffect, useRef, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { ExternalLink, Loader2, MapPin } from 'lucide-react';

delete L.Icon.Default.prototype._getIconUrl;

L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

function CustomMarker({ position, name, coords }) {
  const map = useMap();
  useEffect(() => {
    map.flyTo(position, 12, { animate: true, duration: 1 });
  }, [position, map]);

  return (
    <Marker position={position}>
      <Popup>
        <div className="map-popup">
          <strong>{name}</strong>
          <br />
          <small>{coords.lat.toFixed(4)}, {coords.lng.toFixed(4)}</small>
        </div>
      </Popup>
    </Marker>
  );
}

function MapComponent({ destination, coordinates, onGetDirections }) {
  const [mapReady, setMapReady] = useState(false);
  const containerRef = useRef(null);

  const position = coordinates ? [coordinates.lat, coordinates.lng] : [20.5937, 78.9629];
  const zoom = coordinates ? 12 : 5;

  useEffect(() => {
    if (coordinates) {
      setMapReady(true);
    }
  }, [coordinates]);

  return (
    <div className="map-container" ref={containerRef}>
      {!mapReady ? (
        <div className="map-loading">
          <Loader2 className="h-8 w-8 animate-spin" />
          <p>Loading map...</p>
        </div>
      ) : (
        <>
          <MapContainer
            center={position}
            zoom={zoom}
            scrollWheelZoom={true}
            className="leaflet-map"
            style={{ height: '100%', width: '100%' }}
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            {coordinates && <CustomMarker position={position} name={destination} coords={coordinates} />}
          </MapContainer>
          <div className="map-directions">
            <a
              href={`https://www.google.com/maps/dir/?api=1&destination=${coordinates.lat},${coordinates.lng}`}
              target="_blank"
              rel="noopener noreferrer"
              className="directions-link"
              onClick={onGetDirections}
            >
              <ExternalLink className="h-4 w-4" />
              <span>Get Directions</span>
            </a>
          </div>
        </>
      )}
    </div>
  );
}

export default MapComponent;