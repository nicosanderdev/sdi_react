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


const MapComponent = ({ properties, setMapBounds, hoveredPropertyId, setHoveredPropertyId }:
    { properties: PublicProperty[], setMapBounds: (bounds: L.LatLngBoundsExpression) => void, hoveredPropertyId: string | null, setHoveredPropertyId: (id: string | null) => void }) => {
    
    const position: L.LatLngExpression = [-34.90, -56.16];

    return (
        <MapContainer center={position} zoom={13} style={{ height: '100vh', width: '100%' }}>
            <TileLayer
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            />
            {properties.map(property => (
                <Marker
                    key={property.id}
                    position={[property.location.lat, property.location.lng]}
                    eventHandlers={{
                        mouseover: () => setHoveredPropertyId(property.id),
                        mouseout: () => setHoveredPropertyId(null),
                    }}
                >
                    <Tooltip>
                        <strong>{property.title}</strong><br />${property.rentPrice || property.salePrice || 'N/A'}/month
                    </Tooltip>
                </Marker>
            ))}
            <MapEvents setMapBounds={setMapBounds} />
        </MapContainer>
    );
};

export default MapComponent;