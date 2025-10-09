import { useState, useEffect, useCallback, useRef } from 'react';
import MapComponent from '../../components/public/map-search/MapComponent';
import PropertyListSidebar from '../../components/public/map-search/PropertyListSidebar';
import PropertyDetailSidebar from '../../components/public/map-search/PropertyDetailSidebar';
import { PublicProperty } from '../../models/properties';
import propertyService from '../../services/PropertyService';
import L from 'leaflet';

const MapSearchPage = () => {
    const [properties, setProperties] = useState<PublicProperty[]>([]);
    const [filteredProperties, setFilteredProperties] = useState<PublicProperty[]>([]);
    const [mapBounds, setMapBounds] = useState<L.LatLngBounds | null>(null);
    const [hoveredPropertyId, setHoveredPropertyId] = useState<string | null>(null);
    const [selectedPropertyId, setSelectedPropertyId] = useState<string | null>(null);
    const [mapCenter, setMapCenter] = useState<{ lat: number; lng: number } | null>(null);
    const [mapZoom, setMapZoom] = useState<number | null>(null);
    const [priceRange, setPriceRange] = useState<{ min: number; max: number }>({ min: 0, max: Infinity });
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);
    const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

    const handleMapBoundsChange = useCallback((bounds: L.LatLngBoundsExpression) => {
        setMapBounds(bounds as L.LatLngBounds);
    }, []);

    const handleHoveredPropertyChange = useCallback((id: string | null) => {
        setHoveredPropertyId(id);
    }, []);

    const handlePropertyClick = useCallback((id: string) => {
        setSelectedPropertyId(id);
    }, []);

    const handleCloseDetailSidebar = useCallback(() => {
        setSelectedPropertyId(null);
    }, []);

    const handleLocationSearch = useCallback((location: { lat: number; lng: number; zoom: number }) => {
        setMapCenter({ lat: location.lat, lng: location.lng });
        setMapZoom(location.zoom);
    }, []);

    const handlePriceRangeChange = useCallback((range: { min: number; max: number }) => {
        setPriceRange(range);
    }, []);

    // Fetch properties based on map viewport with debouncing
    const fetchPropertiesInViewport = useCallback(async (bounds: L.LatLngBounds) => {
        // Clear any existing debounce timer
        if (debounceTimerRef.current) {
            clearTimeout(debounceTimerRef.current);
        }

        // Set up a new debounced fetch
        debounceTimerRef.current = setTimeout(async () => {
            try {
                setIsLoading(true);
                setError(null);

                const sw = bounds.getSouthWest();
                const ne = bounds.getNorthEast();

                const response = await propertyService.getPropertiesInBounds(
                    sw.lat,
                    sw.lng,
                    ne.lat,
                    ne.lng,
                    {
                        pageSize: 1000,
                    }
                );

                setProperties(response.items as PublicProperty[]);
            } catch (err) {
                console.error("Error fetching properties in viewport:", err);
                setError("Failed to load properties. Please try again.");
            } finally {
                setIsLoading(false);
            }
        }, 500);
    }, []);

    useEffect(() => {
        if (!mapBounds) return;
        fetchPropertiesInViewport(mapBounds);

        return () => {
            if (debounceTimerRef.current) {
                clearTimeout(debounceTimerRef.current);
            }
        };
    }, [mapBounds, fetchPropertiesInViewport]);

    useEffect(() => {
        const filtered = properties.filter(p => {
            const price = p.rentPrice || p.salePrice || 0;
            return price >= priceRange.min && price <= priceRange.max;
        });

        setFilteredProperties(filtered);
    }, [properties, priceRange]);

    const selectedProperty = selectedPropertyId 
        ? properties.find(p => p.id === selectedPropertyId) || null
        : null;

    return (
        <div className="flex h-screen overflow-hidden">
            {/* Error Notification */}
            {error && (
                <div className="absolute top-4 left-1/2 transform -translate-x-1/2 z-[1001] 
                              bg-red-100 dark:bg-red-900/30 border border-red-400 dark:border-red-700 
                              text-red-700 dark:text-red-200 px-6 py-3 rounded-lg shadow-lg 
                              flex items-center gap-3">
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                    </svg>
                    <span className="font-medium">{error}</span>
                    <button 
                        onClick={() => setError(null)}
                        className="ml-2 text-red-700 dark:text-red-200 hover:text-red-900 dark:hover:text-red-100"
                    >
                        ✕
                    </button>
                </div>
            )}
            
            {/* Left Sidebar - Property List */}
            <PropertyListSidebar
                properties={filteredProperties}
                selectedPropertyId={selectedPropertyId}
                onPropertySelect={handlePropertyClick}
                onPropertyHover={handleHoveredPropertyChange}
                onLocationSearch={handleLocationSearch}
                priceRange={priceRange}
                onPriceRangeChange={handlePriceRangeChange}
            />

            {/* Map */}
            <div className="flex-1">
                <MapComponent 
                    properties={filteredProperties} 
                    setMapBounds={handleMapBoundsChange} 
                    hoveredPropertyId={hoveredPropertyId} 
                    setHoveredPropertyId={handleHoveredPropertyChange}
                    selectedPropertyId={selectedPropertyId}
                    onPropertyClick={handlePropertyClick}
                    center={mapCenter}
                    zoom={mapZoom}
                    isLoading={isLoading}
                />
            </div>

            {/* Right Sidebar - Property Details */}
            {selectedProperty && (
                <PropertyDetailSidebar
                    property={selectedProperty}
                    onClose={handleCloseDetailSidebar}
                />
            )}
        </div>
    );
};

export default MapSearchPage;