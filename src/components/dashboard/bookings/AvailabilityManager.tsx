import React, { useState, useMemo } from 'react';
import { format, parseISO } from 'date-fns';
import {
  Plus,
  Trash2,
  Edit3,
  CheckCircle
} from 'lucide-react';
import { Button, Card, Modal, ModalHeader, ModalBody, ModalFooter, Badge } from 'flowbite-react';
import { AvailabilityBlock, BlockType, SourceType } from '../../../models/calendar/CalendarSync';
import type { SdiApiResponse } from '../../../models/SdiApiResponse';
import { CalendarSyncService } from '../../../services/CalendarSyncService';

const TIPO_BLOQUEO_ES: Record<BlockType, string> = {
  [BlockType.Availability]: 'Disponibilidad',
  [BlockType.Booking]: 'Reserva',
  [BlockType.OwnerBlock]: 'Bloqueo del propietario',
  [BlockType.ExternalBlock]: 'Calendario externo'
};

const inputClass =
  'w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-cyan-500 focus:outline-none focus:ring-2 focus:ring-cyan-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white dark:placeholder:text-gray-400 dark:focus:border-cyan-500 dark:focus:ring-cyan-500';

const blockModalTheme = {
  content: {
    base: 'relative h-full w-full p-4 md:h-auto',
    inner:
      'relative flex max-h-[90dvh] flex-col rounded-lg border border-gray-200 bg-white shadow dark:border-gray-600 dark:bg-gray-800'
  },
  footer: {
    base: 'flex items-center space-x-2 rounded-b border-t border-gray-200 bg-gray-50 p-6 dark:border-gray-600 dark:bg-gray-900/40',
    popup: 'border-t'
  },
  body: {
    base: 'flex-1 overflow-auto p-6 dark:bg-gray-800',
    popup: 'pt-0'
  },
  header: {
    base: 'flex items-start justify-between rounded-t border-b border-gray-200 p-5 dark:border-gray-600 dark:bg-gray-800',
    popup: 'border-b-0 p-2',
    title: 'text-xl font-medium text-gray-900 dark:text-white',
    close: {
      base: 'ml-auto inline-flex items-center rounded-lg bg-transparent p-1.5 text-sm text-gray-400 hover:bg-gray-200 hover:text-gray-900 dark:hover:bg-gray-600 dark:hover:text-white',
      icon: 'h-5 w-5'
    }
  }
};

interface AvailabilityManagerProps {
  propertyId: string;
  availabilityBlocks: AvailabilityBlock[];
  selectedDate: Date | null;
  onDateSelect: (date: Date) => void;
  onAvailabilityChange: (blocks: AvailabilityBlock[]) => void;
}

interface BlockFormData {
  startDate: string;
  endDate: string;
  blockType: BlockType;
  title?: string;
  description?: string;
}

