import React, { useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import propertyService from './../../services/PropertyService'; // Adjust path


export function PropertyMap() {
  const mapRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);

  const { data: properties, isLoading, isError, error } = useQuery({
    queryKey: ['mapProperties'],
    // Fetch properties with location data. Adjust fields as needed.
    queryFn: () => propertyService.getUserProperties(),
    // Assuming getProperties returns { data: [properties] }
    // and each property has { id, title, listingType, location: { latitude, longitude } }
  });

  useEffect(() => {
    if (!mapRef.current || !properties) return;

    // Initialize map if it doesn't exist
    if (!mapInstanceRef.current) {
      const montevideo: L.LatLngExpression = [-30.9025, -55.5505];
      mapInstanceRef.current = L.map(mapRef.current).setView(montevideo, 12);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
      }).addTo(mapInstanceRef.current);
    }

    const map = mapInstanceRef.current;
    // Clear existing markers before adding new ones (important for updates)
    map.eachLayer((layer) => {
      if (layer instanceof L.Marker) {
        map.removeLayer(layer);
      }
    });

    // Add property markers
    if (properties.items.length > 0) {
      const propertyMarkers: L.Marker[] = [];
      properties.items.forEach(property => {
        if (property.location && property.location.lat && property.location.lng) {
          const position: L.LatLngExpression = [property.location.lat, property.location.lng];
          // Custom icon based on listingType (For Sale / For Rent)
          const iconHtml = `<div class="${property.status === 'sale' ? 'bg-blue-500' : 'bg-green-500'} w-6 h-6 rounded-full flex items-center justify-center text-white font-bold border-2 border-white shadow-md text-xs">A</div>`;

          const customIcon = L.divIcon({
            html: iconHtml,
            className: '', // Important to be empty for Tailwind styles to apply
            iconSize: [24, 24],
            iconAnchor: [12, 24], // Point of the icon which will correspond to marker's location
            popupAnchor: [0, -24] // Point from which the popup should open relative to the iconAnchor
          });

          const marker = L.marker(position, { icon: customIcon })
            .addTo(map)
            .bindPopup(`<b>${property.title}</b><br>${property.status === 'sale' ? 'En venta' : 'En alquiler'}`);
          propertyMarkers.push(marker);
        }
      });

      // Fit map to bounds of all markers if there are any
      if (propertyMarkers.length > 0) {
        const group = L.featureGroup(propertyMarkers);
        map.fitBounds(group.getBounds().pad(0.3)); // Add some padding
      }
    }

    // No cleanup function that removes the map instance here,
    // as we want to preserve it across re-renders unless the component unmounts.
    // The map instance removal should be in the main unmount cleanup.

  }, [properties]); // Re-run effect if properties data changes

  // Cleanup map instance on component unmount
  useEffect(() => {
    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);


  if (isLoading) return <div className="flex items-center justify-center h-full"><p>Cargando mapa...</p></div>;
  if (isError) return <div className="flex items-center justify-center h-full"><p className="text-red-500">Error al cargar propiedades para el mapa: {error?.message}</p></div>;

  return <div ref={mapRef} className="w-full h-full rounded-lg" />;
}