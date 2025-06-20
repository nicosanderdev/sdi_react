import React, { useEffect, useRef } from 'react';
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
      const defaultLocation = location.lat === 0 ? [40.416775, -3.70379] : [location.lat, location.lng];
      mapInstanceRef.current = L.map(mapRef.current).setView(defaultLocation as L.LatLngExpression, 13);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
      }).addTo(mapInstanceRef.current);
      // Add marker
      markerRef.current = L.marker(defaultLocation as L.LatLngExpression, {
        draggable: true
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
  return <div ref={mapRef} className="w-full h-full" />;
}