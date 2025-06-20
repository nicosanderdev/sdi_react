import React from 'react';
import { XIcon, AlertCircleIcon, ClockIcon, TrendingUpIcon, CalendarIcon, CheckCircleIcon } from 'lucide-react';
interface NotificationsPanelProps {
  onClose: () => void;
}
export function NotificationsPanel({
  onClose
}: NotificationsPanelProps) {
  const notifications = [{
    id: 1,
    title: 'Alta interacción detectada',
    message: 'El Loft en Malasaña ha recibido 15 consultas en las últimas 24 horas.',
    time: 'Hace 2 horas',
    type: 'alert',
    read: false
  }, {
    id: 2,
    title: 'Recordatorio de actualización',
    message: '3 propiedades necesitan actualizar su información. Haz clic para ver detalles.',
    time: 'Hace 5 horas',
    type: 'reminder',
    read: false
  }, {
    id: 3,
    title: 'Nueva consulta recibida',
    message: 'Ana Martín ha enviado una consulta sobre el Loft en Malasaña.',
    time: 'Ayer',
    type: 'message',
    read: true
  }, {
    id: 4,
    title: 'Estadísticas semanales',
    message: 'El informe semanal de rendimiento está disponible para su revisión.',
    time: 'Hace 2 días',
    type: 'stats',
    read: true
  }, {
    id: 5,
    title: 'Visita programada',
    message: 'Recordatorio: Visita programada para el Chalet en La Moraleja mañana a las 17:00.',
    time: 'Hace 2 días',
    type: 'calendar',
    read: true
  }];
  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'alert':
        return <AlertCircleIcon size={20} className="text-red-500" />;
      case 'reminder':
        return <ClockIcon size={20} className="text-yellow-500" />;
      case 'message':
        return <CheckCircleIcon size={20} className="text-green-500" />;
      case 'stats':
        return <TrendingUpIcon size={20} className="text-blue-500" />;
      case 'calendar':
        return <CalendarIcon size={20} className="text-purple-500" />;
      default:
        return <AlertCircleIcon size={20} className="text-gray-500" />;
    }
  };
  return <div className="bg-[#FDFFFC] rounded-lg shadow-lg border border-gray-200 max-h-[80vh] overflow-hidden">
      <div className="p-4 border-b border-gray-200 flex items-center justify-between">
        <h3 className="font-bold text-[#1B4965]">Notificaciones</h3>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
          <XIcon size={20} />
        </button>
      </div>
      <div className="overflow-y-auto max-h-[calc(80vh-64px)]">
        {notifications.map(notification => <div key={notification.id} className={`p-4 border-b border-gray-100 hover:bg-gray-50 cursor-pointer ${notification.read ? '' : 'bg-[#BEE9E8]/20'}`}>
            <div className="flex">
              <div className="mr-3">
                {getNotificationIcon(notification.type)}
              </div>
              <div className="flex-1">
                <div className="flex items-start justify-between">
                  <h4 className={`text-sm ${notification.read ? 'font-medium' : 'font-bold'} text-[#1B4965]`}>
                    {notification.title}
                  </h4>
                  <span className="text-xs text-gray-500 ml-2 [#FDFFFC]space-nowrap">
                    {notification.time}
                  </span>
                </div>
                <p className="text-sm text-gray-600 mt-1">
                  {notification.message}
                </p>
              </div>
            </div>
          </div>)}
        <div className="p-3 text-center">
          <button className="text-sm text-[#62B6CB] hover:text-[#1B4965] font-medium">
            Ver todas las notificaciones
          </button>
        </div>
      </div>
    </div>;
}