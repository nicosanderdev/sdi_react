import React, { useState, useEffect, useCallback } from 'react';
import {
  Plus,
  RefreshCw,
  Edit,
  Trash2,
  AlertCircle,
  CheckCircle,
  Clock,
  ExternalLink,
  Copy,
  Play,
  RotateCcw
} from 'lucide-react';
import {
  Card,
  Button,
  Modal,
  Label,
  TextInput,
  Select,
  Badge,
  Alert,
  Spinner,
  Tooltip
} from 'flowbite-react';
import { CalendarSyncService } from '../../../services/CalendarSyncService';
import {
  CalendarIntegration,
  PlatformType,
  SyncStatus,
  PLATFORM_NAMES,
  PLATFORM_ICONS,
  SYNC_STATUS_NAMES
} from '../../../models/calendar/CalendarSync';

interface ICalIntegrationManagerProps {
  propertyId: string;
  onSyncCompleted?: () => void;
}

interface IntegrationFormData {
  platformType: PlatformType;
  calendarName: string;
  iCalUrl: string;
}

interface SyncCooldownState {
  [integrationId: string]: {
    canSync: boolean;
    cooldownEnd: number;
    timer: NodeJS.Timeout | null;
  };
}

const ICalIntegrationManager: React.FC<ICalIntegrationManagerProps> = ({
  propertyId,
  onSyncCompleted
}) => {
  const [integrations, setIntegrations] = useState<CalendarIntegration[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingIntegration, setEditingIntegration] = useState<CalendarIntegration | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [syncingIntegrations, setSyncingIntegrations] = useState<Set<string>>(new Set());
  const [syncCooldowns, setSyncCooldowns] = useState<SyncCooldownState>({});
  const [deleteConfirmIntegration, setDeleteConfirmIntegration] = useState<CalendarIntegration | null>(null);

  const [formData, setFormData] = useState<IntegrationFormData>({
    platformType: PlatformType.AirbnbICal,
    calendarName: '',
    iCalUrl: ''
  });

  const [formErrors, setFormErrors] = useState<Partial<IntegrationFormData>>({});

  // Load integrations
  const loadIntegrations = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await CalendarSyncService.getCalendarIntegrations(propertyId);
      if (response.succeeded) {
        // Filter to only iCal integrations (PlatformType 2, 3, 4)
        const iCalIntegrations = response.data.filter(integration =>
          integration.PlatformType >= 2 && integration.PlatformType <= 4
        );
        setIntegrations(iCalIntegrations);
      } else {
        setError(response.errorMessage || 'Failed to load integrations');
      }
    } catch (error: any) {
      setError(error.message || 'Failed to load integrations');
    } finally {
      setIsLoading(false);
    }
  }, [propertyId]);

  useEffect(() => {
    loadIntegrations();
  }, [loadIntegrations]);

  // Validate form
  const validateForm = (): boolean => {
    const errors: Partial<IntegrationFormData> = {};

    if (!formData.calendarName.trim()) {
      errors.calendarName = 'Calendar name is required';
    }

    if (!formData.iCalUrl.trim()) {
      errors.iCalUrl = 'iCal URL is required';
    } else if (!formData.iCalUrl.startsWith('https://')) {
      errors.iCalUrl = 'iCal URL must start with https://';
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Reset form
  const resetForm = () => {
    setFormData({
      platformType: PlatformType.AirbnbICal,
      calendarName: '',
      iCalUrl: ''
    });
    setFormErrors({});
    setEditingIntegration(null);
  };

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const integrationData = {
        EstatePropertyId: propertyId,
        PlatformType: formData.platformType,
        ExternalCalendarId: `ical_${Date.now()}`, // Generate unique ID for iCal
        ExternalCalendarName: formData.calendarName,
        ICalUrl: formData.iCalUrl,
        IsActive: true,
        SyncStatus: SyncStatus.Idle,
        SyncDirection: 'inbound' as const,
        AccessToken: null,
        RefreshToken: null,
        TokenExpiresAt: null,
        WebhookChannelId: null,
        WebhookResourceId: null
      };

      let response;
      if (editingIntegration) {
        response = await CalendarSyncService.updateCalendarIntegration(editingIntegration.Id, {
          ExternalCalendarName: formData.calendarName,
          ICalUrl: formData.iCalUrl,
          PlatformType: formData.platformType
        });
      } else {
        response = await CalendarSyncService.createCalendarIntegration(integrationData);
      }

      if (response.succeeded) {
        // Trigger initial sync
        if (!editingIntegration) {
          await triggerSync(response.data.Id);
        }

        setShowAddModal(false);
        resetForm();
        await loadIntegrations();
        onSyncCompleted?.();
      } else {
        setError(response.errorMessage || 'Failed to save integration');
      }
    } catch (error: any) {
      setError(error.message || 'Failed to save integration');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle edit
  const handleEdit = (integration: CalendarIntegration) => {
    setFormData({
      platformType: integration.PlatformType,
      calendarName: integration.ExternalCalendarName || '',
      iCalUrl: integration.ICalUrl || ''
    });
    setEditingIntegration(integration);
    setShowAddModal(true);
  };

  // Handle delete
  const handleDelete = async (integration: CalendarIntegration) => {
    try {
      // Delete associated availability blocks first
      const blocksResponse = await CalendarSyncService.getAvailabilityBlocks(propertyId);
      if (blocksResponse.succeeded) {
        const blocksToDelete = blocksResponse.data.filter(
          block => block.ExternalEventId && block.Source === 'ical'
        );

        // Delete blocks in parallel
        await Promise.all(
          blocksToDelete.map(block =>
            CalendarSyncService.deleteAvailabilityBlock(block.Id)
          )
        );
      }

      // Delete the integration
      const response = await CalendarSyncService.deleteCalendarIntegration(integration.Id);
      if (response.succeeded) {
        await loadIntegrations();
        onSyncCompleted?.();
        setDeleteConfirmIntegration(null);
      } else {
        setError(response.errorMessage || 'Failed to delete integration');
      }
    } catch (error: any) {
      setError(error.message || 'Failed to delete integration');
    }
  };

  // Handle manual sync
  const triggerSync = async (integrationId: string) => {
    const cooldown = syncCooldowns[integrationId];
    if (cooldown && !cooldown.canSync) {
      return;
    }

    setSyncingIntegrations(prev => new Set(prev).add(integrationId));

    try {
      // Call the sync orchestrator
      const response = await fetch('/functions/v1/ical-import', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          integrationId: integrationId,
          forceRefresh: false
        })
      });

      if (!response.ok) {
        throw new Error('Sync failed');
      }

      // Start cooldown (5 minutes)
      const cooldownEnd = Date.now() + 5 * 60 * 1000;
      const timer = setTimeout(() => {
        setSyncCooldowns(prev => ({
          ...prev,
          [integrationId]: {
            ...prev[integrationId],
            canSync: true,
            timer: null
          }
        }));
      }, 5 * 60 * 1000);

      setSyncCooldowns(prev => ({
        ...prev,
        [integrationId]: {
          canSync: false,
          cooldownEnd,
          timer
        }
      }));

      await loadIntegrations();
      onSyncCompleted?.();
    } catch (error: any) {
      setError(error.message || 'Sync failed');
    } finally {
      setSyncingIntegrations(prev => {
        const newSet = new Set(prev);
        newSet.delete(integrationId);
        return newSet;
      });
    }
  };

  // Get status badge color
  const getStatusBadgeColor = (status: SyncStatus) => {
    switch (status) {
      case SyncStatus.Idle:
        return 'success';
      case SyncStatus.Syncing:
        return 'warning';
      case SyncStatus.Error:
        return 'failure';
      default:
        return 'gray';
    }
  };

  // Format last sync time
  const formatLastSync = (lastSyncAt?: string) => {
    if (!lastSyncAt) return 'Never';

    const date = new Date(lastSyncAt);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMinutes = Math.floor(diffMs / (1000 * 60));

    if (diffMinutes < 1) return 'Just now';
    if (diffMinutes < 60) return `${diffMinutes}m ago`;

    const diffHours = Math.floor(diffMinutes / 60);
    if (diffHours < 24) return `${diffHours}h ago`;

    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays}d ago`;
  };

  // Get cooldown time remaining
  const getCooldownTime = (integrationId: string) => {
    const cooldown = syncCooldowns[integrationId];
    if (!cooldown || cooldown.canSync) return null;

    const remaining = Math.ceil((cooldown.cooldownEnd - Date.now()) / (1000 * 60));
    return `${remaining}m`;
  };

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      Object.values(syncCooldowns).forEach(cooldown => {
        if (cooldown.timer) {
          clearTimeout(cooldown.timer);
        }
      });
    };
  }, [syncCooldowns]);

  if (isLoading) {
    return (
      <Card>
        <div className="flex justify-center items-center py-8">
          <Spinner size="lg" />
          <span className="ml-2">Loading calendar integrations...</span>
        </div>
      </Card>
    );
  }

  return (
    <Card>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-medium text-gray-900 dark:text-white">
            External Calendar Imports
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Sync availability from Airbnb, Booking.com, and other platforms
          </p>
        </div>
        <Button
          onClick={() => {
            resetForm();
            setShowAddModal(true);
          }}
          className="flex items-center"
        >
          <Plus className="mr-2 h-4 w-4" />
          Add External Calendar
        </Button>
      </div>

      {error && (
        <Alert color="failure" className="mb-6">
          <AlertCircle className="h-4 w-4 mr-2" />
          {error}
        </Alert>
      )}

      {integrations.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          <ExternalLink className="h-12 w-12 mx-auto mb-4 text-gray-300" />
          <p className="text-lg font-medium mb-2">No external calendars connected</p>
          <p className="text-sm mb-4">
            Connect your Airbnb or Booking.com calendar to automatically sync availability
          </p>
          <Button
            onClick={() => {
              resetForm();
              setShowAddModal(true);
            }}
            color="primary"
          >
            <Plus className="mr-2 h-4 w-4" />
            Add Your First Calendar
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          {integrations.map((integration) => (
            <div
              key={integration.Id}
              className="flex items-center justify-between p-4 border border-gray-200 dark:border-gray-700 rounded-lg"
            >
              <div className="flex items-center space-x-4">
                <div className="text-2xl">
                  {PLATFORM_ICONS[integration.PlatformType]}
                </div>
                <div>
                  <div className="flex items-center space-x-2">
                    <h4 className="font-medium text-gray-900 dark:text-white">
                      {integration.ExternalCalendarName}
                    </h4>
                    <Badge color={getStatusBadgeColor(integration.SyncStatus)}>
                      {SYNC_STATUS_NAMES[integration.SyncStatus]}
                    </Badge>
                  </div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {PLATFORM_NAMES[integration.PlatformType]}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-500">
                    Last sync: {formatLastSync(integration.LastSyncAt)}
                  </p>
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <Tooltip content={
                  integration.LastError ? `Error: ${integration.LastError}` :
                  integration.SyncStatus === SyncStatus.Error ? 'Sync failed' : ''
                }>
                  {integration.SyncStatus === SyncStatus.Error && (
                    <AlertCircle className="h-4 w-4 text-red-500" />
                  )}
                </Tooltip>

                <Tooltip content="Edit integration">
                  <Button
                    size="sm"
                    color="gray"
                    onClick={() => handleEdit(integration)}
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                </Tooltip>

                <Tooltip content={
                  syncCooldowns[integration.Id]?.canSync === false
                    ? `Sync available in ${getCooldownTime(integration.Id)}`
                    : 'Sync now'
                }>
                  <Button
                    size="sm"
                    color="primary"
                    disabled={syncingIntegrations.has(integration.Id) || !syncCooldowns[integration.Id]?.canSync}
                    onClick={() => triggerSync(integration.Id)}
                  >
                    {syncingIntegrations.has(integration.Id) ? (
                      <Spinner size="sm" />
                    ) : syncCooldowns[integration.Id]?.canSync === false ? (
                      <Clock className="h-4 w-4" />
                    ) : (
                      <RefreshCw className="h-4 w-4" />
                    )}
                  </Button>
                </Tooltip>

                <Tooltip content="Delete integration">
                  <Button
                    size="sm"
                    color="failure"
                    onClick={() => setDeleteConfirmIntegration(integration)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </Tooltip>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add/Edit Modal */}
      <Modal
        show={showAddModal}
        onClose={() => {
          setShowAddModal(false);
          resetForm();
        }}
        size="lg"
      >
        <Modal.Header>
          {editingIntegration ? 'Edit Calendar Integration' : 'Add External Calendar'}
        </Modal.Header>
        <form onSubmit={handleSubmit}>
          <Modal.Body>
            <div className="space-y-4">
              <div>
                <Label htmlFor="platformType" value="Platform" />
                <Select
                  id="platformType"
                  value={formData.platformType}
                  onChange={(e) => setFormData(prev => ({
                    ...prev,
                    platformType: parseInt(e.target.value) as PlatformType
                  }))}
                  required
                >
                  <option value={PlatformType.AirbnbICal}>
                    🏠 {PLATFORM_NAMES[PlatformType.AirbnbICal]}
                  </option>
                  <option value={PlatformType.BookingComICal}>
                    🛏️ {PLATFORM_NAMES[PlatformType.BookingComICal]}
                  </option>
                  <option value={PlatformType.OtherICal}>
                    📆 {PLATFORM_NAMES[PlatformType.OtherICal]}
                  </option>
                </Select>
              </div>

              <div>
                <Label htmlFor="calendarName" value="Calendar Name" />
                <TextInput
                  id="calendarName"
                  type="text"
                  placeholder="e.g., My Airbnb Listing"
                  value={formData.calendarName}
                  onChange={(e) => setFormData(prev => ({
                    ...prev,
                    calendarName: e.target.value
                  }))}
                  color={formErrors.calendarName ? 'failure' : 'gray'}
                  helperText={formErrors.calendarName}
                  required
                />
              </div>

              <div>
                <Label htmlFor="icalUrl" value="iCal Feed URL" />
                <TextInput
                  id="icalUrl"
                  type="url"
                  placeholder="https://example.com/calendar.ics"
                  value={formData.iCalUrl}
                  onChange={(e) => setFormData(prev => ({
                    ...prev,
                    iCalUrl: e.target.value
                  }))}
                  color={formErrors.iCalUrl ? 'failure' : 'gray'}
                  helperText={formErrors.iCalUrl || "Must be a valid HTTPS URL"}
                  required
                />
                <p className="text-xs text-gray-500 mt-1">
                  Find this URL in your platform's calendar export settings
                </p>
              </div>
            </div>
          </Modal.Body>
          <Modal.Footer>
            <Button
              color="gray"
              onClick={() => {
                setShowAddModal(false);
                resetForm();
              }}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting}
              className="flex items-center"
            >
              {isSubmitting ? (
                <Spinner size="sm" className="mr-2" />
              ) : editingIntegration ? (
                <Edit className="mr-2 h-4 w-4" />
              ) : (
                <Plus className="mr-2 h-4 w-4" />
              )}
              {editingIntegration ? 'Update' : 'Test & Save'}
            </Button>
          </Modal.Footer>
        </form>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        show={!!deleteConfirmIntegration}
        onClose={() => setDeleteConfirmIntegration(null)}
        size="md"
      >
        <Modal.Header>
          Delete Calendar Integration
        </Modal.Header>
        <Modal.Body>
          <div className="text-center">
            <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
              Are you sure?
            </h3>
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              This will permanently delete the integration for{' '}
              <strong>{deleteConfirmIntegration?.ExternalCalendarName}</strong>{' '}
              and remove all associated availability blocks.
            </p>
            <p className="text-sm text-gray-500">
              This action cannot be undone.
            </p>
          </div>
        </Modal.Body>
        <Modal.Footer>
          <Button
            color="gray"
            onClick={() => setDeleteConfirmIntegration(null)}
          >
            Cancel
          </Button>
          <Button
            color="failure"
            onClick={() => deleteConfirmIntegration && handleDelete(deleteConfirmIntegration)}
            className="flex items-center"
          >
            <Trash2 className="mr-2 h-4 w-4" />
            Delete Integration
          </Button>
        </Modal.Footer>
      </Modal>
    </Card>
  );
};

export default ICalIntegrationManager;