const AvailabilityManager: React.FC<AvailabilityManagerProps> = ({
  propertyId,
  availabilityBlocks,
  selectedDate,
  onDateSelect: _onDateSelect,
  onAvailabilityChange
}) => {
  const [showBlockModal, setShowBlockModal] = useState(false);
  const [editingBlock, setEditingBlock] = useState<AvailabilityBlock | null>(null);
  const [blockFormData, setBlockFormData] = useState<BlockFormData>({
    startDate: '',
    endDate: '',
    blockType: BlockType.OwnerBlock,
    title: '',
    description: ''
  });
  const [isSaving, setIsSaving] = useState(false);

  // Save availability block
  const handleSaveBlock = async () => {
    setIsSaving(true);

    try {
      const blockData = {
        EstatePropertyId: propertyId,
        IsAvailable: false,
        StartDate: blockFormData.startDate,
        EndDate: blockFormData.endDate,
        BlockType: blockFormData.blockType,
        Source: SourceType.Internal,
        Title: blockFormData.title,
        Description: blockFormData.description,
        IsReadOnly: false,
        ConflictFlagged: false
      };

      let result: SdiApiResponse<AvailabilityBlock> | undefined;
      if (editingBlock) {
        result = await CalendarSyncService.updateAvailabilityBlock(editingBlock.Id, blockData);
        if (result?.succeeded && result.data) {
          const row = result.data;
          const updatedBlocks = availabilityBlocks.map(b =>
            b.Id === editingBlock.Id ? row : b
          );
          onAvailabilityChange(updatedBlocks);
        }
      } else {
        result = await CalendarSyncService.createAvailabilityBlock(blockData);
        if (result?.succeeded && result.data) {
          onAvailabilityChange([...availabilityBlocks, result.data]);
        }
      }

      if (result?.succeeded) {
        setShowBlockModal(false);
        setEditingBlock(null);
      } else {
        console.error('Failed to save block:', result.errorMessage);
      }
    } catch (error: any) {
      console.error('Error saving block:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteBlock = async () => {
    if (!editingBlock) return;

    try {
      const result = await CalendarSyncService.deleteAvailabilityBlock(editingBlock.Id);
      if (result.succeeded) {
        const updatedBlocks = availabilityBlocks.filter(b => b.Id !== editingBlock.Id);
        onAvailabilityChange(updatedBlocks);
        setShowBlockModal(false);
        setEditingBlock(null);
      } else {
        console.error('Failed to delete block:', result.errorMessage);
      }
    } catch (error: any) {
      console.error('Error deleting block:', error);
    }
  };

  const getBlockTypeColor = (blockType: BlockType) => {
    switch (blockType) {
      case BlockType.OwnerBlock:
        return 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300';
      case BlockType.Booking:
        return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300';
      case BlockType.ExternalBlock:
        return 'bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-300';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300';
    }
  };

  const uniqueBlocks = useMemo(() => {
    const seen = new Set<string>();
    return availabilityBlocks.filter(block => {
      const key = `${block.StartDate}-${block.EndDate}-${block.BlockType}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [availabilityBlocks]);

  const handleFormChange = (field: keyof BlockFormData, value: any) => {
    setBlockFormData(prev => ({ ...prev, [field]: value }));
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-gray-600 dark:text-gray-400">
          {uniqueBlocks.length === 0 ? 'No hay bloqueos creados' : `${uniqueBlocks.length} bloqueo(s)`}
        </p>
        <Button
          size="sm"
          color="alternative"
          onClick={() => {
            setBlockFormData({
              startDate: format(selectedDate || new Date(), 'yyyy-MM-dd'),
              endDate: format(selectedDate || new Date(), 'yyyy-MM-dd'),
              blockType: BlockType.OwnerBlock,
              title: '',
              description: ''
            });
            setEditingBlock(null);
            setShowBlockModal(true);
          }}
        >
          <Plus className="h-4 w-4 mr-2" />
          Nuevo Bloqueo
        </Button>
      </div>

      {uniqueBlocks.length > 0 && (
        <Card>
          <h4 className="font-medium mb-3 text-gray-900 dark:text-white">Bloqueos Actuales</h4>
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {uniqueBlocks.map((block) => (
              <div key={block.Id} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded">
                <div className="flex-1">
                  <div className="flex items-center space-x-2">
                    <Badge className={getBlockTypeColor(block.BlockType)}>
                      {TIPO_BLOQUEO_ES[block.BlockType]}
                    </Badge>
                    <span className="font-medium text-gray-900 dark:text-gray-100">{block.Title || 'Sin título'}</span>
                  </div>
                  <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                    {format(parseISO(block.StartDate), 'dd/MM/yyyy')}
                    {block.StartDate !== block.EndDate &&
                      ` - ${format(parseISO(block.EndDate), 'dd/MM/yyyy')}`
                    }
                  </div>
                  {block.Description && (
                    <div className="text-sm text-gray-500 dark:text-gray-400 mt-1">{block.Description}</div>
                  )}
                </div>
                <div className="flex space-x-2">
                  <Button
                    size="sm"
                    color="alternative"
                    onClick={() => {
                      setEditingBlock(block);
                      setBlockFormData({
                        startDate: block.StartDate,
                        endDate: block.EndDate,
                        blockType: block.BlockType,
                        title: block.Title || '',
                        description: block.Description || ''
                      });
                      setShowBlockModal(true);
                    }}
                  >
                    <Edit3 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      <Modal show={showBlockModal} onClose={() => setShowBlockModal(false)} theme={blockModalTheme} dismissible>
        <ModalHeader>
          {editingBlock ? 'Editar Bloqueo' : 'Nuevo Bloqueo de Disponibilidad'}
        </ModalHeader>
        <ModalBody>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Fecha Inicio
                </label>
                <input
                  type="date"
                  value={blockFormData.startDate}
                  onChange={(e) => handleFormChange('startDate', e.target.value)}
                  className={inputClass}
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Fecha Fin
                </label>
                <input
                  type="date"
                  value={blockFormData.endDate}
                  onChange={(e) => handleFormChange('endDate', e.target.value)}
                  className={inputClass}
                />
              </div>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                Tipo de Bloqueo
              </label>
              <select
                value={blockFormData.blockType.toString()}
                onChange={(e) => handleFormChange('blockType', parseInt(e.target.value, 10) as BlockType)}
                className={inputClass}
              >
                {Object.entries(TIPO_BLOQUEO_ES)
                  .filter(([key]) => parseInt(key, 10) !== BlockType.Availability && parseInt(key, 10) !== BlockType.Booking)
                  .map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                Título
              </label>
              <input
                type="text"
                value={blockFormData.title}
                onChange={(e) => handleFormChange('title', e.target.value)}
                placeholder="Ej: Mantenimiento, Limpieza..."
                className={inputClass}
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                Descripción (Opcional)
              </label>
              <textarea
                value={blockFormData.description}
                onChange={(e) => handleFormChange('description', e.target.value)}
                rows={3}
                className={inputClass}
              />
            </div>
          </div>
        </ModalBody>
        <ModalFooter>
          <div className="flex w-full flex-wrap justify-between gap-2">
            <div>
              {editingBlock && (
                <Button
                  color="red"
                  onClick={handleDeleteBlock}
                  disabled={isSaving}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Eliminar
                </Button>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                color="gray"
                onClick={() => setShowBlockModal(false)}
                disabled={isSaving}
                className="border border-gray-300 bg-white text-gray-800 hover:bg-gray-100 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 dark:hover:bg-gray-600"
              >
                Cancelar
              </Button>
              <Button color="green" onClick={handleSaveBlock} disabled={isSaving}>
                {isSaving ? (
                  <>
                    <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-white border-b-transparent" />
                    Guardando...
                  </>
                ) : (
                  <>
                    <CheckCircle className="mr-2 h-4 w-4" />
                    {editingBlock ? 'Actualizar' : 'Crear'} Bloqueo
                  </>
                )}
              </Button>
            </div>
          </div>
        </ModalFooter>
      </Modal>
    </div>
  );
};

export default AvailabilityManager;
