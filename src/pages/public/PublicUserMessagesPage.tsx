import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { PublicLayout } from '../../components/layout/PublicLayout';
import { useSelector } from 'react-redux';
import { RootState } from '../../store/store';
import { 
  ArrowLeft, 
  MessageSquare, 
  Search,
  
} from 'lucide-react';
import messageService, { Message } from '../../services/MessageService';

export function PublicUserMessagesPage() {
  const user = useSelector((state: RootState) => state.user.profile);
  const navigate = useNavigate();
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    loadMessages();
  }, []);

  const loadMessages = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      // Fetch inbox and sent to show full history
      const [inbox, sent] = await Promise.all([
        messageService.getMessages({ filter: 'inbox', limit: 100, sortBy: 'createdAt_desc' }),
        messageService.getMessages({ filter: 'sent', limit: 100, sortBy: 'createdAt_desc' })
      ]);

      const map = new Map<string, Message>();
      [...(inbox.data || []), ...(sent.data || [])].forEach(m => map.set(m.id, m));
      const merged = Array.from(map.values()).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setMessages(merged);
    } catch (err: any) {
      setError(err.message || 'Error al cargar los mensajes');
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenMessage = async (message: Message) => {
    try {
      if (!message.isRead) {
        // Optimistically mark as read
        setMessages(prev => prev.map(m => m.id === message.id ? { ...m, isRead: true } : m));
        await messageService.markMessageAsRead(message.id);
      }
    } catch {
      // Non-blocking
    } finally {
      if (message.propertyId) {
        const params = new URLSearchParams();
        if (message.threadId) params.set('threadId', message.threadId);
        navigate(`/properties/view/${message.propertyId}${params.toString() ? `?${params.toString()}` : ''}`);
      }
    }
  };

  const filteredMessages = messages.filter(message => 
    message.subject.toLowerCase().includes(searchQuery.toLowerCase()) ||
    message.snippet.toLowerCase().includes(searchQuery.toLowerCase()) ||
    message.senderName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);
    
    if (diffInHours < 24) {
      return date.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
    } else if (diffInHours < 168) { // 7 days
      return date.toLocaleDateString('es-ES', { weekday: 'short' });
    } else {
      return date.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit' });
    }
  };

  return (
    <PublicLayout>
      <div className="min-h-screen bg-gradient-to-b from-[#BEE9E8] to-[#FDFFFC]">
        {/* Header */}
        <div className="bg-white shadow-sm">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
            <div className="flex items-center space-x-4">
              <Link
                to="/welcome"
                className="flex items-center space-x-2 text-[#1B4965] hover:text-[#153a52] transition-colors"
              >
                <ArrowLeft className="w-5 h-5" />
                <span>Volver</span>
              </Link>
              <div className="flex-1">
                <h1 className="text-3xl font-bold text-[#1B4965]">Mis Mensajes</h1>
                <p className="text-gray-600 mt-1">Gestiona tus consultas sobre propiedades</p>
              </div>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {error && (
            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-lg mb-6">
              {error}
            </div>
          )}

          <div className="max-w-3xl mx-auto">
            <div className="bg-white rounded-lg shadow-sm">
              {/* Search */}
              <div className="p-4 border-b">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                  <input
                    type="text"
                    placeholder="Buscar mensajes..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1B4965]"
                  />
                </div>
              </div>

              {/* Messages List */}
              <div className="max-h-[70vh] overflow-y-auto">
                {isLoading ? (
                  <div className="p-8 text-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-[#1B4965] mx-auto"></div>
                    <p className="text-gray-500 mt-2">Cargando mensajes...</p>
                  </div>
                ) : filteredMessages.length === 0 ? (
                  <div className="p-8 text-center text-gray-500">
                    <MessageSquare className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                    <p>No hay mensajes para mostrar</p>
                  </div>
                ) : (
                  filteredMessages.map((message) => {
                    const isSentByMe = user?.id && message.senderId && String(user.id) === String(message.senderId);
                    return (
                      <div
                        key={message.id}
                        onClick={() => handleOpenMessage(message)}
                        className={`p-4 border-b cursor-pointer hover:bg-gray-50 transition-colors ${
                          !message.isRead && !isSentByMe ? 'bg-blue-50' : ''
                        }`}
                      >
                        <div className="flex items-start space-x-3">
                          <div className="flex-shrink-0">
                            <div className="w-10 h-10 bg-[#1B4965] rounded-full flex items-center justify-center">
                              <span className="text-white text-sm font-medium">
                                {message.senderName.charAt(0).toUpperCase()}
                              </span>
                            </div>
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between">
                              <p className={`text-sm font-medium truncate ${
                                !message.isRead && !isSentByMe ? 'text-[#1B4965]' : 'text-gray-900'
                              }`}>
                                {isSentByMe ? 'Tú' : message.senderName}
                              </p>
                              <div className="flex items-center space-x-2">
                                {!message.isRead && !isSentByMe && (
                                  <span className="w-2 h-2 bg-blue-500 rounded-full" />
                                )}
                                <span className="text-xs text-gray-500">
                                  {formatDate(message.createdAt)}
                                </span>
                              </div>
                            </div>
                            <p className={`text-sm truncate ${
                              !message.isRead && !isSentByMe ? 'font-medium text-gray-900' : 'text-gray-700'
                            }`}>
                              {message.subject}
                            </p>
                            <p className="text-xs text-gray-500 truncate">
                              {message.snippet}
                            </p>
                            {message.propertyTitle && (
                              <p className="text-xs text-[#1B4965] mt-1">
                                Re: {message.propertyTitle}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </PublicLayout>
  );
}
