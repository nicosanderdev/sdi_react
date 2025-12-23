import React, { useState, useEffect } from 'react'
import { AlertTriangle, CheckCircle, Clock, XCircle, RefreshCw, RotateCcw } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../ui/card'
import { Button } from '../../ui/button'
import { Badge } from '../../ui/badge'
import { Alert, AlertDescription } from '../../ui/alert'
import { useToast } from '../../../hooks/use-toast'
import { SyncOrchestratorService, SyncStatus, SyncJob } from '../../../services/CalendarSyncService'
import { CalendarSyncService } from '../../../services/CalendarSyncService'

interface CalendarSyncStatusProps {
  propertyId: string
}

export function CalendarSyncStatus({ propertyId }: CalendarSyncStatusProps) {
  const [syncStatus, setSyncStatus] = useState<SyncStatus[]>([])
  const [syncJobs, setSyncJobs] = useState<SyncJob[]>([])
  const [loading, setLoading] = useState(false)
  const [retrying, setRetrying] = useState(false)
  const { toast } = useToast()

  // Load sync status and recent jobs
  const loadData = async () => {
    try {
      setLoading(true)
      const [statusResult, jobsResult] = await Promise.all([
        SyncOrchestratorService.getSyncStatus(propertyId),
        CalendarSyncService.getSyncJobs(propertyId, 20)
      ])

      if (statusResult.success) {
        setSyncStatus(statusResult.status || [])
      }

      if (jobsResult.succeeded) {
        setSyncJobs(jobsResult.data || [])
      }
    } catch (error) {
      console.error('Error loading sync status:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()

    // Refresh every 30 seconds
    const interval = setInterval(loadData, 30000)
    return () => clearInterval(interval)
  }, [propertyId])

  // Retry failed jobs
  const handleRetryFailed = async () => {
    try {
      setRetrying(true)
      const result = await SyncOrchestratorService.retryFailedJobs(propertyId)
      toast({
        title: 'Retry Started',
        description: result.message
      })
      await loadData()
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to retry failed jobs',
        variant: 'destructive'
      })
    } finally {
      setRetrying(false)
    }
  }

  // Get status icon
  const getStatusIcon = (status: number) => {
    switch (status) {
      case 0: return <Clock className="w-4 h-4 text-gray-500" />
      case 1: return <RefreshCw className="w-4 h-4 text-blue-500 animate-spin" />
      case 2: return <CheckCircle className="w-4 h-4 text-green-500" />
      case 3: return <XCircle className="w-4 h-4 text-red-500" />
      default: return <Clock className="w-4 h-4 text-gray-500" />
    }
  }

  // Get status text
  const getStatusText = (status: number) => {
    switch (status) {
      case 0: return 'Pending'
      case 1: return 'Running'
      case 2: return 'Completed'
      case 3: return 'Failed'
      default: return 'Unknown'
    }
  }

  // Get job type text
  const getJobTypeText = (jobType: number) => {
    switch (jobType) {
      case 0: return 'Manual'
      case 1: return 'Scheduled'
      case 2: return 'Webhook'
      default: return 'Unknown'
    }
  }

  // Get platform name
  const getPlatformName = (platformType: number) => {
    return platformType === 0 ? 'Google Calendar' : 'Apple Calendar (ICS)'
  }

  // Check if there are failed jobs that can be retried
  const hasFailedJobs = syncJobs.some(job => job.Status === 3)

  return (
    <div className="space-y-6">
      {/* Current Status Overview */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <RefreshCw className="w-5 h-5" />
            Sync Status Overview
          </CardTitle>
          <CardDescription>
            Current synchronization status for all connected calendars
          </CardDescription>
        </CardHeader>
        <CardContent>
          {syncStatus.length === 0 ? (
            <Alert>
              <AlertDescription>
                No calendar integrations found. Configure calendar sync to see status information.
              </AlertDescription>
            </Alert>
          ) : (
            <div className="space-y-4">
              {syncStatus.map((status) => (
                <div key={status.integrationId} className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">
                      {status.platformType === 0 ? '📅' : '📱'}
                    </span>
                    <div>
                      <div className="font-medium">
                        {status.calendarName || getPlatformName(status.platformType)}
                      </div>
                      <div className="text-sm text-gray-500">
                        {getPlatformName(status.platformType)} •
                        {status.isActive ? (
                          <Badge variant="secondary" className="ml-2">Active</Badge>
                        ) : (
                          <Badge variant="outline" className="ml-2">Inactive</Badge>
                        )}
                      </div>
                      {status.lastSyncAt && (
                        <div className="text-xs text-gray-400">
                          Last sync: {new Date(status.lastSyncAt).toLocaleString()}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {status.latestJob && (
                      <div className="text-right">
                        <div className="flex items-center gap-1">
                          {getStatusIcon(status.latestJob.status)}
                          <span className="text-sm font-medium">
                            {getStatusText(status.latestJob.status)}
                          </span>
                        </div>
                        <div className="text-xs text-gray-500">
                          {new Date(status.latestJob.created).toLocaleString()}
                        </div>
                        {status.latestJob.eventsProcessed !== undefined && (
                          <div className="text-xs text-gray-500">
                            {status.latestJob.eventsProcessed} events
                          </div>
                        )}
                      </div>
                    )}
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
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recent Sync Jobs */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Recent Sync Jobs</span>
            {hasFailedJobs && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleRetryFailed}
                disabled={retrying}
              >
                <RotateCcw className={`w-4 h-4 mr-2 ${retrying ? 'animate-spin' : ''}`} />
                Retry Failed
              </Button>
            )}
          </CardTitle>
          <CardDescription>
            History of synchronization operations
          </CardDescription>
        </CardHeader>
        <CardContent>
          {syncJobs.length === 0 ? (
            <Alert>
              <AlertDescription>
                No sync jobs found. Jobs will appear here after synchronization operations.
              </AlertDescription>
            </Alert>
          ) : (
            <div className="space-y-3">
              {syncJobs.map((job) => (
                <div key={job.Id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex items-center gap-3">
                    {getStatusIcon(job.Status)}
                    <div>
                      <div className="font-medium">
                        {getJobTypeText(job.JobType)} Sync
                      </div>
                      <div className="text-sm text-gray-500">
                        {new Date(job.Created).toLocaleString()}
                        {job.StartedAt && ` • Started: ${new Date(job.StartedAt).toLocaleString()}`}
                        {job.CompletedAt && ` • Completed: ${new Date(job.CompletedAt).toLocaleString()}`}
                      </div>
                      {job.Error && (
                        <div className="text-sm text-red-600 mt-1">
                          Error: {job.Error}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {job.EventsProcessed !== undefined && (
                      <Badge variant="outline">
                        {job.EventsProcessed} events
                      </Badge>
                    )}
                    <Badge
                      variant={
                        job.Status === 2 ? 'default' :
                        job.Status === 3 ? 'destructive' :
                        'secondary'
                      }
                    >
                      {getStatusText(job.Status)}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Error Summary */}
      {syncJobs.some(job => job.Status === 3) && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-orange-600">
              <AlertTriangle className="w-5 h-5" />
              Sync Errors
            </CardTitle>
            <CardDescription>
              Recent synchronization errors that may need attention
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {syncJobs
                .filter(job => job.Status === 3)
                .slice(0, 5)
                .map((job) => (
                  <Alert key={job.Id}>
                    <AlertTriangle className="h-4 w-4" />
                    <AlertDescription>
                      <div className="font-medium">
                        {getJobTypeText(job.JobType)} sync failed
                      </div>
                      <div className="text-sm mt-1">
                        {job.Error}
                      </div>
                      <div className="text-xs text-gray-500 mt-1">
                        {new Date(job.Created).toLocaleString()}
                      </div>
                    </AlertDescription>
                  </Alert>
                ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
