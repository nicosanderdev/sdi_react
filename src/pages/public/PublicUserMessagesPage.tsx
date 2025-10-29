import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { PublicLayout } from '../../components/layout/PublicLayout';
import { useSelector } from 'react-redux';
import { RootState } from '../../store/store';
import { 
  ArrowLeft, 
  MessageSquare, 
  Star, 
  Archive, 
  Trash2, 
  Search,
  Filter,
  Mail,
  MailOpen,
  Clock,
  CheckCircle,
  AlertCircle
} from 'lucide-react';
import messageService, { Message, MessageDetail } from '../../services/MessageService';

export function PublicUserMessagesPage() {
  const user = useSelector((state: RootState) => state.user.profile);
  const [messages, setMessages] = useState<Message[]>([]);
  const [selectedMessage, setSelectedMessage] = useState<MessageDetail | null>(null);
  const [activeTab, setActiveTab] = useState<'inbox' | 'starred' | 'replied' | 'archived'>('inbox');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    loadMessages();
  }, [activeTab]);

  const loadMessages = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const response = await messageService.getMessages({
        filter: activeTab,
        limit: 50
      });
      setMessages(response.data);
    } catch (err: any) {
      setError(err.message || 'Error al cargar los mensajes');
    } finally {
      setIsLoading(false);
    }
  };

  const loadMessageDetail = async (messageId: string) => {
    try {
      const messageDetail = await messageService.getMessageById(messageId);
      setSelectedMessage(messageDetail);
      
      // Mark as read if not already read
      if (!messageDetail.isRead) {
        await messageService.markMessageAsRead(messageId);
        // Refresh messages to update read status
        loadMessages();
      }
    } catch (err: any) {
      setError(err.message || 'Error al cargar el mensaje');
    }
  };

  const handleStarMessage = async (messageId: string, isStarred: boolean) => {
    try {
      if (isStarred) {
        await messageService.unstarMessage(messageId);
      } else {
        await messageService.starMessage(messageId);
      }
      loadMessages();
    } catch (err: any) {
      setError(err.message || 'Error al actualizar el mensaje');
    }
  };

  const handleArchiveMessage = async (messageId: string, isArchived: boolean) => {
    try {
      if (isArchived) {
        await messageService.unarchiveMessage(messageId);
      } else {
        await messageService.archiveMessage(messageId);
      }
      loadMessages();
    } catch (err: any) {
      setError(err.message || 'Error al archivar el mensaje');
    }
  };

  const handleDeleteMessage = async (messageId: string) => {
    if (window.confirm('¿Estás seguro de que quieres eliminar este mensaje?')) {
      try {
        await messageService.deleteMessage(messageId);
        loadMessages();
        if (selectedMessage?.id === messageId) {
          setSelectedMessage(null);
        }
      } catch (err: any) {
        setError(err.message || 'Error al eliminar el mensaje');
      }
    }
  };

  const filteredMessages = messages.filter(message => 
    message.subject.toLowerCase().includes(searchQuery.toLowerCase()) ||
    message.snippet.toLowerCase().includes(searchQuery.toLowerCase()) ||
    message.senderName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getTabCount = (tab: string) => {
    return messages.filter(msg => {
      switch (tab) {
        case 'starred': return msg.isStarred;
        case 'replied': return msg.isReplied;
        case 'archived': return msg.isArchived;
        default: return !msg.isArchived;
      }
    }).length;
  };

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

  const tabs = [
    { id: 'inbox', label: 'Bandeja de entrada', icon: MailOpen },
    { id: 'starred', label: 'Destacados', icon: Star },
    { id: 'replied', label: 'Respondidos', icon: CheckCircle },
    { id: 'archived', label: 'Archivados', icon: Archive }
  ] as const;

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

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Messages List */}
            <div className="lg:col-span-1">
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

                {/* Tabs */}
                <div className="border-b">
                  <nav className="flex">
                    {tabs.map((tab) => {
                      const Icon = tab.icon;
                      const count = getTabCount(tab.id);
                      return (
                        <button
                          key={tab.id}
                          onClick={() => setActiveTab(tab.id)}
                          className={`flex-1 flex items-center justify-center space-x-2 py-3 px-4 text-sm font-medium border-b-2 transition-colors ${
                            activeTab === tab.id
                              ? 'border-[#1B4965] text-[#1B4965] bg-blue-50'
                              : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                          }`}
                        >
                          <Icon className="w-4 h-4" />
                          <span>{tab.label}</span>
                          {count > 0 && (
                            <span className="bg-gray-200 text-gray-600 text-xs px-2 py-1 rounded-full">
                              {count}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </nav>
                </div>

                {/* Messages List */}
                <div className="max-h-96 overflow-y-auto">
                  {isLoading ? (
                    <div className="p-8 text-center">
                      <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-[#1B4965] mx-auto"></div>
                      <p className="text-gray-500 mt-2">Cargando mensajes...</p>
                    </div>
                  ) : filteredMessages.length === 0 ? (
                    <div className="p-8 text-center text-gray-500">
                      <MessageSquare className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                      <p>No hay mensajes en esta categoría</p>
                    </div>
                  ) : (
                    filteredMessages.map((message) => (
                      <div
                        key={message.id}
                        onClick={() => loadMessageDetail(message.id)}
                        className={`p-4 border-b cursor-pointer hover:bg-gray-50 transition-colors ${
                          selectedMessage?.id === message.id ? 'bg-blue-50 border-l-4 border-l-[#1B4965]' : ''
                        } ${!message.isRead ? 'bg-blue-50' : ''}`}
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
                                !message.isRead ? 'text-[#1B4965]' : 'text-gray-900'
                              }`}>
                                {message.senderName}
                              </p>
                              <div className="flex items-center space-x-1">
                                {message.isStarred && (
                                  <Star className="w-4 h-4 text-yellow-500 fill-current" />
                                )}
                                {!message.isRead && (
                                  <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                                )}
                                <span className="text-xs text-gray-500">
                                  {formatDate(message.createdAt)}
                                </span>
                              </div>
                            </div>
                            <p className={`text-sm truncate ${
                              !message.isRead ? 'font-medium text-gray-900' : 'text-gray-600'
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
                    ))
                  )}
                </div>
              </div>
            </div>

            {/* Message Detail */}
            <div className="lg:col-span-2">
              {selectedMessage ? (
                <div className="bg-white rounded-lg shadow-sm">
                  {/* Message Header */}
                  <div className="p-6 border-b">
                    <div className="flex items-start justify-between">
                      <div className="flex items-start space-x-4">
                        <div className="w-12 h-12 bg-[#1B4965] rounded-full flex items-center justify-center">
                          <span className="text-white text-lg font-medium">
                            {selectedMessage.senderName.charAt(0).toUpperCase()}
                          </span>
                        </div>
                        <div>
                          <h2 className="text-xl font-semibold text-[#1B4965]">
                            {selectedMessage.subject}
                          </h2>
                          <p className="text-gray-600">
                            De: {selectedMessage.senderName}
                            {selectedMessage.senderEmail && (
                              <span className="text-gray-500"> ({selectedMessage.senderEmail})</span>
                            )}
                          </p>
                          {selectedMessage.propertyTitle && (
                            <p className="text-sm text-[#1B4965] mt-1">
                              Propiedad: {selectedMessage.propertyTitle}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => handleStarMessage(selectedMessage.id, selectedMessage.isStarred)}
                          className={`p-2 rounded-lg transition-colors ${
                            selectedMessage.isStarred
                              ? 'text-yellow-500 bg-yellow-50'
                              : 'text-gray-400 hover:text-yellow-500 hover:bg-yellow-50'
                          }`}
                        >
                          <Star className={`w-5 h-5 ${selectedMessage.isStarred ? 'fill-current' : ''}`} />
                        </button>
                        <button
                          onClick={() => handleArchiveMessage(selectedMessage.id, selectedMessage.isArchived)}
                          className="p-2 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
                        >
                          <Archive className="w-5 h-5" />
                        </button>
                        <button
                          onClick={() => handleDeleteMessage(selectedMessage.id)}
                          className="p-2 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                        >
                          <Trash2 className="w-5 h-5" />
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Message Content */}
                  <div className="p-6">
                    <div className="prose max-w-none">
                      <p className="text-gray-800 whitespace-pre-wrap">
                        {selectedMessage.fullBody}
                      </p>
                    </div>
                  </div>

                  {/* Message Footer */}
                  <div className="p-6 border-t bg-gray-50">
                    <div className="flex items-center justify-between text-sm text-gray-500">
                      <div className="flex items-center space-x-4">
                        <span>
                          Enviado: {new Date(selectedMessage.createdAt).toLocaleString('es-ES')}
                        </span>
                        {selectedMessage.isReplied && (
                          <span className="flex items-center space-x-1 text-green-600">
                            <CheckCircle className="w-4 h-4" />
                            <span>Respondido</span>
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="bg-white rounded-lg shadow-sm p-12 text-center">
                  <MessageSquare className="w-16 h-16 mx-auto mb-4 text-gray-300" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">
                    Selecciona un mensaje
                  </h3>
                  <p className="text-gray-500">
                    Elige un mensaje de la lista para ver su contenido completo
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </PublicLayout>
  );
}
