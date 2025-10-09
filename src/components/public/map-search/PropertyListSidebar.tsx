import { useState, useRef, useEffect } from 'react';
import { PublicProperty } from '../../../models/properties';
import { Search, MapPin, Bed, Bath, DollarSign, SlidersHorizontal } from 'lucide-react';
import { mapCitiesData } from '../../../data/MapCitiesData';
import { Button, TextInput, Label } from 'flowbite-react';

interface PropertyListSidebarProps {
  properties: PublicProperty[];
  selectedPropertyId: string | null;
  onPropertySelect: (propertyId: string) => void;
  onPropertyHover: (propertyId: string | null) => void;
  onLocationSearch: (location: { lat: number; lng: number; zoom: number }) => void;
  priceRange: { min: number; max: number };
  onPriceRangeChange: (range: { min: number; max: number }) => void;
}

const PropertyListSidebar = ({ 
  properties, 
  selectedPropertyId, 
  onPropertySelect,
  onPropertyHover,
  onLocationSearch,
  priceRange,
  onPriceRangeChange
}: PropertyListSidebarProps) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [showFilters, setShowFilters] = useState(false);
  const [localMinPrice, setLocalMinPrice] = useState(priceRange.min.toString());
  const [localMaxPrice, setLocalMaxPrice] = useState(priceRange.max.toString());
  const searchInputRef = useRef<HTMLInputElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);

  // Filter cities based on search query
  const filteredCities = searchQuery.trim()
    ? mapCitiesData.filter(city =>
        city.name.toLowerCase().includes(searchQuery.toLowerCase())
      ).slice(0, 10) // Limit to 10 suggestions
    : [];

  // Handle click outside to close suggestions
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        suggestionsRef.current &&
        !suggestionsRef.current.contains(event.target as Node) &&
        searchInputRef.current &&
        !searchInputRef.current.contains(event.target as Node)
      ) {
        setShowSuggestions(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handleSearch = () => {
    if (filteredCities.length > 0) {
      const selectedCity = selectedIndex >= 0 ? filteredCities[selectedIndex] : filteredCities[0];
      onLocationSearch({
        lat: selectedCity.lat,
        lng: selectedCity.lng,
        zoom: selectedCity.zoom
      });
      setSearchQuery(selectedCity.name);
      setShowSuggestions(false);
      setSelectedIndex(-1);
    }
  };

  const handleCitySelect = (city: typeof mapCitiesData[0]) => {
    onLocationSearch({
      lat: city.lat,
      lng: city.lng,
      zoom: city.zoom
    });
    setSearchQuery(city.name);
    setShowSuggestions(false);
    setSelectedIndex(-1);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(prev => 
        prev < filteredCities.length - 1 ? prev + 1 : prev
      );
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(prev => (prev > 0 ? prev - 1 : -1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      handleSearch();
    } else if (e.key === 'Escape') {
      setShowSuggestions(false);
    }
  };

  const getMainImage = (property: PublicProperty) => {
    return property.images.find(img => img.id === property.mainImageId) || property.images[0];
  };

  const getPrice = (property: PublicProperty) => {
    return property.rentPrice || property.salePrice || 0;
  };

  const handleApplyPriceFilter = () => {
    const min = localMinPrice === '' ? 0 : parseInt(localMinPrice);
    const max = localMaxPrice === '' ? Infinity : parseInt(localMaxPrice);
    onPriceRangeChange({ 
      min: isNaN(min) ? 0 : min, 
      max: isNaN(max) ? Infinity : max 
    });
  };

  const handleResetPriceFilter = () => {
    setLocalMinPrice('0');
    setLocalMaxPrice('');
    onPriceRangeChange({ min: 0, max: Infinity });
  };

  // Sync local state with prop changes
  useEffect(() => {
    setLocalMinPrice(priceRange.min === 0 ? '0' : priceRange.min.toString());
    setLocalMaxPrice(priceRange.max === Infinity ? '' : priceRange.max.toString());
  }, [priceRange]);

  return (
    <div className="w-96 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 h-screen flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-gray-200 dark:border-gray-700">
        <h2 className="text-xl font-semibold mb-4">
          Properties ({properties.length})
        </h2>
        
        {/* Location Search Bar */}
        <div className="relative">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
              <TextInput
                ref={searchInputRef}
                type="text"
                placeholder="Search cities or states..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setShowSuggestions(true);
                  setSelectedIndex(-1);
                }}
                onFocus={() => setShowSuggestions(true)}
                onKeyDown={handleKeyDown}
              />
            </div>
            <Button
              onClick={handleSearch}
              disabled={filteredCities.length === 0}
            >
              Search
            </Button>
          </div>

          {/* Suggestions Dropdown */}
          {showSuggestions && filteredCities.length > 0 && (
            <div
              ref={suggestionsRef}
              className="absolute z-10 w-full mt-1 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 
                       rounded-lg shadow-lg max-h-60 overflow-y-auto"
            >
              {filteredCities.map((city, index) => (
                <div
                  key={`${city.name}-${city.lat}-${city.lng}`}
                  onClick={() => handleCitySelect(city)}
                  className={`px-4 py-2 cursor-pointer flex items-center gap-2 ${
                    index === selectedIndex
                      ? 'bg-blue-50 dark:bg-blue-900/20'
                      : 'hover:bg-gray-50 dark:hover:bg-gray-600'
                  }`}
                >
                  <MapPin className="w-4 h-4 text-gray-400 flex-shrink-0" />
                  <span className="text-gray-900 dark:text-white">{city.name}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Price Filter Toggle */}
        <div className="mt-4">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300 
                     hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
          >
            <SlidersHorizontal className="w-4 h-4" />
            <span>Price Filter</span>
            <span className={`ml-auto transition-transform ${showFilters ? 'rotate-180' : ''}`}>▼</span>
          </button>

          {/* Price Filter Inputs */}
          {showFilters && (
            <div className="mt-3 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
              <div className="grid grid-cols-2 gap-2 mb-3">
                <div>
                  <Label htmlFor="minPrice" className="mb-1 text-xs">
                    Min Price
                  </Label>
                  <TextInput
                    id="minPrice"
                    type="number"
                    placeholder="0"
                    value={localMinPrice}
                    onChange={(e) => setLocalMinPrice(e.target.value)}
                    sizing="sm"
                  />
                </div>
                <div>
                  <Label htmlFor="maxPrice" className="mb-1 text-xs">
                    Max Price
                  </Label>
                  <TextInput
                    id="maxPrice"
                    type="number"
                    placeholder="Any"
                    value={localMaxPrice}
                    onChange={(e) => setLocalMaxPrice(e.target.value)}
                    sizing="sm"
                  />
                </div>
              </div>
              <div className="flex gap-2">
                <Button
                  size="xs"
                  onClick={handleApplyPriceFilter}
                  className="flex-1"
                >
                  Apply
                </Button>
                <Button
                  size="xs"
                  color="alternative"
                  onClick={handleResetPriceFilter}
                  className="flex-1"
                >
                  Reset
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Property List */}
      <div className="flex-1 overflow-y-auto">
        {properties.length === 0 ? (
          <div className="p-4 text-center text-gray-500 dark:text-gray-400">
            No properties found in this area
          </div>
        ) : (
          <div className="divide-y divide-gray-200 dark:divide-gray-700">
            {properties.map((property) => {
              const mainImage = getMainImage(property);
              const price = getPrice(property);
              const isSelected = selectedPropertyId === property.id;

              return (
                <div
                  key={property.id}
                  onClick={() => onPropertySelect(property.id)}
                  onMouseEnter={() => onPropertyHover(property.id)}
                  onMouseLeave={() => onPropertyHover(null)}
                  className={`p-4 cursor-pointer transition-colors ${
                    isSelected
                      ? 'bg-blue-50 dark:bg-blue-900/20 border-l-4 border-blue-500'
                      : 'hover:bg-gray-50 dark:hover:bg-gray-700/50'
                  }`}
                >
                  {/* Property Card */}
                  <div className="flex gap-3">
                    {/* Thumbnail */}
                    {mainImage && (
                      <div className="w-24 h-24 flex-shrink-0 rounded-lg overflow-hidden">
                        <img
                          src={mainImage.url}
                          alt={property.title}
                          className="w-full h-full object-cover"
                        />
                      </div>
                    )}

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      {/* Title */}
                      <h3 className="font-semibold text-gray-900 dark:text-white truncate mb-1">
                        {property.title}
                      </h3>

                      {/* Location */}
                      <div className="flex items-center gap-1 text-sm text-gray-600 dark:text-gray-400 mb-2">
                        <MapPin className="w-4 h-4 flex-shrink-0" />
                        <span className="truncate">
                          {property.city}, {property.state}
                        </span>
                      </div>

                      {/* Features */}
                      <div className="flex items-center gap-3 text-sm text-gray-600 dark:text-gray-400 mb-2">
                        <div className="flex items-center gap-1">
                          <Bed className="w-4 h-4" />
                          <span>{property.bedrooms}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Bath className="w-4 h-4" />
                          <span>{property.bathrooms}</span>
                        </div>
                      </div>

                      {/* Price */}
                      <div className="flex items-center gap-1 text-lg font-semibold text-blue-600 dark:text-blue-400">
                        <DollarSign className="w-5 h-5" />
                        <span>{price.toLocaleString()}</span>
                        <span className="text-xs font-normal text-gray-500 dark:text-gray-400">
                          {property.currency}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default PropertyListSidebar;

