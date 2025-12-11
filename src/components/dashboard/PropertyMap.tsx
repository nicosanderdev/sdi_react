import { useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import propertyService from './../../services/PropertyService'; // Adjust path


export function PropertyMap() {
  const mapRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<mapboxgl.Map | null>(null);

  const { data: properties, isLoading, isError, error } = useQuery({
    queryKey: ['mapProperties'],
    queryFn: () => propertyService.getOwnersProperties(),
  });

  useEffect(() => {
    if (!mapRef.current || !properties) return;

    // Initialize map if it doesn't exist
    if (!mapInstanceRef.current) {
      // Set the access token - replace with your actual token from environment variable
      const mapboxToken = import.meta.env.VITE_MAPBOX_TOKEN;
      mapboxgl.accessToken = mapboxToken;

      mapInstanceRef.current = new mapboxgl.Map({
        container: mapRef.current,
        style: 'mapbox://styles/mapbox/streets-v12',
        center: [-55.5505, -30.9025],
        zoom: 12
      });
    }

    const map = mapInstanceRef.current;
    const markers: mapboxgl.Marker[] = [];

    if (properties.items.length > 0) {
      properties.items.forEach(property => {
        if (property.location && property.location.lat && property.location.lng) {
          const iconHtml = `
            <div class="relative flex items-center justify-center">
              <div class="absolute w-6 h-6 rounded-full bg-[var(--color-primary-500)] animate-ping opacity-75"></div>
              <div class="relative w-6 h-6 rounded-full flex items-center justify-center text-white font-bold border-2 border-white shadow-md text-xs bg-[var(--color-primary-600)]">
                ${property.status === 'sale' ? 'S' : 'R'}
              </div>
            </div>
          `;

          // Create a DOM element for the marker
          const el = document.createElement('div');
          el.innerHTML = iconHtml;
          el.style.width = '24px';
          el.style.height = '24px';

          const marker = new mapboxgl.Marker(el)
            .setLngLat([property.location.lng, property.location.lat])
            .addTo(map);

          // Add popup
          const popup = new mapboxgl.Popup({ offset: 25 })
            .setHTML(`<b>${property.title}</b><br>${property.status === 'sale' ? 'En venta' : 'En alquiler'}`);

          marker.setPopup(popup);
          markers.push(marker);
        }
      });

      // Fit bounds to markers if any exist
      if (markers.length > 0) {
        const bounds = new mapboxgl.LngLatBounds();

        markers.forEach(marker => {
          const lngLat = marker.getLngLat();
          bounds.extend(lngLat);
        });

        map.fitBounds(bounds, { padding: 50 }); // Add some padding
      }
    }

  }, [properties]);

  // Cleanup instance on unmount
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