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
  Spinner
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
      if (!user.user) throw new Error('No autenticado');

      // Retrieve export token via RPC backed by SummerRentExtension
      const { data, error } = await supabase.rpc('get_property_ical_export_token', {
        property_id: propertyId
      });

      if (error || !data) throw error || new Error('No se pudo cargar el token de exportación');

      const token = data as string;

      const baseUrl = window.location.origin;
      const url = `${baseUrl}/ical-export/${propertyId}?token=${token}`;

      setExportData({ url, token });
    } catch (error: any) {
      setError(error.message || 'No se pudo cargar la URL de exportación');
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
      setError('No se pudo copiar al portapapeles');
    }
  };

  // Regenerate export token
  const regenerateToken = async () => {
    setIsRegenerating(true);
    setError(null);

    try {
      const { data, error } = await supabase.rpc('regenerate_property_ical_export_token', {
        property_id: propertyId
      });

      if (error || !data) throw error || new Error('No se pudo regenerar el token');

      const newToken = data as string;

      const baseUrl = window.location.origin;
      const newUrl = `${baseUrl}/ical-export/${propertyId}?token=${newToken}`;

      setExportData({ url: newUrl, token: newToken });
    } catch (error: any) {
      setError(error.message || 'No se pudo regenerar la URL');
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
          <span className="ml-2">Cargando URL de exportación...</span>
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
            Exportar calendario a plataformas externas
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            Usa esta URL para sincronizar tus reservas con Airbnb, Booking.com y otras plataformas
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
              URL de exportación del calendario
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
                {copySuccess ? '¡Copiado!' : 'Copiar'}
              </Button>
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Esta URL contiene tus datos de disponibilidad en formato iCal
            </p>
          </div>

          <div className="flex items-center justify-between">
            <div className="text-sm text-gray-600 dark:text-gray-400">
              <strong>Seguridad:</strong> mantén esta URL privada. Cualquiera con el enlace puede ver tu disponibilidad.
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
              Regenerar URL
            </Button>
          </div>
        </div>

        {/* Platform Instructions */}
        <div className="space-y-3">
          <h4 className="text-md font-medium text-gray-900 dark:text-white">
            Cómo conectar
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
                  <li>Entra en tu cuenta de Airbnb y selecciona tu anuncio</li>
                  <li>Ve a <strong>Calendario</strong> → <strong>Configuración de disponibilidad</strong></li>
                  <li>Baja hasta <strong>Importar calendario</strong></li>
                  <li>Elige <strong>iCal</strong> como tipo de calendario</li>
                  <li>Pega la URL de arriba en el campo <strong>Dirección del calendario (URL)</strong></li>
                  <li>Pulsa <strong>Importar</strong> para guardar</li>
                </ol>
                <div className="mt-3 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                  <p className="text-xs text-blue-800 dark:text-blue-300">
                    <strong>Consejo:</strong> Airbnb puede tardar unos minutos en sincronizar. Revisa el calendario para confirmar que la importación funcionó.
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
                  <li>Inicia sesión en el extranet de Booking.com</li>
                  <li>Ve a <strong>Calendario</strong> → <strong>Importar/Exportar calendario</strong></li>
                  <li>Busca la sección <strong>Importación iCal</strong></li>
                  <li>Pega la URL de arriba en el campo indicado</li>
                  <li>Pulsa <strong>Importar</strong> o <strong>Guardar</strong></li>
                  <li>Espera a que el sistema procese y sincronice tu calendario</li>
                </ol>
                <div className="mt-3 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                  <p className="text-xs text-blue-800 dark:text-blue-300">
                    <strong>Consejo:</strong> la sincronización en Booking.com puede tardar hasta 24 horas. Comprueba la configuración del calendario para confirmar la conexión.
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
                <span className="font-medium text-gray-900 dark:text-white">Otras plataformas</span>
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
                  <p className="mb-2">La mayoría de plataformas admiten importación iCal. Busca:</p>
                  <ul className="list-disc list-inside space-y-1 ml-4">
                    <li>Ajustes de sincronización o importación de calendario</li>
                    <li>Opciones iCal, .ics o feed de calendario</li>
                    <li>Importación mediante URL</li>
                  </ul>
                  <p className="mt-3">
                    Si la plataforma pide usuario y contraseña, las URLs iCal normalmente no usan autenticación.
                    La URL anterior ofrece acceso de solo lectura a tu disponibilidad.
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
            <p className="font-medium">Aviso importante de seguridad</p>
            <p className="text-sm mt-1">
              Esta URL iCal contiene información de tu disponibilidad. No la compartas públicamente ni la publiques en internet.
              Si crees que el enlace se ha filtrado, usa «Regenerar URL» para crear uno nuevo.
            </p>
          </div>
        </Alert>
      </div>
    </Card>
  );
};

export default ICalExportPanel;
