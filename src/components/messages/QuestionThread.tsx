import React, { useState } from 'react';
import { MessageSquare, CornerDownRight } from 'lucide-react';
import UserAvatar from './UserAvatar'; // Re-using the avatar from the previous design
import { Badge, Button, Textarea } from 'flowbite-react';
import { MessageSample, ThreadType } from '../../data/MessagesData';

// Helper component for displaying a single message (question or answer)
const MessageDisplay = ({ message, ownerId }: { message: MessageSample & { senderId?: string }; ownerId?: string }) => {
  const messageSenderId = (message as any).senderId;
  const isOwner = ownerId ? (messageSenderId === ownerId) : (message.sender === 'owner');
  const formatDate = (dateString: string) => new Date(dateString).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });

  return (
    <div className="flex items-start space-x-4">
      <UserAvatar name={message.senderName} avatarUrl={message.avatarUrl} />
      <div className="flex-grow">
        <div className="flex items-center space-x-2">
          <p className="font-semibold">{message.senderName}</p>
          {isOwner && (
            <Badge 
              color='green'>
              Property Owner
            </Badge>
          )}
        </div>
        <p className="text-sm">
          {isOwner ? 'Answered' : 'Asked'} on {formatDate(message.timestamp)}
        </p>
        <p className="mt-2">{message.text}</p>
      </div>
    </div>
  );
};

interface Props {
  thread: ThreadType;
  ownerId?: string;
  isReplying: boolean;
  isSubmitting?: boolean;
  onReplyClick: () => void;
  onReplySubmit: (threadId: string, replyText: string) => void;
}

function QuestionThread({ thread, ownerId, isReplying, isSubmitting = false, onReplyClick, onReplySubmit }: Props) {
  const [replyText, setReplyText] = useState('');
  const question = thread.messages[0];
  const answer = ownerId 
    ? thread.messages.find((msg: any) => (msg as any).senderId === ownerId)
    : thread.messages.find((msg : any) => msg.sender === 'owner');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (replyText.trim()) {
      onReplySubmit(thread.id, replyText);
      setReplyText('');
    }
  };

  return (
    <div className="border-b border-gray-200 dark:border-gray-600 p-6">
      {/* The original question */}
      <MessageDisplay message={question} ownerId={ownerId} />

      {/* The owner's answer */}
      {answer && (
        <div className="mt-4 pl-8 md:pl-16 relative">
          <CornerDownRight className="absolute left-2 md:left-6 top-3 h-5 w-5 text-gray-400" />
          <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg">
            <MessageDisplay message={answer} ownerId={ownerId} />
          </div>
        </div>
      )}

      {/* Reply button or Reply Form */}
      {!answer && (
        <div className="mt-4 pl-8 md:pl-16">
          {!isReplying ? (
            <button
              onClick={onReplyClick}
              className="flex items-center space-x-2 text-sm font-semibold text-green-400 hover:text-green-600 transition-colors"
            >
              <MessageSquare size={16} />
              <span>Responder en el hilo</span>
            </button>
          ) : (
            <form onSubmit={handleSubmit} className="mt-2 mb-8">
              <Textarea
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                placeholder="Type your answer..."
                rows={3}
                required
                disabled={isSubmitting}
              />
              <div className="flex justify-end space-x-2 mt-2">
                 <Button 
                  color="alternative"
                  onClick={onReplyClick}
                  disabled={isSubmitting}>
                   Cancel
                 </Button>
                 <Button 
                  type="submit"
                  color="green"
                  disabled={isSubmitting || !replyText.trim()}>
                   {isSubmitting ? 'Enviando...' : 'Submit Reply'}
                 </Button>
              </div>
            </form>
          )}
        </div>
      )}
    </div>
  );
}

export default QuestionThread;