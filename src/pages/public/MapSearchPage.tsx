import { useState, useEffect, useCallback } from 'react';
import MapComponent from '../../components/public/map-search/MapComponent';
import { PropertyData, PropertyParams, PublicProperty } from '../../models/properties';
import propertyService from '../../services/PropertyService';
import L from 'leaflet';

const MapSearchPage = () => {
    const [allProperties, setAllProperties] = useState<PublicProperty[]>([]);
    const [visibleProperties, setVisibleProperties] = useState<PublicProperty[]>([]);
    const [mapBounds, setMapBounds] = useState<L.LatLngBounds | null>(null);
    const [hoveredPropertyId, setHoveredPropertyId] = useState<string | null>(null);
    const [selectedProperty, setSelectedProperty] = useState<string | null>(null);

    const handleMapBoundsChange = useCallback((bounds: L.LatLngBoundsExpression) => {
        setMapBounds(bounds as L.LatLngBounds);
    }, []);

    const handleHoveredPropertyChange = useCallback((id: string | null) => {
        setHoveredPropertyId(id);
    }, []);

    useEffect(() => {
        const fetchProperties = async () => {
          try {
            var params: PropertyParams = {
              pageNumber: 1,
              pageSize: 10,
              filter: {
                isDeleted: true
              }
            }
            const properties = await propertyService.getProperties(params);
            setAllProperties(properties.items as PublicProperty[]);
          } catch (err) {
            console.error("Error fetching public properties:", err);
          }
        };
        fetchProperties();
      }, []);

    useEffect(() => {
        if (!mapBounds || allProperties.length === 0) return;

        const filtered = allProperties.filter(p => {
            const { lat, lng } = p.location;
            return mapBounds.contains([lat, lng]);
        });

        setVisibleProperties(filtered);
    }, [mapBounds, allProperties]);


    return (
        <div style={{ display: 'flex' }}>
            <div style={{ flex: 1 }}>
                <MapComponent 
                    properties={visibleProperties as PublicProperty[]} 
                    setMapBounds={handleMapBoundsChange} 
                    hoveredPropertyId={hoveredPropertyId} 
                    setHoveredPropertyId={handleHoveredPropertyChange} 
                />
            </div>
            <div style={{ width: '350px', borderLeft: '1px solid #ccc' }}>
                <div>Selected Property</div>
            </div>
        </div>
    );
};

export default MapSearchPage;