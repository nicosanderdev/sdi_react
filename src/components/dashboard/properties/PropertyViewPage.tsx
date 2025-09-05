import React, { useState, useEffect } from 'react';
import {
  MapPin,
  Home,
  BedDouble,
  Bath,
  Car,
  DollarSign,
  FileText,
  Calendar,
  Dog,
  Users,
  Building,
  CheckCircle,
  XCircle,
  Eye,
  EyeOff,
  Wrench,
  FileDown,
  Info,
  Loader2
} from 'lucide-react';
import { useParams } from 'react-router-dom';
import propertyService, { PropertyData, PropertyImage } from '../../../services/PropertyService';

const API_BASE_URL = import.meta.env.VITE_API_BASE_FILES_URL || '';

const InfoField: React.FC<{ icon: React.ReactNode; label: string; value?: string | number | null; children?: React.ReactNode; }> = ({ icon, label, value, children }) => {
  if (!value && !children) return null;
  return (
    <div className="flex items-start">
      <div className="flex-shrink-0 w-10 h-10 rounded-full bg-[#BEE9E8] flex items-center justify-center mr-4">
        {icon}
      </div>
      <div>
        <p className="text-sm text-gray-500">{label}</p>
        {value && <p className="font-medium text-[#1B4965]">{value}</p>}
        {children && <div className="font-medium text-[#1B4965]">{children}</div>}
      </div>
    </div>
  );
};

const BooleanField: React.FC<{ label: string; value: boolean; icon: React.ReactNode }> = ({ label, value, icon }) => (
  <div className="flex items-center">
    <div className="flex-shrink-0 w-10 h-10 rounded-full bg-[#BEE9E8] flex items-center justify-center mr-4">
      {icon}
    </div>
    <div className='flex items-center space-x-2'>
      <p className="font-medium text-[#1B4965]">{label}:</p>
      {value ? (
        <CheckCircle size={20} className="text-green-500" />
      ) : (
        <XCircle size={20} className="text-red-500" />
      )}
      <span className="text-sm text-gray-600">{value ? 'Sí' : 'No'}</span>
    </div>
  </div>
);

const propertyTypeMap: Record<string, string> = {
  'House': 'Casa',
  'Apartment': 'Apartamento',
  'Commercial': 'Local Comercial',
  'Land': 'Terreno',
  'Other': 'Otro',
};

const propertyStatusMap: Record<string, string> = {
  'Sale': 'En venta',
  'Rent': 'En alquiler',
  'Sold': 'Vendido',
  'Reserved': 'Reservado',
  'Unavailable': 'No disponible',
};

