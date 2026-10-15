// src/components/admin/properties/PropertyManagementToolbar.tsx
import React, { useEffect, useState } from 'react';
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
  ExternalLinkIcon,
} from 'lucide-react';
import { AdminPropertyListItem } from '../../../services/PropertyAdminService';
import propertyService from '../../../services/PropertyService';
import {
  DUPLICATE_REAL_ESTATE_BLOCKED_MESSAGE,
  adminTypeSummaryBlocksRealEstateDuplication,
} from '../../../models/properties/creatablePropertyTypes';
import { PropertyPreviewChooser } from '../../dashboard/properties/PropertyPreviewChooser';
import {
  listPropertyPreviewTargets,
  noGuestPreviewTitle,
  openPropertyPreview,
  type PropertyPreviewTarget,
} from '../../../services/propertyPreview';

interface PropertyManagementToolbarHook {
  selectedPropertyIds: string[];
  primarySelectedProperty: AdminPropertyListItem | null;
  fetchPropertyDetail?: (propertyId: string) => Promise<void>;
  openDeleteConfirmModal: (property: AdminPropertyListItem) => void;
  fetchProperties: () => Promise<void>;
  setEditingListingPropertyId: (propertyId: string | null) => void;
}

interface PropertyManagementToolbarProps {
  hook: PropertyManagementToolbarHook;
  /** When true, edit property and edit publication stay disabled. */
  editBlocked?: boolean;
  /** Replaces admin detail modal for “Ver propiedad”. */
  onViewProperty?: (propertyId: string) => void;
}

export const PropertyManagementToolbar: React.FC<PropertyManagementToolbarProps> = ({
  hook,
  editBlocked = false,
  onViewProperty,
}) => {
  const navigate = useNavigate();
  const [duplicating, setDuplicating] = useState(false);
  const [duplicateBlockedMessage, setDuplicateBlockedMessage] = useState<string | null>(null);
  const [previewTargets, setPreviewTargets] = useState<PropertyPreviewTarget[]>([]);
  const [previewTargetsLoading, setPreviewTargetsLoading] = useState(false);
  const [previewChooserOpen, setPreviewChooserOpen] = useState(false);
  const [openingPreview, setOpeningPreview] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
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
  const blocksRealEstateDuplicate = adminTypeSummaryBlocksRealEstateDuplication(
    primarySelectedProperty?.propertyTypesSummary
  );

  const handleCalendar = () => {
    if (!selectedId) return;
    navigate(`/dashboard/property/${selectedId}/bookings`);
  };

  const handleView = () => {
    if (!selectedId) return;
    if (onViewProperty) {
      onViewProperty(selectedId);
      return;
    }
    if (fetchPropertyDetail) {
      void fetchPropertyDetail(selectedId);
    }
  };

  const handleEditProperty = () => {
    if (!selectedId || editBlocked) return;
    navigate(`/dashboard/property/${selectedId}/edit`);
  };

  const handleEditPublication = () => {
    if (!selectedId || editBlocked) return;
    setEditingListingPropertyId(selectedId);
  };

  const handleDelete = () => {
    if (!primarySelectedProperty) return;
    openDeleteConfirmModal(primarySelectedProperty);
  };

  const handleDuplicate = async () => {
    if (!selectedId) return;
    if (blocksRealEstateDuplicate) {
      setDuplicateBlockedMessage(DUPLICATE_REAL_ESTATE_BLOCKED_MESSAGE);
      return;
    }
    setDuplicateBlockedMessage(null);
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

  useEffect(() => {
    if (!selectedId) {
      setPreviewTargets([]);
      setPreviewTargetsLoading(false);
      setPreviewChooserOpen(false);
      return;
    }

    let cancelled = false;
    setPreviewTargetsLoading(true);
    setPreviewError(null);
    listPropertyPreviewTargets(selectedId)
      .then((targets) => {
        if (!cancelled) setPreviewTargets(targets);
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setPreviewTargets([]);
        setPreviewError(error instanceof Error ? error.message : 'No se pudo preparar la vista previa.');
      })
      .finally(() => {
        if (!cancelled) setPreviewTargetsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [selectedId]);

  const startPreview = async (targets: PropertyPreviewTarget[]) => {
    if (!selectedId || targets.length === 0 || openingPreview) return;
    setPreviewError(null);
    if (targets.length > 1) {
      setPreviewChooserOpen(true);
      return;
    }
    setOpeningPreview(true);
    try {
      await openPropertyPreview(selectedId, targets[0].listingType);
    } catch (error) {
      setPreviewError(error instanceof Error ? error.message : 'No se pudo abrir la vista previa.');
    } finally {
      setOpeningPreview(false);
    }
  };

  const choosePreviewSite = async (target: PropertyPreviewTarget) => {
    if (!selectedId) return;
    setOpeningPreview(true);
    setPreviewError(null);
    try {
      await openPropertyPreview(selectedId, target.listingType);
      setPreviewChooserOpen(false);
    } catch (error) {
      setPreviewError(error instanceof Error ? error.message : 'No se pudo abrir la vista previa.');
    } finally {
      setOpeningPreview(false);
    }
  };

  const disabled = !singleSelection || duplicating;
  const editDisabled = disabled || editBlocked;
  const previewDisabled =
    disabled || previewTargetsLoading || openingPreview || previewTargets.length === 0;
  const duplicateDisabled = disabled || blocksRealEstateDuplicate;

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
          disabled={previewDisabled}
          onClick={() => void startPreview(previewTargets)}
          className="flex items-center gap-2"
          title={
            singleSelection && !previewTargetsLoading && previewTargets.length === 0
              ? noGuestPreviewTitle()
              : 'Vista previa'
          }
        >
          {openingPreview ? (
            <Loader2Icon className="w-4 h-4 shrink-0 animate-spin" />
          ) : (
            <ExternalLinkIcon className="w-4 h-4 shrink-0" />
          )}
          <span>Vista previa</span>
        </Button>
        <Button
          size="sm"
          color="light"
          disabled={editDisabled}
          onClick={handleEditProperty}
          className="flex items-center gap-2"
          title={editBlocked ? 'Verifica tu contacto para editar' : undefined}
        >
          <Edit2Icon className="w-4 h-4 shrink-0" />
          <span>Editar propiedad</span>
        </Button>
        <Button
          size="sm"
          color="light"
          disabled={editDisabled}
          onClick={handleEditPublication}
          className="flex items-center gap-2"
          title={editBlocked ? 'Verifica tu contacto para editar' : undefined}
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
          disabled={duplicateDisabled}
          onClick={() => void handleDuplicate()}
          className="flex items-center gap-2"
          title={blocksRealEstateDuplicate ? DUPLICATE_REAL_ESTATE_BLOCKED_MESSAGE : undefined}
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
      {duplicateBlockedMessage && (
        <p className="text-xs text-amber-700 dark:text-amber-400">{duplicateBlockedMessage}</p>
      )}
      {previewError && (
        <p className="text-xs text-red-600 dark:text-red-400" role="alert">{previewError}</p>
      )}
      <PropertyPreviewChooser
        open={previewChooserOpen}
        targets={previewTargets}
        busy={openingPreview}
        onClose={() => {
          if (!openingPreview) setPreviewChooserOpen(false);
        }}
        onChoose={(target) => void choosePreviewSite(target)}
      />
    </div>
  );
};
