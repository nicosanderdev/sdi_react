import React, { useState, useMemo } from 'react';
import { format, parseISO, isSameDay } from 'date-fns';
import { es } from 'date-fns/locale';
import {
  Lock,
  Unlock,
  Plus,
  Trash2,
  Edit3,
  Calendar as CalendarIcon,
  AlertTriangle,
  CheckCircle
} from 'lucide-react';
import { Button, Card, Select, Modal, ModalHeader, ModalBody, ModalFooter, Badge } from 'flowbite-react';
import { AvailabilityBlock, BlockType, SourceType, BLOCK_TYPE_NAMES } from '../../../models/calendar/CalendarSync';
import { CalendarSyncService } from '../../../services/CalendarSyncService';

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
  onDateSelect,
  onAvailabilityChange
}) => {
  const [isBlockingMode, setIsBlockingMode] = useState(false);
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

  // Group blocks by date for quick lookup
  const blocksByDate = useMemo(() => {
    const grouped: { [key: string]: AvailabilityBlock[] } = {};
    availabilityBlocks.forEach(block => {
      const start = parseISO(block.StartDate);
      const end = parseISO(block.EndDate);

      let current = new Date(start);
      while (current <= end) {
        const dateKey = format(current, 'yyyy-MM-dd');
        if (!grouped[dateKey]) {
          grouped[dateKey] = [];
        }
        grouped[dateKey].push(block);
        current.setDate(current.getDate() + 1);
      }
    });
    return grouped;
  }, [availabilityBlocks]);

  // Handle date click in blocking mode
  const handleDateClick = (date: Date) => {
    const dateKey = format(date, 'yyyy-MM-dd');
    const existingBlocks = blocksByDate[dateKey] || [];

    if (existingBlocks.length > 0) {
      // If there are existing blocks, offer to unblock
      const block = existingBlocks[0]; // Take the first one
      setEditingBlock(block);
      setBlockFormData({
        startDate: block.StartDate,
        endDate: block.EndDate,
        blockType: block.BlockType,
        title: block.Title || '',
        description: block.Description || ''
      });
      setShowBlockModal(true);
    } else {
      // Create new block
      const dateStr = format(date, 'yyyy-MM-dd');
      setBlockFormData({
        startDate: dateStr,
        endDate: dateStr,
        blockType: BlockType.OwnerBlock,
        title: 'Bloqueado por propietario',
        description: ''
      });
      setEditingBlock(null);
      setShowBlockModal(true);
    }
  };

  // Save availability block
  const handleSaveBlock = async () => {
    setIsSaving(true);

    try {
      const blockData = {
        EstatePropertyId: propertyId,
        IsAvailable: false, // All blocks in this manager are unavailable
        StartDate: blockFormData.startDate,
        EndDate: blockFormData.endDate,
        BlockType: blockFormData.blockType,
        Source: SourceType.Internal,
        Title: blockFormData.title,
        Description: blockFormData.description
      };

      let result;
      if (editingBlock) {
        // Update existing block
        result = await CalendarSyncService.updateAvailabilityBlock(editingBlock.Id, blockData);
        if (result.succeeded && result.data) {
          const updatedBlocks = availabilityBlocks.map(b =>
            b.Id === editingBlock.Id ? result.data! : b
          );
          onAvailabilityChange(updatedBlocks);
        }
      } else {
        // Create new block
        result = await CalendarSyncService.createAvailabilityBlock(blockData);
        if (result.succeeded && result.data) {
          onAvailabilityChange([...availabilityBlocks, result.data]);
        }
      }

      if (result.succeeded) {
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

  // Delete availability block
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

  // Get block type color
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

  // Get unique blocks (avoid duplicates from date expansion)
  const uniqueBlocks = useMemo(() => {
    const seen = new Set<string>();
    return availabilityBlocks.filter(block => {
      const key = `${block.StartDate}-${block.EndDate}-${block.BlockType}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [availabilityBlocks]);

  // Handle form input changes
  const handleFormChange = (field: keyof BlockFormData, value: any) => {
    setBlockFormData(prev => ({ ...prev, [field]: value }));
  };

  return (
    <div className="space-y-4">
      {/* Mode Toggle */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Button
            size="sm"
            color={isBlockingMode ? "primary" : "alternative"}
            onClick={() => setIsBlockingMode(!isBlockingMode)}
          >
            {isBlockingMode ? (
              <>
                <Lock className="h-4 w-4 mr-2" />
                Modo Bloqueo Activado
              </>
            ) : (
              <>
                <Unlock className="h-4 w-4 mr-2" />
                Modo Bloqueo Desactivado
              </>
            )}
          </Button>
          {isBlockingMode && (
            <span className="text-sm text-gray-600">
              Haz clic en las fechas para bloquear/desbloquear disponibilidad
            </span>
          )}
        </div>

        <Button
          size="sm"
          color="success"
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

      {/* Instructions */}
      {isBlockingMode && (
        <Card className="bg-emerald-50 border-emerald-200 dark:bg-emerald-900/20 dark:border-emerald-700">
          <div className="flex items-start space-x-3">
            <AlertTriangle className="h-5 w-5 text-emerald-600 dark:text-emerald-400 mt-0.5" />
            <div>
              <h4 className="font-medium text-emerald-900 dark:text-emerald-100">Modo de Gestión de Disponibilidad</h4>
              <p className="text-sm text-emerald-700 dark:text-emerald-300 mt-1">
                • Haz clic en fechas disponibles para bloquearlas<br />
                • Haz clic en fechas bloqueadas para editarlas<br />
                • Los bloques se aplicarán a todas las fechas del rango seleccionado
              </p>
            </div>
          </div>
        </Card>
      )}

      {/* Current Blocks List */}
      {uniqueBlocks.length > 0 && (
        <Card>
          <h4 className="font-medium mb-3">Bloqueos Actuales</h4>
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {uniqueBlocks.map((block) => (
              <div key={block.Id} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded">
                <div className="flex-1">
                  <div className="flex items-center space-x-2">
                    <Badge className={getBlockTypeColor(block.BlockType)}>
                      {BLOCK_TYPE_NAMES[block.BlockType]}
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
                    <div className="text-sm text-gray-500 dark:text-gray-500 mt-1">{block.Description}</div>
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

      {/* Block Modal */}
      <Modal show={showBlockModal} onClose={() => setShowBlockModal(false)}>
        <ModalHeader>
          {editingBlock ? 'Editar Bloqueo' : 'Nuevo Bloqueo de Disponibilidad'}
        </ModalHeader>
        <ModalBody>
          <div className="space-y-4">
            {/* Date Range */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Fecha Inicio
                </label>
                <input
                  type="date"
                  value={blockFormData.startDate}
                  onChange={(e) => handleFormChange('startDate', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Fecha Fin
                </label>
                <input
                  type="date"
                  value={blockFormData.endDate}
                  onChange={(e) => handleFormChange('endDate', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            {/* Block Type */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Tipo de Bloqueo
              </label>
              <Select
                value={blockFormData.blockType.toString()}
                onChange={(e) => handleFormChange('blockType', parseInt(e.target.value) as BlockType)}
              >
                {Object.entries(BLOCK_TYPE_NAMES)
                  .filter(([key]) => parseInt(key) !== BlockType.Availability && parseInt(key) !== BlockType.Booking)
                  .map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </Select>
            </div>

            {/* Title */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Título
              </label>
              <input
                type="text"
                value={blockFormData.title}
                onChange={(e) => handleFormChange('title', e.target.value)}
                placeholder="Ej: Mantenimiento, Limpieza..."
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Description */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Descripción (Opcional)
              </label>
              <textarea
                value={blockFormData.description}
                onChange={(e) => handleFormChange('description', e.target.value)}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        </ModalBody>
        <ModalFooter>
          <div className="flex justify-between w-full">
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
            <div className="flex space-x-2">
              <Button
                color="alternative"
                onClick={() => setShowBlockModal(false)}
                disabled={isSaving}
              >
                Cancelar
              </Button>
              <Button
                color="primary"
                onClick={handleSaveBlock}
                disabled={isSaving}
              >
                {isSaving ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Guardando...
                  </>
                ) : (
                  <>
                    <CheckCircle className="h-4 w-4 mr-2" />
                    {editingBlock ? 'Actualizar' : 'Crear'} Bloqueo
                  </>
                )}
              </Button>
            </div>
          </div>
        </ModalFooter>
      </Modal>

      {/* Calendar Overlay for Blocking Mode */}
      {isBlockingMode && (
        <div className="relative">
          <div className="absolute inset-0 bg-blue-500 bg-opacity-10 rounded-lg pointer-events-none"></div>
          <div className="absolute top-2 left-2 text-blue-700 text-sm font-medium">
            Modo Bloqueo Activo
          </div>
        </div>
      )}
    </div>
  );
};

export default AvailabilityManager;