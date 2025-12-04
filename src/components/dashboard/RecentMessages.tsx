import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { UserIcon, CheckCircleIcon, MessageSquareIcon } from 'lucide-react'; // Using MessageSquareIcon for reply
import messageService, { Message } from '../../services/MessageService';
import { formatDistanceToNowStrict } from 'date-fns'; // For "time ago"
import { es } from 'date-fns/locale'; // Spanish locale for date-fns

export function RecentMessages() {
  const queryClient = useQueryClient();

  const { data: messagesData, isLoading, isError, error } = useQuery({
    queryKey: ['recentMessages'],
    queryFn: () => messageService.getMessages({ limit: 6, sortBy: 'createdAt_desc' }),
    select: (response) => response
    // Assumes getMessages returns { data: [messages], ... }
    // And each message has: id, sender: { name }, property: { title }, content, createdAt, isRead, isReplied
  });

  const recentMessages : Message[] = messagesData?.data || [];

  // Example: Mutation for marking as replied (if you have such an API action)
  // This is a placeholder; your "Reply" button might navigate or open a modal.
  const replyMutation = useMutation({
    mutationFn: (messageId: string) => messageService.markMessageAsReplied(messageId), // You'd need this service function
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recentMessages']}); // Refetch messages
    },
    onError: (err) => {
      alert(`Error al marcar como respondido: ${err.message}`);
    }
  });

  const handleReply = (messageId: string) => {
    console.log(`Replying to message ${messageId} - implement actual reply UI`);
  };

  const formatTimeAgo = (dateString: string) => {
    if (!dateString) return '';
    try {
      return formatDistanceToNowStrict(new Date(dateString), { addSuffix: true, locale: es });
    } catch (e) {
      return 'Fecha inválida';
    }
  };

  if (isLoading) return <p className="p-6 text-center">Cargando mensajes...</p>;
  if (isError) return <p className="p-6 text-center text-red-500">Error al cargar mensajes: {error?.message}</p>;

  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-xl shadow-sm p-4 md:p-6">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">Mensajes Recientes</h3>
        <button className="text-sm text-green-600 dark:text-green-400 hover:text-green-700 dark:hover:text-green-300 font-medium">
          Ver todos →
        </button>
      </div>

      {recentMessages.length === 0 && <p className="text-gray-500 dark:text-gray-400 text-center py-4">No hay mensajes recientes.</p>}

      <div className="space-y-4">
        {recentMessages.map((message : Message) => (
          <div key={message.id} className={`p-4 rounded-lg border ${message.isRead ? 'border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-800' : 'border-green-100 dark:border-green-900 bg-green-50 dark:bg-green-900/20'}`}>
            <div className="flex items-start">
              <div className="p-2 bg-gray-100 dark:bg-gray-700 rounded-lg mr-3">
                <UserIcon className="w-4 h-4 text-gray-600 dark:text-gray-400" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-medium text-gray-900 dark:text-gray-100 truncate" title={message.senderName}>
                    {message.senderName || 'Desconocido'}
                  </h4>
                  <span className="text-xs text-gray-500 dark:text-gray-400 shrink-0 ml-2">{formatTimeAgo(message.createdAt)}</span>
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-400 truncate mb-2" title={message.propertyTitle}>
                    Propiedad: {message.propertyTitle || 'N/A'}
                </p>
                <p className="text-sm text-gray-700 dark:text-gray-300 break-words">{message.snippet}</p>
              </div>
            </div>
            <div className="flex justify-end mt-3">
              {message.isReplied ? (
                <span className="text-xs flex items-center text-green-600 dark:text-green-400">
                  <CheckCircleIcon size={14} className="mr-1" />
                  Respondido
                </span>
              ) : (
                <button
                  onClick={() => handleReply(message.id)}
                  disabled={isLoading && replyMutation.variables === message.id}
                  className="text-xs bg-green-600 hover:bg-green-500 text-white px-3 py-1.5 rounded-full transition-colors flex items-center shadow-sm"
                >
                  <MessageSquareIcon size={14} className="mr-1" />
                  Responder
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}