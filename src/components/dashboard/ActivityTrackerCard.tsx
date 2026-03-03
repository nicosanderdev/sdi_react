import React from 'react';
import { Clock, Play, Pause, Square } from 'lucide-react';
import { Button } from 'flowbite-react';

interface Activity {
  id: string;
  title: string;
  project?: string;
  duration: number; // in minutes
  status: 'active' | 'paused' | 'stopped';
  startTime?: Date;
}

interface ActivityTrackerCardProps {
  title?: string;
  activities: Activity[];
  totalToday: number; // total minutes today
  className?: string;
}

const formatDuration = (minutes: number): string => {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;

  if (hours > 0) {
    return `${hours}h ${mins}m`;
  }
  return `${mins}m`;
};

const getActivityStatusColor = (status: Activity['status']) => {
  switch (status) {
    case 'active':
      return 'text-green-600 dark:text-green-400';
    case 'paused':
      return 'text-yellow-600 dark:text-yellow-400';
    case 'stopped':
      return 'text-gray-600 dark:text-gray-400';
    default:
      return 'text-gray-600 dark:text-gray-400';
  }
};

const getActivityStatusIcon = (status: Activity['status']) => {
  switch (status) {
    case 'active':
      return <Play className="w-4 h-4" />;
    case 'paused':
      return <Pause className="w-4 h-4" />;
    case 'stopped':
      return <Square className="w-4 h-4" />;
    default:
      return <Clock className="w-4 h-4" />;
  }
};

export function ActivityTrackerCard({
  title = "Seguimiento de Tiempo",
  activities,
  totalToday,
  className = ''
}: ActivityTrackerCardProps) {
  return (
    <div className={`bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-xl shadow-sm p-4 md:p-6 ${className}`}>
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">{title}</h3>
        <div className="text-right">
          <div className="text-sm text-gray-500 dark:text-gray-400">Total hoy</div>
          <div className="text-lg font-bold text-gray-900 dark:text-white">
            {formatDuration(totalToday)}
          </div>
        </div>
      </div>

      <div className="space-y-4">
        {activities.length === 0 ? (
          <p className="text-gray-500 dark:text-gray-400 text-center py-4">
            No hay actividades activas
          </p>
        ) : (
          activities.map((activity) => (
            <div key={activity.id} className="flex items-center justify-between p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
              <div className="flex-1 min-w-0">
                <div className="flex items-center space-x-2 mb-1">
                  <div className={`${getActivityStatusColor(activity.status)}`}>
                    {getActivityStatusIcon(activity.status)}
                  </div>
                  <h4 className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                    {activity.title}
                  </h4>
                </div>

                {activity.project && (
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">
                    Proyecto: {activity.project}
                  </p>
                )}

                <div className="flex items-center space-x-2 text-xs text-gray-500 dark:text-gray-400">
                  <Clock className="w-3 h-3" />
                  <span>{formatDuration(activity.duration)}</span>
                  <span className={`px-2 py-0.5 rounded-full text-xs ${getActivityStatusColor(activity.status)} bg-current bg-opacity-10`}>
                    {activity.status === 'active' ? 'Activo' :
                     activity.status === 'paused' ? 'Pausado' : 'Detenido'}
                  </span>
                </div>
              </div>

              <div className="flex space-x-2 ml-4">
                {activity.status === 'active' ? (
                  <Button size="xs" color="gray" className="rounded-full">
                    <Pause className="w-3 h-3" />
                  </Button>
                ) : activity.status === 'paused' ? (
                  <Button size="xs" color="green" className="rounded-full">
                    <Play className="w-3 h-3" />
                  </Button>
                ) : (
                  <Button size="xs" color="green" className="rounded-full">
                    <Play className="w-3 h-3" />
                  </Button>
                )}
                <Button size="xs" color="red" className="rounded-full">
                  <Square className="w-3 h-3" />
                </Button>
              </div>
            </div>
          ))
        )}
      </div>

      <div className="mt-6 pt-4 border-t border-gray-100 dark:border-gray-700">
        <Button
          size="sm"
          className="w-full bg-green-600 hover:bg-green-500 text-white rounded-full"
        >
          <Play className="w-4 h-4 mr-2" />
          Iniciar Nueva Actividad
        </Button>
      </div>
    </div>
  );
}
