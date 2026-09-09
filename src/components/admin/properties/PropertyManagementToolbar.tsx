// src/components/admin/properties/PropertyManagementToolbar.tsx
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from 'flowbite-react';
import {
  CalendarIcon,
  EyeIcon,
  Edit2Icon,
  FileTextIcon,
  TrashIcon,
  CopyIcon,
  Loader2Icon,
} from 'lucide-react';
import { UseAdminPropertiesReturn } from '../../../hooks/useAdminProperties';
import propertyService from '../../../services/PropertyService';

interface PropertyManagementToolbarProps {
  hook: UseAdminPropertiesReturn;
}

export const PropertyManagementToolbar: React.FC<PropertyManagementToolbarProps> = ({ hook }) => {
  const navigate = useNavigate();
  const [duplicating, setDuplicating] = useState(false);
  const {
    selectedPropertyIds,
    primarySelectedProperty,
    fetchPropertyDetail,
    openDeleteConfirmModal,
    fetchProperties,
    setEditingListingPropertyId,
  } = hook;

  const singleSelection = selectedPropertyIds.length === 1;
  const selectedId = singleSelection ? selectedPropertyIds[0] : null;

  const handleCalendar = () => {
    if (!selectedId) return;
    navigate(`/dashboard/property/${selectedId}/bookings`);
  };

  const handleView = () => {
    if (!selectedId) return;
    void fetchPropertyDetail(selectedId);
  };

  const handleEditProperty = () => {
    if (!selectedId) return;
    navigate(`/dashboard/property/${selectedId}/edit`);
  };

  const handleEditPublication = () => {
    if (!selectedId) return;
    setEditingListingPropertyId(selectedId);
  };

  const handleDelete = () => {
    if (!primarySelectedProperty) return;
    openDeleteConfirmModal(primarySelectedProperty);
  };

  const handleDuplicate = async () => {
    if (!selectedId) return;
    setDuplicating(true);
    try {
      const result = await propertyService.duplicateProperty(selectedId);
      await fetchProperties();
      navigate(`/dashboard/property/${result.newPropertyId}/edit`);
    } catch {
      // keep UX consistent with previous row menu; errors surface via console / global patterns if added later
    } finally {
      setDuplicating(false);
    }
  };

  const disabled = !singleSelection || duplicating;

  return (
    <div className="flex flex-col gap-2 border-b border-gray-200 dark:border-gray-700 pb-3 mb-3">
      <div className="flex flex-wrap items-center gap-2">
        <Button
          size="sm"
          color="light"
          disabled={disabled}
          onClick={handleCalendar}
          className="flex items-center gap-2"
        >
          <CalendarIcon className="w-4 h-4 shrink-0" />
          <span>Ver calendario</span>
        </Button>
        <Button
          size="sm"
          color="light"
          disabled={disabled}
          onClick={handleView}
          className="flex items-center gap-2"
        >
          <EyeIcon className="w-4 h-4 shrink-0" />
          <span>Ver propiedad</span>
        </Button>
        <Button
          size="sm"
          color="light"
          disabled={disabled}
          onClick={handleEditProperty}
          className="flex items-center gap-2"
        >
          <Edit2Icon className="w-4 h-4 shrink-0" />
          <span>Editar propiedad</span>
        </Button>
        <Button
          size="sm"
          color="light"
          disabled={disabled}
          onClick={handleEditPublication}
          className="flex items-center gap-2"
        >
          <FileTextIcon className="w-4 h-4 shrink-0" />
          <span>Editar publicación</span>
        </Button>
        <Button
          size="sm"
          color="light"
          disabled={disabled}
          onClick={handleDelete}
          className="flex items-center gap-2 text-red-700 dark:text-red-400"
        >
          <TrashIcon className="w-4 h-4 shrink-0" />
          <span>Eliminar</span>
        </Button>
        <Button
          size="sm"
          color="light"
          disabled={disabled}
          onClick={() => void handleDuplicate()}
          className="flex items-center gap-2"
        >
          {duplicating ? (
            <Loader2Icon className="w-4 h-4 shrink-0 animate-spin" />
          ) : (
            <CopyIcon className="w-4 h-4 shrink-0" />
          )}
          <span>Duplicar</span>
        </Button>
      </div>
      {selectedPropertyIds.length > 1 && (
        <p className="text-xs text-amber-700 dark:text-amber-400">
          Seleccione una sola fila para usar estas acciones.
        </p>
      )}
    </div>
  );
};
