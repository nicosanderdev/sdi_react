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
    queryFn: () => propertyService.getOwnersProperties(),
  });

  useEffect(() => {
    if (!mapRef.current || !properties) return;

    // Initialize map if it doesn't exist
    if (!mapInstanceRef.current) {
      const montevideo: L.LatLngExpression = [-30.9025, -55.5505];
      mapInstanceRef.current = L.map(mapRef.current).setView(montevideo, 12);
      L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; <a href="https://carto.com/">CARTO</a>'
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
              const iconHtml = `
                    <div class="relative flex items-center justify-center">
                    <div class="absolute w-6 h-6 rounded-full bg-[var(--color-primary-500)] animate-ping opacity-75"></div>
                    <div class="relative w-6 h-6 rounded-full flex items-center justify-center text-white font-bold border-2 border-white shadow-md text-xs bg-[var(--color-primary-600)]">
                        ${property.status === 'sale' ? 'S' : 'R'}
                    </div>
                    </div>
                `;

              const customIcon = L.divIcon({
                  html: iconHtml,
                  className: '', // Important so Tailwind styles apply
                  iconSize: [24, 24],
                  iconAnchor: [12, 24],
                  popupAnchor: [0, -24]
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
        map.fitBounds(group.getBounds().pad(0.3));
      }
    }

  }, [properties]);

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