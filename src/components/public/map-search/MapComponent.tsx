import { MapContainer, TileLayer, Marker, useMap, useMapEvents, Tooltip } from 'react-leaflet';
import { PublicProperty } from '../../../models/properties';

import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useEffect, useRef } from 'react';

function MapEvents({ setMapBounds }: { setMapBounds: (bounds: L.LatLngBoundsExpression) => void }) {
    const initialBoundsSet = useRef(false);
    const map = useMap();

    useEffect(() => {
        if (!initialBoundsSet.current && map) {
            initialBoundsSet.current = true;
            setMapBounds(map.getBounds());
        }
    }, [map, setMapBounds]);

    useMapEvents({
        moveend: (e) => {
            setMapBounds(e.target.getBounds());
        },
        zoomend: (e) => {
            setMapBounds(e.target.getBounds());
        },
    });

    return null;
}

function MapController({ 
    center, 
    zoom 
}: { 
    center: { lat: number; lng: number } | null; 
    zoom: number | null;
}) {
    const map = useMap();

    useEffect(() => {
        if (center && zoom) {
            map.flyTo([center.lat, center.lng], zoom, {
                duration: 1.5
            });
        }
    }, [center, zoom, map]);

    return null;
}


interface MapComponentProps {
    properties: PublicProperty[];
    setMapBounds: (bounds: L.LatLngBoundsExpression) => void;
    hoveredPropertyId: string | null;
    setHoveredPropertyId: (id: string | null) => void;
    selectedPropertyId: string | null;
    onPropertyClick: (id: string) => void;
    center?: { lat: number; lng: number } | null;
    zoom?: number | null;
    isLoading?: boolean;
}

const MapComponent = ({ 
    properties, 
    setMapBounds, 
    hoveredPropertyId, 
    setHoveredPropertyId,
    selectedPropertyId,
    onPropertyClick,
    center = null,
    zoom = null,
    isLoading = false
}: MapComponentProps) => {
    
    const position: L.LatLngExpression = [-34.90, -56.16];

    return (
        <div className="relative h-full w-full">
            <MapContainer center={position} zoom={13} style={{ height: '100vh', width: '100%' }}>
                <TileLayer
                    url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
                    attribution='&copy; <a href="https://carto.com/">CARTO</a>'
                />
                {properties.map(property => {
                const isSelected = selectedPropertyId === property.id;
                const isHovered = hoveredPropertyId === property.id;
                
                // Determine if property is for sale or rent
                const isForSale = property.salePrice !== undefined && property.salePrice !== null;
                const statusLabel = isForSale ? 'S' : 'R';
                
                // Create custom icon matching PropertyMap style with selected/hovered states
                const scale = isSelected ? 1.3 : isHovered ? 1.15 : 1.0;
                const iconHtml = `
                    <div class="relative flex items-center justify-center" style="transform: scale(${scale});">
                        <div class="absolute w-6 h-6 rounded-full bg-[var(--color-primary-500)] animate-ping opacity-75"></div>
                        <div class="relative w-6 h-6 rounded-full flex items-center justify-center text-white font-bold border-2 border-white shadow-md text-xs bg-[var(--color-primary-600)]">
                            ${statusLabel}
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

                return (
                    <Marker
                        key={property.id}
                        position={[property.location.lat, property.location.lng]}
                        icon={customIcon}
                        eventHandlers={{
                            mouseover: () => setHoveredPropertyId(property.id),
                            mouseout: () => setHoveredPropertyId(null),
                            click: () => onPropertyClick(property.id),
                        }}
                    >
                        <Tooltip>
                            <strong>{property.title}</strong><br />${property.rentPrice || property.salePrice || 'N/A'}/month
                        </Tooltip>
                    </Marker>
                );
            })}
            <MapEvents setMapBounds={setMapBounds} />
            <MapController center={center} zoom={zoom} />
        </MapContainer>
        
        {/* Loading Overlay */}
        {isLoading && (
            <div className="absolute top-4 left-1/2 transform -translate-x-1/2 z-[1000] 
                          bg-white dark:bg-gray-800 shadow-lg rounded-lg px-6 py-3 
                          flex items-center gap-3 border border-gray-200 dark:border-gray-700">
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
                <span className="text-gray-700 dark:text-gray-200 font-medium">
                    Loading properties...
                </span>
            </div>
        )}
        </div>
    );
};

export default MapComponent;