export function PropertyViewPage() {
  const { propertyId } = useParams<{ propertyId: string }>();
  const [property, setProperty] = useState<PropertyData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedImage, setSelectedImage] = useState<string>('');

  useEffect(() => {
    if (!propertyId) {
      setError("No property ID provided.");
      setLoading(false);
      return;
    }

    const fetchProperty = async () => {
      try {
        setLoading(true);
        const data = await propertyService.getOwnersPropertyById(propertyId);
        setProperty(data);
        if (data.mainImageId && data.propertyImages && data.propertyImages.length > 0) {
          const mainImage = data.propertyImages.find((img: PropertyImage) => img.id === data.mainImageId);
          const url = mainImage ? mainImage.url : 'https://via.placeholder.com/800x600.png?text=No+Image';
          const fullUrl = `${API_BASE_URL}${url.startsWith('/') ? '' : '/'}${url}`;
          setSelectedImage(fullUrl);
        } else if (data.propertyImages && data.propertyImages.length > 0) {
          setSelectedImage((data.propertyImages[0] as PropertyImage).url);
        } else {
          setSelectedImage('https://via.placeholder.com/800x600.png?text=No+Image');
        }
      } catch (err) {
        setError("Failed to fetch property details. Please try again later.");
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchProperty();
  }, [propertyId]);

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <Loader2 className="animate-spin text-[#1B4965]" size={48} />
        <span className="ml-4 text-xl text-[#1B4965]">Cargando propiedad...</span>
      </div>
    );
  }

  const formatCurrency = (amount: string | undefined, currency: string) => {
    if (!amount || isNaN(parseFloat(amount))) return 'No especificado'; {
      const currencyN = Number.parseInt(currency);
      const currencySymbols = ['USD', 'UYU', 'BRL', 'EUR', 'GBP'];
      const symbol = currencySymbols[currencyN] || 'USD';
      return `${symbol} ${Number(amount).toLocaleString('es-UY')}`;
    }
  };

  const formatAreaUnit = (areaUnit: string) => {
    const areaUnitN = Number.parseInt(areaUnit);
    const areaUnitSymbols = ['m²', 'ft²', 'yd²', 'acres', 'hectares', 'sq_km', 'sq_mi'];
    const symbol = areaUnitSymbols[areaUnitN] || 'USD';
    return `${symbol}`;
  };

  if (error) {
    return <div className="text-center text-red-500 mt-10">{error}</div>;
  }

  if (!property) {
    return <div className="text-center text-gray-600 mt-10">Propiedad no encontrada.</div>;
  }

  const allImages = property.propertyImages.map((img: PropertyImage) => img.url);

  const renderDocumentLink = (doc: { url: string; name: string } | undefined, label: string) => {
    if (!doc) return null;
    return (
      <a
        href={doc.url}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center space-x-3 p-3 rounded-md transition-colors hover:bg-[#E8F8F7] bg-white"
        title={`Ver ${doc.name}`}
      >
        <FileText className="text-[#1B4965] shrink-0" />
        <div className="flex-grow">
          <p className="font-semibold text-[#1B4965] text-sm">{label}</p>
          <p className="text-xs text-gray-500 truncate">{doc.name}</p>
        </div>
        <FileDown size={18} className="text-[#62B6CB] shrink-0" />
      </a>
    )
  }

  return (
    <div className="max-w-5xl mx-auto p-4 md:p-6 bg-gray-50 min-h-screen">
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-3xl font-bold text-[#1B4965]">{property.title}</h1>
      </div>
      <div className="flex items-center justify-between mb-6 mx-4">
        <p className="text-lg text-gray-600">{`${propertyTypeMap[property.type]} en ${property.neighborhood}, ${property.city}`}</p>
        <a href={`/dashboard/property/${property.id}/edit`} className="text-[#62B6CB] hover:underline">
          Editar
        </a>
      </div>
      <div className="bg-[#FDFFFC] rounded-lg shadow-lg border border-gray-100 overflow-hidden">
        
        {/* --- Image Gallery --- */}
        <div className="p-4 md:p-6">
          <div className="mb-4">
            <img src={selectedImage} alt="Main property view" className="w-full h-auto max-h-[500px] object-cover rounded-lg shadow-md" />
          </div>
          {allImages.length > 1 && (
            <div className="flex space-x-2 overflow-x-auto pb-2">
              {allImages.map((imgUrl, index) => (
                <button key={index} onClick={() => setSelectedImage(imgUrl)} className="flex-shrink-0">
                  <img
                    src={imgUrl}
                    alt={`Thumbnail ${index + 1}`}
                    className={`h-20 w-28 object-cover rounded-md border-2 transition-all ${selectedImage === imgUrl ? 'border-[#62B6CB] scale-105' : 'border-transparent'}`}
                  />
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="p-4 md:p-6 border-t border-gray-200">
          {/* --- Section: Main Details --- */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-8 mb-8">
            <InfoField icon={<Home size={20} className="text-[#1B4965]" />} label="Tipo de Propiedad" value={propertyTypeMap[property.type]} />
            <InfoField icon={<Building size={20} className="text-[#1B4965]" />} label="Área Total" value={`${property.areaValue} ${formatAreaUnit(property.areaUnit)}`} />
            <InfoField icon={<BedDouble size={20} className="text-[#1B4965]" />} label="Dormitorios" value={property.bedrooms} />
            <InfoField icon={<Bath size={20} className="text-[#1B4965]" />} label="Baños" value={property.bathrooms} />
            <InfoField icon={<Car size={20} className="text-[#1B4965]" />} label="Espacios de Garage" value={property.hasGarage ? property.garageSpaces : 'No tiene'} />
            <InfoField icon={<Users size={20} className="text-[#1B4965]" />} label="Capacidad" value={`${property.capacity} persona(s)`} />
            <InfoField icon={<Dog size={20} className="text-[#1B4965]" />} label="Mascotas Permitidas" value={property.arePetsAllowed ? 'Sí' : 'No'} />
            <InfoField icon={<Calendar size={20} className="text-[#1B4965]" />} label="Disponible Desde" value={new Date(property.availableFrom).toLocaleDateString('es-UY')} />
          </div>

          {/* --- Section: Description --- */}
          <div className='mb-8'>
            <h3 className="text-xl font-semibold text-[#1B4965] mb-4 border-b pb-2">Descripción</h3>
            <p className="text-gray-700 whitespace-pre-wrap">{property.description || 'No se proporcionó una descripción.'}</p>
          </div>

          {/* --- Section: Address --- */}
          <div className='mb-8'>
            <h3 className="text-xl font-semibold text-[#1B4965] mb-4 border-b pb-2">Ubicación</h3>
            <InfoField icon={<MapPin size={20} className="text-[#1B4965]" />} label="Dirección">
              <p>{`${property.streetName} ${property.houseNumber}`}</p>
              <p>{`${property.neighborhood}, ${property.city}, ${property.state}`}</p>
              <p>{`${property.zipCode}, ${property.country}`}</p>
              <a href={`https://www.google.com/maps?q=${property.location.lat},${property.location.lng}`} target="_blank" rel="noopener noreferrer" className="text-sm text-[#62B6CB] hover:underline mt-1">
                Ver en Google Maps
              </a>
            </InfoField>
          </div>

          {/* --- Section: Financials --- */}
          <div className='mb-8'>
            <h3 className="text-xl font-semibold text-[#1B4965] mb-4 border-b pb-2">Información Financiera</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {property.salePrice && <InfoField icon={<DollarSign size={20} className="text-[#1B4965]" />} label="Precio de Venta" value={formatCurrency(property.salePrice, property.currency)} />}
              {property.rentPrice && <InfoField icon={<DollarSign size={20} className="text-[#1B4965]" />} label="Precio de Alquiler" value={`${formatCurrency(property.rentPrice, property.currency)} /mes`} />}
              {property.hasCommonExpenses && <InfoField icon={<DollarSign size={20} className="text-[#1B4965]" />} label="Gastos Comunes" value={formatCurrency(property.commonExpensesAmount, property.currency)} />}
              <BooleanField icon={<Wrench size={20} className="text-[#1B4965]" />} label="Agua Incluida" value={property.isWaterIncluded} />
              <BooleanField icon={<Wrench size={20} className="text-[#1B4965]" />} label="Electricidad Incluida" value={property.isElectricityIncluded} />
            </div>
          </div>

          {/* --- Section: Internal Status (For Owner) --- */}
          <div className='mb-8 bg-blue-50 p-6 rounded-lg border border-blue-200'>
            <h3 className="text-xl font-semibold text-[#1B4965] mb-4 border-b pb-2">Estado Interno (Solo visible para ti)</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <InfoField icon={<Info size={20} className="text-[#1B4965]" />} label="Estado de la publicación" value={propertyStatusMap[property.status] || 'No definido'} />
              <BooleanField icon={<CheckCircle size={20} className="text-[#1B4965]" />} label="Activa en el sistema" value={property.isActive} />
              <BooleanField icon={<Eye size={20} className="text-[#1B4965]" />} label="Visible al público" value={property.isPropertyVisible} />
              <BooleanField icon={<EyeOff size={20} className="text-[#1B4965]" />} label="Precio visible al público" value={property.isPriceVisible} />
            </div>
          </div>

          {/* --- Section: Documents (For Owner) --- */}
          {/* NOTE: You will need to ensure your API returns document URLs and names */}
          {/*
                    <div className='mb-8'>
                      <h3 className="text-xl font-semibold text-[#1B4965] mb-4 border-b pb-2">Documentos Adjuntos</h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {renderDocumentLink(property.publicDeed, 'Escritura Pública')}
                        {renderDocumentLink(property.propertyPlans, 'Planos de la Propiedad')}
                        {renderDocumentLink(property.taxReceipts, 'Recibos de Impuestos')}
                        {property.otherDocuments?.map((doc, index) => renderDocumentLink(doc, `Otro Documento ${index + 1}`))}
                      </div>
                    </div>
                    */}
        </div>
      </div>
    </div>
  );
};

export default PropertyViewPage;