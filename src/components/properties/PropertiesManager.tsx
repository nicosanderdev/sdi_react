// src/components/PropertiesManager.tsx
import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { PlusIcon, SearchIcon, Loader2Icon } from 'lucide-react';
import { PropertyTable } from './PropertyTable'; // Assuming same directory
import { AddPropertyForm } from './AddPropertyForm'; // Assuming same directory
import propertyService, { PropertyData } from '../../services/PropertyService'; // Adjust path

const TABS = [
  { id: 'all', label: 'Todas' },
  { id: 'sale', label: 'En Venta' },
  { id: 'rent', label: 'En Alquiler' },
  { id: 'reserved', label: 'Reservadas' }
];

const SEARCH_FIELDS: (keyof PropertyData)[] = ['title', 'streetName', 'houseNumber', 'neighborhood', 'city', 'state'];

export function PropertiesManager() {
  const [allProperties, setAllProperties] = useState<PropertyData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddProperty, setShowAddProperty] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [propertyToDelete, setPropertyToDelete] = useState<PropertyData | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const navigate = useNavigate();

  const fetchProperties = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await propertyService.getUserProperties();
      setAllProperties(data.items || []);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch properties.');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchProperties();
  }, []);

  const filteredProperties = useMemo(() => {
    let properties = [...allProperties];

    // Filter by activeTab
    if (activeTab !== 'all') {
      properties = properties.filter(p => p.status && p.status.toLowerCase() === activeTab.toLowerCase());
    }

    // Filter by searchTerm
    if (searchTerm.trim() !== '') {
      const lowerSearchTerm = searchTerm.toLowerCase();
      properties = properties.filter(property => 
        SEARCH_FIELDS.some(field => {
          const value = property[field];
          return typeof value === 'string' && value.toLowerCase().includes(lowerSearchTerm);
        })
      );
    }
    return properties;
  }, [allProperties, activeTab, searchTerm]);

  /* const handleViewProperty = (id: string) => {
    navigate(`/properties/${id}`);
  }; */ 

  const handleEditProperty = (id: string) => {
    navigate(`/properties/${id}/edit`);
  };

  const handlePrintProperty = (id: string) => {
    console.log(`Placeholder: Print property with ID: ${id}`);
    // Future implementation for printing
  };

  const handleDeleteRequest = (property: PropertyData) => {
    setPropertyToDelete(property);
    setShowDeleteModal(true);
  };

  const confirmDeleteProperty = async () => {
    if (!propertyToDelete) return;
    setIsDeleting(true);
    setError(null);
    try {
      await propertyService.deleteProperty(propertyToDelete.id);
      setAllProperties(prev => prev.filter(p => p.id !== propertyToDelete.id));
      setShowDeleteModal(false);
      setPropertyToDelete(null);
      // Optionally show a success toast/message
    } catch (err: any) {
      setError(err.message || 'Failed to delete property.');
      console.error(err);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleAddPropertyFormClose = () => {
    setShowAddProperty(false);
    fetchProperties(); // Refetch properties after adding a new one
  };

  if (showAddProperty) {
    return <AddPropertyForm onClose={handleAddPropertyFormClose} />;
  }

  return (
    <div className="p-4 md:p-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-6">
        <h1 className="text-2xl font-bold text-[#101828] mb-4 md:mb-0">
          Gestión de Propiedades
        </h1>
        <button 
          onClick={() => setShowAddProperty(true)} 
          className="flex items-center bg-[#62B6CB] text-[#FDFFFC] px-4 py-2.5 rounded-md hover:opacity-90 transition-colors shadow-sm"
        >
          <PlusIcon size={18} className="mr-2" />
          <span>Nueva Propiedad</span>
        </button>
      </div>

      {error && !isDeleting && ( // Show general fetch error, not delete error which is handled in modal
            <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 mb-4" role="alert">
                <p className="font-bold">Error</p>
                <p>{error}</p>
            </div>
        )}

      <div className="bg-[#FDFFFC] rounded-lg shadow-sm border border-gray-100 p-4 md:p-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-6">
          <div className="flex space-x-1 mb-4 md:mb-0 overflow-x-auto pb-2">
            {TABS.map(tab => (
              <button 
                key={tab.id} 
                onClick={() => setActiveTab(tab.id)} 
                className={`px-3 py-2 rounded-md text-sm font-medium whitespace-nowrap ${
                  activeTab === tab.id 
                    ? 'bg-[#62B6CB] text-[#FDFFFC] shadow-sm' 
                    : 'bg-[#BEE9E8] text-[#101828] hover:bg-opacity-80 transition-colors'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
          <div className="relative">
            <input 
              type="text" 
              placeholder="Buscar por título, dirección..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 pr-4 py-2 w-full md:w-72 border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#62B6CB] focus:border-[#62B6CB]" 
            />
            <SearchIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
          </div>
        </div>
        
        {isLoading ? (
          <div className="text-center py-10">
            <Loader2Icon size={48} className="mx-auto text-[#62B6CB] animate-spin mb-4" />
            <p className="text-gray-500">Cargando propiedades...</p>
          </div>
        ) : (
          <PropertyTable 
            properties={filteredProperties}
            // onViewProperty={handleViewProperty}
            onEditProperty={handleEditProperty}
            onPrintProperty={handlePrintProperty}
            onDeleteProperty={handleDeleteRequest}
          />
        )}
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteModal && propertyToDelete && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center p-4 z-50 transition-opacity duration-300">
          <div className="bg-white p-6 rounded-lg shadow-xl w-full max-w-md transform transition-all duration-300 scale-100">
            <h3 className="text-xl font-semibold text-[#1B4965] mb-2">Confirmar Eliminación</h3>
            <p className="text-gray-600 mb-1">
              ¿Estás seguro de que quieres eliminar la propiedad: <br/>
              <strong className="text-gray-800">{propertyToDelete.title}</strong>?
            </p>
            <p className="text-sm text-gray-500 mb-4">Esta acción no se puede deshacer.</p>
            
            {error && isDeleting && ( // Show delete-specific error here
                <div className="bg-red-100 border border-red-400 text-red-700 px-3 py-2 rounded text-sm mb-3" role="alert">
                    {error}
                </div>
            )}

            <div className="flex justify-end space-x-3 pt-2">
              <button
                onClick={() => { setShowDeleteModal(false); setError(null); }}
                disabled={isDeleting}
                className="px-4 py-2 border border-gray-300 rounded-md text-sm hover:bg-gray-50 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={confirmDeleteProperty}
                disabled={isDeleting}
                className="bg-red-600 text-white px-4 py-2 rounded-md text-sm hover:bg-red-700 transition-colors disabled:opacity-50 flex items-center"
              >
                {isDeleting ? (
                  <>
                    <Loader2Icon size={16} className="animate-spin mr-2" />
                    Eliminando...
                  </>
                ) : (
                  "Eliminar"
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}