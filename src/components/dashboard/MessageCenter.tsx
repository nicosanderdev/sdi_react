import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  SearchIcon, UserIcon, CheckCircleIcon, ArchiveIcon, TrashIcon, StarIcon,
  Loader2Icon, AlertTriangleIcon, SendIcon, ChevronLeftIcon, ChevronRightIcon, InboxIcon, ExternalLinkIcon
} from 'lucide-react';
import messageService, { Message, MessageDetail, TabCounts, GetMessagesParams } from '../../services/MessageService';
import { formatRelativeTime } from '../../utils/TimeUtils';
import DashboardPageTitle from './DashboardPageTitle';
import { Card } from 'flowbite-react';
import { IconWrapper } from '../ui/IconWrapper';

const ITEMS_PER_PAGE = 15; // Or get from config/props

const TABS_CONFIG = [
  { id: 'inbox', label: 'Bandeja de entrada', icon: <InboxIcon size={18} /> },
  { id: 'starred', label: 'Destacados', icon: <StarIcon size={18} /> },
  { id: 'archived', label: 'Archivados', icon: <ArchiveIcon size={18} /> },
  { id: 'sent', label: 'Enviados', icon: <SendIcon size={18} /> },
  { id: 'trash', label: 'Papelera', icon: <TrashIcon size={18} /> },
];


