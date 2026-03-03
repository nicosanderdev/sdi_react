import React, { useState, useEffect, useCallback } from 'react';
import {
  ExternalLink,
  Copy,
  Check,
  RefreshCw,
  ChevronDown,
  ChevronRight,
  AlertTriangle,
  Home,
  Bed
} from 'lucide-react';
import {
  Card,
  Button,
  Alert,
  Spinner,
  Collapsible
} from 'flowbite-react';
import { supabase } from '../../../config/supabase';

interface ICalExportPanelProps {
  propertyId: string;
}

interface ExportData {
  url: string;
  token: string;
}

const ICalExportPanel: React.FC<ICalExportPanelProps> = ({ propertyId }) => {
  const [exportData, setExportData] = useState<ExportData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);
  const [expandedInstructions, setExpandedInstructions] = useState<string | null>(null);

  // Load export URL
  const loadExportData = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      // For now, we'll generate a simple URL format
      // In a real implementation, this would come from the database
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) throw new Error('Not authenticated');

      // Generate or retrieve export token from database
      const { data: property, error: propertyError } = await supabase
        .from('EstateProperties')
        .select('ICalExportToken')
        .eq('Id', propertyId)
        .single();

      if (propertyError) throw propertyError;

      let token = property.ICalExportToken;
      if (!token) {
        // Generate new token if none exists
        token = crypto.randomUUID();
        const { error: updateError } = await supabase
          .from('EstateProperties')
          .update({ ICalExportToken: token })
          .eq('Id', propertyId);

        if (updateError) throw updateError;
      }

      const baseUrl = window.location.origin;
      const url = `${baseUrl}/ical-export/${propertyId}?token=${token}`;

      setExportData({ url, token });
    } catch (error: any) {
      setError(error.message || 'Failed to load export URL');
    } finally {
      setIsLoading(false);
    }
  }, [propertyId]);

  useEffect(() => {
    loadExportData();
  }, [loadExportData]);

  // Copy URL to clipboard
  const copyToClipboard = async () => {
    if (!exportData) return;

    try {
      await navigator.clipboard.writeText(exportData.url);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    } catch (error: any) {
      setError('Failed to copy to clipboard');
    }
  };

  // Regenerate export token
  const regenerateToken = async () => {
    setIsRegenerating(true);
    setError(null);

    try {
      const newToken = crypto.randomUUID();

      const { error: updateError } = await supabase
        .from('EstateProperties')
        .update({ ICalExportToken: newToken })
        .eq('Id', propertyId);

      if (updateError) throw updateError;

      const baseUrl = window.location.origin;
      const newUrl = `${baseUrl}/ical-export/${propertyId}?token=${newToken}`;

      setExportData({ url: newUrl, token: newToken });
    } catch (error: any) {
      setError(error.message || 'Failed to regenerate URL');
    } finally {
      setIsRegenerating(false);
    }
  };

  // Toggle instruction expansion
  const toggleInstructions = (platform: string) => {
    setExpandedInstructions(expandedInstructions === platform ? null : platform);
  };

  if (isLoading) {
    return (
      <Card>
        <div className="flex justify-center items-center py-8">
          <Spinner size="lg" />
          <span className="ml-2">Loading export URL...</span>
        </div>
      </Card>
    );
  }

  return (
    <Card>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h3 className="text-lg font-medium text-gray-900 dark:text-white flex items-center">
            <ExternalLink className="mr-2 h-5 w-5" />
            Export Calendar to External Platforms
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            Use this URL to sync your bookings to Airbnb, Booking.com, and other platforms
          </p>
        </div>

        {error && (
          <Alert color="failure">
            <AlertTriangle className="h-4 w-4 mr-2" />
            {error}
          </Alert>
        )}

        {/* Export URL Section */}
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Calendar Export URL
            </label>
            <div className="flex space-x-2">
              <div className="flex-1">
                <input
                  type="text"
                  value={exportData?.url || ''}
                  readOnly
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white text-sm font-mono"
                />
              </div>
              <Button
                onClick={copyToClipboard}
                disabled={!exportData}
                color={copySuccess ? "success" : "gray"}
                className="flex items-center"
              >
                {copySuccess ? (
                  <Check className="h-4 w-4 mr-2" />
                ) : (
                  <Copy className="h-4 w-4 mr-2" />
                )}
                {copySuccess ? 'Copied!' : 'Copy'}
              </Button>
            </div>
            <p className="text-xs text-gray-500 mt-1">
              This URL contains your availability data in iCal format
            </p>
          </div>

          <div className="flex items-center justify-between">
            <div className="text-sm text-gray-600 dark:text-gray-400">
              <strong>Security:</strong> Keep this URL private. Anyone with this URL can view your availability.
            </div>
            <Button
              size="sm"
              color="alternative"
              onClick={regenerateToken}
              disabled={isRegenerating}
              className="flex items-center"
            >
              {isRegenerating ? (
                <Spinner size="sm" className="mr-2" />
              ) : (
                <RefreshCw className="mr-2 h-4 w-4" />
              )}
              Regenerate URL
            </Button>
          </div>
        </div>

        {/* Platform Instructions */}
        <div className="space-y-3">
          <h4 className="text-md font-medium text-gray-900 dark:text-white">
            How to Connect
          </h4>

          {/* Airbnb Instructions */}
          <div className="border border-gray-200 dark:border-gray-700 rounded-lg">
            <button
              onClick={() => toggleInstructions('airbnb')}
              className="w-full flex items-center justify-between p-4 text-left hover:bg-gray-50 dark:hover:bg-gray-800 rounded-lg"
            >
              <div className="flex items-center space-x-3">
                <Home className="h-5 w-5 text-pink-500" />
                <span className="font-medium text-gray-900 dark:text-white">Airbnb</span>
              </div>
              {expandedInstructions === 'airbnb' ? (
                <ChevronDown className="h-4 w-4 text-gray-500" />
              ) : (
                <ChevronRight className="h-4 w-4 text-gray-500" />
              )}
            </button>

            {expandedInstructions === 'airbnb' && (
              <div className="px-4 pb-4 border-t border-gray-200 dark:border-gray-700">
                <ol className="list-decimal list-inside space-y-2 text-sm text-gray-600 dark:text-gray-400 mt-3">
                  <li>Go to your Airbnb account and select your listing</li>
                  <li>Navigate to <strong>Calendar</strong> → <strong>Availability Settings</strong></li>
                  <li>Scroll down to <strong>Import Calendar</strong></li>
                  <li>Select <strong>iCal</strong> as the calendar type</li>
                  <li>Paste the URL above into the <strong>Calendar Address (URL)</strong> field</li>
                  <li>Click <strong>Import</strong> to save</li>
                </ol>
                <div className="mt-3 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                  <p className="text-xs text-blue-800 dark:text-blue-300">
                    <strong>Tip:</strong> Airbnb may take a few minutes to sync. Check back in your calendar to confirm the import worked.
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Booking.com Instructions */}
          <div className="border border-gray-200 dark:border-gray-700 rounded-lg">
            <button
              onClick={() => toggleInstructions('booking')}
              className="w-full flex items-center justify-between p-4 text-left hover:bg-gray-50 dark:hover:bg-gray-800 rounded-lg"
            >
              <div className="flex items-center space-x-3">
                <Bed className="h-5 w-5 text-green-500" />
                <span className="font-medium text-gray-900 dark:text-white">Booking.com</span>
              </div>
              {expandedInstructions === 'booking' ? (
                <ChevronDown className="h-4 w-4 text-gray-500" />
              ) : (
                <ChevronRight className="h-4 w-4 text-gray-500" />
              )}
            </button>

            {expandedInstructions === 'booking' && (
              <div className="px-4 pb-4 border-t border-gray-200 dark:border-gray-700">
                <ol className="list-decimal list-inside space-y-2 text-sm text-gray-600 dark:text-gray-400 mt-3">
                  <li>Log in to your Booking.com extranet</li>
                  <li>Go to <strong>Calendar</strong> → <strong>Import/Export Calendar</strong></li>
                  <li>Find the <strong>iCal Import</strong> section</li>
                  <li>Paste the URL above into the designated field</li>
                  <li>Click <strong>Import</strong> or <strong>Save</strong></li>
                  <li>Wait for the system to process and sync your calendar</li>
                </ol>
                <div className="mt-3 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                  <p className="text-xs text-blue-800 dark:text-blue-300">
                    <strong>Tip:</strong> Booking.com syncs may take up to 24 hours. Check your calendar settings to confirm the connection.
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Other Platforms */}
          <div className="border border-gray-200 dark:border-gray-700 rounded-lg">
            <button
              onClick={() => toggleInstructions('other')}
              className="w-full flex items-center justify-between p-4 text-left hover:bg-gray-50 dark:hover:bg-gray-800 rounded-lg"
            >
              <div className="flex items-center space-x-3">
                <ExternalLink className="h-5 w-5 text-gray-500" />
                <span className="font-medium text-gray-900 dark:text-white">Other Platforms</span>
              </div>
              {expandedInstructions === 'other' ? (
                <ChevronDown className="h-4 w-4 text-gray-500" />
              ) : (
                <ChevronRight className="h-4 w-4 text-gray-500" />
              )}
            </button>

            {expandedInstructions === 'other' && (
              <div className="px-4 pb-4 border-t border-gray-200 dark:border-gray-700">
                <div className="text-sm text-gray-600 dark:text-gray-400 mt-3">
                  <p className="mb-2">Most booking platforms support iCal import. Look for:</p>
                  <ul className="list-disc list-inside space-y-1 ml-4">
                    <li>Calendar sync or import settings</li>
                    <li>iCal, .ics, or calendar feed options</li>
                    <li>URL-based import functionality</li>
                  </ul>
                  <p className="mt-3">
                    If your platform asks for a username/password, iCal URLs typically don't support authentication.
                    The URL above provides read-only access to your availability data.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer Note */}
        <Alert color="warning" className="border-yellow-200 dark:border-yellow-800">
          <AlertTriangle className="h-4 w-4 mr-2" />
          <div>
            <p className="font-medium">Important Security Note</p>
            <p className="text-sm mt-1">
              This iCal URL contains your availability information. Never share it publicly or post it online.
              If you suspect the URL has been compromised, use the "Regenerate URL" button to create a new secure URL.
            </p>
          </div>
        </Alert>
      </div>
    </Card>
  );
};

export default ICalExportPanel;