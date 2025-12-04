import React from 'react';
import { Badge } from 'flowbite-react';
import { Clock, AlertCircle, CheckCircle, Calendar } from 'lucide-react';

interface Reminder {
  id: string;
  title: string;
  description?: string;
  dueDate?: string;
  priority: 'high' | 'medium' | 'low';
  completed: boolean;
  type: 'task' | 'meeting' | 'deadline' | 'followup';
}

interface ReminderCardProps {
  title?: string;
  reminders: Reminder[];
  className?: string;
}

const getPriorityColor = (priority: Reminder['priority']) => {
  switch (priority) {
    case 'high':
      return 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300';
    case 'medium':
      return 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300';
    case 'low':
      return 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300';
    default:
      return 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300';
  }
};

const getTypeIcon = (type: Reminder['type']) => {
  switch (type) {
    case 'meeting':
      return <Calendar className="w-4 h-4" />;
    case 'deadline':
      return <AlertCircle className="w-4 h-4" />;
    case 'followup':
      return <Clock className="w-4 h-4" />;
    case 'task':
    default:
      return <CheckCircle className="w-4 h-4" />;
  }
};

const formatDueDate = (dateString?: string) => {
  if (!dateString) return null;

  try {
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = date.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'Hoy';
    if (diffDays === 1) return 'Mañana';
    if (diffDays === -1) return 'Ayer';
    if (diffDays > 0) return `En ${diffDays} días`;
    if (diffDays < 0) return `${Math.abs(diffDays)} días atrasado`;

    return date.toLocaleDateString('es-ES', {
      day: 'numeric',
      month: 'short'
    });
  } catch {
    return null;
  }
};

export function ReminderCard({
  title = "Recordatorios",
  reminders,
  className = ''
}: ReminderCardProps) {
  const pendingReminders = reminders.filter(r => !r.completed);
  const completedReminders = reminders.filter(r => r.completed);

  return (
    <div className={`bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-xl shadow-sm p-4 md:p-6 ${className}`}>
      <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-6">{title}</h3>

      <div className="space-y-4">
        {pendingReminders.length === 0 && completedReminders.length === 0 ? (
          <p className="text-gray-500 dark:text-gray-400 text-center py-4">
            No hay recordatorios
          </p>
        ) : (
          <>
            {/* Pending reminders */}
            {pendingReminders.map((reminder) => (
              <div key={reminder.id} className="flex items-start space-x-3 p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                <div className="text-gray-400 dark:text-gray-500 mt-0.5">
                  {getTypeIcon(reminder.type)}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between mb-2">
                    <h4 className="text-sm font-medium text-gray-900 dark:text-gray-100">
                      {reminder.title}
                    </h4>
                    <div className="flex items-center space-x-2 ml-2 shrink-0">
                      <Badge className={`text-xs ${getPriorityColor(reminder.priority)}`}>
                        {reminder.priority === 'high' ? 'Alta' :
                         reminder.priority === 'medium' ? 'Media' : 'Baja'}
                      </Badge>
                      {reminder.dueDate && (
                        <span className="text-xs text-gray-500 dark:text-gray-400">
                          {formatDueDate(reminder.dueDate)}
                        </span>
                      )}
                    </div>
                  </div>

                  {reminder.description && (
                    <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
                      {reminder.description}
                    </p>
                  )}
                </div>
              </div>
            ))}

            {/* Completed reminders separator */}
            {completedReminders.length > 0 && pendingReminders.length > 0 && (
              <div className="border-t border-gray-100 dark:border-gray-700 pt-4 mt-4">
                <p className="text-xs text-gray-500 dark:text-gray-400 font-medium mb-2">
                  Completados
                </p>
              </div>
            )}

            {/* Completed reminders */}
            {completedReminders.map((reminder) => (
              <div key={reminder.id} className="flex items-start space-x-3 p-3 rounded-lg opacity-60">
                <div className="text-green-500 mt-0.5">
                  <CheckCircle className="w-4 h-4" />
                </div>

                <div className="flex-1 min-w-0">
                  <h4 className="text-sm font-medium text-gray-500 dark:text-gray-400 line-through">
                    {reminder.title}
                  </h4>
                  {reminder.description && (
                    <p className="text-xs text-gray-400 dark:text-gray-500 line-through">
                      {reminder.description}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </>
        )}
      </div>

      {reminders.length > 0 && (
        <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-700">
          <button className="text-sm text-green-600 dark:text-green-400 hover:text-green-700 dark:hover:text-green-300 font-medium">
            Ver todos los recordatorios →
          </button>
        </div>
      )}
    </div>
  );
}
