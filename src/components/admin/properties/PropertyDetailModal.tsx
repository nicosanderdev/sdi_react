// src/components/admin/properties/PropertyDetailModal.tsx
import React from 'react';
import { Modal, Button, Tabs, Card, ModalHeader, ModalBody, TabItem, ModalFooter } from 'flowbite-react';
import {
  MapPinIcon,
  HomeIcon,
  EyeOffIcon,
  XCircleIcon,
  ClockIcon,
  UserIcon,
  BarChart3Icon
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';
import { UseAdminPropertiesReturn } from '../../../hooks/useAdminProperties';
import reportService from '../../../services/ReportService';

interface PropertyDetailModalProps {
  hook: UseAdminPropertiesReturn;
}

const formatDate = (dateString: string | null): string => {
  if (!dateString) return 'Nunca';
  return new Date(dateString).toLocaleDateString('es-ES', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};

const getPropertyTypeLabel = (category: number): string => {
  // Mirrors `get_admin_property_detail` mapping from SQL:
  // 0: Casa, 1: Apartamento, 2: Terreno, 3: Chacra, 4: Campo
  const categories = ['Casa', 'Apartamento', 'Terreno', 'Chacra', 'Campo'];
  return categories[category] || 'Desconocido';
};

const getAreaUnitLabel = (unit: number): string => {
  const units = ['m²', 'ft²', 'yd²', 'acres', 'hectares', 'sq_km', 'sq_mi'];
  return units[unit] || 'm²';
};

const PROPERTY_VIEWS_PERIOD = 'last30days';

export const PropertyDetailModal: React.FC<PropertyDetailModalProps> = ({ hook }) => {
  const {
    selectedProperty,
    detailModalOpen,
    closeDetailModal,
    propertyDetailLoading,
    hideProperty,
    markPropertyInvalid,
    openDeleteConfirmModal,
  } = hook;

  const { data: propertyViewsData, isLoading: loadingViews } = useQuery({
    queryKey: ['propertyViews', selectedProperty?.id, PROPERTY_VIEWS_PERIOD],
    queryFn: () => reportService.getPropertyViews(selectedProperty!.id, { period: PROPERTY_VIEWS_PERIOD }),
    enabled: !!selectedProperty?.id,
  });

  const { data: propertyViewsBySource, isLoading: loadingViewsBySource } = useQuery({
    queryKey: ['propertyViewsBySource', selectedProperty?.id, PROPERTY_VIEWS_PERIOD],
    queryFn: () => reportService.getPropertyViewsBySource(selectedProperty!.id, { period: PROPERTY_VIEWS_PERIOD }),
    enabled: !!selectedProperty?.id,
  });

  const totalViews = propertyViewsData?.reduce((sum, d) => sum + d.count, 0) ?? 0;
  const chartData = (propertyViewsData ?? []).map(d => ({
    date: d.date,
    dateLabel: new Date(d.date).toLocaleDateString(undefined, { day: '2-digit', month: '2-digit' }),
    visits: d.count,
  }));

  if (!selectedProperty) return null;

  const handleQuickAction = async (action: () => Promise<void>) => {
    try {
      await action();
    } catch (error) {
      // Error handling is done in the hook
    }
  };

  const handleHide = () => handleQuickAction(() => hideProperty(selectedProperty.id, 'Hidden by admin'));
  const handleMarkInvalid = () => handleQuickAction(() => markPropertyInvalid(selectedProperty.id, 'Marked as invalid by admin'));
  const handleDelete = () => openDeleteConfirmModal(selectedProperty);

  const derivedTitle = `${selectedProperty.street_name} ${selectedProperty.house_number}`;

  return (
    <Modal
      show={detailModalOpen}
      onClose={closeDetailModal}
      size="4xl"
      className="h-full"
    >
      <ModalHeader>
        <div className="flex items-center space-x-3">
          <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
            <HomeIcon className="w-6 h-6 text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              {derivedTitle}
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {selectedProperty.city}, {selectedProperty.state}
            </p>
          </div>
        </div>
      </ModalHeader>

      <ModalBody>
        {propertyDetailLoading ? (
          <div className="flex justify-center items-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 dark:border-white"></div>
          </div>
        ) : (
          <Tabs aria-label="Pestañas de detalles de la propiedad" className='underline'>
            {/* Overview Tab */}
            <TabItem active title="Resumen" icon={HomeIcon}>
              <div className="space-y-6">
                {/* Quick Actions */}
                <Card>
                  <h4 className="text-md font-semibold mb-4">Acciones rápidas</h4>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      color="gray"
                      onClick={handleHide}
                      className="flex items-center space-x-2"
                    >
                      <EyeOffIcon className="w-4 h-4" />
                      <span>Ocultar propiedad</span>
                    </Button>

                    <Button
                      size="sm"
                      color="yellow"
                      onClick={handleMarkInvalid}
                      className="flex items-center space-x-2"
                    >
                      <XCircleIcon className="w-4 h-4" />
                      <span>Marcar como inválido</span>
                    </Button>

                    <Button
                      size="sm"
                      color="failure"
                      onClick={handleDelete}
                      className="flex items-center space-x-2"
                    >
                      <XCircleIcon className="w-4 h-4" />
                      <span>Eliminar propiedad</span>
                    </Button>
                  </div>
                </Card>

                {/* Basic Information */}
                <Card>
                  <h4 className="text-md font-semibold mb-4">Información básica</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-3">
                      <div className="flex items-center space-x-2">
                        <HomeIcon className="w-4 h-4 text-gray-400" />
                        <span className="text-sm text-gray-600 dark:text-gray-300">
                          Tipo: {getPropertyTypeLabel(selectedProperty.category)}
                        </span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <MapPinIcon className="w-4 h-4 text-gray-400" />
                        <span className="text-sm text-gray-600 dark:text-gray-300">
                          Ubicación: {selectedProperty.street_name} {selectedProperty.house_number}, {selectedProperty.city}, {selectedProperty.state}
                        </span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <HomeIcon className="w-4 h-4 text-gray-400" />
                        <span className="text-sm text-gray-600 dark:text-gray-300">
                          Tamaño: {selectedProperty.area_value} {getAreaUnitLabel(selectedProperty.area_unit)}
                        </span>
                      </div>
                    </div>
                    <div className="space-y-3">
                      <div className="flex items-center space-x-2">
                        <HomeIcon className="w-4 h-4 text-gray-400" />
                        <span className="text-sm text-gray-600 dark:text-gray-300">
                          Habitaciones: {selectedProperty.bedrooms}, Baños: {selectedProperty.bathrooms}
                        </span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <HomeIcon className="w-4 h-4 text-gray-400" />
                        <span className="text-sm text-gray-600 dark:text-gray-300">
                          Garaje: {selectedProperty.garage_spaces > 0 ? `${selectedProperty.garage_spaces} espacios` : 'No'}
                        </span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <UserIcon className="w-4 h-4 text-gray-400" />
                        <span className="text-sm text-gray-600 dark:text-gray-300">
                          Capacidad: {selectedProperty.capacity} personas
                        </span>
                      </div>
                    </div>
                  </div>
                </Card>

                {/* Dates */}
                <Card>
                  <h4 className="text-md font-semibold mb-4">Fechas importantes</h4>
                  <div className="space-y-2">
                    <div className="flex items-center space-x-2">
                      <ClockIcon className="w-4 h-4 text-gray-400" />
                      <span className="text-sm text-gray-600 dark:text-gray-300">
                        Creado: {formatDate(selectedProperty.created)}
                      </span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <ClockIcon className="w-4 h-4 text-gray-400" />
                      <span className="text-sm text-gray-600 dark:text-gray-300">
                        Última modificación: {formatDate(selectedProperty.lastModified)}
                      </span>
                    </div>
                  </div>
                </Card>
              </div>
            </TabItem>

            {/* Owner Tab */}
            <TabItem title="Propietario" icon={UserIcon}>
              <Card>
                <h4 className="text-md font-semibold mb-4">Información del propietario</h4>
                <div className="space-y-3">
                  <div>
                        <p className="text-sm text-gray-500 dark:text-gray-400">ID del propietario</p>
                        <p className="text-sm font-mono text-gray-600 dark:text-gray-300">{selectedProperty.owner_id}</p>
                  </div>
                </div>
              </Card>
            </TabItem>

            {/* Analytics / Views Tab */}
            <TabItem title="Visitas" icon={BarChart3Icon}>
              <div className="space-y-6">
                {loadingViews && loadingViewsBySource ? (
                  <div className="flex justify-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 dark:border-white" />
                  </div>
                ) : (
                  <>
                    <Card>
                      <h4 className="text-md font-semibold mb-2">Vistas (últimos 30 días)</h4>
                      <p className="text-2xl font-bold text-gray-900 dark:text-white">{totalViews.toLocaleString('es-ES')}</p>
                    </Card>
                    <Card>
                      <h4 className="text-md font-semibold mb-3">Visitas por día</h4>
                      <div className="h-48">
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={chartData} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="dateLabel" tick={{ fontSize: 10 }} />
                            <YAxis allowDecimals={false} tick={{ fontSize: 10 }} />
                            <Tooltip formatter={(value: number) => [value, 'Visitas']} />
                            <Line type="monotone" dataKey="visits" name="Visitas" stroke="#0f9d58" strokeWidth={2} dot={{ r: 3 }} />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                    </Card>
                    <Card>
                      <h4 className="text-md font-semibold mb-3">Visitas por fuente</h4>
                      {(propertyViewsBySource?.length ?? 0) === 0 ? (
                        <p className="text-sm text-gray-500 dark:text-gray-400">Sin datos por fuente en este período.</p>
                      ) : (
                        <div className="h-48">
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={propertyViewsBySource ?? []} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
                              <CartesianGrid strokeDasharray="3 3" />
                              <XAxis dataKey="source" tick={{ fontSize: 10 }} />
                              <YAxis allowDecimals={false} tick={{ fontSize: 10 }} />
                              <Tooltip />
                              <Bar dataKey="visits" name="Visitas" fill="#0f9d58" radius={[4, 4, 0, 0]} />
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                      )}
                    </Card>
                  </>
                )}
              </div>
            </TabItem>

            {/* Description Tab */}
            {selectedProperty.allowedEventsDescription && (
              <TabItem title="Descripción" icon={HomeIcon}>
                <Card>
                  <h4 className="text-md font-semibold mb-4">Descripción de eventos</h4>
                  <div className="prose dark:prose-invert max-w-none">
                    <p className="text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
                      {selectedProperty.allowedEventsDescription}
                    </p>
                  </div>
                </Card>
              </TabItem>
            )}
          </Tabs>
        )}
      </ModalBody>

      <ModalFooter>
        <Button color="gray" onClick={closeDetailModal}>
          Cerrar
        </Button>
      </ModalFooter>
    </Modal>
  );
};
