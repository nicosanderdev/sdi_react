import React, { useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import propertyService from './../../services/PropertyService'; // Adjust path

// Default Leaflet icon fix (if you haven't set this up globally)
import iconRetinaUrl from 'leaflet/dist/images/marker-icon-2x.png';
import iconUrl from 'leaflet/dist/images/marker-icon.png';
import shadowUrl from 'leaflet/dist/images/marker-shadow.png';

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl,
  iconUrl,
  shadowUrl,
});


export function PropertyMap() {
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);

  const { data: propertiesData, isLoading, isError, error } = useQuery({
    queryKey: ['mapProperties'],
    // Fetch properties with location data. Adjust fields as needed.
    queryFn: () => propertyService.getProperties({ fields: 'id,title,listingType,location' }),
    // Assuming getProperties returns { data: [properties] }
    // and each property has { id, title, listingType, location: { latitude, longitude } }
  });
  const properties = propertiesData?.data || [];

  useEffect(() => {
    if (!mapRef.current || !properties) return;

    // Initialize map if it doesn't exist
    if (!mapInstanceRef.current) {
      const madrid = [40.416775, -3.70379]; // Default center
      mapInstanceRef.current = L.map(mapRef.current).setView(madrid, 12);
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
    if (properties.length > 0) {
      const propertyMarkers = [];
      properties.forEach(property => {
        if (property.location && property.location.latitude && property.location.longitude) {
          const position = [property.location.latitude, property.location.longitude];
          // Custom icon based on listingType (For Sale / For Rent)
          const iconHtml = `<div class="${property.listingType === 'FOR_SALE' ? 'bg-blue-500' : 'bg-green-500'} w-6 h-6 rounded-full flex items-center justify-center text-white font-bold border-2 border-white shadow-md text-xs">P</div>`;

          const customIcon = L.divIcon({
            html: iconHtml,
            className: '', // Important to be empty for Tailwind styles to apply
            iconSize: [24, 24],
            iconAnchor: [12, 24], // Point of the icon which will correspond to marker's location
            popupAnchor: [0, -24] // Point from which the popup should open relative to the iconAnchor
          });

          const marker = L.marker(position, { icon: customIcon })
            .addTo(map)
            .bindPopup(`<b>${property.title}</b><br>${property.listingType === 'FOR_SALE' ? 'En venta' : 'En alquiler'}`);
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