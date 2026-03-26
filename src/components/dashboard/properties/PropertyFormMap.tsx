import { useEffect, useRef } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';

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
  const mapInstanceRef = useRef<mapboxgl.Map | null>(null);
  const markerRef = useRef<mapboxgl.Marker | null>(null);
  const isInternalUpdateRef = useRef(false);

  const effectiveLocation = location ?? { lat: -34.9011, lng: -56.1645 };

  useEffect(() => {
    if (!mapRef.current) return;

    // Initialize map if it doesn't exist
    if (!mapInstanceRef.current) {
      // Set the access token
      const mapboxToken = import.meta.env.VITE_MAPBOX_TOKEN;
      mapboxgl.accessToken = mapboxToken;

      // Default to Montevideo center if no location is set or location is (0,0)
      const defaultLocation =
        !location || (location.lat === 0 && location.lng === 0)
          ? [-34.9011, -56.1645]
          : [location.lng, location.lat];

      mapInstanceRef.current = new mapboxgl.Map({
        container: mapRef.current,
        style: 'mapbox://styles/mapbox/streets-v12',
        center: defaultLocation as mapboxgl.LngLatLike,
        zoom: 12
      });

      // Create custom marker element
      const iconHtml = `
        <div class="relative flex items-center justify-center">
          <div class="absolute w-6 h-6 rounded-full bg-[var(--color-primary-500)] animate-ping opacity-75"></div>
          <div class="relative w-6 h-6 rounded-full flex items-center justify-center text-white font-bold border-2 border-white shadow-md text-xs bg-[var(--color-primary-600)] cursor-move">
            P
          </div>
        </div>
      `;

      const el = document.createElement('div');
      el.innerHTML = iconHtml;
      el.style.width = '24px';
      el.style.height = '24px';

      // Add draggable marker
      markerRef.current = new mapboxgl.Marker(el, { draggable: true })
        .setLngLat(defaultLocation as mapboxgl.LngLatLike)
        .addTo(mapInstanceRef.current);

      // Update location when marker is dragged
      markerRef.current.on('dragend', () => {
        const marker = markerRef.current;
        if (marker) {
          const lngLat = marker.getLngLat();
          isInternalUpdateRef.current = true;
          onLocationChange({
            lat: lngLat.lat,
            lng: lngLat.lng
          });
          // Reset after a short delay to allow the useEffect to see it
          setTimeout(() => { isInternalUpdateRef.current = false; }, 100);
        }
      });

      // Update marker position when map is clicked
      mapInstanceRef.current.on('click', (e) => {
        const marker = markerRef.current;
        if (marker) {
          marker.setLngLat(e.lngLat);
          isInternalUpdateRef.current = true;
          onLocationChange({
            lat: e.lngLat.lat,
            lng: e.lngLat.lng
          });
          // Reset after a short delay to allow the useEffect to see it
          setTimeout(() => { isInternalUpdateRef.current = false; }, 100);
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
    if (!location) {
      return;
    }

    if (mapInstanceRef.current && markerRef.current && !isInternalUpdateRef.current) {
      const newLngLat = [location.lng, location.lat] as mapboxgl.LngLatLike;
      const currentCenter = mapInstanceRef.current.getCenter();

      // Only update if the location is significantly different to avoid fighting with user drag
      if (Math.abs(currentCenter.lat - location.lat) > 0.0001 || Math.abs(currentCenter.lng - location.lng) > 0.0001) {
        mapInstanceRef.current.flyTo({
          center: newLngLat,
          zoom: 15,
          essential: true
        });
      }

      const currentMarkerLngLat = markerRef.current.getLngLat();
      if (Math.abs(currentMarkerLngLat.lat - location.lat) > 1e-6 || Math.abs(currentMarkerLngLat.lng - location.lng) > 1e-6) {
        markerRef.current.setLngLat(newLngLat);
      }
    }
  }, [location]);

  return <div ref={mapRef} className="w-full h-full" />;
}