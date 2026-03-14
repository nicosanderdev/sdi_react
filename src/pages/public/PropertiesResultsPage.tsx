import { Card, TextInput, Dropdown, Sidebar, Button, DropdownItem, SidebarItems, SidebarItemGroup, Banner, Pagination } from 'flowbite-react';
import { Search } from 'lucide-react';
import React, { useState, useEffect, useMemo } from 'react';
import { CheckboxFilterGroup } from '../../components/public/properties/CheckboxFilterGroup';
import { RadioFilterGroup } from '../../components/public/properties/RadioFilterGroup';
import { PropertyParams, PublicProperty } from '../../models/properties';
import propertyService from '../../services/PropertyService';

// --- CONSTANTS ---
const PROPERTY_TYPES = [
  { id: 'house', name: 'House' },
  { id: 'apartment', name: 'Apartment' },
  { id: 'condo', name: 'Condo' },
  { id: 'land', name: 'Land' },
];

const STATES = [
  { id: 'ca', name: 'California' },
  { id: 'tx', name: 'Texas' },
  { id: 'fl', name: 'Florida' },
  { id: 'ny', name: 'New York' },
];

// --- TYPES ---
const propertyTypeOptions = [
  { id: 'type-apartment', value: 'apartment', label: 'Apartment' },
  { id: 'type-house', value: 'house', label: 'House' },
  { id: 'type-commercial', value: 'commercial', label: 'Commercial' },
  { id: 'type-land', value: 'land', label: 'Land' },
  { id: 'type-other', value: 'other', label: 'Other' },
];

const priceRangeOptions = [
  { id: 'price-1', value: '0-25000', label: '0 - 25,000' },
  { id: 'price-2', value: '25000-50000', label: '25,000 - 50,000' },
  { id: 'price-3', value: '50000-100000', label: '50,000 - 100,000' },
  { id: 'price-4', value: '100000+', label: '100,000+' },
];

const bedroomOptions = [
  { id: 'beds-1', value: '1', label: '1' },
  { id: 'beds-2', value: '2', label: '2' },
  { id: 'beds-3', value: '3', label: '3+' },
];

const bathroomOptions = [
    { id: 'baths-0', value: '0', label: '0' },
    { id: 'baths-1', value: '1', label: '1' },
    { id: 'baths-2', value: '2', label: '2+' },
];

const garageOptions = [
    { id: 'garage-0', value: '0', label: '0' },
    { id: 'garage-1', value: '1', label: '1' },
    { id: 'garage-2', value: '2', label: '2+' },
];

