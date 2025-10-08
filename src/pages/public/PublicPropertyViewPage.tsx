import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Bed, Bath, Car, Square, Check, Home } from 'lucide-react';
import PropertyImageGallery from '../../components/public/properties/PropertyImageGallery';
import { PublicLayout } from '../../components/layout/PublicLayout';
import { Badge, Card } from 'flowbite-react';
import { IconWrapper } from '../../components/ui/IconWrapper';
import PropertyContact from '../../components/messages/PropertyContact';
import propertyService from '../../services/PropertyService';
import { PropertyData } from '../../models/properties';

interface ServiceGridElement {
  icon: any;
  label: string;
  value: string;
}

function getAreaUnit(id: string): "m²" | "ft²" | "yd²" | "acres" | "hectares" | "sq_km" | "sq_mi" {
    switch (id) {
      case '0': return 'm²';
      case '1': return 'ft²';
      case '2': return 'yd²';
      case '3': return 'acres';
      case '4': return 'hectares';
      case '5': return 'sq_km';
      default: return 'sq_mi';
    }
  }

function PublicPropertyViewPage() {
  const { propertyId } = useParams<{ propertyId: string }>();

  // State for loading, data, and errors
  const [property, setProperty] = useState<PropertyData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchPropertyData = async () => {
      try {
        setLoading(true);
        var result = await propertyService.getPropertyById(propertyId!);
        result = { ...result, areaUnit: getAreaUnit(result.areaUnit) }
        setProperty(result);
      } catch (err) {
        setError("Failed to fetch property data.");
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchPropertyData();
  }, [propertyId]);

  if (!propertyId) {
    return <div className="text-center text-red-500 mt-10">No property ID provided.</div>;
  }
  
  if (loading) {
    return <div className="text-center text-gray-500 mt-10">Loading property details...</div>;
  }
  
  if (error || !property) {
    return <div className="text-center text-red-500 mt-10">{error || "Property not found."}</div>;
  }

  const formatPrice = (price?: number) => {
    if (!price) return 'Price not available';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: property.currency || 'USD',
      maximumFractionDigits: 0,
    }).format(price);
  };

  const formatAreaValue = (value?: number, unit?: string) => {
    if (!value || !unit) return 'N/A';
    return `${value} ${unit}`;
  }

  return (<>
    <PublicLayout>
      <div className="min-h-screen bg-gray-100 dark:bg-gray-900 text-gray-900 dark:text-gray-100">
        <div className="container mx-auto p-4 md:p-8">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

            {/* Left Column (or Top on Mobile) - Image Gallery */}
            <div className="lg:col-span-2">
              <PropertyImageGallery images={property.propertyImages} mainImageId={property.mainImageId!} />
            </div>

            {/* Right Column (or Bottom on Mobile) - Property Info */}
            <div className="lg:col-span-1 space-y-6">
              <Card>
                <div className='flex justify-normal'>
                  <Badge
                    color='green'
                    icon={Check} size='xs'>
                    For {property.salePrice ? 'Sale' : 'Rent'}
                  </Badge>
                </div>
                <h1 className="text-3xl font-bold">{property.title}</h1>
                <p className="mt-1">{`${property.streetName} ${property.houseNumber}, ${property.city}, ${property.state}`}</p>
                <p className="text-4xl font-bold mt-4">{property.salePrice != null ? formatPrice(Number.parseFloat(property.salePrice)) : formatPrice(Number.parseFloat(property.rentPrice!))}</p>
              </Card>

              {/* Key Features */}
              <Card>
                <h2 className="text-xl font-semibold mb-4">Key Features</h2>
                <div className="grid grid-cols-2 gap-4">
                  <div className='flex items-center space-x-2'>
                    <IconWrapper icon={Bed} size={20}></IconWrapper>
                    <span>{property.bedrooms} Bedrooms</span>
                  </div>
                  <div className='flex items-center space-x-2'>
                    <IconWrapper icon={Bath} size={20}></IconWrapper>
                    <span>{property.bathrooms} Bathrooms</span>
                  </div>
                  <div className='flex items-center space-x-2'>
                    <IconWrapper icon={Square} size={20}></IconWrapper>
                    <span>{formatAreaValue(property.areaValue, property.areaUnit)}</span>
                  </div>
                  <div className='flex items-center space-x-2'>
                    <IconWrapper icon={Car} size={20}></IconWrapper>
                    <span>{property.garageSpaces} Garage Spaces</span>
                  </div>
                </div>
              </Card>
            </div>
          </div>

          {/* Full-width Description */}
          <Card className='mt-8 mb-8 p-3'>
            <h2 className="text-2xl font-bold mb-4">About this property</h2>
            <p className="leading-relaxed whitespace-pre-line">{property.description}</p>
          </Card>
          
          {/* Amenities */}
          <Card className='mb-8 p-3'>
            <h2 className="text-2xl font-bold mb-4">Otros servicios y características</h2>
            <div className='grid grid-cols-1 md:grid-cols-3 gap-4 p-4'>
              {property.amenities.map(e => (
                <div key={e.name} className='flex items-center space-x-2'>
                  <IconWrapper icon={Home} hoverable={true} size={25} />
                  <span>{e.name}</span>
                </div>
              ))}
            </div>
          </Card>
          
          {/* Q&A Section */}
          <div>
            <PropertyContact />
          </div>
        </div>
      </div>

    </PublicLayout>
  </>
  );
}

export default PublicPropertyViewPage;