import React, { useState, useEffect } from 'react'
import { Calendar, ExternalLink, RefreshCw, Trash2, Plus, Download, Upload } from 'lucide-react'
import { Button } from '../../ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../ui/card'
import { Input } from '../../ui/input'
import { Label } from '../../ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../ui/select'
import { Badge } from '../../ui/badge'
import { Alert, AlertDescription } from '../../ui/alert'
import { useToast } from '../../../hooks/use-toast'
import {
  CalendarSyncService,
  GoogleCalendarOAuthService,
  ICalSyncService,
  SyncOrchestratorService,
  CalendarIntegration,
  SyncStatus
} from '../../../services/CalendarSyncService'

interface CalendarSyncSettingsProps {
  propertyId: string
}

export function CalendarSyncSettings({ propertyId }: CalendarSyncSettingsProps) {
  const [integrations, setIntegrations] = useState<CalendarIntegration[]>([])
  const [syncStatus, setSyncStatus] = useState<SyncStatus[]>([])
  const [loading, setLoading] = useState(false)
  const [connecting, setConnecting] = useState<string | null>(null)
  const [showAddForm, setShowAddForm] = useState(false)
  const [newIntegration, setNewIntegration] = useState({
    platformType: 0,
    icsUrl: '',
    calendarName: ''
  })
  const { toast } = useToast()

  // Load integrations and sync status
  const loadData = async () => {
    try {
      setLoading(true)
      const [integrationsResult, statusResult] = await Promise.all([
        CalendarSyncService.getCalendarIntegrations(propertyId),
        SyncOrchestratorService.getSyncStatus(propertyId)
      ])

      if (integrationsResult.succeeded) {
        setIntegrations(integrationsResult.data || [])
      }

      if (statusResult.success) {
        setSyncStatus(statusResult.status || [])
      }
    } catch (error) {
      console.error('Error loading calendar data:', error)
      toast({
        title: 'Error',
        description: 'Failed to load calendar integrations',
        variant: 'destructive'
      })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [propertyId])

  // Connect Google Calendar
  const handleGoogleConnect = async () => {
    try {
      setConnecting('google')
      const result = await GoogleCalendarOAuthService.initiateOAuth(propertyId)
      // Redirect to Google OAuth
      window.location.href = result.authUrl
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to connect Google Calendar',
        variant: 'destructive'
      })
    } finally {
      setConnecting(null)
    }
  }

  // Add ICS integration
  const handleAddICS = async () => {
    if (!newIntegration.icsUrl.trim()) {
      toast({
        title: 'Error',
        description: 'Please enter an ICS URL',
        variant: 'destructive'
      })
      return
    }

    try {
      setConnecting('ics')
      const result = await ICalSyncService.connectICS(
        propertyId,
        newIntegration.icsUrl,
        newIntegration.calendarName || undefined
      )

      toast({
        title: 'Success',
        description: 'ICS calendar connected successfully'
      })

      setShowAddForm(false)
      setNewIntegration({ platformType: 0, icsUrl: '', calendarName: '' })
      await loadData()
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to connect ICS calendar',
        variant: 'destructive'
      })
    } finally {
      setConnecting(null)
    }
  }

  // Trigger manual sync
  const handleSync = async (integrationId: string) => {
    try {
      const result = await SyncOrchestratorService.triggerSync(integrationId)
      toast({
        title: 'Sync Started',
        description: result.message
      })
      await loadData()
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to start sync',
        variant: 'destructive'
      })
    }
  }

  // Delete integration
  const handleDelete = async (integrationId: string) => {
    if (!confirm('Are you sure you want to disconnect this calendar?')) {
      return
    }

    try {
      const result = await CalendarSyncService.deleteCalendarIntegration(integrationId)
      if (result.succeeded) {
        toast({
          title: 'Success',
          description: 'Calendar disconnected successfully'
        })
        await loadData()
      } else {
        throw new Error(result.errorMessage)
      }
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to disconnect calendar',
        variant: 'destructive'
      })
    }
  }

  // Get platform name
  const getPlatformName = (platformType: number) => {
    return platformType === 0 ? 'Google Calendar' : 'Apple Calendar (ICS)'
  }

  // Get platform icon
  const getPlatformIcon = (platformType: number) => {
    return platformType === 0 ? '📅' : '📱'
  }

  // Get sync status info
  const getSyncStatusInfo = (integrationId: string) => {
    return syncStatus.find(s => s.integrationId === integrationId)
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="w-5 h-5" />
            Calendar Integrations
          </CardTitle>
          <CardDescription>
            Connect your property calendar with external calendar platforms for automatic synchronization
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Existing Integrations */}
          {integrations.length > 0 ? (
            <div className="space-y-3">
              {integrations.map((integration) => {
                const statusInfo = getSyncStatusInfo(integration.Id)
                return (
                  <div
                    key={integration.Id}
                    className="flex items-center justify-between p-4 border rounded-lg"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">{getPlatformIcon(integration.PlatformType)}</span>
                      <div>
                        <div className="font-medium">
                          {integration.ExternalCalendarName || getPlatformName(integration.PlatformType)}
                        </div>
                        <div className="text-sm text-gray-500">
                          {getPlatformName(integration.PlatformType)} •
                          {integration.IsActive ? (
                            <Badge variant="secondary" className="ml-2">Active</Badge>
                          ) : (
                            <Badge variant="outline" className="ml-2">Inactive</Badge>
                          )}
                          {statusInfo && (
                            <>
                              {statusInfo.syncStatus === 1 && <Badge variant="default" className="ml-2">Syncing</Badge>}
                              {statusInfo.syncStatus === 2 && <Badge variant="destructive" className="ml-2">Error</Badge>}
                            </>
                          )}
                        </div>
                        {integration.LastSyncAt && (
                          <div className="text-xs text-gray-400">
                            Last sync: {new Date(integration.LastSyncAt).toLocaleString()}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {integration.PlatformType === 1 && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => window.open(ICalSyncService.getICSExportUrl(integration.Id), '_blank')}
                        >
                          <Download className="w-4 h-4 mr-1" />
                          Export ICS
                        </Button>
                      )}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleSync(integration.Id)}
                        disabled={statusInfo?.syncStatus === 1}
                      >
                        <RefreshCw className={`w-4 h-4 mr-1 ${statusInfo?.syncStatus === 1 ? 'animate-spin' : ''}`} />
                        Sync Now
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDelete(integration.Id)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <Alert>
              <AlertDescription>
                No calendar integrations configured. Connect a calendar to enable automatic synchronization.
              </AlertDescription>
            </Alert>
          )}

          {/* Add New Integration */}
          <div className="pt-4 border-t">
            {!showAddForm ? (
              <div className="flex gap-3">
                <Button onClick={handleGoogleConnect} disabled={connecting === 'google'}>
                  <ExternalLink className="w-4 h-4 mr-2" />
                  {connecting === 'google' ? 'Connecting...' : 'Connect Google Calendar'}
                </Button>
                <Button variant="outline" onClick={() => setShowAddForm(true)}>
                  <Plus className="w-4 h-4 mr-2" />
                  Add ICS Calendar
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="icsUrl">ICS Feed URL</Label>
                    <Input
                      id="icsUrl"
                      placeholder="https://example.com/calendar.ics"
                      value={newIntegration.icsUrl}
                      onChange={(e) => setNewIntegration(prev => ({ ...prev, icsUrl: e.target.value }))}
                    />
                  </div>
                  <div>
                    <Label htmlFor="calendarName">Calendar Name (Optional)</Label>
                    <Input
                      id="calendarName"
                      placeholder="My Calendar"
                      value={newIntegration.calendarName}
                      onChange={(e) => setNewIntegration(prev => ({ ...prev, calendarName: e.target.value }))}
                    />
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button onClick={handleAddICS} disabled={connecting === 'ics'}>
                    <Upload className="w-4 h-4 mr-2" />
                    {connecting === 'ics' ? 'Connecting...' : 'Connect ICS'}
                  </Button>
                  <Button variant="outline" onClick={() => setShowAddForm(false)}>
                    Cancel
                  </Button>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Sync Status */}
      {syncStatus.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Recent Sync Activity</CardTitle>
            <CardDescription>
              Status of recent synchronization jobs
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {syncStatus.map((status) => (
                <div key={status.integrationId} className="flex items-center justify-between py-2">
                  <div className="flex items-center gap-3">
                    <span className="text-lg">{getPlatformIcon(status.platformType)}</span>
                    <div>
                      <div className="font-medium">{status.calendarName || getPlatformName(status.platformType)}</div>
                      {status.latestJob && (
                        <div className="text-sm text-gray-500">
                          {status.latestJob.status === 0 && 'Pending'}
                          {status.latestJob.status === 1 && 'Running'}
                          {status.latestJob.status === 2 && `Completed (${status.latestJob.eventsProcessed || 0} events)`}
                          {status.latestJob.status === 3 && `Failed: ${status.latestJob.error}`}
                          {' • '}
                          {new Date(status.latestJob.created).toLocaleString()}
                        </div>
                      )}
                    </div>
                  </div>
                  <Badge
                    variant={
                      status.syncStatus === 0 ? 'secondary' :
                      status.syncStatus === 1 ? 'default' :
                      'destructive'
                    }
                  >
                    {status.syncStatus === 0 ? 'Idle' :
                     status.syncStatus === 1 ? 'Syncing' :
                     'Error'}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
