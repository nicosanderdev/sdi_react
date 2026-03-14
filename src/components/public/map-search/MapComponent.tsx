import { MapContainer, TileLayer, Marker, useMap, useMapEvents, Popup } from 'react-leaflet';
import { PublicProperty, PropertyImage } from '../../../models/properties';

import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useEffect, useRef } from 'react';

const API_BASE_URL = import.meta.env.VITE_API_BASE_FILES_URL || '';

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


type MapProperty = PublicProperty & {
    images?: PropertyImage[];
};

interface MapComponentProps {
    properties: MapProperty[];
    setMapBounds: (bounds: L.LatLngBoundsExpression) => void;
    hoveredPropertyId: string | null;
    setHoveredPropertyId: (id: string | null) => void;
    selectedPropertyId: string | null;
    onPropertyClick?: (id: string) => void;
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
    onPropertyClick: _onPropertyClick,
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

                const isForSale = property.salePrice !== undefined && property.salePrice !== null;
                const statusLabel = property.rentPrice !== undefined && property.rentPrice !== null
                    ? 'For Rent'
                    : isForSale
                        ? 'For Sale'
                        : null;

                const priceValue = property.rentPrice ?? property.salePrice ?? null;
                const formattedPrice = priceValue !== null
                    ? [property.currency, priceValue.toLocaleString()].filter(Boolean).join(' ')
                    : 'Price unavailable';

                const propertyImages = (property.propertyImages ?? []).filter((image): image is PropertyImage => Boolean(image && image.url));
                const mainImage = property.mainImageId
                    ? propertyImages.find(img => img.id === property.mainImageId) ?? propertyImages[0]
                    : propertyImages[0];

                const addressLines = [
                    [property.streetName, property.houseNumber].filter(Boolean).join(' ').trim(),
                    property.neighborhood,
                    [property.city, property.state, property.zipCode].filter(Boolean).join(', ').trim(),
                    property.country
                ].filter(line => line && line.length > 0);

                const statusClassName = statusLabel
                    ? `property-popup__status ${statusLabel === 'For Rent'
                        ? 'property-popup__status--rent'
                        : 'property-popup__status--sale'}`
                    : '';

                // Create custom icon matching PropertyMap style with selected/hovered states
                const scale = isSelected ? 1.3 : isHovered ? 1.15 : 1.0;
                const statusIconLabel = property.rentPrice !== undefined && property.rentPrice !== null
                    ? 'R'
                    : isForSale
                        ? 'S'
                        : '?';
                const iconHtml = `
                    <div class="relative flex items-center justify-center" style="transform: scale(${scale});">
                        <div class="absolute w-6 h-6 rounded-full bg-[var(--color-primary-500)] animate-ping opacity-75"></div>
                        <div class="relative w-6 h-6 rounded-full flex items-center justify-center text-white font-bold border-2 border-white shadow-md text-xs bg-[var(--color-primary-600)]">
                            ${statusIconLabel}
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
                        }}
                    >
                        <Popup minWidth={500}>
                            <div className="property-popup">
                                {mainImage ? (
                                    <img
                                        className="popup-img"
                                        src={`${API_BASE_URL}${mainImage?.url?.startsWith('/') ? '' : '/'}${mainImage?.url}`}
                                        alt={mainImage.altText || property.title}
                                    />
                                ) : (
                                    <div className="popup-img popup-img--placeholder">
                                        No image available
                                    </div>
                                )}
                                <div className="property-popup__content">
                                    <div className="property-popup__header">
                                        <h3 className="property-popup__title">{property.title}</h3>
                                        {statusLabel && (
                                            <span className={statusClassName}>{statusLabel}</span>
                                        )}
                                    </div>
                                    <div className="property-popup__price">{formattedPrice}</div>
                                    {addressLines.length > 0 && (
                                        <div className="property-popup__address">
                                            {addressLines.map((line, index) => (
                                                <span key={`${property.id}-address-${index}`}>{line}</span>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </Popup>
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