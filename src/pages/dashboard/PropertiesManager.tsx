import { useState, useEffect, useMemo, memo } from 'react';
import { PlusIcon, SearchIcon, Loader2Icon } from 'lucide-react';
import { PropertyTable } from '../../components/dashboard/properties/PropertyTable';
import { AddPropertyForm } from './AddPropertyForm';
import propertyService from '../../services/PropertyService';
import DashboardPageTitle from '../../components/dashboard/DashboardPageTitle';
import { Button, Card, Dropdown, DropdownItem, Modal, ModalBody, ModalHeader } from 'flowbite-react';
import { PropertyData } from '../../models/properties';
import { CompanySelector, COMPANY_SELECTOR_OPTIONS } from '../../components/dashboard/CompanySelector';
import { usePropertyQuota } from '../../hooks/usePropertyQuota';
import { useAuth } from '../../contexts/AuthContext';

const TABS = [
  { id: 'all', label: 'Todas' },
  { id: 'sale', label: 'En Venta' },
  { id: 'rent', label: 'En Alquiler' },
  { id: 'reserved', label: 'Reservadas' },
  { id: 'archived', label: 'Archivadas' }
];

const SEARCH_FIELDS: (keyof PropertyData)[] = ['title', 'streetName', 'houseNumber', 'neighborhood', 'city', 'state'];

