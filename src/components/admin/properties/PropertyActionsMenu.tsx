// src/components/admin/properties/PropertyActionsMenu.tsx
import React, { useState } from 'react';
import { Button, Dropdown, DropdownItem, DropdownDivider } from 'flowbite-react';
import { MoreHorizontalIcon, Loader2Icon, EyeOffIcon, AlertTriangleIcon, TrashIcon } from 'lucide-react';
import { AdminPropertyListItem } from '../../../services/PropertyAdminService';
import { UseAdminPropertiesReturn } from '../../../hooks/useAdminProperties';

interface PropertyActionsMenuProps {
  property: AdminPropertyListItem;
  hook: UseAdminPropertiesReturn;
}

export const PropertyActionsMenu: React.FC<PropertyActionsMenuProps> = ({ property, hook }) => {
  const [loading, setLoading] = useState(false);

  const {
    hideProperty,
    markPropertyInvalid,
    openDeleteConfirmModal,
  } = hook;

  const handleAction = async (action: () => Promise<void>) => {
    setLoading(true);
    try {
      await action();
    } finally {
      setLoading(false);
    }
  };

  const handleHide = () => handleAction(() => hideProperty(property.id, 'Hidden by admin'));
  const handleMarkInvalid = () => handleAction(() => markPropertyInvalid(property.id, 'Marked as invalid by admin'));
  const handleMarkSpam = () => handleAction(() => markPropertyInvalid(property.id, 'Marked as spam by admin', true));
  const handleDelete = () => openDeleteConfirmModal(property);

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
      {/* Visibility Actions */}
      {!property.isPropertyVisible ? (
        <DropdownItem onClick={handleHide} disabled>
          <div className="flex items-center space-x-2">
            <EyeOffIcon className="w-4 h-4" />
            <span>Already Hidden</span>
          </div>
        </DropdownItem>
      ) : (
        <DropdownItem onClick={handleHide}>
          <div className="flex items-center space-x-2">
            <EyeOffIcon className="w-4 h-4" />
            <span>Hide Property</span>
          </div>
        </DropdownItem>
      )}

      {/* Moderation Actions */}
      <DropdownDivider />
      <DropdownItem onClick={handleMarkInvalid}>
        <div className="flex items-center space-x-2">
          <AlertTriangleIcon className="w-4 h-4" />
          <span>Mark as Invalid</span>
        </div>
      </DropdownItem>

      <DropdownItem onClick={handleMarkSpam}>
        <div className="flex items-center space-x-2">
          <AlertTriangleIcon className="w-4 h-4" />
          <span>Mark as Spam</span>
        </div>
      </DropdownItem>

      {/* Delete Property */}
      <DropdownDivider />
      <DropdownItem onClick={handleDelete} className="text-red-600 hover:text-red-700">
        <div className="flex items-center space-x-2">
          <TrashIcon className="w-4 h-4" />
          <span>Delete Property</span>
        </div>
      </DropdownItem>
    </Dropdown>
  );
};