export function PropertiesResultsPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [publicProperties, setProperties] = useState<PublicProperty[]>([]);
  const [selectedState, setSelectedState] = useState<string>('All States');
  const [selectedPropertyType, setSelectedPropertyType] = useState<string>('All Types');
  const [currentPage, setCurrentPage] = useState(1);
  const onPageChange = (page: number) => setCurrentPage(page);

  useEffect(() => {
    const fetchProperties = async () => {
      try {
        var params: PropertyParams = {
          pageNumber: 1,
          pageSize: 10,
          filter: {
            isDeleted: false
          }
        }
        const properties = await propertyService.getProperties(params);
        setProperties(properties.items || []);
      } catch (err) {
        console.error("Error fetching public properties:", err);
      }
    };
    fetchProperties();
  }, []);

  const filteredPublicProperties = useMemo(() => {
    let result = [...publicProperties];

    if (searchTerm) {
      result = result.filter(p =>
        p.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.neighborhood?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }
    if (selectedState !== 'All States') {
      result = result.filter(p => p.state.includes(selectedState));
    }
    if (selectedPropertyType !== 'All Types') {
      result = result.filter(p => p.type === selectedPropertyType);
    }
    
    return result;
  }, [publicProperties, searchTerm, selectedState, selectedPropertyType]);
  
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, selectedState, selectedPropertyType]);

  return (<>
    <div className="flex flex-col h-screen">
      {/* Top Search and Filter Bar */}
      <div className='max-w-4xl p-4 mx-auto w-full'>
        <Banner className='w-full'>
          <div className="flex items-center space-x-4">
            <TextInput
              id="search"
              type="text"
              icon={Search}
              placeholder="Search by address, city, or zip"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="flex-grow"
            />
            <Dropdown label={selectedState}>
              <DropdownItem onClick={() => setSelectedState('All States')}>All States</DropdownItem>
              {STATES.map(state => (
                <DropdownItem key={state.id} onClick={() => setSelectedState(state.name)}>
                  {state.name}
                </DropdownItem>
              ))}
            </Dropdown>

            <Dropdown label={selectedPropertyType}>
              <DropdownItem onClick={() => setSelectedPropertyType('All Types')}>All Types</DropdownItem>
              {PROPERTY_TYPES.map(type => (
                <DropdownItem key={type.id} onClick={() => setSelectedPropertyType(type.name)}>
                  {type.name}
                </DropdownItem>
              ))}
            </Dropdown>
          </div>
        </Banner>
      </div>

      <div className="flex flex-1 overflow-y-auto">
        {/* Sidebar with advanced filters */}
        <Sidebar>
          <SidebarItems>
            <SidebarItemGroup>
              <h2 className="text-xl font-semibold mb-4 px-2">Filters</h2>

              {/* Property Type Filter */}
              <CheckboxFilterGroup
                title="Property Type"
                options={propertyTypeOptions}
              />

              {/* Price Range Filter */}
              <RadioFilterGroup
                title="Price Range ($)"
                name="price"
                options={priceRangeOptions}
              />

              {/* Bedrooms Filter */}
              <RadioFilterGroup
                title="Bedrooms"
                name="bedrooms"
                options={bedroomOptions}
                layout="horizontal"
              />

              {/* Bathrooms Filter */}
              <RadioFilterGroup
                title="Bathrooms"
                name="bathrooms"
                options={bathroomOptions}
                layout="horizontal"
              />

              {/* Garage Filter */}
              <RadioFilterGroup
                title="Garage"
                name="garage"
                options={garageOptions}
                layout="horizontal"
              />

              <div className="mt-6">
                <div className="w-full flex justify-center">
                  <Button size="sm">Apply Filters</Button>
                </div>
              </div>
            </SidebarItemGroup>
          </SidebarItems>
        </Sidebar>

        {/* Main content with property results */}
        <div className="flex-1 p-6 overflow-y-auto bg-gray-100">
          <div className='flex justify-between items-center mb-6'>
              <h2 className="text-2xl font-bold mb-4">
                {filteredPublicProperties.length} Properties Found
              </h2>            
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredPublicProperties.map(property => (
              <Card
                key={property.id}
                imgAlt={property.title}
                imgSrc={property.propertyImages?.[0]?.url ?? ''}
                className="transition-transform duration-300 ease-in-out hover:scale-105 hover:shadow-xl hover:cursor-pointer relative"
              >
                
                <h5 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white">
                  {property.title}
                </h5>
                <p className="font-normal text-gray-700 dark:text-gray-400">
                  {property.streetName} {property.houseNumber}, {property.city}, {property.state}
                </p>
                <div className="flex justify-between items-center">
                  <span className="text-xl font-bold text-gray-900">{property.salePrice || property.rentPrice }</span>
                  <div className="flex space-x-4">
                    <span>{property.bedrooms} Beds</span>
                    <span>{property.bathrooms} Baths</span>
                  </div>
                </div>
              </Card>
            ))}
          </div>
          <div className='flex justify-center mt-6'>
              <Pagination
                currentPage={currentPage}
                totalPages={100}
                onPageChange={onPageChange}
                showIcons />
            </div>
        </div>
      </div>
    </div></>
  );
}

export default PropertiesResultsPage;