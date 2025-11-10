import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

interface PropertyFormMapProps {
  location: {
    lat: number;
    lng: number;
  };
  onLocationChange: (location: {
    lat: number;
    lng: number;
  }) => void;

}
export function PropertyFormMap({
  location,
  onLocationChange
}: PropertyFormMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  useEffect(() => {
    if (!mapRef.current) return;
    // Initialize map if it doesn't exist
    if (!mapInstanceRef.current) {
      // Default to Madrid center if no location is set
      const defaultLocation = location.lat === 0 && location.lng === 0 ? [-34.9011, -56.1645] : [location.lat, location.lng];
      mapInstanceRef.current = L.map(mapRef.current).setView(defaultLocation as L.LatLngExpression, 12);
      L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; <a href="https://carto.com/">CARTO</a>'
      }).addTo(mapInstanceRef.current);

      const iconHtml = `
            <div class="relative flex items-center justify-center">
            <div class="absolute w-6 h-6 rounded-full bg-[var(--color-primary-500)] animate-ping opacity-75"></div>
            <div class="relative w-6 h-6 rounded-full flex items-center justify-center text-white font-bold border-2 border-white shadow-md text-xs bg-[var(--color-primary-600)]">
                ${'P'}
            </div>
            </div>
        `;

      const customIcon = L.divIcon({
            html: iconHtml,
            className: '',
            iconSize: [24, 24],
            iconAnchor: [12, 24],
            popupAnchor: [0, -24]
        });

      // Add marker
      markerRef.current = L.marker(defaultLocation as L.LatLngExpression, {
        draggable: true,
        icon: customIcon
      }).addTo(mapInstanceRef.current);

      // Update location when marker is dragged
      markerRef.current.on('dragend', () => {
        const marker = markerRef.current;
        if (marker) {
          const position = marker.getLatLng();
          onLocationChange({
            lat: position.lat,
            lng: position.lng
          });
        }
      });
      
      // Update marker position when map is clicked
      mapInstanceRef.current.on('click', (e: L.LeafletMouseEvent) => {
        const marker = markerRef.current;
        if (marker) {
          marker.setLatLng(e.latlng);
          onLocationChange({
            lat: e.latlng.lat,
            lng: e.latlng.lng
          });
        }
      });
    }
    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
        markerRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (mapInstanceRef.current && markerRef.current) {
      const newLatLng = L.latLng(location.lat, location.lng);
      // Only update if the location is significantly different to avoid fighting with user drag
      if (!mapInstanceRef.current.getCenter().equals(newLatLng, 1e-5)) {
        mapInstanceRef.current.setView(newLatLng, 15); // Zoom in a bit more on update
      }
      if (!markerRef.current.getLatLng().equals(newLatLng, 1e-5)) {
        markerRef.current.setLatLng(newLatLng);
      }
    }
  }, [location]);
  return <div ref={mapRef} className="w-full h-full" />;
}