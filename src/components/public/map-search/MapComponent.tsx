import { MapContainer, TileLayer, Marker, useMap, useMapEvents, Tooltip } from 'react-leaflet';
import { PublicProperty } from '../../../models/properties';

import L from 'leaflet';
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';
import { useEffect, useRef } from 'react';

const DefaultIcon = L.icon({
    iconUrl: icon,
    shadowUrl: iconShadow
});
L.Marker.prototype.options.icon = DefaultIcon;

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
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                />
                {properties.map(property => {
                const isSelected = selectedPropertyId === property.id;
                const isHovered = hoveredPropertyId === property.id;
                
                // Create custom icon for selected/hovered markers
                const customIcon = (isSelected || isHovered) ? L.divIcon({
                    className: 'custom-marker',
                    html: `<div style="
                        width: 30px; 
                        height: 30px; 
                        background-color: ${isSelected ? '#2563eb' : '#3b82f6'}; 
                        border: 3px solid white;
                        border-radius: 50%;
                        box-shadow: 0 2px 8px rgba(0,0,0,0.3);
                        transform: scale(${isSelected ? 1.2 : 1.1});
                    "></div>`,
                    iconSize: [30, 30],
                    iconAnchor: [15, 15],
                }) : DefaultIcon;

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