const PropertiesManagerComponent = () => {
  const { user } = useAuth();
  const [allProperties, setAllProperties] = useState<PropertyData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddProperty, setShowAddProperty] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [propertyToDelete, setPropertyToDelete] = useState<PropertyData | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [company, setCompany] = useState<string>(COMPANY_SELECTOR_OPTIONS.MY_PROPERTIES);

  // Property quota information
  const {
    ownedCount,
    publishedCount,
    totalLimit,
    publishedLimit,
    remainingTotal,
    remainingPublished,
    isAtTotalLimit,
    isAtPublishedLimit,
    isLoading: isQuotaLoading
  } = usePropertyQuota();

  // Helper function to get company filter for API calls
  const getCompanyFilter = () => {
    if (company === COMPANY_SELECTOR_OPTIONS.ALL_COMPANIES) {
      return { companyId: 'all-companies' }; // Special value for all companies
    }
    if (company === COMPANY_SELECTOR_OPTIONS.MY_PROPERTIES) {
      return {}; // No company filter for personal properties
    }
    return { companyId: company }; // Specific company ID
  };

  const fetchProperties = async () => {
    setIsLoading(true);
    setError(null);
    try {
      let data;

      if (company === COMPANY_SELECTOR_OPTIONS.ALL_PROPERTIES) {
        // Fetch both personal properties and company properties, then combine
        const [personalData, companyData] = await Promise.all([
          propertyService.getOwnersProperties({ user }), // Personal properties
          propertyService.getOwnersProperties({ companyId: 'all-companies', user }) // Company properties
        ]);

        // Combine and deduplicate properties (in case some properties appear in both)
        const allItems = [...(personalData.items || []), ...(companyData.items || [])];
        const uniqueItems = allItems.filter((item, index, self) =>
          index === self.findIndex(t => t.id === item.id)
        );

        data = { ...personalData, items: uniqueItems };
      } else {
        data = await propertyService.getOwnersProperties({ ...getCompanyFilter(), user });
      }

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
  }, [company]);

  const filteredProperties = useMemo(() => {
    let properties = [...allProperties];

    if (activeTab !== 'all') {
      properties = properties.filter(p => p.status && p.status.toLowerCase() === activeTab.toLowerCase());
    }

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

  const handlePrintProperty = (id: string) => {
    console.log(`Placeholder: Print property with ID: ${id}`);
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
      
    } catch (err: any) {
      setError(err.message || 'Failed to delete property.');
      console.error(err);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleAddPropertyFormClose = () => {
    setShowAddProperty(false);
    fetchProperties();
  };

  if (showAddProperty) {
    return <AddPropertyForm onClose={handleAddPropertyFormClose} />;
  }

  return (
    <div>
      <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-6">
      <DashboardPageTitle title="Gestión de Propiedades" />
        <div className="flex items-center space-x-2">
            <CompanySelector
                mode="all-options"
                value={company}
                onChange={setCompany}
                className="mr-4"
            />
            <Button
                onClick={() => setShowAddProperty(true)}
                disabled={isAtTotalLimit || isQuotaLoading} >
                <PlusIcon size={18} className="mr-2" />
                <span>Nueva Propiedad</span>
            </Button>
        </div>
      </div>

      {/* Property Quota Display */}
      {!isQuotaLoading && (
        <div className="mb-4 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between space-y-2 md:space-y-0">
            <div className="flex space-x-6">
              <div className="text-sm">
                <span className="text-gray-600 dark:text-gray-400">Propiedades totales:</span>
                <span className={`ml-2 font-semibold ${isAtTotalLimit ? 'text-red-600' : 'text-gray-900 dark:text-gray-100'}`}>
                  {ownedCount}/{totalLimit}
                </span>
                {isAtTotalLimit && (
                  <span className="ml-2 text-red-600 text-xs">(Límite alcanzado)</span>
                )}
              </div>
              <div className="text-sm">
                <span className="text-gray-600 dark:text-gray-400">Propiedades publicadas:</span>
                <span className={`ml-2 font-semibold ${isAtPublishedLimit ? 'text-orange-600' : 'text-gray-900 dark:text-gray-100'}`}>
                  {publishedCount}/{publishedLimit}
                </span>
                {isAtPublishedLimit && (
                  <span className="ml-2 text-orange-600 text-xs">(Límite alcanzado)</span>
                )}
              </div>
            </div>
            {isAtTotalLimit && (
              <div className="text-sm text-red-600 font-medium">
                No puedes crear más propiedades
              </div>
            )}
          </div>
        </div>
      )}

      {error && !isDeleting && ( 
            <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 mb-4" role="alert">
                <p className="font-bold">Error</p>
                <p>{error}</p>
            </div>
        )}

      <Card>
        <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-6">
          <div className="flex space-x-1 mb-4 md:mb-0 overflow-x-auto p-2">
            {TABS.map(tab => (
              <Button
                color={activeTab === tab.id ? (tab.id === 'archived' ? 'red' : 'default') : 'alternative'}
                key={tab.id} 
                onClick={() => setActiveTab(tab.id)} 
              >
                {tab.label}
              </Button>
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
            onPrintProperty={handlePrintProperty}
            onDeleteProperty={handleDeleteRequest}
          />
        )}
      </Card>

      {/* Delete Confirmation Modal */}
      {propertyToDelete &&
      <Modal show={showDeleteModal} onClose={() => setShowDeleteModal(false)} className='text-gray-800 dark:text-gray-50'>
        <ModalHeader>
          <h3 className="text-xl font-semibold mb-2">Confirmar Eliminación</h3>
        </ModalHeader>
        <ModalBody>
          <p className="mb-4 text-xl text-center">
            ¿Estás seguro de que quieres eliminar la propiedad: <br />
            <strong>{propertyToDelete.title}</strong>?
          </p>
          <p className="text-sm mb-8 text-center">Esta acción no se puede deshacer.</p>

          {error && isDeleting && ( // Show delete-specific error here
            <div className="bg-red-100 border border-red-400 text-red-700 px-3 py-2 rounded text-sm mb-3" role="alert">
              {error}
            </div>
          )}
          <div className='flex justify-end gap-2 w-100'>
            <Button
              color="alternative"
              onClick={() => { setShowDeleteModal(false); setError(null); }}
              disabled={isDeleting}
            >
              Cancelar
            </Button>
            <Button
              color="red"
              onClick={confirmDeleteProperty}
              disabled={isDeleting}
            >
              {isDeleting ? (
                <>
                  <Loader2Icon size={16} className="animate-spin mr-2" />
                  Eliminando...
                </>
              ) : (
                "Eliminar"
              )}
            </Button>
          </div>
        </ModalBody>
      </Modal>}
    </div>
  );
};

export const PropertiesManager = memo(PropertiesManagerComponent);