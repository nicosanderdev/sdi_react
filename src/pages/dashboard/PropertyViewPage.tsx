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
    Users,
    Building,
    CheckCircle,
    XCircle,
    Eye,
    EyeOff,
    Wrench,
    Info,
    Loader2,
    Play,
    ExternalLink,
    Lock,
    Globe,
    ChevronLeft,
    ChevronRight,
    Star,
    Copy
} from 'lucide-react';
import { useParams, useNavigate } from 'react-router-dom';
import propertyService from '../../services/PropertyService';
import { Button, Card, Modal, ModalBody, ModalFooter, ModalHeader, Dropdown, DropdownItem } from 'flowbite-react';
import { PropertyData } from '../../models/properties/PropertyData';
import { PropertyImage } from '../../models/properties/PropertyImage';
import { PropertyVideo } from '../../models/properties/PropertyVideo';
import { PropertyDocument } from '../../models/properties/PropertyDocument';
import { Amenity } from '../../models/properties/Amenity';
import { DuplicatedEstateProperty } from '../../models/properties/DuplicatedEstateProperty';
import { EstatePropertyValues } from '../../models/properties/EstatePropertyValues';

const API_BASE_URL = import.meta.env.VITE_API_BASE_FILES_URL || '';

const InfoField: React.FC<{ icon: React.ReactNode; label: string; value?: string | number | null; children?: React.ReactNode; }> = ({ icon, label, value, children }) => {
    if (!value && !children) return null;
    return (
        <div className="flex items-start">
            <div className="flex-shrink-0 w-10 h-10 rounded-full bg-primary-400 flex items-center justify-center mr-4">
                {icon}
            </div>
            <div>
                <p className="text-sm">{label}</p>
                {value && <p className="font-medium">{value}</p>}
                {children && <div className="font-medium">{children}</div>}
            </div>
        </div>
    );
};

