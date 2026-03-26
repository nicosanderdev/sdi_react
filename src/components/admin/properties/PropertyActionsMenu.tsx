// src/components/admin/properties/PropertyActionsMenu.tsx
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Dropdown, DropdownItem } from 'flowbite-react';
import { MoreHorizontalIcon, Loader2Icon, Edit2Icon, TrashIcon, CopyIcon } from 'lucide-react';
import { AdminPropertyListItem } from '../../../services/PropertyAdminService';
import { UseAdminPropertiesReturn } from '../../../hooks/useAdminProperties';
import propertyService from '../../../services/PropertyService';

interface PropertyActionsMenuProps {
  property: AdminPropertyListItem;
  hook: UseAdminPropertiesReturn;
}

export const PropertyActionsMenu: React.FC<PropertyActionsMenuProps> = ({ property, hook }) => {
  const navigate = useNavigate();
  const [duplicating, setDuplicating] = useState(false);

  const { openDeleteConfirmModal, fetchProperties } = hook;

  const handleEdit = () => {
    navigate(`/dashboard/property/${property.id}/edit`);
  };

  const handleDelete = () => {
    openDeleteConfirmModal(property);
  };

  const handleDuplicate = async () => {
    setDuplicating(true);
    try {
      const result = await propertyService.duplicateProperty(property.id);
      await fetchProperties();
      navigate(`/dashboard/property/${result.newPropertyId}/edit`);
    } catch {
      // Error could be shown via toast if available; hook.actionError could be used from parent
      setDuplicating(false);
    } finally {
      setDuplicating(false);
    }
  };

  const loading = duplicating;

  return (
    <Dropdown
      label=""
      renderTrigger={() => (
        <Button size="sm" color="light" className="p-2" disabled={loading}>
          {loading ? (
            <Loader2Icon className="w-4 h-4 animate-spin" />
          ) : (
            <MoreHorizontalIcon className="w-4 h-4" />
          )}
        </Button>
      )}
    >
      <DropdownItem onClick={handleEdit}>
        <div className="flex items-center space-x-2">
          <Edit2Icon className="w-4 h-4" />
          <span>Editar propiedad</span>
        </div>
      </DropdownItem>

      <DropdownItem onClick={handleDelete} className="text-red-600 hover:text-red-700">
        <div className="flex items-center space-x-2">
          <TrashIcon className="w-4 h-4" />
          <span>Eliminar propiedad</span>
        </div>
      </DropdownItem>

      <DropdownItem onClick={handleDuplicate} disabled={duplicating}>
        <div className="flex items-center space-x-2">
          {duplicating ? (
            <Loader2Icon className="w-4 h-4 animate-spin" />
          ) : (
            <CopyIcon className="w-4 h-4" />
          )}
          <span>Duplicar propiedad</span>
        </div>
      </DropdownItem>
    </Dropdown>
  );
};