export function MessageCenter() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [selectedMessage, setSelectedMessage] = useState<MessageDetail | null>(null);
  const [threadMessages, setThreadMessages] = useState<MessageDetail[]>([]);
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

  const filteredMessages = messages;

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
      
      if (response.data.length === 0 && currentPage > 1 && response.totalPages > 0) {
        setCurrentPage(prev => Math.max(1, prev - 1));
      }
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
  }, [fetchMessages]);

  const handleSelectMessage = useCallback(async (messageToList: Message) => {
    if (selectedMessage?.id === messageToList.id) { // Reselecting same message, maybe just ensure it's marked read
      if (!messageToList.isRead) {
        try {
          await messageService.markMessageAsRead(messageToList.id);
          setMessages(prev => prev.map(m => m.id === messageToList.id ? { ...m, isRead: true } : m));
          await fetchMessageCounts();
        } catch (error) { console.error("Error marking as read on reselect", error); }
      }
      return;
    }

    setSelectedMessage(null);
    setThreadMessages([]);
    setIsLoadingDetail(true);
    setDetailError(null);
    setActionError(null);
    setReplyText('');
    try {
      const detailedMsg = await messageService.getMessageById(messageToList.id);
      setSelectedMessage(detailedMsg);
    
      let thread: MessageDetail[] = [];
      if (detailedMsg.threadId) {
        try {
          thread = await messageService.getMessagesByThreadId(detailedMsg.threadId);
          thread.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
        } catch (threadError: any) {
          console.error("Error fetching thread messages:", threadError);
          // If thread fetch fails, just show the single message
          thread = [detailedMsg];
        }
      } else {
        thread = [detailedMsg];
      }
      
      setThreadMessages(thread);
      
      if (!detailedMsg.isRead) {
        // Optimistically update in list then call API
        setMessages(prev => prev.map(m => m.id === detailedMsg.id ? { ...m, isRead: true } : m));
        await messageService.markMessageAsRead(detailedMsg.id);
        await fetchMessageCounts();
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
    };

    optimisticUpdate(!currentlyStarred); // Optimistic UI update

    try {
      if (currentlyStarred) {
        await messageService.unstarMessage(msg.id);
      } else {
        await messageService.starMessage(msg.id);
      }
      // Update counts after successful API call
      await fetchMessageCounts();
    } catch (error: any) {
      setActionError(error.message || `Failed to ${currentlyStarred ? 'unstar' : 'star'} message.`);
      optimisticUpdate(currentlyStarred); // Revert on error
    }
  };

  const handleMarkAsUnread = async (e: React.MouseEvent, msg: MessageDetail | Message) => {
    e.stopPropagation();
    if (!msg || !msg.isRead) return;
    setActionError(null);
    try {
      await messageService.markMessageAsUnread(msg.id);
      if (selectedMessage?.id === msg.id) {
        setSelectedMessage(prev => prev ? { ...prev, isRead: false } : null);
      }
      setMessages(prevMsgs => prevMsgs.map(m => m.id === msg.id ? { ...m, isRead: false } : m));
      await fetchMessageCounts();
    } catch (error: any) {
      setActionError(error.message || 'Failed to mark message as unread.');
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
        setThreadMessages([]);
      }
    };

    optimisticUpdate(!currentlyArchived);

    try {
      if (currentlyArchived) {
        await messageService.unarchiveMessage(msg.id);
      } else {
        await messageService.archiveMessage(msg.id);
      }
      // Update counts after successful API call
      await fetchMessageCounts();
      
      // If message was removed from current view, refetch to maintain pagination consistency
      const shouldRefetch = (activeTab === 'inbox' && !currentlyArchived) || (activeTab === 'archived' && currentlyArchived);
      if (shouldRefetch) {
        await fetchMessages();
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
    const previousMessages = messages;
    const previousPage = currentPage;
    try {
      await messageService.deleteMessage(msg.id);
      setMessages(prevMsgs => prevMsgs.filter(m => m.id !== msg.id));
      if (selectedMessage?.id === msg.id) {
        setSelectedMessage(null);
        setThreadMessages([]);
      }
      await fetchMessageCounts();
      // Refetch messages to maintain pagination consistency
      await fetchMessages();
      // If current page becomes empty after refetch, adjust to previous page
      // This will be handled by the useEffect that watches messages length
    } catch (error: any) {
      setActionError(error.message || 'Failed to delete message.');
      // Revert optimistic update on error
      setMessages(previousMessages);
      setCurrentPage(previousPage);
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
      setSelectedMessage(prev => prev ? { ...prev, isReplied: true } : null);
      setMessages(prevMsgs => prevMsgs.map(m => m.id === selectedMessage.id ? { ...m, isReplied: true } : m));
      setReplyText('');
      await fetchMessageCounts();
      
      if (selectedMessage.threadId) {
        try {
          const updatedThread = await messageService.getMessagesByThreadId(selectedMessage.threadId);
          updatedThread.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
          setThreadMessages(updatedThread);
        } catch (threadError) {
          console.error("Error refreshing thread after reply:", threadError);
        }
      } else {
        try {
          const refreshedMsg = await messageService.getMessageById(selectedMessage.id);
          setSelectedMessage(refreshedMsg);
          setThreadMessages([refreshedMsg]);
        } catch (error) {
          console.error("Error refreshing message after reply:", error);
        }
      }
    } catch (error: any) {
      setReplyError(error.message || 'Failed to send reply.');
    } finally {
      setIsSendingReply(false);
    }
  };

  const currentTabLabel = useMemo(() => TABS_CONFIG.find(t => t.id === activeTab)?.label || 'Mensajes', [activeTab]);

  return (
    <div>
      <DashboardPageTitle title="Centro de Mensajes" />
      <Card>
        <div className="flex flex-col md:flex-row h-full min-h-[700px]">
          
          {/* Sidebar */}
          <div className="w-full md:w-72 border-r border-gray-200 dark:border-gray-700 flex flex-col">
            <div className="p-4">
              <div className="relative">
                <input
                  type="text"
                  placeholder="Buscar mensajes..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 pr-4 py-2 w-full border border-primary-200 dark:border-primary-800 rounded-lg focus:outline-none focus:ring-1 focus:ring-green-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                />
                <SearchIcon className="absolute left-3 top-1/2 transform -translate-y-1/2" size={18} />
              </div>
            </div>
            <nav className="mt-1 flex-grow">
              {TABS_CONFIG.map(tab => (
                <button
                  key={tab.id}
                  onClick={() => { setActiveTab(tab.id); setCurrentPage(1); setSelectedMessage(null); }}
                  className={`flex items-center justify-between w-full px-4 py-3 text-left transition-colors duration-150 
                    ${activeTab === tab.id ? 'bg-primary-200/50 border-primary-800 dark:bg-gray-700 border-r-2 dark:border-gray-400' : 'hover:bg-primary-200/50 dark:hover:bg-gray-700'}`}
                >
                  <div className="flex items-center">
                    <span className={`mr-3 ${activeTab === tab.id ? 'text-primary-800 dark:text-white' : 'text-gray-600 dark:text-gray-300'}`}>{tab.icon}</span>
                    <span className={`${activeTab === tab.id ? 'font-semibold text-primary-800 dark:text-white' : 'text-gray-700 dark:text-gray-300'}`}>
                      {tab.label}
                    </span>
                  </div>
                      {tab.id === 'inbox' && tabCounts.inbox !== undefined && tabCounts.inbox > 0 && (
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${activeTab === tab.id ? 'bg-green-600 text-white' : 'bg-gray-200 dark:bg-gray-600 text-gray-600 dark:text-gray-300'
                      }`}>
                      {tabCounts.inbox}
                    </span>
                  )}
                </button>
              ))}
            </nav>
          </div>

            {/* Messages list and detail */}
            <div className="flex-1 flex flex-col md:flex-row overflow-hidden">

              {/* Messages list */}
              <div className={`w-full ${selectedMessage !== null ? 'hidden md:flex' : 'flex'} md:w-1/2 lg:w-2/5 border-r border-gray-200 dark:border-gray-700 flex-col max-h-full`}>
                <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center flex-shrink-0">
                  <h2 className="font-semibold text-primary-800 dark:text-white text-lg">{currentTabLabel}</h2>
                  <div className="text-sm text-gray-600 dark:text-gray-300">
                    {totalMessages > 0 ? `${(currentPage - 1) * ITEMS_PER_PAGE + 1}-${Math.min(currentPage * ITEMS_PER_PAGE, totalMessages)} de ${totalMessages}` : '0 mensajes'}
                  </div>
                </div>

                {listError && <div className="p-4 text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 text-center">{listError}</div>}
                {actionError && <div className="p-2 text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 text-center sticky top-0 z-10">{actionError}</div>}

                {/* Message detail */}
                {isLoadingList ? (
                  <div className="flex-1 flex items-center justify-center">
                    <Loader2Icon size={32} className="text-green-500 animate-spin" />
                  </div>
              ) : messages.length === 0 && !listError ? (
                <div className="flex-1 flex flex-col items-center justify-center text-gray-500 dark:text-gray-400 p-4">
                  <InboxIcon size={48} className="mb-3 text-gray-400 dark:text-gray-500" />
                  <p>No hay mensajes en {currentTabLabel.toLowerCase()}.</p>
                </div>
              ) : filteredMessages.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center text-gray-500 dark:text-gray-400 p-4 text-center">
                  <SearchIcon size={48} className="mb-3 text-gray-400 dark:text-gray-500" />
                  <p className="font-medium">No se encontraron resultados</p>
                  <p className="text-sm">Ningún mensaje en esta página coincide con tu búsqueda.</p>
                </div>
              ) : (
                <div className="overflow-y-auto flex-grow">
                  {filteredMessages.map(message => (
                    <div
                      key={message.id}
                      onClick={() => handleSelectMessage(message)}
                      className={`p-4 border-b border-gray-200 dark:border-gray-700 cursor-pointer relative group transition-colors duration-150 ${!message.isRead ? 'bg-green-50 dark:bg-green-900/20' : '' // Light cyan for unread
                        } ${selectedMessage?.id === message.id ? 'bg-green-100 dark:bg-green-900/30' : 'hover:bg-gray-50 dark:hover:bg-gray-700'}`}
                    >
                      {!message.isRead && (
                        <span className="absolute top-3 left-2 w-2 h-2 bg-green-600 rounded-full" title="No leído"></span>
                      )}
                      <div className="flex items-start">
                        <div className={`flex-shrink-0 h-10 w-10 rounded-full flex items-center justify-center mr-3 ${!message.isRead ? '' : ''}`}>
                          <IconWrapper icon={UserIcon} size={20} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <h3 className={`text-sm font-semibold text-gray-900 dark:text-white ${!message.isRead ? '' : ''}`}>
                              {message.senderName}
                            </h3>
                            <span className="text-xs whitespace-nowrap ml-2 text-gray-500 dark:text-gray-400">
                              {formatRelativeTime(message.createdAt)}
                            </span>
                          </div>
                          {message.propertyTitle &&
                            <p className="text-xs mt-0.5 truncate text-gray-600 dark:text-gray-300" title={message.propertyTitle}>
                              Propiedad: {message.propertyTitle}
                            </p>}
                          <p className={`text-sm mt-0.5 truncate text-gray-800 dark:text-gray-200 ${!message.isRead ? 'font-medium' : ''}`} title={message.subject}>
                            {message.subject}
                          </p>
                          <p className="text-xs mt-0.5 truncate text-gray-600 dark:text-gray-400" title={message.snippet}>
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
                    className="p-2 text-gray-500 hover:text-green-800 disabled:opacity-50 rounded-md hover:bg-gray-100"
                  >
                    <ChevronLeftIcon size={20} />
                  </button>
                  <span className="text-sm text-gray-600">Página {currentPage} de {totalPages}</span>
                  <button
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                    className="p-2 text-gray-500 hover:text-green-800 disabled:opacity-50 rounded-md hover:bg-gray-100"
                  >
                    <ChevronRightIcon size={20} />
                  </button>
                </div>
              )}
            </div>

            {/* Message detail */}
            <div className="flex-1 flex flex-col max-h-full">
              {isLoadingDetail ? (
                <div className="flex-1 flex items-center justify-center">
                  <Loader2Icon size={32} className="text-green-500 animate-spin" />
                </div>
              ) : selectedMessage ? (
                <>
                  <div className="p-4 md:p-6 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
                    <div className="flex justify-between items-center mb-1">
                      <button onClick={() => { setSelectedMessage(null); setThreadMessages([]); }} className="md:hidden p-2 -ml-2 text-gray-500 hover:text-[#1B4965]">
                        <ChevronLeftIcon size={20} /> Volver
                      </button>
                      <div className="flex space-x-1">
                        <button onClick={(e) => handleToggleStar(e, selectedMessage)} title={selectedMessage.isStarred ? "Quitar Destacado" : "Destacar"} className={`p-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors ${selectedMessage.isStarred ? 'text-yellow-500' : 'text-gray-500 hover:text-yellow-500'}`}>
                          {selectedMessage.isStarred ? <StarIcon size={20} fill="currentColor" /> : <StarIcon size={20} />}
                        </button>
                        {selectedMessage.isRead && (
                          <button onClick={(e) => handleMarkAsUnread(e, selectedMessage)} title="Marcar como no leído" className="p-2 text-gray-500 hover:text-green-800 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
                            <InboxIcon size={20} />
                          </button>
                        )}
                        <button onClick={(e) => handleToggleArchive(e, selectedMessage)} title={selectedMessage.isArchived ? "Desarchivar" : "Archivar"} className="p-2 text-gray-500 hover:text-green-800 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
                          <ArchiveIcon size={20} />
                        </button>
                        <button onClick={(e) => handleDeleteMessage(e, selectedMessage)} title="Eliminar" className="p-2 text-gray-500 hover:text-red-500 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
                          <TrashIcon size={20} />
                        </button>
                      </div>
                    </div>
                    <h1 className="text-xl font-semibold text-primary-800 dark:text-white mb-2">
                      {selectedMessage.subject}
                    </h1>
                    {selectedMessage.propertyTitle && selectedMessage.propertyId && (
                      <div className="flex items-center justify-between mb-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-md border border-gray-200 dark:border-gray-700">
                        <div className="text-sm text-gray-600 dark:text-gray-300">
                          Relacionado con la propiedad: <span className="font-medium text-primary-800 dark:text-white">{selectedMessage.propertyTitle}</span>
                        </div>
                        <button
                          onClick={() => window.open(`/dashboard/property/${selectedMessage.propertyId}`, '_blank')}
                          className="ml-4 bg-green-600 text-white px-4 py-2 rounded-md hover:opacity-90 transition-opacity flex items-center space-x-2 text-sm font-medium"
                        >
                          <ExternalLinkIcon size={16} />
                          <span>Ver Propiedad</span>
                        </button>
                      </div>
                    )}
                    {threadMessages.length > 1 && (
                      <div className="text-sm text-gray-500 dark:text-gray-400 mb-2">
                        {threadMessages.length} mensajes en esta conversación
                      </div>
                    )}
                  </div>
                  <div className="p-4 md:p-6 overflow-y-auto flex-grow max-h-[440px]">
                    {threadMessages.map((msg, index) => (
                      <div key={msg.id} className={`mb-6 ${index < threadMessages.length - 1 ? 'border-b border-gray-200 dark:border-gray-700 pb-6' : ''}`}>
                        <div className="flex items-center mb-3">
                          <div className="flex-shrink-0 h-10 w-10 rounded-full bg-green-100 dark:bg-gray-700 flex items-center justify-center text-green-800 dark:text-white mr-3">
                            <UserIcon size={20} />
                          </div>
                          <div className="flex-1">
                            <div className="font-medium text-primary-800 dark:text-white">{msg.senderName}</div>
                            {msg.senderEmail && <div className="text-sm text-gray-500 dark:text-gray-400">&lt;{msg.senderEmail}&gt;</div>}
                          </div>
                          <div className="text-sm text-gray-500 dark:text-gray-400">{formatRelativeTime(msg.createdAt)}</div>
                        </div>
                        {index === 0 && msg.subject && (
                          <div className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">{msg.subject}</div>
                        )}
                        <div className="text-gray-700 dark:text-gray-300 leading-relaxed whitespace-pre-wrap">
                          {msg.fullBody}
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="p-4 md:p-6 border-t border-gray-200 dark:border-gray-700 flex-shrink-0 bg-gray-50/70 dark:bg-gray-800/50">
                    <h2 className="font-medium text-[#1B4965] dark:text-white mb-3">Responder a {selectedMessage.senderName}</h2>
                    {replyError && <p className="text-sm text-red-500 mb-2">{replyError}</p>}
                    <textarea
                      placeholder="Escribe tu respuesta aquí..."
                      value={replyText}
                      onChange={(e) => setReplyText(e.target.value)}
                      className="w-full border border-gray-300 rounded-lg p-3 focus:outline-none focus:ring-1 focus:ring-green-500"
                      rows={4}
                      disabled={isSendingReply}
                    ></textarea>
                    <div className="flex justify-end mt-3">
                      <button
                        onClick={handleSendReply}
                        disabled={isSendingReply || !replyText.trim()}
                        className="bg-green-600 text-white px-5 py-2.5 rounded-md hover:opacity-90 transition-opacity disabled:opacity-60 flex items-center font-medium"
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
                <div className="flex-1 flex flex-col items-center justify-center p-6">
                  <InboxIcon size={48} className="mb-4" />
                  <p>Selecciona un mensaje para ver los detalles.</p>
                  <p className="text-sm">O comienza una nueva conversación.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}