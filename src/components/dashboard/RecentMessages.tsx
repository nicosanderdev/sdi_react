import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { UserIcon, CheckCircleIcon, MessageSquareIcon } from 'lucide-react'; // Using MessageSquareIcon for reply
import messageService, { Message } from '../../services/MessageService';
import { formatDistanceToNowStrict } from 'date-fns'; // For "time ago"
import { es } from 'date-fns/locale'; // Spanish locale for date-fns
import { Card } from 'flowbite-react';
import { IconWrapper } from '../ui/IconWrapper';

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
    <Card>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold">Mensajes Recientes</h2>
        <button className="text-sm font-medium hover:underline">
          Ver todos
        </button>
      </div>
      {recentMessages.length === 0 && <p className="text-gray-500">No hay mensajes recientes.</p>}
      <div className="space-y-4">
        {recentMessages.map((message : Message) => (
          <Card key={message.id} className={`${message.isRead ? '' : '!bg-primary-100 !dark:bg-gray-700'}`}>
            <div className="flex items-start">
              <IconWrapper icon={UserIcon} size={26} className="mr-3" />
              <div className="flex-1 min-w-0"> {/* Added min-w-0 for flex truncation */}
                <div className="flex items-center justify-between">
                  <h3 className="font-medium truncate" title={message.senderName}>
                    {message.senderName || 'Desconocido'}
                  </h3>
                  <span className="text-xs shrink-0 ml-2">{formatTimeAgo(message.createdAt)}</span>
                </div>
                <p className="text-sm mt-1 truncate" title={message.propertyTitle}>
                    Propiedad: {message.propertyTitle || 'N/A'}
                </p>
                <p className="text-sm mt-1 break-words">{message.snippet}</p> {/* Use break-words for long messages */}
              </div>
            </div>
            <div className="flex justify-end mt-2">
              {message.isReplied ? (
                <span className="text-xs flex items-center text-green-600">
                  <CheckCircleIcon size={14} className="mr-1" />
                  Respondido
                </span>
              ) : (
                <button
                  onClick={() => handleReply(message.id)}
                  disabled={isLoading && replyMutation.variables === message.id}
                  className="text-xs bg-[#62B6CB] text-[#FDFFFC] px-3 py-1 rounded-md hover:bg-[#539BAF] transition-colors flex items-center"
                >
                  <MessageSquareIcon size={14} className="mr-1" />
                  Responder
                </button>
              )}
            </div>
          </Card>
        ))}
      </div>
    </Card>
  );
}