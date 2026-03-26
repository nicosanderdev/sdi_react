import React, { useState, useEffect } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';
import {
  CheckCircle,
  Loader2,
  AlertCircle,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  Calendar,
  Smartphone
} from 'lucide-react';
import { Button, Card, Badge } from 'flowbite-react';
import { SyncOrchestratorService } from '../../../services/CalendarSyncService';
import { SyncStatusResponse, SyncStatus, PlatformType } from '../../../models/calendar/CalendarSync';

const NOMBRE_PLATAFORMA: Record<PlatformType, string> = {
  [PlatformType.GoogleCalendar]: 'Google Calendar (ICS)',
  [PlatformType.AppleCalendar]: 'Apple Calendar (ICS)',
  [PlatformType.AirbnbICal]: 'Airbnb iCal',
  [PlatformType.BookingComICal]: 'Booking.com iCal',
  [PlatformType.OtherICal]: 'Otro iCal'
};

interface SyncStatusBarProps {
  propertyId: string;
  onSync?: () => void;
  isSyncing?: boolean;
}

interface SyncJobDisplay {
  id: string;
  jobType: number;
  status: number;
  startedAt?: string;
  completedAt?: string;
  eventsProcessed?: number;
  error?: string;
}

const SyncStatusBar: React.FC<SyncStatusBarProps> = ({
  propertyId,
  onSync,
  isSyncing: externalIsSyncing = false
}) => {
  const [syncStatus, setSyncStatus] = useState<SyncStatusResponse | null>(null);
  const [syncJobs, setSyncJobs] = useState<SyncJobDisplay[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isExpanded, setIsExpanded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [internalIsSyncing, setInternalIsSyncing] = useState(false);

  const isSyncing = externalIsSyncing || internalIsSyncing;

  // Load sync status
  const loadSyncStatus = async () => {
    try {
      const result = await SyncOrchestratorService.getSyncStatus(propertyId);
      if (result.succeeded && result.data) {
        setSyncStatus(result.data);
        setError(null);
      } else {
        setError(result.errorMessage || 'No se pudo cargar el estado de sincronización');
      }
    } catch (err: any) {
      setError(err.message || 'No se pudo cargar el estado de sincronización');
    } finally {
      setIsLoading(false);
    }
  };

  // Load recent sync jobs
  const loadSyncJobs = async () => {
    if (!isExpanded) return;

    try {
      const result = await SyncOrchestratorService.getSyncJobs(propertyId, 10);
      if (result.succeeded && result.data) {
        setSyncJobs(result.data);
      }
    } catch (err: any) {
      console.error('Failed to load sync jobs:', err);
    }
  };

  // Initial load
  useEffect(() => {
    loadSyncStatus();
  }, [propertyId]);

  // Load sync jobs when expanded
  useEffect(() => {
    if (isExpanded) {
      loadSyncJobs();
    }
  }, [isExpanded]);

  // Poll sync status during active sync
  useEffect(() => {
    let interval: NodeJS.Timeout;

    if (isSyncing) {
      interval = setInterval(() => {
        loadSyncStatus();
      }, 3000); // Poll every 3 seconds during sync
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isSyncing]);

  // Handle manual sync
  const handleSync = async () => {
    setInternalIsSyncing(true);
    setError(null);

    try {
      if (onSync) {
        await onSync();
      } else {
        const result = await SyncOrchestratorService.triggerBulkSync(propertyId);
        if (result.succeeded) {
          await loadSyncStatus(); // Refresh status immediately
        } else {
          setError(result.errorMessage || 'Error de sincronización');
        }
      }
    } catch (err: any) {
      setError(err.message || 'Error de sincronización');
    } finally {
      setInternalIsSyncing(false);
    }
  };

  // Get status icon and color
  const getStatusDisplay = () => {
    if (isLoading) {
      return { icon: Loader2, color: 'text-gray-500', bgColor: 'bg-gray-100', text: 'Cargando...' };
    }

    if (error) {
      return { icon: AlertCircle, color: 'text-red-600', bgColor: 'bg-red-100', text: 'Error' };
    }

    if (isSyncing) {
      return { icon: Loader2, color: 'text-blue-600', bgColor: 'bg-blue-100', text: 'Sincronizando...' };
    }

    const hasActiveIntegrations = syncStatus?.status?.some(s => s.isActive) || false;

    if (hasActiveIntegrations) {
      return { icon: CheckCircle, color: 'text-green-600', bgColor: 'bg-green-100', text: 'Sincronizado' };
    }

    return { icon: AlertCircle, color: 'text-gray-500', bgColor: 'bg-gray-100', text: 'No configurado' };
  };

  // Get platform icon
  const getPlatformIcon = (platformType: PlatformType) => {
    switch (platformType) {
      case PlatformType.GoogleCalendar:
        return <Calendar className="h-4 w-4" />;
      case PlatformType.AppleCalendar:
        return <Smartphone className="h-4 w-4" />;
      default:
        return <Calendar className="h-4 w-4" />;
    }
  };

  // Format relative time
  const formatLastSync = (dateString?: string) => {
    if (!dateString) return 'Nunca';
    try {
      return formatDistanceToNow(new Date(dateString), { addSuffix: true, locale: es });
    } catch {
      return 'Desconocido';
    }
  };

  const statusDisplay = getStatusDisplay();
  const StatusIcon = statusDisplay.icon;
  const activeIntegrations = syncStatus?.status?.filter(s => s.isActive) || [];
  const totalIntegrations = syncStatus?.status?.length || 0;

  return (
    <Card className="border-l-4 border-l-blue-500">
      <div className="space-y-4">
        {/* Main Status Bar */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            {/* Status Indicator */}
            <div className={`p-2 rounded-full ${statusDisplay.bgColor}`}>
              <StatusIcon className={`h-5 w-5 ${statusDisplay.color} ${isSyncing ? 'animate-spin' : ''}`} />
            </div>

            {/* Status Text */}
            <div>
              <h3 className="font-medium text-gray-900">Sincronización de Calendarios</h3>
              <p className="text-sm text-gray-600">
                {statusDisplay.text}
                {syncStatus?.status?.some(s => s.lastSyncAt) && (
                  <span className="ml-2">
                    • Última: {formatLastSync(syncStatus.status.find(s => s.lastSyncAt)?.lastSyncAt)}
                  </span>
                )}
              </p>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center space-x-2">
            <Button
              size="sm"
              color="alternative"
              onClick={() => setIsExpanded(!isExpanded)}
            >
              {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              Historial
            </Button>
            <Button
              size="sm"
              color="primary"
              onClick={handleSync}
              disabled={isSyncing}
            >
              {isSyncing ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4 mr-2" />
              )}
              Sincronizar Ahora
            </Button>
          </div>
        </div>

        {/* Connected Platforms */}
        {activeIntegrations.length > 0 && (
          <div className="flex items-center space-x-2">
            <span className="text-sm text-gray-600">Conectado a:</span>
            <div className="flex space-x-2">
              {activeIntegrations.map((integration) => (
                <Badge key={integration.integrationId} color="success" className="flex items-center space-x-1">
                  {getPlatformIcon(integration.platformType)}
                  <span>{NOMBRE_PLATAFORMA[integration.platformType]}</span>
                </Badge>
              ))}
            </div>
            {totalIntegrations > activeIntegrations.length && (
              <Badge color="gray">
                +{totalIntegrations - activeIntegrations.length} inactivos
              </Badge>
            )}
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-3 py-2 rounded text-sm">
            {error}
          </div>
        )}

        {/* Expandable Sync History */}
        {isExpanded && (
          <div className="border-t pt-4">
            <h4 className="font-medium mb-3">Historial de Sincronización</h4>
            {syncJobs.length === 0 ? (
              <p className="text-gray-500 text-sm">No hay historial de sincronización disponible.</p>
            ) : (
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {syncJobs.map((job) => (
                  <div key={job.id} className="flex items-center justify-between p-2 bg-gray-50 rounded text-sm">
                    <div className="flex items-center space-x-2">
                      <div className={`w-2 h-2 rounded-full ${
                        job.status === 2 ? 'bg-green-500' :
                        job.status === 3 ? 'bg-red-500' :
                        job.status === 1 ? 'bg-blue-500' : 'bg-gray-500'
                      }`} />
                      <span>
                        {job.jobType === 0 ? 'Manual' :
                         job.jobType === 1 ? 'Programada' : 'Webhook'}
                      </span>
                      {job.eventsProcessed !== undefined && (
                        <span className="text-gray-600">
                          ({job.eventsProcessed} eventos)
                        </span>
                      )}
                    </div>
                    <div className="text-right text-xs text-gray-600">
                      {job.startedAt && formatDistanceToNow(new Date(job.startedAt), { addSuffix: true, locale: es })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </Card>
  );
};

export default SyncStatusBar;