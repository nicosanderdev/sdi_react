import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Bed, Bath, Car, Square, PawPrint, Droplets, Zap, Check, HouseIcon } from 'lucide-react';
import { mockPropertyData, Property } from '../../data/PropertyData';
import PropertyImageGallery from '../../components/public/properties/PropertyImageGallery';
import IconLabel from '../../components/public/properties/IconLabel';
import { PublicLayout } from '../../components/layout/PublicLayout';
import { Badge, Card } from 'flowbite-react';
import { IconWrapper } from '../../components/ui/IconWrapper';
import PropertyContact from '../../components/messages/PropertyContact';

interface ServiceGridElement {
  icon: any;
  label: string;
  value: string;
}

function PublicPropertyViewPage() {
  const { propertyId } = useParams<{ propertyId: string }>();

  // State for loading, data, and errors
  const [property, setProperty] = useState<Property | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const servicesArray: ServiceGridElement[] = [
    { icon: PawPrint, label: 'Pets Allowed', value: property?.ArePetsAllowed ? 'Yes' : 'No' },
    { icon: Droplets, label: 'Water Included', value: property?.IsWaterIncluded ? 'Yes' : 'No' },
    { icon: Zap, label: 'Electricity Included', value: property?.IsElectricityIncluded ? 'Yes' : 'No' },
  ];

  useEffect(() => {
    // Simulate fetching data from an API
    const fetchPropertyData = async () => {
      try {
        setLoading(true);
        // In a real app, you would make an API call here:
        // const response = await fetch(`/api/properties/${propertyId}`);
        // const data = await response.json();
        
        // For now, we use the mock data after a short delay
        await new Promise(resolve => setTimeout(resolve, 500)); 
        
        // Here you could check if `propertyId` matches the mock data's ID
        if (propertyId) {
             setProperty(mockPropertyData);
        } else {
            throw new Error("Property not found");
        }
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

  // Helper to format currency
  const formatPrice = (price?: number) => {
    if (!price) return 'Price not available';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: property.Currency,
      maximumFractionDigits: 0,
    }).format(price);
  };

  return (<>
    <PublicLayout>
      <div className="min-h-screen bg-gray-100 dark:bg-gray-900 text-gray-900 dark:text-gray-100">
        <div className="container mx-auto p-4 md:p-8">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

            {/* Left Column (or Top on Mobile) - Image Gallery */}
            <div className="lg:col-span-2">
              <PropertyImageGallery images={property.Images} mainImageId={property.MainImageId} />
            </div>

            {/* Right Column (or Bottom on Mobile) - Property Info */}
            <div className="lg:col-span-1 space-y-6">
              <Card>
                <div className='flex justify-normal'>
                  <Badge
                    icon={Check} size='xs'>
                    For {property.SalePrice ? 'Sale' : 'Rent'}
                  </Badge>
                </div>
                <h1 className="text-3xl font-bold">{property.Title}</h1>
                <p className="mt-1">{`${property.StreetName} ${property.HouseNumber}, ${property.City}, ${property.State}`}</p>
                <p className="text-4xl font-extrabold mt-4">{formatPrice(property.SalePrice || property.RentPrice)}</p>
              </Card>

              {/* Key Features */}
              <Card>
                <h2 className="text-xl font-semibold mb-4">Key Features</h2>
                <div className="grid grid-cols-2 gap-4">
                  <div className='flex items-center space-x-2'>
                    <IconWrapper icon={Bed} size={20}></IconWrapper>
                    <span>{property.Bedrooms} Bedrooms</span>
                  </div>
                  <div className='flex items-center space-x-2'>
                    <IconWrapper icon={Bath} size={20}></IconWrapper>
                    <span>{property.Bathrooms} Bathrooms</span>
                  </div>
                  <div className='flex items-center space-x-2'>
                    <IconWrapper icon={Square} size={20}></IconWrapper>
                    <span>{property.AreaValue} {property.AreaUnit}</span>
                  </div>
                  <div className='flex items-center space-x-2'>
                    <IconWrapper icon={Car} size={20}></IconWrapper>
                    <span>{property.GarageSpaces} Garage Spaces</span>
                  </div>
                </div>
              </Card>
            </div>
          </div>

          {/* Full-width Description */}
          <Card className='mt-8 mb-8'>
            <h2 className="text-2xl font-bold mb-4">About this property</h2>
            <p className="leading-relaxed whitespace-pre-line">{property.Description}</p>
          </Card>
          
          {/* Services Included / Not Included */}
          <Card className='mb-8'>
            <h2 className="text-2xl font-bold mb-4">Services</h2>
            <div className='grid grid-cols-1 md:grid-cols-3 gap-4'>
              {servicesArray.map((e: ServiceGridElement, idx: number) => (
                <div key={e.label} className='flex items-center space-x-2'>
                  <IconWrapper icon={e.icon} hoverable={true} size={25} />
                  <span>{e.label} {e.value}</span>
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