const BooleanField: React.FC<{ label: string; value: boolean; icon: React.ReactNode }> = ({ label, value, icon }) => (
    <div className="flex items-center">
        <div className="flex-shrink-0 w-10 h-10 rounded-full bg-primary-400 flex items-center justify-center mr-4">
            {icon}
        </div>
        <div className='flex items-center space-x-2'>
            <p className="font-medium">{label}:</p>
            {value ? (
                <CheckCircle size={20} className="text-green-500" />
            ) : (
                <XCircle size={20} className="text-red-500" />
            )}
            <span className="text-sm">{value ? 'Sí' : 'No'}</span>
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

const iconStyle = "text-white";

export function PropertyViewPage() {
    const { propertyId } = useParams<{ propertyId: string }>();
    const navigate = useNavigate();
    const [property, setProperty] = useState<PropertyData | null>(null);
    const [loading, setLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);
    const [selectedImage, setSelectedImage] = useState<string>('');
    const [currentImageIndex, setCurrentImageIndex] = useState<number>(0);
    const [showDuplicateModal, setShowDuplicateModal] = useState<boolean>(false);
    const [duplicating, setDuplicating] = useState<boolean>(false);
    const [selectedVersion, setSelectedVersion] = useState<EstatePropertyValues | null>(null);

    // Helper function to get current property data (either main property or selected version)
    const getCurrentPropertyData = (): PropertyData | null => {
        if (!property) return null;
        
        if (selectedVersion) {
            // Return property with version data overlaid
            return {
                ...property,
                description: selectedVersion.description,
                availableFrom: selectedVersion.availableFrom,
                capacity: selectedVersion.capacity,
                currency: selectedVersion.currency.toString() as any,
                salePrice: selectedVersion.salePrice?.toString(),
                rentPrice: selectedVersion.rentPrice?.toString(),
                hasCommonExpenses: selectedVersion.hasCommonExpenses,
                commonExpensesValue: selectedVersion.commonExpensesValue?.toString(),
                isElectricityIncluded: selectedVersion.isElectricityIncluded || false,
                isWaterIncluded: selectedVersion.isWaterIncluded || false,
                isPriceVisible: selectedVersion.isPriceVisible,
                status: selectedVersion.status.toString() as any,
                isActive: selectedVersion.isActive,
                isPropertyVisible: selectedVersion.isPropertyVisible,
            };
        }
        
        return property;
    };

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

                // Set up image carousel
                if (data.propertyImages && data.propertyImages.length > 0) {
                    let mainImageIndex = 0;
                    if (data.mainImageId) {
                        const mainImageIndexFound = data.propertyImages.findIndex((img: PropertyImage) => img.id === data.mainImageId);
                        if (mainImageIndexFound !== -1) {
                            mainImageIndex = mainImageIndexFound;
                        }
                    }
                    setCurrentImageIndex(mainImageIndex);
                    const mainImage = data.propertyImages[mainImageIndex];
                    const fullUrl = `${API_BASE_URL}${mainImage.url.startsWith('/') ? '' : '/'}${mainImage.url}`;
                    setSelectedImage(fullUrl);
                } else {
                    setSelectedImage('https://placehold.co/600x400');
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

    // Image carousel functions
    const nextImage = () => {
        if (!property?.propertyImages) return;
        const nextIndex = (currentImageIndex + 1) % property.propertyImages.length;
        setCurrentImageIndex(nextIndex);
        const nextImage = property.propertyImages[nextIndex];
        const fullUrl = `${API_BASE_URL}${nextImage.url.startsWith('/') ? '' : '/'}${nextImage.url}`;
        setSelectedImage(fullUrl);
    };

    const prevImage = () => {
        if (!property?.propertyImages) return;
        const prevIndex = currentImageIndex === 0 ? property.propertyImages.length - 1 : currentImageIndex - 1;
        setCurrentImageIndex(prevIndex);
        const prevImage = property.propertyImages[prevIndex];
        const fullUrl = `${API_BASE_URL}${prevImage.url.startsWith('/') ? '' : '/'}${prevImage.url}`;
        setSelectedImage(fullUrl);
    };

    const selectImage = (index: number) => {
        if (!property?.propertyImages) return;
        setCurrentImageIndex(index);
        const selectedImg = property.propertyImages[index];
        const fullUrl = `${API_BASE_URL}${selectedImg.url.startsWith('/') ? '' : '/'}${selectedImg.url}`;
        setSelectedImage(fullUrl);
    };

    // Video thumbnail generation
    const generateVideoThumbnail = (url: string): string => {
        if (url.includes('youtube.com/watch') || url.includes('youtu.be/')) {
            let videoId = '';
            if (url.includes('youtu.be/')) {
                videoId = url.split('youtu.be/')[1].split('?')[0].split('/')[0];
            } else if (url.includes('youtube.com/watch')) {
                const match = url.match(/[?&]v=([^&]+)/);
                videoId = match ? match[1] : '';
            }

            if (videoId) {
                return `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`;
            }
        }
        if (url.includes('vimeo.com/')) {
            const videoId = url.split('vimeo.com/')[1].split('?')[0];
            return `https://vumbnail.com/${videoId}.jpg`;
        }
        return '';
    };

    // Duplicate property function
    const handleDuplicateProperty = async () => {
        if (!propertyId) return;
        
        try {
            setDuplicating(true);
            const duplicatedProperty: DuplicatedEstateProperty = await propertyService.duplicateProperty(propertyId);
            setShowDuplicateModal(false);
            navigate(`/dashboard/property/${duplicatedProperty.newPropertyId}/edit`);
        } catch (error) {
            console.error('Error duplicating property:', error);
            setError('Error al duplicar la propiedad. Por favor, inténtalo de nuevo.');
        } finally {
            setDuplicating(false);
        }
    };

    if (error) {
        return <div className="text-center text-red-500 mt-10">{error}</div>;
    }

    if (!property) {
        return <div className="text-center text-gray-600 mt-10">Propiedad no encontrada.</div>;
    }

    return (<>
        <Card>
            <div className="flex justify-between items-center mb-4">
                <h1 className="text-3xl font-bold">{property.title}</h1>
                <div className="flex space-x-2">
                    <Button 
                        color="alternative" 
                        onClick={() => setShowDuplicateModal(true)}
                        disabled={duplicating}
                    >
                        <Copy size={16} className="mr-2" />
                        Duplicar
                    </Button>
                    <Button href={`/dashboard/property/${property.id}/edit`}>
                        Editar
                    </Button>
                </div>
            </div>
            
            {/* Version History Dropdown */}
            {property.estatePropertyValues && property.estatePropertyValues.length > 0 && (
                <div className="mb-4 p-4 bg-white dark:bg-gray-800 rounded-lg">
                    <div className="flex items-center space-x-4">
                        <span className="text-sm font-medium">Historial de versiones:</span>
                        <Dropdown
                            label={selectedVersion ? 
                                `Versión del ${new Date(selectedVersion.createdAt).toLocaleDateString('es-UY')}` : 
                                'Versión actual'
                            }
                            dismissOnClick={true}
                            size="sm"
                        >
                            <DropdownItem 
                                onClick={() => setSelectedVersion(null)}
                                className={!selectedVersion ? 'bg-blue-50 text-blue-700' : ''}
                            >
                                Versión actual
                            </DropdownItem>
                            {property.estatePropertyValues
                                .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
                                .map((version) => (
                                <DropdownItem 
                                    key={version.id}
                                    onClick={() => setSelectedVersion(version)}
                                    className={selectedVersion?.id === version.id ? 'bg-blue-50 text-blue-700' : ''}
                                >
                                    {new Date(version.createdAt).toLocaleDateString('es-UY')} - {new Date(version.createdAt).toLocaleTimeString('es-UY', { hour: '2-digit', minute: '2-digit' })}
                                </DropdownItem>
                            ))}
                        </Dropdown>
                        {selectedVersion && (
                            <Button 
                                size="sm" 
                                color="light" 
                                onClick={() => setSelectedVersion(null)}
                            >
                                Volver a actual
                            </Button>
                        )}
                    </div>
                </div>
            )}
            <Card>
                <div className='mb-2'>
                    <h3 className="text-xl font-semibold mb-4 border-b pb-2">{`${propertyTypeMap[getCurrentPropertyData()?.type || property.type]} en ${getCurrentPropertyData()?.neighborhood || property.neighborhood}, ${getCurrentPropertyData()?.city || property.city}`}</h3>
                </div>
                {/* --- Image Gallery --- */}
                <div className="p-4 md:p-6">
                    <div className="mb-4 relative">
                        <img src={selectedImage} alt="Main property view" className="w-full h-auto max-h-[500px] object-cover rounded-lg shadow-md" />

                        {/* Carousel Navigation */}
                        {property.propertyImages && property.propertyImages.length > 1 && (
                            <>
                                <button
                                    onClick={prevImage}
                                    className="absolute left-4 top-1/2 transform -translate-y-1/2 bg-black bg-opacity-50 text-white p-2 rounded-full hover:bg-opacity-70 transition-all"
                                >
                                    <ChevronLeft size={24} />
                                </button>
                                <button
                                    onClick={nextImage}
                                    className="absolute right-4 top-1/2 transform -translate-y-1/2 bg-black bg-opacity-50 text-white p-2 rounded-full hover:bg-opacity-70 transition-all"
                                >
                                    <ChevronRight size={24} />
                                </button>

                                {/* Image Counter */}
                                <div className="absolute bottom-4 right-4 bg-black bg-opacity-50 text-white px-3 py-1 rounded-full text-sm">
                                    {currentImageIndex + 1} / {property.propertyImages.length}
                                </div>
                            </>
                        )}
                    </div>

                    {/* Thumbnail Gallery */}
                    {property.propertyImages && property.propertyImages.length > 1 && (
                        <div className="flex space-x-2 overflow-x-auto p-2">
                            {property.propertyImages.map((img: PropertyImage, index: number) => (
                                <button
                                    key={img.id || index}
                                    onClick={() => selectImage(index)}
                                    className="flex-shrink-0 relative"
                                >
                                    <img
                                        src={`${API_BASE_URL}${img.url.startsWith('/') ? '' : '/'}${img.url}`}
                                        alt={img.altText || `Thumbnail ${index + 1}`}
                                        className={`h-20 w-28 object-cover rounded-md border-2 transition-all ${currentImageIndex === index ? 'border-primary-400 scale-105' : 'border-transparent'
                                            }`}
                                    />
                                    {/* Main image indicator */}
                                    {img.id === property.mainImageId && (
                                        <div className="absolute top-1 right-1 bg-yellow-400 text-white rounded-full p-1">
                                            <Star size={12} />
                                        </div>
                                    )}
                                    {/* Public/Private indicator */}
                                    <div className="absolute bottom-1 left-1">
                                        {img.isPublic ? (
                                            <div title="Público">
                                                <Globe size={12} className="text-green-500 bg-white rounded-full p-0.5" />
                                            </div>
                                        ) : (
                                            <div title="Privado">
                                                <Lock size={12} className="text-red-500 bg-white rounded-full p-0.5" />
                                            </div>
                                        )}
                                    </div>
                                </button>
                            ))}
                        </div>
                    )}
                </div>

                <div className='mb-8'>
                    <h3 className="text-xl font-semibold border-b pb-2">Características</h3>
                </div>
                {/* --- Section: Main Details --- */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-8 mb-8">
                    <InfoField icon={<Home size={20} className={iconStyle} />} label="Tipo de Propiedad" value={propertyTypeMap[getCurrentPropertyData()?.type || property.type]} />
                    <InfoField icon={<Building size={20} className={iconStyle} />} label="Área Total" value={`${getCurrentPropertyData()?.areaValue || property.areaValue} ${formatAreaUnit(getCurrentPropertyData()?.areaUnit || property.areaUnit)}`} />
                    <InfoField icon={<BedDouble size={20} className={iconStyle} />} label="Dormitorios" value={getCurrentPropertyData()?.bedrooms || property.bedrooms} />
                    <InfoField icon={<Bath size={20} className={iconStyle} />} label="Baños" value={getCurrentPropertyData()?.bathrooms || property.bathrooms} />
                    <InfoField icon={<Car size={20} className={iconStyle} />} label="Espacios de Garage" value={(getCurrentPropertyData()?.hasGarage || property.hasGarage) ? (getCurrentPropertyData()?.garageSpaces || property.garageSpaces) : 'No tiene'} />
                    <InfoField icon={<Users size={20} className={iconStyle} />} label="Capacidad" value={`${property.estatePropertyValues?.[0]?.capacity || 1} persona(s)`} />
                    <InfoField icon={<Calendar size={20} className={iconStyle} />} label="Disponible Desde" value={new Date(getCurrentPropertyData()?.availableFrom || property.availableFrom).toLocaleDateString('es-UY')} />
                </div>

                {/* --- Section: Description --- */}
                <div className='mb-8'>
                    <h3 className="text-xl font-semibold mb-4 border-b pb-2">Descripción</h3>
                    <p className="whitespace-pre-wrap">{getCurrentPropertyData()?.description || property.description || 'No se proporcionó una descripción.'}</p>
                </div>

                {/* --- Section: Address --- */}
                <div className='mb-8'>
                    <h3 className="text-xl font-semibold mb-4 border-b pb-2">Ubicación</h3>
                    <InfoField icon={<MapPin size={20} className={iconStyle} />} label="Dirección">
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
                    <h3 className="text-xl font-semibold mb-4 border-b pb-2">Información Financiera</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {(getCurrentPropertyData()?.salePrice || property.salePrice) && <InfoField icon={<DollarSign size={20} className={iconStyle} />} label="Precio de Venta" value={formatCurrency(getCurrentPropertyData()?.salePrice || property.salePrice, getCurrentPropertyData()?.currency || property.currency)} />}
                        {(getCurrentPropertyData()?.rentPrice || property.rentPrice) && <InfoField icon={<DollarSign size={20} className={iconStyle} />} label="Precio de Alquiler" value={`${formatCurrency(getCurrentPropertyData()?.rentPrice || property.rentPrice, getCurrentPropertyData()?.currency || property.currency)} /mes`} />}
                        {(getCurrentPropertyData()?.hasCommonExpenses || property.hasCommonExpenses) && <InfoField icon={<DollarSign size={20} className={iconStyle} />} label="Gastos Comunes" value={formatCurrency(getCurrentPropertyData()?.commonExpensesValue || property.commonExpensesValue, getCurrentPropertyData()?.currency || property.currency)} />}
                        <BooleanField icon={<Wrench size={20} className={iconStyle} />} label="Agua Incluida" value={getCurrentPropertyData()?.isWaterIncluded || property.isWaterIncluded} />
                        <BooleanField icon={<Wrench size={20} className={iconStyle} />} label="Electricidad Incluida" value={getCurrentPropertyData()?.isElectricityIncluded || property.isElectricityIncluded} />
                    </div>
                </div>

                {/* --- Section: Documents --- */}
                {property.propertyDocuments && property.propertyDocuments.length > 0 && (
                    <div className='mb-8'>
                        <h3 className="text-xl font-semibold mb-4 border-b pb-2">Documentos</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {property.propertyDocuments.map((doc: PropertyDocument, index: number) => (
                                <div key={doc.id || index} className="flex items-center space-x-3 p-3 rounded-md transition-colors hover:bg-[#E8F8F7] bg-white border border-gray-200">
                                    <FileText className="text-[#1B4965] shrink-0" size={24} />
                                    <div className="flex-grow min-w-0">
                                        <p className="font-semibold text-[#1B4965] text-sm truncate">{doc.name}</p>
                                        <p className="text-xs text-gray-500 truncate">{doc.fileName}</p>
                                    </div>
                                    <div className="flex items-center space-x-2">
                                        {/* Public/Private indicator */}
                                        {doc.isPublic ? (
                                            <div title="Público">
                                                <Globe size={24} className="text-green-500" />
                                            </div>
                                        ) : (
                                            <div title="Privado">
                                                <Lock size={24} className="text-red-500" />
                                            </div>
                                        )}
                                        <a
                                            href={`${API_BASE_URL}${doc.url.startsWith('/') ? '' : '/'}${doc.url}`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="p-1 text-[#62B6CB] hover:bg-[#62B6CB] hover:text-white rounded transition-colors"
                                            title="Abrir documento"
                                        >
                                            <ExternalLink size={24} />
                                        </a>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* --- Section: Videos --- */}
                {property.propertyVideos && property.propertyVideos.length > 0 && (
                    <div className='mb-8'>
                        <h3 className="text-xl font-semibold mb-4 border-b pb-2">Videos</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {property.propertyVideos.map((video: PropertyVideo, index: number) => (
                                <div key={video.id || index} className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden group">
                                    {/* Video Thumbnail */}
                                    <div className="relative aspect-video bg-gray-100">
                                        {video.url && generateVideoThumbnail(video.url) ? (
                                            <img
                                                src={generateVideoThumbnail(video.url)}
                                                alt={video.title || 'Video thumbnail'}
                                                className="w-full h-full object-cover"
                                                onError={(e) => {
                                                    const target = e.target as HTMLImageElement;
                                                    target.style.display = 'none';
                                                    const fallback = target.parentElement?.querySelector('.video-fallback') as HTMLElement;
                                                    if (fallback) {
                                                        fallback.classList.remove('hidden');
                                                    }
                                                }}
                                            />
                                        ) : null}

                                        {/* Fallback when no thumbnail */}
                                        <div className={`video-fallback absolute inset-0 flex items-center justify-center ${video.url && generateVideoThumbnail(video.url) ? 'hidden' : ''}`}>
                                            <Play size={48} className="text-gray-400" />
                                        </div>

                                        {/* Public/Private indicator */}
                                        <div className="absolute top-2 left-2">
                                            {video.isPublic ? (
                                                <div title="Público">
                                                    <Globe size={28} className="text-primary-400 bg-white rounded-full p-1" />
                                                </div>
                                            ) : (
                                                <div title="Privado">
                                                    <Lock size={28} className="text-red-500 bg-white rounded-full p-1" />
                                                </div>
                                            )}
                                        </div>

                                        {/* Open in new tab button */}
                                        <div className="absolute top-2 right-2">
                                            <a
                                                href={video.url}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                                                title="Abrir video en nueva pestaña"
                                            >
                                                <ExternalLink size={28} />
                                            </a>
                                        </div>
                                    </div>

                                    {/* Video Details */}
                                    <div className="p-4">
                                        <h4 className="font-semibold text-gray-800 mb-1 truncate">
                                            {video.title || 'Sin título'}
                                        </h4>
                                        {video.description && (
                                            <p className="text-sm text-gray-600 overflow-hidden" style={{
                                                display: '-webkit-box',
                                                WebkitLineClamp: 2,
                                                WebkitBoxOrient: 'vertical'
                                            }}>
                                                {video.description}
                                            </p>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* --- Section: Amenities --- */}
                {property.amenities && property.amenities.length > 0 && (
                    <div className='mb-8'>
                        <h3 className="text-xl font-semibold mb-4 border-b pb-2">Servicios y Amenidades</h3>
                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                            {property.amenities.map((amenity: Amenity) => (
                                <div key={amenity.id} className="flex items-center space-x-3 p-3 rounded-md bg-[#E8F8F7] border border-[#62B6CB]">
                                    <CheckCircle size={20} className="text-green-500 flex-shrink-0" />
                                    <span className="text-sm font-medium text-[#1B4965]">{amenity.name}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* --- Section: Internal Status (For Owner) --- */}
                <div className='mb-8 bg-blue-50 dark:bg-gray-700 p-6 rounded-lg border border-blue-200 dark:border-gray-500'>
                    <h3 className="text-xl font-semibold mb-4 border-b pb-2">Estado Interno (Solo visible para ti)</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <InfoField icon={<Info size={20} className={iconStyle} />} label="Estado de la publicación" value={propertyStatusMap[getCurrentPropertyData()?.status || property.status] || 'No definido'} />
                        <BooleanField icon={<CheckCircle size={20} className={iconStyle} />} label="Activa en el sistema" value={getCurrentPropertyData()?.isActive || property.isActive} />
                        <BooleanField icon={<Eye size={20} className={iconStyle} />} label="Visible al público" value={getCurrentPropertyData()?.isPropertyVisible || property.isPropertyVisible} />
                        <BooleanField icon={<EyeOff size={20} className={iconStyle} />} label="Precio visible al público" value={getCurrentPropertyData()?.isPriceVisible || property.isPriceVisible} />
                    </div>
                </div>

            </Card>
        </Card>

        {/* Duplicate Confirmation Modal */}
        <Modal show={showDuplicateModal} onClose={() => setShowDuplicateModal(false)}>
            <ModalHeader>Confirmar acción de duplicar</ModalHeader>
            <ModalBody>
                <div className="space-y-6">
                    <p className="text-base leading-relaxed text-gray-500 dark:text-gray-400">
                        ¿Estás seguro de que quieres duplicar esta propiedad? Se creará una copia exacta que podrás editar.
                    </p>
                </div>
            </ModalBody>
            <ModalFooter>
                <Button 
                    color="alternative" 
                    onClick={() => setShowDuplicateModal(false)}
                    disabled={duplicating}
                >
                    Cancelar
                </Button>
                <Button 
                    onClick={handleDuplicateProperty}
                    disabled={duplicating}
                >
                    {duplicating && <Loader2 className="animate-spin mr-2" size={16} />}
                    {duplicating ? 'Duplicando...' : 'Duplicar'}
                </Button>
            </ModalFooter>
        </Modal>
    </>);
};

export default PropertyViewPage;