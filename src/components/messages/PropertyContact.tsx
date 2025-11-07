import React, { useState, useEffect, useCallback } from 'react';
import { Send } from 'lucide-react';
import { ThreadType, MessageSample } from '../../data/MessagesData';
import QuestionThread from './QuestionThread';
import { Button, Card, Label, Textarea } from 'flowbite-react';
import messageService, { Message } from '../../services/MessageService';
import { useSelector } from 'react-redux';
import { RootState } from '../../store/store';
import { useNavigate } from 'react-router-dom';

interface PropertyContactProps {
  propertyId?: string;
  ownerId?: string;
}

function PropertyContact({ propertyId, ownerId }: PropertyContactProps) {
  const user = useSelector((state: RootState) => state.user.profile);
  const navigate = useNavigate();
  const [threads, setThreads] = useState<ThreadType[]>([]);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [messagesError, setMessagesError] = useState<string | null>(null);
  
  // State to track which thread's reply form is open
  const [replyingToId, setReplyingToId] = useState<string | null>(null);
  const [isSubmittingReply, setIsSubmittingReply] = useState(false);
  const [replyError, setReplyError] = useState<string | null>(null);
  const [replySuccess, setReplySuccess] = useState(false);

  // State for the "Ask a New Question" form
  const [newQuestionText, setNewQuestionText] = useState('');
  const [isSubmittingQuestion, setIsSubmittingQuestion] = useState(false);
  const [questionError, setQuestionError] = useState<string | null>(null);
  const [questionSuccess, setQuestionSuccess] = useState(false);

  // Transform API Message[] to ThreadType[] format
  const transformMessagesToThreads = useCallback((messages: Message[]): ThreadType[] => {
    if (!messages || messages.length === 0) {
      return [];
    }

    const uniqueMessagesMap = new Map<string, Message>();
    messages.forEach(message => {
      if (!uniqueMessagesMap.has(message.id)) {
        uniqueMessagesMap.set(message.id, message);
      }
    });
    const deduplicatedMessages = Array.from(uniqueMessagesMap.values());

    // Group messages by threadId, or use message id as threadId if no threadId exists
    const threadMap = new Map<string, Message[]>();
    
    deduplicatedMessages.forEach(message => {
      // Use threadId if available, otherwise use message id as the thread identifier
      const threadKey = message.threadId || message.id;
      
      if (!threadMap.has(threadKey)) {
        threadMap.set(threadKey, []);
      }
      threadMap.get(threadKey)!.push(message);
    });

    // Convert grouped messages to ThreadType format
    const transformedThreads: ThreadType[] = [];
    
    threadMap.forEach((threadMessages, threadKey) => {
      // Sort messages by creation time (oldest first)
      const sortedMessages = [...threadMessages].sort((a, b) => 
        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      );

      // Transform messages to MessageSample format
      const transformedMessages: MessageSample[] = sortedMessages.map((msg, index) => {
        // Determine if message is from owner: check if senderId matches property ownerId
        // Also, messages with recipientId are replies (from owner to visitor)
        const isOwner = ownerId ? (msg.senderId === ownerId) : (index > 0 || !!msg.recipientId);
        
        return {
          id: msg.id,
          sender: isOwner ? 'owner' : 'visitor',
          senderName: msg.senderName,
          avatarUrl: undefined, // API doesn't provide avatarUrl, can be enhanced later
          text: msg.snippet || msg.subject, // Use snippet or subject as text
          timestamp: msg.createdAt,
          // Store original message data for reply functionality
          ...(msg.senderId && { senderId: msg.senderId }),
        } as MessageSample & { senderId?: string };
      });

      transformedThreads.push({
        id: threadKey,
        messages: transformedMessages,
      });
    });

    // Sort threads by the most recent message (newest first)
    return transformedThreads.sort((a, b) => {
      const aLatest = a.messages[a.messages.length - 1];
      const bLatest = b.messages[b.messages.length - 1];
      return new Date(bLatest.timestamp).getTime() - new Date(aLatest.timestamp).getTime();
    });
  }, [ownerId]);

  // Fetch messages for the property
  const fetchMessages = useCallback(async () => {
    if (!propertyId) {
      setThreads([]);
      return;
    }

    setIsLoadingMessages(true);
    setMessagesError(null);

    try {
      const messages = await messageService.getMessagesByPropertyId(propertyId);
      const transformedThreads = transformMessagesToThreads(messages);
      setThreads(transformedThreads);
    } catch (error: any) {
      console.error('Error fetching messages:', error);
      setMessagesError(error.message || 'Failed to load messages.');
      setThreads([]);
    } finally {
      setIsLoadingMessages(false);
    }
  }, [propertyId, transformMessagesToThreads]);

  // Fetch messages when propertyId changes
  useEffect(() => {
    fetchMessages();
  }, [fetchMessages]);

  const handleNewQuestionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Check if user is authenticated
    if (!user) {
      return; // Form is disabled when not authenticated
    }
    
    if (!propertyId) {
      setQuestionError('Property ID is required to send a question.');
      return;
    }

    setIsSubmittingQuestion(true);
    setQuestionError(null);
    setQuestionSuccess(false);

    try {
      await messageService.sendMessage({
        propertyId: propertyId,
        subject: `Question about property`,
        body: newQuestionText
      });
      
      setQuestionSuccess(true);
      setNewQuestionText('');
      
      // Refresh messages to show the new question
      await fetchMessages();
      
      setTimeout(() => setQuestionSuccess(false), 3000);
    } catch (error: any) {
      const errorMessage = error.message || 'Failed to send question. Please try again.';
      setQuestionError(errorMessage);
      console.error('Error sending question:', error);
    } finally {
      setIsSubmittingQuestion(false);
    }
  };

  const handleReplySubmit = async (threadId: string, replyText: string) => {
    // Check if user is authenticated
    if (!user) {
      return; // Form is disabled when not authenticated
    }
    
    if (!propertyId) {
      setReplyError('Property ID is required to send a reply.');
      return;
    }

    setIsSubmittingReply(true);
    setReplyError(null);
    setReplySuccess(false);

    try {
      const thread = threads.find(t => t.id === threadId);
      if (!thread) {
        throw new Error('Thread not found.');
      }

      const question = thread.messages[0];
      if (!question) {
        throw new Error('Question not found in thread.');
      }

      const replyData: any = {
        propertyId: propertyId,
        subject: `Re: Question about property`,
        body: replyText,
      };

      if ((question as any).senderId) {
        replyData.recipientId = (question as any).senderId;
      }
      if ((question as any).id) {
        replyData.inReplyToMessageId = (question as any).id;
      }
      if (threadId) {
        replyData.threadId = threadId;
      }

      await messageService.sendMessage(replyData);
      
      setReplySuccess(true);
      setReplyingToId(null);
      
      // Refresh messages to show the new reply
      await fetchMessages();
      
      // Clear success message after 3 seconds
      setTimeout(() => setReplySuccess(false), 3000);
    } catch (error: any) {
      const errorMessage = error.message || 'Failed to send reply. Please try again.';
      setReplyError(errorMessage);
      console.error('Error sending reply:', error);
    } finally {
      setIsSubmittingReply(false);
    }
  };

  const handleReplyClick = (threadId: string) => {
    // Check if user is authenticated before allowing reply
    if (!user) {
      return;
    }
    // If clicking the same reply button, close it. Otherwise, open the new one.
    setReplyingToId(prevId => (prevId === threadId ? null : threadId));
  };

  const isAuthenticated = !!user;

  return (
    <Card className='p-3'>
      <h2 className="text-2xl font-bold">Preguntas y respuestas</h2>

      {/* Form for asking a brand new question */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
          <div className="relative mt-8">
            <div className="max-h-[600px] overflow-y-scroll-auto rounded-lg">
              {messagesError && (
                <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded-lg text-sm">
                  {messagesError}
                </div>
              )}
              {replyError && (
                <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded-lg text-sm">
                  {replyError}
                </div>
              )}
              {replySuccess && (
                <div className="mb-4 p-3 bg-green-100 border border-green-400 text-green-700 rounded-lg text-sm">
                  Reply sent successfully!
                </div>
              )}
              {isLoadingMessages ? (
                <div className="text-center py-8 text-gray-500">
                  Loading messages...
                </div>
              ) : threads.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-lg font-light">Sé el primero en dejar un mensaje para esta propiedad!</p>
                </div>
              ) : (
                threads.map(thread => (
                  <QuestionThread
                    key={thread.id}
                    thread={thread}
                    ownerId={ownerId}
                    isReplying={replyingToId === thread.id}
                    isSubmitting={isSubmittingReply && replyingToId === thread.id}
                    onReplyClick={() => handleReplyClick(thread.id)}
                    onReplySubmit={handleReplySubmit}
                  />
                ))
              )}
            </div>
            <div className="pointer-events-none absolute bottom-0 h-20 w-full bg-gradient-to-t from-white to-transparent shadow-lg dark:from-gray-800" />
          </div>

        {/* List of existing Q&A threads */}
          <form onSubmit={handleNewQuestionSubmit} className="mt-6 p-4 relative">
            {/* Blurred overlay when not authenticated */}
            {!isAuthenticated && (
              <div className="absolute inset-0 bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm z-10 rounded-lg flex flex-col items-center justify-center p-6">
                <p className="text-center text-gray-700 dark:text-gray-300 mb-6 text-lg">
                  Por favor, inicia sesión o regístrate para enviar un mensaje.
                </p>
                <div className="flex gap-4">
                  <Button color="blue" onClick={() => navigate('/login')}>
                    Iniciar sesión
                  </Button>
                  <Button color="green" onClick={() => navigate('/register')}>
                    Registrarse
                  </Button>
                </div>
              </div>
            )}
            
            <h3 className="font-semibold text-center">¿Tenés una pregunta para el propietario?</h3>
            {user?.email && (
              <p className="text-sm text-gray-500 text-center mt-2">
                Sending as: {user.email}
              </p>
            )}
            {questionError && (
              <div className="mt-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded-lg text-sm">
                {questionError}
              </div>
            )}
            {questionSuccess && (
              <div className="mt-4 p-3 bg-green-100 border border-green-400 text-green-700 rounded-lg text-sm">
                Question sent successfully!
              </div>
            )}
            <div className="mt-4 grid grid-cols-1 gap-4 max-w-lg mx-auto">
              <div className='mb-2'>
                <div className='mb-2'>
                  <Label htmlFor="question">Tu pregunta</Label>
                </div>
                <Textarea
                  id="question"
                  value={newQuestionText}
                  onChange={(e) => setNewQuestionText(e.target.value)}
                  rows={2}
                  className='max-h-64'
                  placeholder="e.g., Is there air conditioning in every room?"
                  required
                  disabled={isSubmittingQuestion || !isAuthenticated}
                />
              </div>
            </div>
            <div className="flex justify-center mt-6">
              <Button type="submit" color="green" disabled={isSubmittingQuestion || !isAuthenticated}>
                <Send className='mr-2' size={18} />
                <span>{isSubmittingQuestion ? 'Enviando...' : 'Preguntar'}</span>
              </Button>
            </div>
          </form>
        </div>

    </Card>
  );
}

export default PropertyContact;