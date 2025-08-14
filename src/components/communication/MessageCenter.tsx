// src/components/MessageCenter.tsx
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  SearchIcon, UserIcon, CheckCircleIcon, ArchiveIcon, TrashIcon, StarIcon,
  Loader2Icon, AlertTriangleIcon, SendIcon, ChevronLeftIcon, ChevronRightIcon, InboxIcon
} from 'lucide-react';
import messageService, { Message, MessageDetail, TabCounts, GetMessagesParams } from '../../services/MessageService';
import { formatRelativeTime } from '../../utils/TimeUtils';

const ITEMS_PER_PAGE = 15; // Or get from config/props

const TABS_CONFIG = [
  { id: 'inbox', label: 'Bandeja de entrada', icon: <InboxIcon size={18} /> },
  { id: 'starred', label: 'Destacados', icon: <StarIcon size={18} /> },
  { id: 'replied', label: 'Respondidos', icon: <CheckCircleIcon size={18} /> },
  { id: 'archived', label: 'Archivados', icon: <ArchiveIcon size={18} /> },
  { id: 'sent', label: 'Enviados', icon: <SendIcon size={18} /> },
  { id: 'trash', label: 'Papelera', icon: <TrashIcon size={18} /> },
];


export function MessageCenter() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [selectedMessage, setSelectedMessage] = useState<MessageDetail | null>(null);
  const [tabCounts, setTabCounts] = useState<TabCounts>({});

  const [activeTab, setActiveTab] = useState<string>('inbox');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState<string>('');

  const [replyText, setReplyText] = useState<string>('');

  const [currentPage, setCurrentPage] = useState<number>(1);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [totalMessages, setTotalMessages] = useState<number>(0);

  const [isLoadingList, setIsLoadingList] = useState<boolean>(true);
  const [isLoadingDetail, setIsLoadingDetail] = useState<boolean>(false);
  const [isSendingReply, setIsSendingReply] = useState<boolean>(false);

  const [listError, setListError] = useState<string | null>(null);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [replyError, setReplyError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const filteredMessages = useMemo(() => {
    const trimmedSearch = searchTerm.trim().toLowerCase();
    if (!trimmedSearch) {
      return messages;
    }
    return messages.filter(message =>
      message.senderName.toLowerCase().includes(trimmedSearch)
    );
  }, [messages, searchTerm]);

  // Debounce search term
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
      setCurrentPage(1); // Reset to first page on new search
    }, 500);
    return () => clearTimeout(handler);
  }, [searchTerm]);

  const fetchMessageCounts = useCallback(async () => {
    try {
      const counts = await messageService.getMessageCounts();
      setTabCounts(counts);
    } catch (error) {
      console.error("Failed to fetch message counts", error);
      // Potentially set an error state for counts
    }
  }, []);

  const fetchMessages = useCallback(async () => {
    setIsLoadingList(true);
    setListError(null);
    setActionError(null);
    const params: GetMessagesParams = {
      page: currentPage,
      limit: ITEMS_PER_PAGE,
      filter: activeTab, // Backend handles mapping 'inbox', 'starred', etc.
      query: debouncedSearchTerm || undefined,
      sortBy: 'createdAt_desc',
    };
    try {
      const response = await messageService.getMessages(params);
      setMessages(response.data);
      setTotalMessages(response.total);
      setTotalPages(response.totalPages);
    } catch (error: any) {
      setListError(error.message || 'Failed to load messages.');
      setMessages([]); // Clear messages on error
    } finally {
      setIsLoadingList(false);
    }
  }, [activeTab, debouncedSearchTerm, currentPage]);

  useEffect(() => {
    fetchMessageCounts();
  }, [fetchMessageCounts]);

  useEffect(() => {
    fetchMessages();
  }, [fetchMessages]); // Depends on activeTab, debouncedSearchTerm, currentPage

  const handleSelectMessage = useCallback(async (messageToList: Message) => {
    if (selectedMessage?.id === messageToList.id) { // Reselecting same message, maybe just ensure it's marked read
      if (!messageToList.isRead) {
        try {
          await messageService.markMessageAsRead(messageToList.id);
          setMessages(prev => prev.map(m => m.id === messageToList.id ? { ...m, isRead: true } : m));
          fetchMessageCounts(); // Update unread count
        } catch (error) { console.error("Error marking as read on reselect", error); }
      }
      return;
    }

    setSelectedMessage(null);
    setIsLoadingDetail(true);
    setDetailError(null);
    setActionError(null);
    setReplyText('');
    try {
      const detailedMsg = await messageService.getMessageById(messageToList.id);
      setSelectedMessage(detailedMsg);
      if (!detailedMsg.isRead) {
        // Optimistically update in list then call API
        setMessages(prev => prev.map(m => m.id === detailedMsg.id ? { ...m, isRead: true } : m));
        await messageService.markMessageAsRead(detailedMsg.id);
        fetchMessageCounts(); // Update unread count
      }
    } catch (error: any) {
      setDetailError(error.message || 'Failed to load message details.');
    } finally {
      setIsLoadingDetail(false);
    }
  }, [selectedMessage, fetchMessageCounts]);

  const handleToggleStar = async (e: React.MouseEvent, msg: MessageDetail | Message) => {
    e.stopPropagation(); // Prevent selecting message if clicking star on list item
    if (!msg) return;
    setActionError(null);
    const currentlyStarred = msg.isStarred;
    const optimisticUpdate = (starred: boolean) => {
      if (selectedMessage?.id === msg.id) setSelectedMessage(prev => prev ? { ...prev, isStarred: starred } : null);
      setMessages(prevMsgs => prevMsgs.map(m => m.id === msg.id ? { ...m, isStarred: starred } : m));
      fetchMessageCounts();
    };

    optimisticUpdate(!currentlyStarred); // Optimistic UI update

    try {
      if (currentlyStarred) {
        await messageService.unstarMessage(msg.id);
      } else {
        await messageService.starMessage(msg.id);
      }
      // fetchMessageCounts(); // Already called in optimistic update
    } catch (error: any) {
      setActionError(error.message || `Failed to ${currentlyStarred ? 'unstar' : 'star'} message.`);
      optimisticUpdate(currentlyStarred); // Revert on error
    }
  };

  const handleToggleArchive = async (e: React.MouseEvent, msg: MessageDetail | Message) => {
    e.stopPropagation();
    if (!msg) return;
    setActionError(null);
    const currentlyArchived = msg.isArchived;
    const optimisticUpdate = (archived: boolean) => {
      if (selectedMessage?.id === msg.id) setSelectedMessage(prev => prev ? { ...prev, isArchived: archived } : null);

      // If archiving from inbox, or unarchiving to inbox, list might change
      if (activeTab === 'inbox' && archived) {
        setMessages(prevMsgs => prevMsgs.filter(m => m.id !== msg.id));
      } else if (activeTab === 'archived' && !archived) {
        setMessages(prevMsgs => prevMsgs.filter(m => m.id !== msg.id));
      } else {
        setMessages(prevMsgs => prevMsgs.map(m => m.id === msg.id ? { ...m, isArchived: archived } : m));
      }
      if (selectedMessage?.id === msg.id && archived && activeTab !== 'archived') {
        setSelectedMessage(null); // Clear detail if archived from non-archive view
      }
      fetchMessageCounts();
    };

    optimisticUpdate(!currentlyArchived);

    try {
      if (currentlyArchived) {
        await messageService.unarchiveMessage(msg.id);
      } else {
        await messageService.archiveMessage(msg.id);
      }
      // Refetch if current tab integrity depends on archive state strongly
      if ((activeTab === 'inbox' && !currentlyArchived) || (activeTab === 'archived' && currentlyArchived)) {
        // If item removed from list, refetch could be an option or rely on optimistic update
      }
    } catch (error: any) {
      setActionError(error.message || `Failed to ${currentlyArchived ? 'unarchive' : 'archive'} message.`);
      optimisticUpdate(currentlyArchived); // Revert
    }
  };

  const handleDeleteMessage = async (e: React.MouseEvent, msg: MessageDetail | Message) => {
    e.stopPropagation();
    if (!msg || !window.confirm(`Are you sure you want to delete the message: "${msg.subject}"?`)) return;
    setActionError(null);
    try {
      await messageService.deleteMessage(msg.id);
      setMessages(prevMsgs => prevMsgs.filter(m => m.id !== msg.id));
      if (selectedMessage?.id === msg.id) setSelectedMessage(null);
      fetchMessageCounts();
      // fetchMessages(); // Or refetch the current list
    } catch (error: any) {
      setActionError(error.message || 'Failed to delete message.');
    }
  };

  const handleSendReply = async () => {
    if (!selectedMessage || !replyText.trim()) return;
    setIsSendingReply(true);
    setReplyError(null);
    setActionError(null);
    try {
      const replyData = {
        recipientId: selectedMessage.senderId || '',
        subject: `Re: ${selectedMessage.subject}`,
        body: replyText,
        inReplyToMessageId: selectedMessage.id,
        threadId: selectedMessage.threadId,
        propertyId: selectedMessage.propertyId,
      };
      if (!replyData.recipientId) {
        throw new Error("Cannot determine recipient ID for the reply.");
      }

      await messageService.sendMessage(replyData);
      // Mark original message as replied
      await messageService.markMessageAsReplied(selectedMessage.id);

      setSelectedMessage(prev => prev ? { ...prev, isReplied: true } : null);
      setMessages(prevMsgs => prevMsgs.map(m => m.id === selectedMessage.id ? { ...m, isReplied: true } : m));
      setReplyText('');
      fetchMessageCounts();
      // Optionally, display the sent reply or a success message
    } catch (error: any) {
      setReplyError(error.message || 'Failed to send reply.');
    } finally {
      setIsSendingReply(false);
    }
  };

  const currentTabLabel = useMemo(() => TABS_CONFIG.find(t => t.id === activeTab)?.label || 'Mensajes', [activeTab]);

  return (
    <div>
      <h1 className="text-2xl font-bold text-[#1B4965] mb-6">Centro de Mensajes</h1>
      <div className="bg-[#FDFFFC] rounded-lg shadow-sm border border-gray-100 overflow-hidden">
        <div className="flex flex-col md:flex-row h-full min-h-[700px]">
          {/* Sidebar */}
          <div className="w-full md:w-72 border-r border-gray-200 bg-gray-50/50 flex flex-col">
            <div className="p-4">
              <div className="relative">
                <input
                  type="text"
                  placeholder="Buscar mensajes..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 pr-4 py-2 w-full border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#62B6CB]"
                />
                <SearchIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
              </div>
            </div>
            <nav className="mt-1 flex-grow">
              {TABS_CONFIG.map(tab => (
                <button
                  key={tab.id}
                  onClick={() => { setActiveTab(tab.id); setCurrentPage(1); setSelectedMessage(null); }}
                  className={`flex items-center justify-between w-full px-4 py-3 text-left transition-colors duration-150 ${activeTab === tab.id ? 'bg-[#BEE9E8]/50 border-r-2 border-[#62B6CB]' : 'hover:bg-gray-100'
                    }`}
                >
                  <div className="flex items-center">
                    <span className={`mr-3 ${activeTab === tab.id ? 'text-[#1B4965]' : 'text-gray-500'}`}>{tab.icon}</span>
                    <span className={`${activeTab === tab.id ? 'font-semibold text-[#1B4965]' : 'text-gray-700'}`}>
                      {tab.label}
                    </span>
                  </div>
                  {tabCounts[tab.id] !== undefined && tabCounts[tab.id]! > 0 && (
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${activeTab === tab.id ? 'bg-[#62B6CB] text-white' : 'bg-gray-200 text-gray-600'
                      }`}>
                      {tabCounts[tab.id]}
                    </span>
                  )}
                </button>
              ))}
            </nav>
          </div>

          {/* Messages list and detail */}
          <div className="flex-1 flex flex-col md:flex-row overflow-hidden">

            {/* Messages list */}
            <div className={`w-full ${selectedMessage !== null ? 'hidden md:flex' : 'flex'} md:w-1/2 lg:w-2/5 border-r border-gray-200 flex-col max-h-full`}>
              <div className="p-4 border-b border-gray-200 flex justify-between items-center flex-shrink-0">
                <h2 className="font-semibold text-[#1B4965] text-lg">{currentTabLabel}</h2>
                <div className="text-sm text-gray-500">
                  {totalMessages > 0 ? `${(currentPage - 1) * ITEMS_PER_PAGE + 1}-${Math.min(currentPage * ITEMS_PER_PAGE, totalMessages)} de ${totalMessages}` : '0 mensajes'}
                </div>
              </div>

              {listError && <div className="p-4 text-red-600 bg-red-50 text-center">{listError}</div>}
              {actionError && <div className="p-2 text-xs text-red-600 bg-red-50 text-center sticky top-0 z-10">{actionError}</div>}

              {/* Message detail */}
              {isLoadingList ? (
                <div className="flex-1 flex items-center justify-center">
                  <Loader2Icon size={32} className="text-[#62B6CB] animate-spin" />
                </div>
              ) : messages.length === 0 && !listError ? (
                <div className="flex-1 flex flex-col items-center justify-center text-gray-500 p-4">
                  <InboxIcon size={48} className="mb-3 text-gray-400" />
                  <p>No hay mensajes en {currentTabLabel.toLowerCase()}.</p>
                </div>
              ) : filteredMessages.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center text-gray-500 p-4 text-center">
                  <SearchIcon size={48} className="mb-3 text-gray-400" />
                  <p className="font-medium">No se encontraron resultados</p>
                  <p className="text-sm">Ningún mensaje en esta página coincide con tu búsqueda.</p>
                </div>
              ) : (
                <div className="overflow-y-auto flex-grow">
                  {filteredMessages.map(message => (
                    <div
                      key={message.id}
                      onClick={() => handleSelectMessage(message)}
                      className={`p-4 border-b border-gray-200 cursor-pointer relative group transition-colors duration-150 ${!message.isRead ? 'bg-[#E0F7FA]/60' : '' // Light cyan for unread
                        } ${selectedMessage?.id === message.id ? 'bg-[#CAE9FF]' : 'hover:bg-gray-50'}`}
                    >
                      {!message.isRead && (
                        <span className="absolute top-3 left-2 w-2 h-2 bg-[#62B6CB] rounded-full" title="No leído"></span>
                      )}
                      <div className="flex items-start">
                        <div className={`flex-shrink-0 h-10 w-10 rounded-full bg-[#CAE9FF] flex items-center justify-center text-[#1B4965] mr-3 ${!message.isRead ? 'ring-2 ring-[#62B6CB]' : ''}`}>
                          <UserIcon size={20} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <h3 className={`text-sm font-semibold ${!message.isRead ? 'text-[#103A53]' : 'text-[#1B4965]'}`}>
                              {message.senderName}
                            </h3>
                            <span className="text-xs text-gray-500 whitespace-nowrap ml-2">
                              {formatRelativeTime(message.createdAt)}
                            </span>
                          </div>
                          {message.propertyTitle &&
                            <p className="text-xs text-gray-500 mt-0.5 truncate" title={message.propertyTitle}>
                              Propiedad: {message.propertyTitle}
                            </p>}
                          <p className={`text-sm mt-0.5 truncate ${!message.isRead ? 'text-black font-medium' : 'text-gray-700'}`} title={message.subject}>
                            {message.subject}
                          </p>
                          <p className="text-xs text-gray-500 mt-0.5 truncate" title={message.snippet}>
                            {message.snippet}
                          </p>
                        </div>
                      </div>
                      <div className="flex justify-end items-center mt-2 space-x-2">
                        {message.isStarred && (
                          <button onClick={(e) => handleToggleStar(e, message)} title="Quitar destacado" className="p-1 text-yellow-500 hover:text-yellow-600">
                            <StarIcon size={16} fill="currentColor" />
                          </button>
                        )}
                        {!message.isStarred && (
                          <button onClick={(e) => handleToggleStar(e, message)} title="Destacar" className="p-1 text-gray-400 hover:text-yellow-500 group-hover:opacity-100 opacity-0  focus:opacity-100 transition-opacity">
                            <StarIcon size={16} />
                          </button>
                        )}
                        {message.isReplied && (
                          <span title="Respondido">
                            <CheckCircleIcon size={16} className="text-green-600" />
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Pagination */}
              {totalPages > 1 && !isLoadingList && messages.length > 0 && (
                <div className="p-3 border-t border-gray-200 flex justify-between items-center flex-shrink-0">
                  <button
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="p-2 text-gray-500 hover:text-[#1B4965] disabled:opacity-50 rounded-md hover:bg-gray-100"
                  >
                    <ChevronLeftIcon size={20} />
                  </button>
                  <span className="text-sm text-gray-600">Página {currentPage} de {totalPages}</span>
                  <button
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                    className="p-2 text-gray-500 hover:text-[#1B4965] disabled:opacity-50 rounded-md hover:bg-gray-100"
                  >
                    <ChevronRightIcon size={20} />
                  </button>
                </div>
              )}
            </div>

            {/* Message detail */}
            <div className="flex-1 flex flex-col bg-white max-h-full">
              {isLoadingDetail ? (
                <div className="flex-1 flex items-center justify-center">
                  <Loader2Icon size={32} className="text-[#62B6CB] animate-spin" />
                </div>
              ) : selectedMessage ? (
                <>
                  <div className="p-4 md:p-6 border-b border-gray-200 flex-shrink-0">
                    <div className="flex justify-between items-center mb-1">
                      <button onClick={() => setSelectedMessage(null)} className="md:hidden p-2 -ml-2 text-gray-500 hover:text-[#1B4965]">
                        <ChevronLeftIcon size={20} /> Volver
                      </button>
                      <div className="flex space-x-1">
                        <button onClick={(e) => handleToggleStar(e, selectedMessage)} title={selectedMessage.isStarred ? "Quitar Destacado" : "Destacar"} className={`p-2 rounded-md hover:bg-gray-100 transition-colors ${selectedMessage.isStarred ? 'text-yellow-500' : 'text-gray-500 hover:text-yellow-500'}`}>
                          {selectedMessage.isStarred ? <StarIcon size={20} fill="currentColor" /> : <StarIcon size={20} />}
                        </button>
                        <button onClick={(e) => handleToggleArchive(e, selectedMessage)} title={selectedMessage.isArchived ? "Desarchivar" : "Archivar"} className="p-2 text-gray-500 hover:text-[#1B4965] rounded-md hover:bg-gray-100 transition-colors">
                          <ArchiveIcon size={20} />
                        </button>
                        <button onClick={(e) => handleDeleteMessage(e, selectedMessage)} title="Eliminar" className="p-2 text-gray-500 hover:text-red-500 rounded-md hover:bg-gray-100 transition-colors">
                          <TrashIcon size={20} />
                        </button>
                      </div>
                    </div>
                    <h1 className="text-xl font-semibold text-[#1B4965] mb-2">
                      {selectedMessage.subject}
                    </h1>
                    <div className="flex items-center mb-3">
                      <div className="flex-shrink-0 h-10 w-10 rounded-full bg-[#CAE9FF] flex items-center justify-center text-[#1B4965] mr-3">
                        <UserIcon size={20} />
                      </div>
                      <div>
                        <div className="font-medium text-[#1B4965]">{selectedMessage.senderName}</div>
                        {selectedMessage.senderEmail && <div className="text-sm text-gray-500">&lt;{selectedMessage.senderEmail}&gt;</div>}
                      </div>
                      <div className="ml-auto text-sm text-gray-500">{formatRelativeTime(selectedMessage.createdAt)}</div>
                    </div>
                    {selectedMessage.propertyTitle &&
                      <div className="text-sm text-gray-600 mb-3 p-2 bg-gray-50 rounded-md border">
                        Relacionado con la propiedad: <span className="font-medium">{selectedMessage.propertyTitle}</span>
                      </div>}
                  </div>
                  <div className="p-4 md:p-6 text-gray-700 leading-relaxed overflow-y-auto flex-grow whitespace-pre-wrap">
                    {selectedMessage.fullBody}
                  </div>

                  <div className="p-4 md:p-6 border-t border-gray-200 flex-shrink-0 bg-gray-50/70">
                    <h2 className="font-medium text-[#1B4965] mb-3">Responder a {selectedMessage.senderName}</h2>
                    {replyError && <p className="text-sm text-red-500 mb-2">{replyError}</p>}
                    <textarea
                      placeholder="Escribe tu respuesta aquí..."
                      value={replyText}
                      onChange={(e) => setReplyText(e.target.value)}
                      className="w-full border border-gray-300 rounded-lg p-3 focus:outline-none focus:ring-1 focus:ring-[#62B6CB]"
                      rows={4}
                      disabled={isSendingReply}
                    ></textarea>
                    <div className="flex justify-end mt-3">
                      <button
                        onClick={handleSendReply}
                        disabled={isSendingReply || !replyText.trim()}
                        className="bg-[#62B6CB] text-[#FDFFFC] px-5 py-2.5 rounded-md hover:opacity-90 transition-opacity disabled:opacity-60 flex items-center font-medium"
                      >
                        {isSendingReply ? <Loader2Icon size={18} className="animate-spin mr-2" /> : <SendIcon size={16} className="mr-2" />}
                        Enviar Respuesta
                      </button>
                    </div>
                  </div>
                </>
              ) : detailError ? (
                <div className="flex-1 flex flex-col items-center justify-center p-6 text-red-500 bg-red-50">
                  <AlertTriangleIcon size={40} className="mb-3" />
                  <p className="font-medium">Error al cargar el mensaje</p>
                  <p className="text-sm">{detailError}</p>
                </div>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center p-6 text-gray-500 bg-gray-50/30">
                  <InboxIcon size={48} className="mb-4 text-gray-400" />
                  <p>Selecciona un mensaje para ver los detalles.</p>
                  <p className="text-sm">O comienza una nueva conversación.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}